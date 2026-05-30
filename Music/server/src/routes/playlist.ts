import { Router } from "express";
import { runNcm } from "../services/ncmExecutor.js";
import { z } from "zod";

export const playlistRouter = Router();

playlistRouter.get("/created", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const result = await runNcm("playlist", "created", "--limit", String(limit));
    res.json(result);
  } catch (e) { next(e); }
});

playlistRouter.get("/collected", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const result = await runNcm("playlist", "collected", "--limit", String(limit));
    res.json(result);
  } catch (e) { next(e); }
});

playlistRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await runNcm("playlist", "get", "--playlistId", req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});

playlistRouter.get("/:id/tracks", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const result = await runNcm("playlist", "tracks", "--playlistId", req.params.id, "--limit", String(limit));
    res.json(result);
  } catch (e) { next(e); }
});

playlistRouter.post("/create", async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const result = await runNcm("playlist", "create", "--playlistName", name);
    res.json(result);
  } catch (e) { next(e); }
});

playlistRouter.post("/add-songs", async (req, res, next) => {
  try {
    const { playlistId, songIds } = z.object({
      playlistId: z.string().min(1),
      songIds: z.array(z.string()).min(1),
    }).parse(req.body);
    const result = await runNcm("playlist", "add", "--playlistId", playlistId, "--songIdList", JSON.stringify(songIds));
    res.json(result);
  } catch (e) { next(e); }
});
