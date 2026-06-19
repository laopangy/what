import { Router } from "express";
import { createRequire } from "module";
import { runNcm } from "../services/ncmExecutor.js";
import { notifyPlaybackChange } from "../services/wsManager.js";
import { normalizeState } from "../services/stateTransform.js";
import * as mpv from "../services/mpvController.js";
import { config } from "../config.js";
import { isLoggedIn, getLoginQr } from "../services/authHelper.js";
import { z } from "zod";
const require = createRequire(import.meta.url);
const { song_url } = require("NeteaseCloudMusicApi");
const { playlist_detail, song_detail } = require("NeteaseCloudMusicApi");

function isHex32(s: string): boolean {
  return /^[0-9a-fA-F]{32}$/.test(s);
}

interface SongUrlEntry {
  url?: string | null;
  type?: string | null;
  size?: number;
  freeTrialInfo?: { start: number; end: number } | null;
}

async function getSongUrl(songId: number): Promise<{
  url: string;
  isTrial: boolean;
  bitrate: number;
} | null> {
  // Try bitrates from highest to lowest (VIP accounts get higher quality)
  const bitrates = [320000, 999000, 192000, 128000];
  // Use cookie as-is if it already contains MUSIC_U= or other cookie fields
  const cookieStr = config.netease.cookie || undefined;

  let trialFallback: { url: string; bitrate: number } | null = null;

  for (const br of bitrates) {
    try {
      const opts: Record<string, unknown> = { id: String(songId), br };
      if (cookieStr) opts.cookie = cookieStr;
      const result = await song_url(opts);
      const body = result.body as { data?: SongUrlEntry[] };
      const entry = body.data?.[0];

      if (!entry?.url) continue;

      const trialEnd = entry.freeTrialInfo?.end;
      if (trialEnd && trialEnd <= 60) {
        // Save first trial URL as fallback, keep trying lower bitrates
        if (!trialFallback) trialFallback = { url: entry.url, bitrate: br };
        continue;
      }

      return { url: entry.url, isTrial: false, bitrate: br };
    } catch {
      continue;
    }
  }

  // All full versions failed — fall back to trial (30s preview) if available
  if (trialFallback) {
    return { url: trialFallback.url, isTrial: true, bitrate: trialFallback.bitrate };
  }

  return null;
}

export const playbackRouter = Router();

/** Check login and optionally return QR code. Returns null if logged in, or a needLogin response. */
async function gateLogin(): Promise<{ needLogin: true; qrKey: string; qrimg: string; message: string } | null> {
  const status = await isLoggedIn();
  if (status.loggedIn) return null;
  const qr = await getLoginQr();
  return {
    needLogin: true,
    qrKey: qr?.qrKey || "",
    qrimg: qr?.qrimg || "",
    message: qr?.message || "请先登录网易云音乐",
  };
}

playbackRouter.get("/state", async (_req, res, next) => {
  try {
    // Get playback state from mpv directly (more reliable than ncm-cli)
    const mpvState = await mpv.getFullState();
    if (mpvState && mpvState.filename) {
      const meta = mpv.getCurrentMeta();
      res.json({
        success: true,
        data: {
          playing: mpvState.playing,
          song: {
            id: mpvState.songId,
            name: mpvState.filename,
            artist: meta?.artist || "",
            duration: mpvState.duration,
            position: mpvState.position,
          },
          volume: mpvState.volume,
        },
      });
      return;
    }
    if (mpvState) {
      // mpv running but no metadata yet
      res.json({
        success: true,
        data: {
          playing: mpvState.playing,
          volume: mpvState.volume,
        },
      });
      return;
    }

    // Fallback to ncm-cli if mpv is not running
    const result = await runNcm("state");
    if (result.success && result.data) {
      result.data = normalizeState(result.data) as unknown;
    }
    res.json(result);
  } catch (e) { next(e); }
});

playbackRouter.post("/play-songs", async (req, res, next) => {
  try {
    const loginGate = await gateLogin();
    if (loginGate) { res.json({ success: false, ...loginGate }); return; }

    const body = z.object({
      songs: z.array(z.object({
        encryptedId: z.string().optional(),
        originalId: z.number().optional(),
        name: z.string().optional(),
        artist: z.string().optional(),
        duration: z.number().optional(),
      })),
    }).parse(req.body);

    if (body.songs.length === 0) { res.json({ success: false, error: "歌曲列表为空" }); return; }

    const MAX = 200;
    const selected = body.songs.slice(0, MAX);
    const trackList: Array<{ songId: string; url: string; name: string; artist: string; duration: number }> = [];

    const BATCH = 5;
    for (let i = 0; i < selected.length; i += BATCH) {
      const batch = selected.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (s) => {
        let id = s.originalId || null;
        if (!id && s.encryptedId) {
          const p = parseInt(s.encryptedId, 16);
          if (!Number.isNaN(p)) id = p;
        }
        if (!id) return null;
        const urlR = await getSongUrl(id);
        return urlR ? { songId: String(id), url: urlR.url, name: s.name || "", artist: s.artist || "", duration: (s.duration || 0) / 1000 } : null;
      }));
      for (const r of results) { if (r) trackList.push(r); }
    }

    if (trackList.length === 0) { res.json({ success: false, error: "没有可播放的歌曲" }); return; }

    mpv.setPlaylistTracks(trackList);
    const ok = await mpv.playPlaylist(trackList);
    if (!ok) { res.json({ success: false, error: "无法启动播放器" }); return; }

    notifyPlaybackChange();
    res.json({ success: true, data: { message: `开始播放（${trackList.length}/${selected.length} 首可播放）` } });
  } catch (e) { next(e); }
});

