import { createRequire } from "module";
import { runNcm } from "../services/ncmExecutor.js";
import type { DeepSeekTool } from "../types/chat.js";

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

export const NCM_TOOLS: DeepSeekTool[] = [
  {
    name: "search_songs",
    description: "搜索歌曲。根据关键词搜索歌曲，返回歌曲列表（含加密ID、原始ID、歌手名等）。",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "搜索关键词，如歌曲名、歌手名" },
        limit: { type: "number", description: "返回数量，默认30", default: 10 },
      },
      required: ["keyword"],
    },
  },
  {
    name: "search_playlists",
    description: "搜索歌单。根据关键词搜索歌单。",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "搜索关键词" },
        limit: { type: "number", description: "返回数量，默认10", default: 10 },
      },
      required: ["keyword"],
    },
  },
  {
    name: "search_albums",
    description: "搜索专辑。",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "搜索关键词" },
        limit: { type: "number", description: "返回数量", default: 10 },
      },
      required: ["keyword"],
    },
  },
  {
    name: "play_song",
    description: "播放指定歌曲。直接使用搜索结果的 id 和 originalId 字段即可，系统自动处理 ID 格式转换。",
    input_schema: {
      type: "object",
      properties: {
        encryptedId: { type: "string", description: "歌曲ID（直接取搜索结果的 id 字段值，支持数字ID和32位加密ID两种格式）" },
        originalId: { type: "number", description: "歌曲原始数字ID（直接取搜索结果的 originalId 字段值）" },
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
    description: "获取当前播放状态（当前歌曲、进度、音量等）。",
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
    name: "get_playlist",
    description: "获取歌单详情。",
    input_schema: {
      type: "object",
      properties: {
        playlistId: { type: "string", description: "歌单加密ID" },
      },
      required: ["playlistId"],
    },
  },
  {
    name: "get_playlist_tracks",
    description: "获取歌单中的歌曲列表。",
    input_schema: {
      type: "object",
      properties: {
        playlistId: { type: "string", description: "歌单加密ID" },
        limit: { type: "number", description: "返回数量", default: 50 },
      },
      required: ["playlistId"],
    },
  },
  {
    name: "get_daily_recommend",
    description: "获取每日推荐歌曲。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_personal_fm",
    description: "获取私人FM推荐。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_liked_songs",
    description: "获取用户收藏（红心）的歌曲列表。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_user_profile",
    description: "获取当前用户信息。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_listening_history",
    description: "获取播放历史。",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "返回数量，默认20", default: 20 },
      },
    },
  },
  {
    name: "like_song",
    description: "收藏/喜欢一首歌曲（红心）。",
    input_schema: {
      type: "object",
      properties: {
        songId: { type: "string", description: "歌曲加密ID" },
      },
      required: ["songId"],
    },
  },
  {
    name: "dislike_song",
    description: "取消收藏/不喜欢一首歌曲。",
    input_schema: {
      type: "object",
      properties: {
        songId: { type: "string", description: "歌曲加密ID" },
      },
      required: ["songId"],
    },
  },
  {
    name: "get_lyrics",
    description: "获取歌曲歌词。",
    input_schema: {
      type: "object",
      properties: {
        songId: { type: "string", description: "歌曲加密ID" },
      },
      required: ["songId"],
    },
  },
  {
    name: "get_album",
    description: "获取专辑详情。",
    input_schema: {
      type: "object",
      properties: {
        albumId: { type: "string", description: "专辑加密ID" },
      },
      required: ["albumId"],
    },
  },
  {
    name: "get_album_tracks",
    description: "获取专辑歌曲列表。",
    input_schema: {
      type: "object",
      properties: {
        albumId: { type: "string", description: "专辑加密ID" },
      },
      required: ["albumId"],
    },
  },
  {
    name: "create_playlist",
    description: "创建新歌单。创建成功后会返回歌单ID，可以之后用 add_to_playlist 添加歌曲。",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "歌单名称" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_to_playlist",
    description: "向指定歌单添加歌曲。需要歌单加密ID和歌曲加密ID列表。歌曲ID来自搜索结果中的 id 字段。",
    input_schema: {
      type: "object",
      properties: {
        playlistId: { type: "string", description: "歌单加密ID" },
        songIds: { type: "array", items: { type: "string" }, description: "歌曲加密ID列表（搜索结果的id字段）" },
      },
      required: ["playlistId", "songIds"],
    },
  },
];

