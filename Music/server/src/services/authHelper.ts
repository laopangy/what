import { runNcm } from "./ncmExecutor.js";
import { createRequire } from "module";
import { config } from "../config.js";
import { existsSync } from "fs";
import { resolve } from "path";
const require = createRequire(import.meta.url);
const {
  login_status,
  login_qr_key,
  login_qr_create,
  login_qr_check,
  register_anonimous,
} = require("NeteaseCloudMusicApi");
const { generateDeviceId } = require("NeteaseCloudMusicApi/util");

/** Build cookie string from config if available */
function getCookie(): string | undefined {
  return config.netease.cookie || undefined;
}

/** In-memory store for active QR login sessions */
const activeQrSessions = new Map<string, { unikey: string; anonCookie: string }>();

/**
 * Check whether user is logged in.
 * Checks ncm-cli first (fast), falls back to env cookie.
 */
export async function isLoggedIn(): Promise<{ loggedIn: boolean; nickname?: string }> {
  // Check NeteaseCloudMusicApi cookie — data APIs depend on it.
  // login_status always returns code:200 (even when logged out).
  // The real indicator is whether `profile` exists in the response.
  const cookie = getCookie();
  if (cookie) {
    try {
      const status = await login_status({ cookie });
      const body = status.body as { data?: { code?: number; profile?: { nickname?: string }; account?: unknown } };
      // ✅ Check profile/account existence, NOT code (which is always 200)
      if (body?.data?.profile || body?.data?.account) {
        return { loggedIn: true, nickname: body.data.profile?.nickname };
      }
      console.log("[authHelper] Cookie present but profile is empty — session expired");
    } catch { /* ignore */ }
  }

  // ncm-cli may have its own session, but if the API cookie is expired/missing,
  // recommend/liked/search etc. will all fail with 301.
  // Signal not logged in so the QR flow kicks in.
  try {
    const check = await runNcm("login", "--check");
    if (check.success) {
      console.log("[authHelper] ncm-cli logged in but API cookie missing/invalid — prompting re-login");
    }
  } catch { /* ignore */ }

  return { loggedIn: false };
}

/**
 * Start QR login using raw NeteaseCloudMusicApi (gives full cookie with write permissions).
 * Returns base64 QR code image + key, or null if already logged in.
 */
export async function getLoginQr(): Promise<{
  qrKey: string;
  qrimg: string; // base64 data URL
  message: string;
} | null> {
  const status = await isLoggedIn();
  if (status.loggedIn) return null;

  try {
    // Step 0: Register an anonymous session to get a valid MUSIC_A token.
    //         Without this, Netease's anti-fraud flags the QR as "设备环境异常".
    console.log("[authHelper] Registering anonymous session...");
    const regRes = await register_anonimous({});
    const regCookie: string =
      typeof regRes.body?.cookie === "string" ? regRes.body.cookie : "";

    // Step 0b: Add a device ID to the cookie so chainId generation works.
    const deviceId = generateDeviceId();
    const anonCookie = regCookie
      ? `${regCookie}; sDeviceId=${deviceId}; os=pc; appver=3.1.17.204416; channel=netease`
      : `sDeviceId=${deviceId}; os=pc; appver=3.1.17.204416; channel=netease`;

    // Step 1: Get QR key (pass anonymous cookie for session continuity)
    const keyRes = await login_qr_key({ cookie: anonCookie });
    const unikey = (keyRes.body as any).data?.unikey as string;
    if (!unikey) throw new Error("获取二维码 key 失败");

    // Step 2: Create QR image with platform=web to include chainId in the URL.
    //         This is critical — without it Netease rejects the scan as "设备环境异常".
    const qrRes = await login_qr_create({
      key: unikey,
      qrimg: true,
      platform: "web",
      cookie: anonCookie,
    });
    const qrimg = (qrRes.body as any).data?.qrimg as string;
    if (!qrimg) throw new Error("生成二维码失败");

    // Store session with anonymous cookie for later checkLoginQr
    activeQrSessions.set(unikey, { unikey, anonCookie });

    console.log("[authHelper] QR code ready, unikey:", unikey.slice(0, 8) + "...");

    return {
      qrKey: unikey,
      qrimg,
      message: "使用网易云音乐 APP 扫描二维码即可登录",
    };
  } catch (e) {
    console.error("[authHelper] getLoginQr failed:", e);
    return null;
  }
}

/**
 * Check QR login status. If logged in, save cookie to .env and return it.
 * Returns status code: 801=waiting, 802=confirming, 803=success, 800=expired
 */
export async function checkLoginQr(qrKey: string): Promise<{
  status: "waiting" | "confirming" | "success" | "expired" | "error";
  nickname?: string;
  message?: string;
}> {
  const session = activeQrSessions.get(qrKey);
  if (!session) {
    return { status: "error", message: "无效的二维码会话" };
  }

  try {
    // Pass the same anonymous cookie used when creating the QR code
    const checkRes = await login_qr_check({ key: session.unikey, cookie: session.anonCookie });
    const code = (checkRes.body as any).code as number;

    if (code === 803) {
      // Login success — get cookie and save to .env
      const cookie = (checkRes.body as any).cookie as string;
      activeQrSessions.delete(qrKey);

      // Try to get nickname
      let nickname: string | undefined;
      try {
        const status = await login_status({ cookie });
        nickname = (status.body as any)?.data?.profile?.nickname;
      } catch { /* ignore */ }

      // Save cookie to .env
      saveCookieToEnv(cookie);

      return { status: "success", nickname };
    }

    if (code === 800) {
      activeQrSessions.delete(qrKey);
      return { status: "expired", message: "二维码已过期" };
    }

    if (code === 802) {
      return { status: "confirming", message: "请在手机上确认登录" };
    }

    // 801 or other — still waiting
    return { status: "waiting", message: "等待扫码" };
  } catch (e: any) {
    return { status: "error", message: e.message || "检查登录状态失败" };
  }
}

/** Save cookie string to Music/server/.env AND update in-memory config */
function saveCookieToEnv(cookie: string): void {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const fs = require("fs");
    let lines: string[] = [];
    if (existsSync(envPath)) {
      lines = fs.readFileSync(envPath, "utf-8").split("\n");
    }
    // Replace existing NETEASE_COOKIE line, or append new one
    const idx = lines.findIndex((l: string) => l.startsWith("NETEASE_COOKIE="));
    if (idx >= 0) {
      lines[idx] = `NETEASE_COOKIE=${cookie}`;
    } else {
      lines.push(`NETEASE_COOKIE=${cookie}`);
    }
    // Ensure trailing newline
    let output = lines.join("\n");
    if (output && !output.endsWith("\n")) output += "\n";
    fs.writeFileSync(envPath, output);
    console.log("[authHelper] Cookie saved to .env");

    // Also update in-memory config so API calls work immediately without restart.
    // config is imported as a const, but its properties are mutable.
    config.netease.cookie = cookie;
    console.log("[authHelper] In-memory config updated");
  } catch (e) {
    console.error("[authHelper] Failed to save cookie to .env:", e);
  }
}
