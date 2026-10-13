import { config } from "../config.js";
import type { ModuleTool, ModuleToolPlugin } from "./types.js";

const MUSIC_URL = config.modules.music;

const MUSIC_SYSTEM_PROMPT = `当前请求可以按需调用音乐模块（网易云音乐控制）。

音乐模块当前支持的操作：
- 搜索：搜索歌曲（search_songs）、搜索歌单（search_playlists）
- 播放控制：播放歌曲、播放歌单、暂停、继续、停止、上一首、下一首
- 进度和音量：跳转播放位置、调节音量
- 队列管理：查看队列、添加歌曲到队列、清空队列
- 播放状态：查看当前播放的歌曲信息
- 登录：获取登录二维码（get_login_qr）

操作提示：
- 当用户想听某首歌时，先用 search_songs 搜索。从搜索结果中找到最匹配的歌曲，然后用 play_song 播放。
- 搜索结果中的 id 字段即为 encryptedId，originalId 字段即为 originalId。播放时同时传入 name（歌曲名）、artist（歌手名，多个用 / 分隔）、duration（时长毫秒），确保播放器正确显示歌曲信息和歌词。
- 搜索无结果时，尝试用不同的关键词组合再次搜索（如缩短关键词、只用歌名或歌手名单独搜索），不要只搜一次就放弃。
- 如果一首歌有多个同名结果（不同歌手），列出前 3-5 个让用户选择，格式如：
  "找到这些版本的《烟圈》：
  1. 功夫胖KUNGFU-PEN — 《全家福》
  2. 万乐体/999PUNKSTA/Zakiya晴子 — 《泡芙小姐 什么是真爱》
  …你想听哪个版本？"
- 播放前确认一下歌手是否匹配用户说的，尽量选最匹配的那个直接播放。

⚠️ 登录处理（重要）：
- 如果工具返回了 needLogin: true 和 qrCodeUrl，说明用户未登录网易云音乐。
- 此时你应该友好地告知用户需要登录，并提供 qrCodeUrl 链接让用户扫码。
- 回复格式示例："要播放音乐需要先登录网易云音乐哦！请用网易云音乐 APP 扫描这个二维码登录：[qrCodeUrl]"
- 用户扫码登录后，可以让他们再次尝试操作。
- 如果用户明确要求登录（比如"帮我登录"、"登录网易云"），调用 get_login_qr 工具。`;

const MUSIC_INTENT_PATTERN = /音乐|歌曲|歌单|歌手|专辑|歌词|网易云|播放|暂停|继续播放|停止播放|下一首|上一首|切歌|音量|队列|单曲|点歌|听歌|想听|好听/;

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

const TOOLS: ModuleTool[] = [
  {
    name: "search_songs",
    label: "搜索歌曲",
    risk: "read",
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
    label: "搜索歌单",
    risk: "read",
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
    label: "播放歌曲",
    risk: "write",
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
    label: "播放歌单",
    risk: "write",
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
    label: "暂停",
    risk: "write",
    description: "暂停播放。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "resume",
    label: "继续",
    risk: "write",
    description: "继续播放。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "stop",
    label: "停止",
    risk: "write",
    description: "停止播放。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "next_track",
    label: "下一首",
    risk: "write",
    description: "下一首。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "prev_track",
    label: "上一首",
    risk: "write",
    description: "上一首。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "set_volume",
    label: "设置音量",
    risk: "write",
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
    label: "跳转进度",
    risk: "write",
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
    label: "播放状态",
    risk: "read",
    description: "获取当前播放状态（当前歌曲、进度、音量、队列等）。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_queue",
    label: "播放队列",
    risk: "read",
    description: "查看播放队列。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_to_queue",
    label: "添加到队列",
    risk: "write",
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
    label: "清空队列",
    risk: "write",
    description: "清空播放队列。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_user_profile",
    label: "用户信息",
    risk: "read",
    description: "获取网易云用户信息（昵称、头像等）。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_login_qr",
    label: "登录二维码",
    risk: "read",
    description: "获取网易云音乐登录二维码。当用户未登录时，调用此工具获取扫码登录链接，引导用户用网易云音乐 APP 扫码登录。",
    input_schema: { type: "object", properties: {} },
  },
];

export const musicPlugin: ModuleToolPlugin = {
  name: "music",
  label: "音乐",
  summary: "搜索并播放网易云音乐的歌曲和歌单，控制暂停、切歌、音量、进度和播放队列",
  intent: MUSIC_INTENT_PATTERN,
  prompt: MUSIC_SYSTEM_PROMPT,
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
