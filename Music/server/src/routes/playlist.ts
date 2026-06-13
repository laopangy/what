import { Router } from "express";
import { z } from "zod";
import { createRequire } from "module";
import { config } from "../config.js";
const require = createRequire(import.meta.url);
const {
  user_playlist,
  playlist_detail,
  playlist_track_all,
  playlist_create,
  playlist_tracks, // default crypto (cookie auth), NOT playlist_track_add (weapi)
} = require("NeteaseCloudMusicApi");

type ApiFn = (opts: Record<string, unknown>) => Promise<{ body: unknown }>;

export const playlistRouter = Router();

function getCookie(): string | undefined {
  return config.netease.cookie || undefined;
}

/** NeteaseCloudMusicApi needs numeric IDs — hex string → decimal */
function toNumeric(id: string): string {
  if (/^[0-9a-fA-F]{32}$/.test(id)) return String(parseInt(id, 16));
  return id;
}

let cachedUid: string | null = null;

async function getUserId(): Promise<string> {
  if (cachedUid) return cachedUid;
  const cookie = getCookie();
  if (!cookie) return "";
  try {
    const { user_account } = require("NeteaseCloudMusicApi");
    const r = await (user_account as ApiFn)({ cookie });
    const body = r.body as { code?: number; profile?: { userId?: number }; account?: { id?: number } };
    const uid = body?.profile?.userId || body?.account?.id;
    cachedUid = uid ? String(uid) : "";
  } catch { /* ignore */ }
  return cachedUid || "";
}

interface RawSong {
  id: number;
  name: string;
  dt?: number;
  ar?: Array<{ id: number; name: string }>;
  al?: { id: number; name: string; picUrl?: string };
}

function mapSong(raw: RawSong) {
  return {
    id: Number(raw.id).toString(16).padStart(32, "0"),
    originalId: raw.id,
    name: raw.name,
    duration: (raw.dt || 0) / 1000,
    artists: (raw.ar || []).map((a) => ({ name: a.name, id: String(a.id) })),
    album: {
      name: raw.al?.name || "",
      id: String(raw.al?.id || ""),
      coverUrl: raw.al?.picUrl || "",
    },
    coverImgUrl: raw.al?.picUrl || "",
  };
}

function mapPlaylistItem(raw: Record<string, unknown>) {
  return {
    id: Number(raw.id).toString(16).padStart(32, "0"),
    originalId: raw.id as number,
    name: raw.name as string,
    description: raw.description as string | undefined,
    coverUrl: (raw.coverImgUrl || raw.picUrl) as string | undefined,
    trackCount: raw.trackCount as number | undefined,
    playCount: raw.playCount as number | undefined,
    creator: raw.creator as { nickname: string } | undefined,
  };
}

playlistRouter.get("/created", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) {
      res.json({ success: false, needLogin: true, message: "需要登录才能查看歌单" });
      return;
    }
    const limit = Number(req.query.limit) || 50;
    const result = await (user_playlist as ApiFn)({ uid: (req.query.uid as string) || await getUserId(), cookie });
    const body = result.body as { code?: number; playlist?: Array<Record<string, unknown>> };
    if (body.code !== 200 || !body.playlist) {
      res.json({ success: false, error: "获取歌单失败" });
      return;
    }
    // Filter to only created playlists (not collected), limit
    const created = body.playlist
      .filter((p) => !p.subscribed)
      .slice(0, limit)
      .map(mapPlaylistItem);
    res.json({ success: true, data: created });
  } catch (e) { next(e); }
});

playlistRouter.get("/collected", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) {
      res.json({ success: false, needLogin: true, message: "需要登录才能查看收藏歌单" });
      return;
    }
    const limit = Number(req.query.limit) || 50;
    const result = await (user_playlist as ApiFn)({ uid: (req.query.uid as string) || await getUserId(), cookie });
    const body = result.body as { code?: number; playlist?: Array<Record<string, unknown>> };
    if (body.code !== 200 || !body.playlist) {
      res.json({ success: false, error: "获取收藏歌单失败" });
      return;
    }
    // Filter to only subscribed/collected playlists
    const collected = body.playlist
      .filter((p) => p.subscribed)
      .slice(0, limit)
      .map(mapPlaylistItem);
    res.json({ success: true, data: collected });
  } catch (e) { next(e); }
});

playlistRouter.get("/:id", async (req, res, next) => {
  try {
    const cookie = getCookie();
    const opts: Record<string, unknown> = { id: toNumeric(req.params.id) };
    if (cookie) opts.cookie = cookie;
    const result = await playlist_detail(opts);
    const body = result.body as { code?: number; playlist?: Record<string, unknown> };
    if (body.code !== 200 || !body.playlist) {
      res.json({ success: false, error: "获取歌单详情失败" });
      return;
    }
    res.json({ success: true, data: mapPlaylistItem(body.playlist) });
  } catch (e) { next(e); }
});

playlistRouter.get("/:id/tracks", async (req, res, next) => {
  try {
    const cookie = getCookie();
    const limit = Number(req.query.limit) || 50;
    const opts: Record<string, unknown> = { id: toNumeric(req.params.id), limit };
    if (cookie) opts.cookie = cookie;
    const result = await playlist_track_all(opts);
    const body = result.body as { code?: number; songs?: RawSong[] };
    if (body.code !== 200) {
      res.json({ success: false, error: "获取歌单歌曲失败" });
      return;
    }
    const songs = (body.songs || []).slice(0, limit).map(mapSong);
    res.json({ success: true, data: songs });
  } catch (e) { next(e); }
});

playlistRouter.post("/create", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) {
      res.json({ success: false, needLogin: true, message: "需要登录才能创建歌单" });
      return;
    }
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const result = await playlist_create({ name, cookie });
    const body = result.body as { code?: number; id?: number; playlist?: Record<string, unknown> };
    if (body.code !== 200) {
      res.json({ success: false, error: "创建歌单失败" });
      return;
    }
    res.json({ success: true, data: body.playlist ? mapPlaylistItem(body.playlist) : { id: body.id } });
  } catch (e) { next(e); }
});

playlistRouter.post("/add-songs", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) {
      res.json({ success: false, needLogin: true, message: "需要登录才能添加歌曲" });
      return;
    }
    const { playlistId, songIds } = z.object({
      playlistId: z.string().min(1),
      songIds: z.array(z.string()).min(1),
    }).parse(req.body);
    // Convert hex IDs to numeric if needed
    const numericIds = songIds.map((id) => {
      const n = parseInt(id, 16);
      return isNaN(n) ? id : String(n);
    });
    const result = await playlist_tracks({
      op: "add",
      pid: toNumeric(playlistId),
      tracks: numericIds.join(","), // playlist_tracks uses default crypto, cookie auth works
      cookie,
    });
    const body = result.body as { code?: number };
    res.json({ success: body.code === 200, data: { code: body.code } });
  } catch (e) { next(e); }
});
