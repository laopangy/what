import { Router } from "express";
import { createRequire } from "module";
import { runNcm } from "../services/ncmExecutor.js";
import { isLoggedIn, getLoginQr, checkLoginQr } from "../services/authHelper.js";

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
import { config } from "../config.js";
const require = createRequire(import.meta.url);
const { user_account, user_record, likelist, song_detail, cloudsearch, user_follows } = require("NeteaseCloudMusicApi");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (fn: (...args: any[]) => any, opts: Record<string, unknown>) => fn(opts);

export const userRouter = Router();

function getCookie(): string | undefined {
  return config.netease.cookie || undefined;
}

let cachedUid: string | null = null;

/** Get the current user's numeric UID from Netease account. Cached after first call. */
async function getUserId(): Promise<string> {
  if (cachedUid) return cachedUid;
  const cookie = getCookie();
  if (!cookie) return "";
  try {
    const r = await call(user_account, { cookie });
    const body = r.body as { code?: number; profile?: { userId?: number }; account?: { id?: number } };
    const uid = body?.profile?.userId || body?.account?.id;
    cachedUid = uid ? String(uid) : "";
  } catch { /* ignore */ }
  return cachedUid || "";
}

function mapSong(raw: Record<string, unknown>) {
  const ar = (raw.ar as Array<{ id: number; name: string }>) || [];
  const al = (raw.al as { id: number; name: string; picUrl?: string }) || {};
  return {
    id: Number((raw.id as number) || 0).toString(16).padStart(32, "0"),
    originalId: raw.id as number,
    name: raw.name as string,
    duration: (raw.dt as number) || 0,
    artists: ar.map((a) => ({ name: a.name, id: String(a.id) })),
    album: { name: al.name || "", id: String(al.id || ""), coverUrl: al.picUrl || "" },
    coverImgUrl: al.picUrl || "",
  };
}

userRouter.get("/profile", async (_req, res, next) => {
  try {
    const loginGate = await gateLogin();
    if (loginGate) { res.json({ success: false, ...loginGate }); return; }
    const cookie = getCookie();
    const result = await call(user_account, { cookie });
    const body = result.body as { code?: number; profile?: Record<string, unknown>; account?: Record<string, unknown> };
    if (body.code !== 200) {
      res.json({ success: false, error: "获取用户信息失败" });
      return;
    }
    res.json({ success: true, data: { profile: body.profile, account: body.account } });
  } catch (e) { next(e); }
});

userRouter.get("/history", async (req, res, next) => {
  try {
    const loginGate = await gateLogin();
    if (loginGate) { res.json({ success: false, ...loginGate }); return; }
    const cookie = getCookie();
    const uid = req.query.uid as string || await getUserId();
    if (!uid) { res.json({ success: true, data: [] }); return; }
    const limit = Number(req.query.limit) || 100;
    // Try weekly first, fall back to all-time
    let result = await call(user_record, { uid, type: 1 });
    let body = result.body as { code?: number; weekData?: Array<{ playCount: number; song: Record<string, unknown> }>; allData?: Array<{ playCount: number; song: Record<string, unknown> }> };
    let items = body.weekData || [];
    if (items.length === 0) {
      result = await call(user_record, { uid, type: 0 });
      body = result.body as { code?: number; allData?: Array<{ playCount: number; song: Record<string, unknown> }> };
      items = body.allData || [];
    }
    if (body.code !== 200) {
      res.json({ success: false, error: "获取播放历史失败" });
      return;
    }
    const songs = items.slice(0, limit).map((item) => ({
      ...mapSong(item.song),
      playCount: item.playCount,
    }));
    res.json({ success: true, data: songs });
  } catch (e) { next(e); }
});

userRouter.get("/login-status", async (_req, res, next) => {
  try {
    const status = await isLoggedIn();
    res.json({ success: true, data: status });
  } catch (e) { next(e); }
});

/** Start QR-code login flow. Returns base64 QR image + key. */
userRouter.post("/login-qr", async (_req, res, next) => {
  try {
    const qr = await getLoginQr();
    if (qr === null) {
      res.json({ success: true, data: { alreadyLoggedIn: true } });
    } else {
      res.json({ success: true, data: qr });
    }
  } catch (e) { next(e); }
});

