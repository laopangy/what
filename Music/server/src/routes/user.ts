import { Router } from "express";
import { runNcm } from "../services/ncmExecutor.js";

export const userRouter = Router();

userRouter.get("/profile", async (_req, res, next) => {
  try {
    const result = await runNcm("user", "info");
    res.json(result);
  } catch (e) { next(e); }
});

userRouter.get("/history", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const result = await runNcm("user", "history", "--limit", String(limit));
    res.json(result);
  } catch (e) { next(e); }
});

userRouter.get("/liked", async (_req, res, next) => {
  try {
    // First get the liked playlist info
    const playlistResult = await runNcm("user", "favorite");
    if (!playlistResult.success || !playlistResult.data) {
      res.json(playlistResult);
      return;
    }
    // Extract playlist ID from the result
    const data = playlistResult.data as Record<string, unknown>;
    const inner = (data.data || data) as Record<string, unknown>;
    const playlistId = inner.id as string | undefined;
    if (playlistId) {
      // Fetch the actual tracks
      const tracksResult = await runNcm("playlist", "tracks", "--playlistId", playlistId, "--limit", "200");
      res.json(tracksResult);
    } else {
      res.json(playlistResult);
    }
  } catch (e) { next(e); }
});
