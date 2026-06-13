import { Router } from "express";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { search } = require("NeteaseCloudMusicApi");

export const searchRouter = Router();

interface NcmSong {
  id: number;
  name: string;
  duration: number;
  artists: { id: number; name: string; img1v1Url?: string }[];
  album: { id: number; name: string; picUrl?: string };
}

interface NcmPlaylist {
  id: number;
  name: string;
  description?: string | null;
  coverImgUrl?: string;
  trackCount?: number;
  playCount?: number;
  creator?: { nickname: string; userId?: number; avatarUrl?: string };
}

function toHexId(numId: number): string {
  return numId.toString(16).padStart(32, "0");
}

function mapSong(raw: NcmSong) {
  return {
    id: toHexId(raw.id),                          // 32-char hex encrypted ID
    originalId: raw.id,                            // numeric original ID
    name: raw.name,
    duration: raw.duration,
    artists: (raw.artists || []).map((a) => ({
      name: a.name,
      id: String(a.id || ""),
    })),
    album: {
      name: raw.album?.name || "",
      id: String(raw.album?.id || ""),
      coverUrl: raw.album?.picUrl || "",
    },
    coverImgUrl: raw.album?.picUrl || "",
  };
}

function mapPlaylist(raw: NcmPlaylist) {
  return {
    id: toHexId(raw.id),
    originalId: raw.id,
    name: raw.name,
    description: raw.description,
    coverUrl: raw.coverImgUrl,
    trackCount: raw.trackCount,
    playCount: raw.playCount,
    creator: raw.creator,
  };
}

async function doSearch(type: number, keyword: string, limit: number) {
  try {
    const result = await search({ keywords: keyword, type, limit });
    const body = result.body as {
      code?: number;
      result?: {
        songCount?: number;
        songs?: NcmSong[];
        playlistCount?: number;
        playlists?: NcmPlaylist[];
      };
    };

    if (body.code !== 200) {
      return { success: false, error: "搜索失败" };
    }

    const songs = (body.result?.songs || []).map(mapSong);
    const playlists = (body.result?.playlists || []).map(mapPlaylist);

    return {
      success: true,
      data: {
        records: songs,
        playlists: playlists.length > 0 ? playlists : undefined,
      },
    };
  } catch (e: unknown) {
    return { success: false, error: `搜索出错: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/*
 * NeteaseCloudMusicApi search types:
 *   1  = single song
 *   1000 = playlist
 *   10 = album
 *   1018 = all / comprehensive
 */
searchRouter.get("/songs", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const limit = Number(req.query.limit) || 30;
    res.json(await doSearch(1, q, limit));
  } catch (e) { next(e); }
});

searchRouter.get("/playlists", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const limit = Number(req.query.limit) || 30;
    res.json(await doSearch(1000, q, limit));
  } catch (e) { next(e); }
});

searchRouter.get("/albums", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const limit = Number(req.query.limit) || 30;
    res.json(await doSearch(10, q, limit));
  } catch (e) { next(e); }
});

searchRouter.get("/all", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    // type 1018 = comprehensive search
    const result = await search({ keywords: q, type: 1018, limit: 30 });
    const body = result.body as {
      code?: number;
      result?: {
        songCount?: number;
        songs?: NcmSong[];
        playlistCount?: number;
        playlists?: NcmPlaylist[];
      };
    };

    if (body.code !== 200) {
      res.json({ success: false, error: "搜索失败" });
      return;
    }

    const songs = (body.result?.songs || []).map(mapSong);
    const playlists = (body.result?.playlists || []).map(mapPlaylist);

    res.json({
      success: true,
      data: { records: songs, playlists: playlists.length > 0 ? playlists : undefined },
    });
  } catch (e) { next(e); }
});