playbackRouter.post("/play-song", async (req, res, next) => {
  try {
    // Check login first
    const loginGate = await gateLogin();
    if (loginGate) { res.json({ success: false, ...loginGate }); return; }

    const body = z.object({
      encryptedId: z.string().optional(),
      originalId: z.number().optional(),
      name: z.string().optional(),
      artist: z.string().optional(),
      duration: z.number().optional(),
    }).parse(req.body);

    // Determine numeric song ID (parseInt handles 32-char hex, Number() does not)
    let numericId: number | null = body.originalId || null;
    if (!numericId && body.encryptedId) {
      const n = parseInt(body.encryptedId, 16);
      if (!Number.isNaN(n)) numericId = n;
    }

    if (!numericId) {
      res.json({ success: false, error: "无法确定歌曲ID" });
      return;
    }

    // Store metadata from client (preferred) or from ncm-cli search
    if (body.name) {
      mpv.setCurrentMeta({
        songId: String(numericId),
        name: body.name,
        artist: body.artist || "",
        duration: body.duration || 0,
      });
    } else {
      // Fallback: get metadata from NeteaseCloudMusicApi
      try {
        const detailResult = await song_detail({ ids: String(numericId) });
        const detailBody = detailResult.body as {
          code?: number;
          songs?: Array<{ name: string; ar?: Array<{ name: string }>; dt?: number }>;
        };
        const song = detailBody?.songs?.[0];
        if (song) {
          mpv.setCurrentMeta({
            songId: String(numericId),
            name: song.name,
            artist: (song.ar || []).map(a => a.name).join(" / "),
            duration: (song.dt || 0) / 1000,
          });
        }
      } catch { /* optional */ }
    }

    // Get playable URL via NeteaseCloudMusicApi (with cookie for VIP songs)
    const songUrlResult = await getSongUrl(numericId);
    if (!songUrlResult) {
      // Distinguish between "no URL at all" and "only trial available"
      const hasCookie = !!config.netease.cookie;
      res.json({
        success: false,
        error: hasCookie
          ? "无法获取该歌曲的播放地址（歌曲可能已下架或版权受限）"
          : "无法获取歌曲完整播放地址（VIP 歌曲需在 .env 中配置 NETEASE_COOKIE，否则只能试听 30 秒）",
      });
      return;
    }

    // Play via mpv directly (playUrl clears old playlist)
    const ok = await mpv.playUrl(songUrlResult.url);
    // Set single-song metadata AFTER playUrl clears old tracks
    const meta = mpv.getCurrentMeta();
    if (meta) mpv.setPlaylistTracks([{ ...meta, url: songUrlResult.url }]);
    if (!ok) {
      res.json({ success: false, error: "无法启动 mpv 播放器" });
      return;
    }

    notifyPlaybackChange();
    res.json({
      success: true,
      data: {
        message: songUrlResult.isTrial ? "试听模式（30秒）" : "开始播放",
        bitrate: songUrlResult.bitrate,
      },
    });
  } catch (e) { next(e); }
});

