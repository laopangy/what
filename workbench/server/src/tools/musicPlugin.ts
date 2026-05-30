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
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${MUSIC_URL}${path}`, opts);
  const json = await res.json();
  if (!json.success) return { error: json.error || "Music API error" } as T;
  return (json.data ?? json) as T;
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
    description: "播放指定歌曲。需要加密ID和原始ID。用户提供歌曲名和歌手名时，请根据上下文查找ID；如果没有ID信息，告知用户需要提供歌曲的加密ID和原始ID。",
    input_schema: {
      type: "object",
      properties: {
        encryptedId: { type: "string", description: "歌曲加密ID（32位hex字符串）" },
        originalId: { type: "number", description: "歌曲原始数字ID" },
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
];

export const musicPlugin: ModuleToolPlugin = {
  name: "music",
  tools: TOOLS,
  async execute(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "search_songs":
        return musicFetch("GET", `/api/search/songs?q=${encodeURIComponent(String(args.keyword || ""))}&limit=${args.limit || 10}`);
      case "search_playlists":
        return musicFetch("GET", `/api/search/playlists?q=${encodeURIComponent(String(args.keyword || ""))}&limit=${args.limit || 10}`);
      case "play_song":
        return musicFetch("POST", "/api/playback/play-song", { encryptedId: args.encryptedId, originalId: args.originalId });
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
      default:
        return { error: `Unknown tool: ${name}` };
    }
  },
};
