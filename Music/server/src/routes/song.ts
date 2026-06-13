import { Router } from "express";
import { createRequire } from "module";
import { config } from "../config.js";
const require = createRequire(import.meta.url);
const { lyric, like } = require("NeteaseCloudMusicApi");

export const songRouter = Router();

/** NeteaseCloudMusicApi needs numeric IDs — hex 32-char strings return empty. */
function toNumericId(id: string): string {
  if (/^[0-9a-fA-F]{32}$/.test(id)) {
    return String(parseInt(id, 16));
  }
  return id;
}

/** Pass cookie if configured (required for like/likelist). */
function getCookie(): string | undefined {
  return config.netease.cookie || undefined;
}

songRouter.get("/:id/lyric", async (req, res, next) => {
  try {
    const songId = toNumericId(req.params.id);
    const result = await lyric({ id: songId });
    const body = result.body as {
      code?: number;
      lrc?: { lyric?: string };
      tlyric?: { lyric?: string };
    };
    const lyricText = body.lrc?.lyric || "";
    const transLyric = body.tlyric?.lyric || "";
    res.json({
      success: true,
      data: {
        lyric: lyricText || "[00:00.00]暂无歌词",
        transLyric: transLyric || undefined,
      },
    });
  } catch (e) { next(e); }
});

songRouter.post("/:id/like", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) { res.json({ success: false, error: "未登录" }); return; }
    const songId = toNumericId(req.params.id);
    const result = await like({ id: songId, like: true, cookie });
    const body = result.body as { code?: number };
    res.json({ success: body.code === 200 });
  } catch (e) { next(e); }
});

songRouter.post("/:id/dislike", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) { res.json({ success: false, error: "未登录" }); return; }
    const songId = toNumericId(req.params.id);
    // NeteaseCloudMusicApi.like requires string 'false' for unlike — boolean false is ignored
    const result = await like({ id: songId, like: 'false', cookie });
    const body = result.body as { code?: number };
    res.json({ success: body.code === 200 });
  } catch (e) { next(e); }
});

/** Check if a song is liked by the current user. */
songRouter.get("/:id/is-liked", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) { res.json({ success: true, data: { liked: false } }); return; }
    const songId = toNumericId(req.params.id);
    const { likelist } = require("NeteaseCloudMusicApi");
    const result = await likelist({ cookie });
    const body = result.body as { code?: number; ids?: number[] };
    const ids = body.ids || [];
    const numericId = Number(songId);
    res.json({ success: true, data: { liked: ids.includes(numericId) } });
  } catch (e) { next(e); }
});