playbackRouter.post("/play-playlist", async (req, res, next) => {
  try {
    // Check login first
    const loginGate = await gateLogin();
    if (loginGate) { res.json({ success: false, ...loginGate }); return; }

    const body = z.object({
      encryptedId: z.string().optional(),
      originalId: z.number().optional(),
    }).parse(req.body);

    // Convert hex or numeric string to number (Number() fails on 32-char hex)
    let playlistId = body.originalId || null;
    if (!playlistId && body.encryptedId) {
      const parsed = parseInt(body.encryptedId, 16);
      if (!Number.isNaN(parsed)) playlistId = parsed;
    }
    if (!playlistId) {
      res.json({ success: false, error: "无法确定歌单ID" });
      return;
    }

    // Build cookie string for API calls
    const cookieOpts: Record<string, unknown> = {};
    if (config.netease.cookie) {
      cookieOpts.cookie = config.netease.cookie;
    }

    // 1. Get playlist info (track IDs)
    const plResult = await playlist_detail({ id: String(playlistId), ...cookieOpts });
    const plBody = plResult.body as {
      code?: number;
      playlist?: { trackIds?: Array<{ id: number }>; name?: string };
    };
    const trackIds = plBody?.playlist?.trackIds;
    if (!trackIds || trackIds.length === 0) {
      res.json({ success: false, error: "歌单为空或无法获取" });
      return;
    }

    // 2. Get song details (max 500 tracks for performance)
    const MAX_TRACKS = 500;
    const selectedIds = trackIds.slice(0, MAX_TRACKS).map((t) => t.id);
    const songResult = await song_detail({ ids: selectedIds.join(","), ...cookieOpts });
    const songBody = songResult.body as {
      songs?: Array<{
        id: number;
        name: string;
        ar?: Array<{ name: string }>;
        dt?: number;
      }>;
    };
    const songs = songBody?.songs || [];

    // 3. Resolve playable URLs with cookie (parallel, but limited concurrency)
    const trackList: Array<{ songId: string; url: string; name: string; artist: string; duration: number }> = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < songs.length; i += BATCH_SIZE) {
      const batch = songs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (song) => {
          const urlResult = await getSongUrl(song.id);
          return urlResult
              ? {
                songId: String(song.id),
                url: urlResult.url,
                name: song.name,
                artist: (song.ar || []).map((a) => a.name).join(" / "),
                duration: (song.dt || 0) / 1000,
              }
            : null;
        }),
      );
      for (const r of results) {
        if (r) trackList.push(r);
      }
    }

    if (trackList.length === 0) {
      res.json({ success: false, error: "歌单中没有可播放的歌曲" });
      return;
    }

    // 4. Save playlist metadata for queue display
    mpv.setPlaylistTracks(trackList);

    // 5. Play via mpv
    const ok = await mpv.playPlaylist(trackList);
    if (!ok) {
      res.json({ success: false, error: "无法启动 mpv 播放器" });
      return;
    }

    notifyPlaybackChange();
    res.json({
      success: true,
      data: {
        message: `开始播放歌单（${trackList.length}/${songs.length} 首可播放）`,
        totalTracks: songs.length,
        playableTracks: trackList.length,
      },
    });
  } catch (e) { next(e); }
});

const simpleActions: Record<string, () => Promise<boolean>> = {
  pause: () => mpv.pause(),
  resume: () => mpv.resume(),
  stop: () => mpv.stop(),
  next: () => mpv.next(),
  prev: () => mpv.prev(),
};

for (const [action, fn] of Object.entries(simpleActions)) {
  playbackRouter.post(`/${action}`, async (_req, res, next) => {
    try {
      const ok = await fn();
      notifyPlaybackChange();
      res.json({ success: ok });
    } catch (e) { next(e); }
  });
}

playbackRouter.post("/seek", async (req, res, next) => {
  try {
    const { seconds } = z.object({ seconds: z.number() }).parse(req.body);
    const ok = await mpv.seek(seconds);
    notifyPlaybackChange();
    res.json({ success: ok });
  } catch (e) { next(e); }
});

playbackRouter.post("/volume", async (req, res, next) => {
  try {
    const { level } = z.object({ level: z.number().min(0).max(100) }).parse(req.body);
    const ok = await mpv.setVolume(level);
    notifyPlaybackChange();
    res.json({ success: ok });
  } catch (e) { next(e); }
});

playbackRouter.post("/shuffle", async (_req, res, next) => {
  try {
    const ok = await mpv.shufflePlaylist();
    notifyPlaybackChange();
    res.json({ success: ok });
  } catch (e) { next(e); }
});

playbackRouter.post("/loop", async (req, res, next) => {
  try {
    const { mode } = z.object({ mode: z.enum(["none", "single", "list"]) }).parse(req.body);
    const ok = await mpv.setLoop(mode);
    res.json({ success: ok });
  } catch (e) { next(e); }
});

playbackRouter.get("/queue", async (_req, res, next) => {
  try {
    const items = await mpv.getPlaylist();
    res.json({ success: true, data: items });
  } catch (e) { next(e); }
});

playbackRouter.post("/queue/remove", async (req, res, next) => {
  try {
    const { index } = z.object({ index: z.number().min(0) }).parse(req.body);
    const ok = await mpv.removeFromPlaylist(index);
    res.json({ success: ok });
  } catch (e) { next(e); }
});

playbackRouter.post("/queue/add", async (req, res, next) => {
  try {
    const body = z.object({
      encryptedId: z.string().optional(),
      originalId: z.number().optional(),
      name: z.string().optional(),
      artist: z.string().optional(),
    }).parse(req.body);

    let songId = body.originalId || null;
    if (!songId && body.encryptedId) {
      const parsed = parseInt(body.encryptedId, 16);
      if (!Number.isNaN(parsed)) songId = parsed;
    }
    if (!songId) { res.json({ success: false, error: "无法确定歌曲ID" }); return; }

    const urlResult = await getSongUrl(songId);
    if (!urlResult) { res.json({ success: false, error: "无法获取播放地址" }); return; }

    // Append to mpv playlist
    await mpv.ensureMpv();
    await mpv.appendToPlaylist(urlResult.url);
    // Track metadata
    const tracks = await mpv.getPlaylist();
    mpv.setPlaylistTracks([
      ...tracks,
      { songId: String(songId), url: urlResult.url, name: body.name || "未知歌曲", artist: body.artist || "" },
    ]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

playbackRouter.post("/queue/clear", async (_req, res, next) => {
  try {
    await mpv.stop();
    mpv.setPlaylistTracks([]);
    res.json({ success: true });
  } catch (e) { next(e); }
});