const TOOL_TO_COMMAND: Record<string, (args: Record<string, unknown>) => { cmd: string; args: string[] }> = {
  search_songs: (a) => ({ cmd: "search", args: ["song", "--keyword", String(a.keyword), "--limit", String(a.limit || 10)] }),
  search_playlists: (a) => ({ cmd: "search", args: ["playlist", "--keyword", String(a.keyword), "--limit", String(a.limit || 10)] }),
  search_albums: (a) => ({ cmd: "search", args: ["album", "--keyword", String(a.keyword), "--limit", String(a.limit || 10)] }),
  play_song: (a) => {
    const args = ["play", "--song"];
    if (a.encryptedId) args.push("--encrypted-id", String(a.encryptedId));
    if (a.originalId) args.push("--original-id", String(a.originalId));
    return { cmd: "play", args: args.slice(1) };
  },
  play_playlist: (a) => {
    const args = ["play", "--playlist"];
    if (a.encryptedId) args.push("--encrypted-id", String(a.encryptedId));
    if (a.originalId) args.push("--original-id", String(a.originalId));
    return { cmd: "play", args: args.slice(1) };
  },
  pause: () => ({ cmd: "pause", args: [] }),
  resume: () => ({ cmd: "resume", args: [] }),
  stop: () => ({ cmd: "stop", args: [] }),
  next_track: () => ({ cmd: "next", args: [] }),
  prev_track: () => ({ cmd: "prev", args: [] }),
  set_volume: (a) => ({ cmd: "volume", args: [String(a.level)] }),
  seek: (a) => ({ cmd: "seek", args: [String(a.seconds)] }),
  get_playback_state: () => ({ cmd: "state", args: [] }),
  get_queue: () => ({ cmd: "queue", args: [] }),
  add_to_queue: (a) => {
    const args = ["queue", "add"];
    if (a.encryptedId) args.push("--encrypted-id", String(a.encryptedId));
    if (a.originalId) args.push("--original-id", String(a.originalId));
    return { cmd: "queue", args: args.slice(1) };
  },
  clear_queue: () => ({ cmd: "queue", args: ["clear"] }),
  get_playlist: (a) => ({ cmd: "playlist", args: ["get", "--playlistId", String(a.playlistId)] }),
  get_playlist_tracks: (a) => ({ cmd: "playlist", args: ["tracks", "--playlistId", String(a.playlistId), "--limit", String(a.limit || 50)] }),
  get_daily_recommend: () => ({ cmd: "recommend", args: ["daily"] }),
  get_personal_fm: () => ({ cmd: "recommend", args: ["fm"] }),
  get_liked_songs: () => ({ cmd: "user", args: ["favorite"] }),
  get_user_profile: () => ({ cmd: "user", args: ["info"] }),
  get_listening_history: (a) => ({ cmd: "user", args: ["history", "--limit", String(a.limit || 20)] }),
  like_song: (a) => ({ cmd: "song", args: ["like", "--songId", String(a.songId)] }),
  dislike_song: (a) => ({ cmd: "song", args: ["dislike", "--songId", String(a.songId)] }),
  get_lyrics: (a) => ({ cmd: "song", args: ["lyric", "--songId", String(a.songId)] }),
  get_album: (a) => ({ cmd: "album", args: ["get", "--albumId", String(a.albumId)] }),
  get_album_tracks: (a) => ({ cmd: "album", args: ["tracks", "--albumId", String(a.albumId)] }),
  create_playlist: (a) => ({ cmd: "playlist", args: ["create", "--playlistName", String(a.name)] }),
  add_to_playlist: (a) => ({ cmd: "playlist", args: ["add", "--playlistId", String(a.playlistId), "--songIdList", JSON.stringify(a.songIds)] }),
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (name === "play_song" || name === "play_playlist") {
    // Only stop if something is currently playing.
    // When nothing is playing, stopping is unnecessary and can prevent playback from starting.
    const state = await runNcm("state");
    if (state.success) {
      const d = state.data as Record<string, unknown> | undefined;
      const raw = (d?.state || d) as Record<string, unknown> | undefined;
      if (raw?.status === "playing") {
        await runNcm("stop");
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  // If encryptedId is not a 32-char hex, treat it as a numeric song ID.
  // Search results return numeric IDs, but ncm-cli requires encrypted IDs for playback.
  // We convert via NeteaseCloudMusicApi's song_url to get a playable URL.
  if (name === "play_song") {
    const eid = args.encryptedId as string | undefined;
    if (eid && !isHex32(eid)) {
      const numericId = Number(eid);
      if (!Number.isNaN(numericId)) {
        const url = await getSongUrl(numericId);
        if (url) {
          // Add URL to queue, then play the last queue entry by its encrypted ID
          await runNcm("queue", "add", url);
          const queueResult = await runNcm("queue");
          const qdata = queueResult.data as Record<string, unknown> | undefined;
          const items = (qdata?.items || qdata?.queue) as Array<{ encryptedId?: string }> | undefined;
          if (items && items.length > 0) {
            const last = items[items.length - 1];
            if (last?.encryptedId) {
              const result = await runNcm("play", "--song", "--encrypted-id", last.encryptedId);
              if (result.success) return minimizeResult(result.data);
            }
          }
        }
        // Fallback: try with originalId
        const oid = (args.originalId as number) || numericId;
        const result = await runNcm("play", "--song", "--original-id", String(oid));
        if (result.success) return minimizeResult(result.data);
        return { success: false, message: result.error || "播放失败：无法获取歌曲播放地址" };
      }
    }
  }

  if (name === "add_to_queue") {
    const eid = args.encryptedId as string | undefined;
    if (eid && !isHex32(eid)) {
      const numericId = Number(eid);
      if (!Number.isNaN(numericId)) {
        const url = await getSongUrl(numericId);
        if (url) {
          const result = await runNcm("queue", "add", url);
          if (result.success) return minimizeResult(result.data);
        }
        // Fallback: try with originalId
        const oid = (args.originalId as number) || numericId;
        const result = await runNcm("queue", "add", "--original-id", String(oid));
        if (result.success) return minimizeResult(result.data);
        return { success: false, message: result.error || "添加到队列失败：无法获取歌曲地址" };
      }
    }
  }

  const mapping = TOOL_TO_COMMAND[name];
  if (!mapping) return { error: `Unknown tool: ${name}` };

  const { cmd, args: cmdArgs } = mapping(args);
  const result = await runNcm(cmd, ...cmdArgs);

  if (!result.success) return { error: result.error };

  return minimizeResult(result.data);
}

/** Truncate large results for LLM context */
function minimizeResult(data: unknown): unknown {
  const str = JSON.stringify(data);
  if (str.length > 8000) {
    const truncated = JSON.parse(str);
    if (Array.isArray(truncated)) {
      return { count: truncated.length, items: truncated.slice(0, 15), _truncated: true };
    }
    if (truncated.songs) {
      truncated.songs = truncated.songs.slice(0, 15);
      truncated._truncated = true;
    }
    if (truncated.tracks) {
      truncated.tracks = truncated.tracks.slice(0, 15);
      truncated._truncated = true;
    }
    return truncated;
  }
  return data;
}
