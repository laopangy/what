import { Router } from "express";
import { readdir } from "fs/promises";
import { config } from "../config.js";

export const themeRouter = Router();

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

themeRouter.get("/images", async (_req, res, next) => {
  try {
    const entries = await readdir(config.themeImagesDir);
    const images = entries.filter((f) => IMAGE_RE.test(f));
    res.json({ success: true, data: images });
  } catch (e) { next(e); }
});
