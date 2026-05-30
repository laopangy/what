import type { ToolCall } from "../../types/chat";
import { Wrench, ChevronDown, ChevronUp, Search, Play, Pause, SkipForward, SkipBack, Volume2, ListMusic, Heart, Sparkles, User, Clock, Plus, BookOpen, Disc, Zap } from "lucide-react";
import { useState } from "react";

const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  search_songs: Search, search_playlists: Search, search_albums: Search,
  play_song: Play, play_playlist: Play,
  pause: Pause, resume: Play, stop: Pause, next_track: SkipForward, prev_track: SkipBack,
  set_volume: Volume2, seek: Clock,
  get_playback_state: Play, get_queue: ListMusic,
  add_to_queue: Plus, clear_queue: ListMusic,
  get_playlist: ListMusic, get_playlist_tracks: ListMusic,
  get_daily_recommend: Sparkles, get_personal_fm: Sparkles,
  get_liked_songs: Heart, get_user_profile: User,
  get_listening_history: Clock, like_song: Heart, dislike_song: Heart,
  get_lyrics: BookOpen, get_album: Disc, get_album_tracks: Disc,
  create_playlist: Plus, add_to_playlist: Plus,
};

const toolLabels: Record<string, string> = {
  search_songs: "搜索歌曲", search_playlists: "搜索歌单", search_albums: "搜索专辑",
  play_song: "播放歌曲", play_playlist: "播放歌单",
  pause: "暂停", resume: "继续", stop: "停止",
  next_track: "下一首", prev_track: "上一首",
  set_volume: "设置音量", seek: "跳转进度",
  get_playback_state: "播放状态", get_queue: "播放队列",
  add_to_queue: "添加到队列", clear_queue: "清空队列",
  get_playlist: "歌单详情", get_playlist_tracks: "歌单歌曲",
  get_daily_recommend: "每日推荐", get_personal_fm: "私人FM",
  get_liked_songs: "我喜欢的", get_user_profile: "用户信息",
  get_listening_history: "播放历史", like_song: "收藏歌曲", dislike_song: "取消收藏",
  get_lyrics: "查看歌词", get_album: "专辑详情", get_album_tracks: "专辑歌曲",
  create_playlist: "创建歌单", add_to_playlist: "添加歌曲到歌单",
};

export default function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [open, setOpen] = useState(false);
  const Icon = toolIcons[toolCall.name] || Zap;
  const label = toolLabels[toolCall.name] || toolCall.name;

  const summary = toolCall.args
    ? Object.values(toolCall.args).find((v) => typeof v === "string" && v.length > 0)
    : undefined;

  return (
    <div className="mb-2 text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent-dim hover:bg-accent/15 transition-all"
      >
        <Wrench className="w-3 h-3" />
        <Icon className="w-3 h-3" />
        <span className="font-medium">{label}</span>
        {summary && <span className="text-text-dim truncate max-w-[120px]">— {String(summary)}</span>}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && toolCall.result !== undefined && (
        <pre className="mt-1 p-2 rounded-lg bg-surface-raised border border-border text-[11px] text-text-dim overflow-auto max-h-32">
          {JSON.stringify(toolCall.result, null, 2)}
        </pre>
      )}
    </div>
  );
}
