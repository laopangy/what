import { Router } from "express";
import { runNcm } from "../services/ncmExecutor.js";

export const searchRouter = Router();

interface NcmSong {
  id: string;
  originalId: number;
  name: string;
  duration: number;
  artists: { id: string; originalId?: number; name: string; coverImgUrl?: string | null }[];
  fullArtists?: { id: string; originalId?: number; name: string; coverImgUrl?: string | null }[];
  album: { id: string; originalId?: number; name: string };
  coverImgUrl?: string;
}

interface NcmPlaylist {
  id: string;
  originalId?: number;
  name: string;
  description?: string | null;
  coverUrl?: string;
  coverImgUrl?: string;
  trackCount?: number;
  playCount?: number;
  creator?: { nickname: string; userId?: number; avatarUrl?: string | null };
}

interface NcmSearchResponse {
  code?: number;
  data?: {
    recordCount?: number;
    records?: NcmSong[];
    playlists?: NcmPlaylist[];
    albums?: unknown[];
    artists?: unknown[];
  };
  // Some ncm-cli versions return records at top level
  recordCount?: number;
  records?: NcmSong[];
  playlists?: NcmPlaylist[];
  albums?: unknown[];
  artists?: unknown[];
}

function mapSong(raw: NcmSong) {
  return {
    id: raw.id,                                    // 32-char hex encrypted ID from ncm-cli
    originalId: raw.originalId ?? Number(raw.id),   // numeric original ID
    name: raw.name,
    duration: raw.duration,
    artists: (raw.artists || []).map((a) => ({
      name: a.name,
      id: a.id || String(a.originalId || ""),
    })),
    album: {
      name: raw.album?.name || "",
      id: raw.album?.id || "",
      coverUrl: raw.coverImgUrl || "",
    },
    coverImgUrl: raw.coverImgUrl || "",
  };
}

function mapPlaylist(raw: NcmPlaylist) {
  return {
    id: raw.id,
    originalId: raw.originalId,
    name: raw.name,
    description: raw.description,
    coverUrl: raw.coverUrl || raw.coverImgUrl,
    trackCount: raw.trackCount,
    playCount: raw.playCount,
    creator: raw.creator,
  };
}

async function doSearch(type: string, keyword: string, limit: number) {
  const result = await runNcm("search", type, "--keyword", keyword, "--limit", String(limit));

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const raw = result.data as NcmSearchResponse | undefined;
  // ncm-cli nests data inside { code: 200, data: { records: [...] } }
  // Also support top-level records for compatibility
  const inner = raw?.data || raw;
  const records = (inner?.records || []).map(mapSong);
  const playlists = (inner?.playlists || []).map(mapPlaylist);

  return {
    success: true,
    data: {
      records,
      playlists: playlists.length > 0 ? playlists : undefined,
    },
  };
}

searchRouter.get("/songs", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const limit = Number(req.query.limit) || 30;
    res.json(await doSearch("song", q, limit));
  } catch (e) { next(e); }
});

searchRouter.get("/playlists", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const limit = Number(req.query.limit) || 30;
    res.json(await doSearch("playlist", q, limit));
  } catch (e) { next(e); }
});

searchRouter.get("/albums", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const limit = Number(req.query.limit) || 30;
    res.json(await doSearch("album", q, limit));
  } catch (e) { next(e); }
});

searchRouter.get("/all", async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    // ncm-cli "all" search type for combined results
    const result = await runNcm("search", "all", "--keyword", q, "--limit", "30");

    if (!result.success) {
      res.json({ success: false, error: result.error });
      return;
    }

    const raw = result.data as NcmSearchResponse | undefined;
    const inner = raw?.data || raw;
    const records = (inner?.records || []).map(mapSong);
    const playlists = (inner?.playlists || []).map(mapPlaylist);

    res.json({
      success: true,
      data: { records, playlists: playlists.length > 0 ? playlists : undefined },
    });
  } catch (e) { next(e); }
});
