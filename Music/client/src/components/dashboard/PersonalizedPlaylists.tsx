import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb, Disc3, Play } from "lucide-react";
import { recommendApi } from "../../api/client";
import LoadingSpinner from "../shared/LoadingSpinner";
import EmptyState from "../shared/EmptyState";
import type { Playlist } from "../../types/ncm";

export default function PersonalizedPlaylists() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    recommendApi.personalized(50)
      .then((res) => {
        const arr = extractPlaylists(res.data);
        setPlaylists(arr);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="加载猜你喜欢..." />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text">猜你喜欢</h1>
          <p className="text-xs text-text-dim mt-1">根据你的音乐口味，为你推荐歌单</p>
        </div>
      </div>
      {playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => navigate(`/playlist/${pl.id}`)}
              className="group text-left rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/80 dark:ring-zinc-800
                         hover:ring-accent/30 hover:shadow-[0_4px_20px_rgb(0_0_0_/_0.04)] transition-all duration-300 overflow-hidden"
            >
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative">
                {pl.coverUrl ? (
                  <img src={pl.coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <Disc3 className="w-8 h-8 m-auto text-zinc-300 dark:text-zinc-600 absolute inset-0" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate">{pl.name}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {pl.playCount ? `${formatCount(pl.playCount)} 次播放` : pl.trackCount ? `${pl.trackCount} 首` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Lightbulb className="w-12 h-12" />} title="暂无推荐" description="登录后可获取更精准的个性化推荐" />
      )}
    </div>
  );
}

function extractPlaylists(data: unknown): Playlist[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const arr = (Array.isArray(d.data) ? d.data : null)
    ?? (Array.isArray(d.result) ? d.result : null)
    ?? (Array.isArray(d) ? d : null);
  if (!arr) return [];
  return (arr as Array<Record<string, unknown>>).map((raw) => ({
    id: String(raw.id ?? raw.originalId ?? ""),
    name: String(raw.name ?? ""),
    description: raw.description || raw.copywriter ? String(raw.description || raw.copywriter) : undefined,
    coverUrl: (raw.coverUrl || raw.picUrl || raw.coverImgUrl) ? String(raw.coverUrl || raw.picUrl || raw.coverImgUrl) : undefined,
    trackCount: raw.trackCount ? Number(raw.trackCount) : undefined,
    playCount: raw.playCount ? Number(raw.playCount) : undefined,
  }));
}

function formatCount(n: number): string {
  if (n >= 10000_0000) return `${(n / 10000_0000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  return String(n);
}
