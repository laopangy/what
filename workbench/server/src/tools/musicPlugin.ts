import { config } from "../config.js";
import type { ModuleToolPlugin } from "./types.js";
import type { DeepSeekTool } from "../types/chat.js";

const MUSIC_URL = config.modules.music;

async function musicFetch<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  };
  // Buffer avoids ByteString error on Node.js v23+ Windows
  if (body) opts.body = Buffer.from(JSON.stringify(body), "utf-8");
  const res = await fetch(`${MUSIC_URL}${path}`, opts);
  const json = await res.json();
  // Pass through needLogin responses from Music server
  if (!json.success) {
    if (json.needLogin) {
      return { needLogin: true, qrCodeUrl: json.qrCodeUrl, message: json.message } as T;
    }
    return { error: json.error || "Music API error" } as T;
  }
  return (json.data ?? json) as T;
}

/** Tools that require user to be logged in */
const LOGIN_REQUIRED_TOOLS = new Set([
  "play_song",
  "play_playlist",
  "get_daily_recommend",
  "get_personal_fm",
  "get_liked_songs",
  "get_user_profile",
  "get_listening_history",
  "like_song",
  "dislike_song",
  "create_playlist",
  "add_to_playlist",
]);

/** Pre-check login and return QR info if not logged in. */
async function ensureLogin(): Promise<Record<string, unknown> | null> {
  try {
    const statusRes = await fetch(`${MUSIC_URL}/api/user/login-status`);
    const statusJson = await statusRes.json();
    const loggedIn = statusJson?.data?.loggedIn;
    if (loggedIn) return null; // Already logged in

    // Get QR code
    const qrRes = await fetch(`${MUSIC_URL}/api/user/login-qr`, { method: "POST" });
    const qrJson = await qrRes.json();
    if (qrJson?.data?.alreadyLoggedIn) return null; // Logged in between checks

    return {
      needLogin: true,
      qrCodeUrl: qrJson?.data?.qrCodeUrl || "",
      message: qrJson?.data?.message || "请扫描二维码登录网易云音乐后重试",
    };
  } catch {
    return { error: "无法连接音乐服务" };
  }
}

const TOOLS: DeepSeekTool[] = [
  {
    name: "search_songs",
    description: "搜索歌曲。通过关键词搜索网易云音乐歌曲，返回歌曲列表（包含歌曲ID、名称、歌手、专辑信息）。",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "搜索关键词（歌曲名或歌手名）" },
        limit: { type: "number", description: "返回结果数量，默认10" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "search_playlists",
    description: "搜索歌单。通过关键词搜索网易云音乐歌单。",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "搜索关键词" },
        limit: { type: "number", description: "返回结果数量，默认10" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "play_song",
    description: "播放指定歌曲。搜索到歌曲后，将搜索结果中的 id（encryptedId）、originalId、name、artists 等信息一并传入。",
    input_schema: {
      type: "object",
      properties: {
        encryptedId: { type: "string", description: "歌曲加密ID（32位hex字符串）" },
        originalId: { type: "number", description: "歌曲原始数字ID" },
        name: { type: "string", description: "歌曲名称（用于显示）" },
        artist: { type: "string", description: "歌手名（用于显示）" },
        duration: { type: "number", description: "歌曲时长（毫秒）" },
      },
      required: ["encryptedId", "originalId"],
    },
  },
  {
    name: "play_playlist",
    description: "播放指定歌单。",
    input_schema: {
      type: "object",
      properties: {
        encryptedId: { type: "string", description: "歌单加密ID" },
        originalId: { type: "number", description: "歌单原始数字ID" },
      },
      required: ["encryptedId"],
    },
  },
  {
    name: "pause",
    description: "暂停播放。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "resume",
    description: "继续播放。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "stop",
    description: "停止播放。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "next_track",
    description: "下一首。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "prev_track",
    description: "上一首。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "set_volume",
    description: "设置音量。",
    input_schema: {
      type: "object",
      properties: {
        level: { type: "number", description: "音量0-100" },
      },
      required: ["level"],
    },
  },
  {
    name: "seek",
    description: "跳转到指定播放位置。",
    input_schema: {
      type: "object",
      properties: {
        seconds: { type: "number", description: "目标位置（秒）" },
      },
      required: ["seconds"],
    },
  },
  {
    name: "get_playback_state",
    description: "获取当前播放状态（当前歌曲、进度、音量、队列等）。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_queue",
    description: "查看播放队列。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_to_queue",
    description: "将歌曲添加到播放队列。",
    input_schema: {
      type: "object",
      properties: {
        encryptedId: { type: "string", description: "歌曲加密ID" },
        originalId: { type: "number", description: "歌曲原始数字ID" },
      },
      required: ["encryptedId"],
    },
  },
  {
    name: "clear_queue",
    description: "清空播放队列。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_user_profile",
    description: "获取网易云用户信息（昵称、头像等）。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_login_qr",
    description: "获取网易云音乐登录二维码。当用户未登录时，调用此工具获取扫码登录链接，引导用户用网易云音乐 APP 扫码登录。",
    input_schema: { type: "object", properties: {} },
  },
];

export const musicPlugin: ModuleToolPlugin = {
  name: "music",
  tools: TOOLS,
  async execute(name: string, args: Record<string, unknown>) {
    // Pre-check login for tools that require it
    if (LOGIN_REQUIRED_TOOLS.has(name)) {
      const loginIssue = await ensureLogin();
      if (loginIssue) return loginIssue;
    }

    switch (name) {
      case "search_songs":
        return musicFetch("GET", `/api/search/songs?q=${encodeURIComponent(String(args.keyword || ""))}&limit=${args.limit || 10}`);
      case "search_playlists":
        return musicFetch("GET", `/api/search/playlists?q=${encodeURIComponent(String(args.keyword || ""))}&limit=${args.limit || 10}`);
      case "play_song":
        return musicFetch("POST", "/api/playback/play-song", {
          encryptedId: args.encryptedId,
          originalId: args.originalId,
          name: args.name,
          artist: args.artist,
          duration: args.duration,
        });
      case "play_playlist":
        return musicFetch("POST", "/api/playback/play-playlist", { encryptedId: args.encryptedId, originalId: args.originalId });
      case "pause":
        return musicFetch("POST", "/api/playback/pause");
      case "resume":
        return musicFetch("POST", "/api/playback/resume");
      case "stop":
        return musicFetch("POST", "/api/playback/stop");
      case "next_track":
        return musicFetch("POST", "/api/playback/next");
      case "prev_track":
        return musicFetch("POST", "/api/playback/prev");
      case "set_volume":
        return musicFetch("POST", "/api/playback/volume", { level: args.level });
      case "seek":
        return musicFetch("POST", "/api/playback/seek", { seconds: args.seconds });
      case "get_playback_state":
        return musicFetch("GET", "/api/playback/state");
      case "get_queue":
        return musicFetch("GET", "/api/playback/queue");
      case "add_to_queue":
        return musicFetch("POST", "/api/playback/queue/add", { encryptedId: args.encryptedId, originalId: args.originalId });
      case "clear_queue":
        return musicFetch("POST", "/api/playback/queue/clear");
      case "get_user_profile":
        return musicFetch("GET", "/api/user/login-status");
      case "get_login_qr": {
        const qr = await ensureLogin();
        if (qr) return qr;
        return { alreadyLoggedIn: true, message: "已登录，无需扫码" };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  },
};
