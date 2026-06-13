import { Router } from "express";
import { createRequire } from "module";
import { isLoggedIn, getLoginQr } from "../services/authHelper.js";
import { config } from "../config.js";
const require = createRequire(import.meta.url);
const { recommend_songs, personal_fm } = require("NeteaseCloudMusicApi");
type ApiFn = (opts: Record<string, unknown>) => Promise<{ body: unknown }>;

export const recommendRouter = Router();

function getCookie(): string | undefined {
  return config.netease.cookie
    ? config.netease.cookie
    : undefined;
}

async function gateLogin(): Promise<{ needLogin: true; qrKey: string; qrimg: string; message: string } | null> {
  const status = await isLoggedIn();
  if (status.loggedIn) return null;
  const qr = await getLoginQr();
  return {
    needLogin: true,
    qrKey: qr?.qrKey || "",
    qrimg: qr?.qrimg || "",
    message: qr?.message || "请先登录网易云音乐",
  };
}

function mapSongs(rawSongs: Array<Record<string, unknown>>) {
  return rawSongs.map((s: Record<string, unknown>) => ({
    id: Number((s.id as number) || 0).toString(16).padStart(32, "0"),
    originalId: s.id as number,
    name: s.name as string,
    duration: (s.dt as number) || 0,
    artists: (s.ar as Array<{ id: number; name: string }> || []).map((a) => ({
      name: a.name,
      id: String(a.id || ""),
    })),
    album: {
      name: (s.al as { name?: string })?.name || "",
      id: String((s.al as { id?: number })?.id || ""),
      coverUrl: (s.al as { picUrl?: string })?.picUrl || "",
    },
    coverImgUrl: (s.al as { picUrl?: string })?.picUrl || "",
  }));
}

recommendRouter.get("/daily", async (_req, res, next) => {
  try {
    const loginGate = await gateLogin();
    if (loginGate) { res.json({ success: false, ...loginGate }); return; }

    const cookie = getCookie();
    if (!cookie) {
      res.json({ success: false, needLogin: true, message: "需要登录才能获取每日推荐" });
      return;
    }

    const result = await (recommend_songs as ApiFn)({ cookie });
    const body = result.body as { code?: number; data?: { dailySongs?: Array<Record<string, unknown>> } };
    if (body.code !== 200) {
      res.json({ success: false, error: "获取每日推荐失败" });
      return;
    }
    const songs = body.data?.dailySongs || [];
    res.json({ success: true, data: mapSongs(songs) });
  } catch (e) { next(e); }
});

recommendRouter.get("/fm", async (_req, res, next) => {
  try {
    const loginGate = await gateLogin();
    if (loginGate) { res.json({ success: false, ...loginGate }); return; }

    const cookie = getCookie();
    if (!cookie) {
      res.json({ success: false, needLogin: true, message: "需要登录才能使用私人FM" });
      return;
    }

    const result = await personal_fm({ cookie });
    const body = result.body as { code?: number; data?: Array<Record<string, unknown>> };
    if (body.code !== 200) {
      res.json({ success: false, error: "获取私人FM失败" });
      return;
    }
    const songs = body.data || [];
    res.json({ success: true, data: mapSongs(songs) });
  } catch (e) { next(e); }
});
