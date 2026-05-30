import { Router } from "express";
import { createRequire } from "module";
import { runNcm } from "../services/ncmExecutor.js";
import { notifyPlaybackChange } from "../services/wsManager.js";
import { normalizeState } from "../services/stateTransform.js";
import { z } from "zod";
const require = createRequire(import.meta.url);
const { song_url } = require("NeteaseCloudMusicApi");

function isHex32(s: string): boolean {
  return /^[0-9a-fA-F]{32}$/.test(s);
}

async function getSongUrl(songId: number): Promise<string | null> {
  try {
    const result = await song_url({ id: String(songId), br: 999000 });
    const body = result.body as { data?: Array<{ url?: string }> };
    return body.data?.[0]?.url || null;
  } catch {
    return null;
  }
}

export const playbackRouter = Router();

playbackRouter.get("/state", async (_req, res, next) => {
  try {
    const result = await runNcm("state");
    if (result.success && result.data) {
      result.data = normalizeState(result.data) as unknown;
    }
    res.json(result);
  } catch (e) { next(e); }
});

playbackRouter.post("/play-song", async (req, res, next) => {
  try {
    const body = z.object({
      encryptedId: z.string().optional(),
      originalId: z.number().optional(),
    }).parse(req.body);

    const state = await runNcm("state");
    if (state.success) {
      const d = state.data as Record<string, unknown> | undefined;
      const raw = (d?.state || d) as Record<string, unknown> | undefined;
      if (raw?.status === "playing") {
        await runNcm("stop");
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // If encryptedId is not a 32-char hex, treat it as a numeric song ID.
    // Search results should always include the encrypted ID (32-char hex), so this
    // fallback only triggers for legacy callers or direct API usage with numeric IDs.
    const eid = body.encryptedId;
    if (eid && !isHex32(eid)) {
      const numericId = Number(eid);
      if (!Number.isNaN(numericId)) {
        // 1) Try to get the song URL and start playback with it
        const url = await getSongUrl(numericId);
        if (url) {
          // queue add URL only works when ncm-cli already has an active playback
          // process. If it fails (nothing playing), re-search via ncm-cli to
          // discover the encrypted ID, then play normally.
          const addResult = await runNcm("queue", "add", url);
          if (addResult.success) {
            const queueResult = await runNcm("queue");
            const qdata = queueResult.data as Record<string, unknown> | undefined;
            const items = (qdata?.items || qdata?.queue) as Array<{ encryptedId?: string }> | undefined;
            if (items && items.length > 0) {
              const last = items[items.length - 1];
              if (last?.encryptedId) {
                const playResult = await runNcm("play", "--song", "--encrypted-id", last.encryptedId);
                notifyPlaybackChange();
                res.json(playResult);
                return;
              }
            }
          }
        }

        // 2) Try --original-id (works in some ncm-cli versions)
        const oid = body.originalId || numericId;
        const directResult = await runNcm("play", "--song", "--original-id", String(oid));
        if (directResult.success) {
          notifyPlaybackChange();
          res.json(directResult);
          return;
        }

        // 3) Return a helpful error — the caller should pass the encrypted ID
        res.json({
          success: false,
          error: "无法使用数字ID播放歌曲。请通过搜索获取加密ID（32位hex字符串）后重试。",
        });
        return;
      }
    }

    const args: string[] = ["play", "--song"];
    if (body.encryptedId) args.push("--encrypted-id", body.encryptedId);
    if (body.originalId) args.push("--original-id", String(body.originalId));
    const result = await runNcm(args[0], ...args.slice(1));
    notifyPlaybackChange();
    res.json(result);
  } catch (e) { next(e); }
});

playbackRouter.post("/play-playlist", async (req, res, next) => {
  try {
    const body = z.object({
      encryptedId: z.string().optional(),
      originalId: z.number().optional(),
    }).parse(req.body);
    const state = await runNcm("state");
    if (state.success) {
      const d = state.data as Record<string, unknown> | undefined;
      const raw = (d?.state || d) as Record<string, unknown> | undefined;
      if (raw?.status === "playing") {
        await runNcm("stop");
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    const args: string[] = ["play", "--playlist"];
    if (body.encryptedId) args.push("--encrypted-id", body.encryptedId);
    if (body.originalId) args.push("--original-id", String(body.originalId));
    const result = await runNcm(args[0], ...args.slice(1));
    notifyPlaybackChange();
    res.json(result);
  } catch (e) { next(e); }
});

const simpleActions: Record<string, string[]> = {
  pause: ["pause"],
  resume: ["resume"],
  stop: ["stop"],
  next: ["next"],
  prev: ["prev"],
};

for (const [action, cmdArgs] of Object.entries(simpleActions)) {
  playbackRouter.post(`/${action}`, async (_req, res, next) => {
    try {
      const result = await runNcm(cmdArgs[0], ...cmdArgs.slice(1));
      notifyPlaybackChange();
      res.json(result);
    } catch (e) { next(e); }
  });
}

playbackRouter.post("/seek", async (req, res, next) => {
  try {
    const { seconds } = z.object({ seconds: z.number() }).parse(req.body);
    const result = await runNcm("seek", String(seconds));
    notifyPlaybackChange();
    res.json(result);
  } catch (e) { next(e); }
});

playbackRouter.post("/volume", async (req, res, next) => {
  try {
    const { level } = z.object({ level: z.number().min(0).max(100) }).parse(req.body);
    const result = await runNcm("volume", String(level));
    notifyPlaybackChange();
    res.json(result);
  } catch (e) { next(e); }
});

playbackRouter.get("/queue", async (_req, res, next) => {
  try {
    const result = await runNcm("queue");
    res.json(result);
  } catch (e) { next(e); }
});

playbackRouter.post("/queue/add", async (req, res, next) => {
  try {
    const body = z.object({
      encryptedId: z.string().optional(),
      originalId: z.number().optional(),
    }).parse(req.body);

    const eid = body.encryptedId;
    if (eid && !isHex32(eid)) {
      const sid = body.originalId || Number(eid);
      if (!Number.isNaN(sid)) {
        const url = await getSongUrl(sid);
        if (url) {
          const result = await runNcm("queue", "add", url);
          if (result.success) {
            res.json(result);
            return;
          }
          // queue add URL failed — ncm-cli may not be running
          res.json({
            success: false,
            error: "无法添加到队列：播放服务未启动或无法解析该歌曲。请先播放一首歌曲后再添加。",
          });
          return;
        }
      }
    }

    const args: string[] = ["queue", "add"];
    if (body.encryptedId) args.push("--encrypted-id", body.encryptedId);
    if (body.originalId) args.push("--original-id", String(body.originalId));
    const result = await runNcm(args[0], ...args.slice(1));
    res.json(result);
  } catch (e) { next(e); }
});

playbackRouter.post("/queue/clear", async (_req, res, next) => {
  try {
    const result = await runNcm("queue", "clear");
    res.json(result);
  } catch (e) { next(e); }
});