/** Check QR login status. Returns status + nickname on success. */
userRouter.post("/login-check", async (req, res, next) => {
  try {
    const { qrKey } = req.body as { qrKey?: string };
    if (!qrKey) {
      res.json({ success: false, error: "缺少 qrKey" });
      return;
    }
    const result = await checkLoginQr(qrKey);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

/** Legacy login endpoint. */
userRouter.post("/login", async (_req, res, next) => {
  try {
    const qr = await getLoginQr();
    if (qr === null) {
      res.json({ success: true, data: { alreadyLoggedIn: true } });
    } else {
      res.json({ success: true, data: qr });
    }
  } catch (e) { next(e); }
});

userRouter.post("/logout", async (_req, res, next) => {
  try {
    const result = await runNcm("logout");
    res.json(result);
  } catch (e) { next(e); }
});

/** Search Netease users by nickname. Returns list of { userId, nickname, avatarUrl }. */
userRouter.get("/search", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) {
      res.json({ success: false, error: "未登录" });
      return;
    }
    const nickname = (req.query.nickname as string) || "";
    if (!nickname.trim()) {
      res.json({ success: false, error: "请输入搜索关键词" });
      return;
    }
    const result = await call(cloudsearch, {
      keywords: nickname.trim(),
      type: 1002, // user search
      limit: 20,
      cookie,
    });
    const body = result.body as {
      code?: number;
      result?: {
        userprofiles?: Array<{
          userId: number;
          nickname: string;
          avatarUrl: string;
          followeds: number;
          signature?: string;
        }>;
      };
    };
    if (body.code !== 200 || !body.result?.userprofiles) {
      res.json({ success: true, data: [] });
      return;
    }
    const users = body.result.userprofiles.map((u) => ({
      userId: String(u.userId),
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      followeds: u.followeds,
      signature: u.signature || "",
    }));
    res.json({ success: true, data: users });
  } catch (e) { next(e); }
});

/** Get current user's followed users (关注列表). */
userRouter.get("/follows", async (req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) {
      res.json({ success: false, error: "未登录" });
      return;
    }
    const uid = (req.query.uid as string) || (await getUserId());
    if (!uid) {
      res.json({ success: false, error: "无法获取用户ID" });
      return;
    }
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const result = await call(user_follows, { uid, limit, offset, cookie });
    const body = result.body as {
      code?: number;
      follow?: Array<{
        userId: number;
        nickname: string;
        avatarUrl: string;
        signature?: string;
        followeds?: number;
        gender?: number;
      }>;
      more?: boolean;
      size?: number;
    };
    if (body.code !== 200) {
      res.json({ success: false, error: "获取关注列表失败" });
      return;
    }
    const users = (body.follow || []).map((u) => ({
      userId: String(u.userId),
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      followeds: u.followeds ?? 0,
      signature: u.signature || "",
      gender: u.gender,
    }));
    res.json({ success: true, data: { users, more: body.more ?? false, size: body.size ?? users.length } });
  } catch (e) { next(e); }
});

userRouter.get("/liked", async (_req, res, next) => {
  try {
    const loginGate = await gateLogin();
    if (loginGate) { res.json({ success: false, ...loginGate }); return; }

    const cookie = getCookie();
    // Get liked songs playlist ID
    const likeResult = await likelist({ cookie });
    const likeBody = likeResult.body as { code?: number; ids?: number[] };
    if (likeBody.code !== 200 || !likeBody.ids?.length) {
      res.json({ success: true, data: [] });
      return;
    }

    // Fetch song details (max 200)
    const MAX_TRACKS = 200;
    const trackIds = likeBody.ids.slice(0, MAX_TRACKS);
    const tracksResult = await call(song_detail, { ids: trackIds.join(",") });
    const tracksBody = tracksResult.body as {
      code?: number;
      songs?: Array<Record<string, unknown>>;
    };

    const songs = (tracksBody.songs || []).map(mapSong);
    res.json({ success: true, data: songs });
  } catch (e) { next(e); }
});
