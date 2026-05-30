import { Router } from "express";
import { runNcm } from "../services/ncmExecutor.js";

export const songRouter = Router();

songRouter.get("/:id/lyric", async (req, res, next) => {
  try {
    const result = await runNcm("song", "lyric", "--songId", req.params.id);
    if (result.success && result.data) {
      const d = result.data as Record<string, unknown>;
      const inner = (d.data || d) as Record<string, unknown>;
      res.json({ success: true, data: { lyric: inner.lyric, transLyric: inner.transLyric } });
    } else {
      res.json(result);
    }
  } catch (e) { next(e); }
});

songRouter.post("/:id/like", async (req, res, next) => {
  try {
    const result = await runNcm("song", "like", "--songId", req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});

songRouter.post("/:id/dislike", async (req, res, next) => {
  try {
    const result = await runNcm("song", "dislike", "--songId", req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});

songRouter.get("/:id/album", async (req, res, next) => {
  try {
    const result = await runNcm("album", "get", "--albumId", req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});

songRouter.get("/:id/album/tracks", async (req, res, next) => {
  try {
    const result = await runNcm("album", "tracks", "--albumId", req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});
