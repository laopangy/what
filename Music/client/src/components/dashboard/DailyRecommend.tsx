import { useState, useEffect } from "react";
import { Sparkles, Play } from "lucide-react";
import { recommendApi, playbackApi } from "../../api/client";
import TrackRow from "../shared/TrackRow";
import LoadingSpinner from "../shared/LoadingSpinner";
import EmptyState from "../shared/EmptyState";
import LoginPrompt from "./LoginPrompt";
import type { Song } from "../../types/ncm";

export default function DailyRecommend() {
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);
  const [needLogin, setNeedLogin] = useState(false);

  const loadDaily = () => {
    setLoading(true);
    setNeedLogin(false);
    recommendApi.daily()
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        if (!res.success && data?.needLogin) {
          setNeedLogin(true);
        } else {
          setSongs(extractSongs(res.data));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDaily(); }, []);

  if (needLogin) {
    return <LoginPrompt onLogin={() => loadDaily()} />;
  }

  if (loading) return <LoadingSpinner text="加载每日推荐..." />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text">每日推荐</h1>
          <p className="text-xs text-text-dim mt-1">根据你的口味，每天为你推荐</p>
        </div>
        {songs.length > 0 && (
          <button
            onClick={() => { playbackApi.playSongs(songs.map(s => ({ encryptedId: s.encryptedId, originalId: s.originalId, name: s.name, artist: s.artists?.map(a => a.name).join(" / "), duration: s.duration }))); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent text-white text-sm font-medium hover:bg-accent-dim smooth"
          >
            <Play className="w-4 h-4 fill-current" /> 播放全部
          </button>
        )}
      </div>
      {songs.length > 0 ? (
        <div className="space-y-0.5">{songs.map((s, i) => <TrackRow key={s.id || `${i}`} song={s} index={i} queue={songs} />)}</div>
      ) : (
        <EmptyState icon={<Sparkles className="w-12 h-12" />} title="暂无推荐" description="请先登录并听一些歌曲" />
      )}
    </div>
  );
}

function extractSongs(data: unknown): Song[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const arr = (Array.isArray(d.data) ? d.data : null)
    ?? (Array.isArray(d.songs) ? d.songs : null)
    ?? (Array.isArray(d.dailySongs) ? d.dailySongs : null)
    ?? (Array.isArray(d) ? d : null);
  if (!arr) return [];
  return (arr as Array<Record<string, unknown>>).map((raw) => ({
    id: String(raw.id ?? raw.originalId ?? ""),
    name: String(raw.name ?? ""),
    encryptedId: raw.id ? String(raw.id) : undefined,
    originalId: raw.originalId ? Number(raw.originalId) : undefined,
    artists: Array.isArray(raw.artists)
      ? (raw.artists as Array<Record<string, unknown>>).map((a) => ({ name: String(a.name ?? ""), id: a.id ? String(a.id) : undefined }))
      : [],
    album: {
      name: raw.album && typeof raw.album === "object" ? String((raw.album as Record<string, unknown>).name ?? "") : "",
      id: raw.album && typeof raw.album === "object" && (raw.album as Record<string, unknown>).id ? String((raw.album as Record<string, unknown>).id) : undefined,
      coverUrl: (raw.coverImgUrl || raw.coverUrl) ? String(raw.coverImgUrl || raw.coverUrl) : undefined,
    },
    duration: Number(raw.duration ?? 0),
  }));
}
