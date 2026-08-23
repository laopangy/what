import { Router } from "express";
import { readdir } from "fs/promises";
import { config } from "../config.js";

export const themeRouter = Router();

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
const COVER_HOSTS = ["music.126.net", "y.qq.com", "gtimg.cn", "qpic.cn", "qq.com"];

themeRouter.get("/images", async (_req, res, next) => {
  try {
    const entries = await readdir(config.themeImagesDir);
    const images = entries.filter((f) => IMAGE_RE.test(f));
    res.json({ success: true, data: images });
  } catch (e) { next(e); }
});

themeRouter.get("/cover-image", async (req, res, next) => {
  try {
    const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
    const target = new URL(rawUrl);
    const allowed = target.protocol === "https:" && COVER_HOSTS.some((host) =>
      target.hostname === host || target.hostname.endsWith(`.${host}`)
    );
    if (!allowed) {
      res.status(400).json({ success: false, error: "不支持的专辑封面地址" });
      return;
    }
    const response = await fetch(target, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { Referer: "https://y.qq.com/" },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.startsWith("image/")) {
      res.status(502).json({ success: false, error: "专辑封面读取失败" });
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 6 * 1024 * 1024) {
      res.status(413).json({ success: false, error: "专辑封面文件过大" });
      return;
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (error) { next(error); }
});
