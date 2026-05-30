import { useState, useEffect } from "react";
import { ListMusic } from "lucide-react";
import { playlistApi } from "../../api/client";
import PlaylistCard from "../shared/PlaylistCard";
import LoadingSpinner from "../shared/LoadingSpinner";
import EmptyState from "../shared/EmptyState";
import type { Playlist } from "../../types/ncm";

type Tab = "created" | "collected";

export default function PlaylistBrowser() {
  const [tab, setTab] = useState<Tab>("created");
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    setLoading(true);
    const fetcher = tab === "created" ? playlistApi.created : playlistApi.collected;
    fetcher()
      .then((res) => setPlaylists(extractPlaylists(res.data)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "created", label: "创建的歌单" },
    { key: "collected", label: "收藏的歌单" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-5 text-text">我的歌单</h1>
      <div className="flex gap-1 mb-6">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-2xl text-sm smooth ${
              tab === key
                ? "bg-accent/15 text-accent-dim font-medium border border-accent/20"
                : "text-text-dim hover:text-text border border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {playlists.map((pl) => <PlaylistCard key={pl.id} playlist={pl} />)}
        </div>
      ) : (
        <EmptyState
          icon={<ListMusic className="w-12 h-12" />}
          title="暂无歌单"
          description={tab === "created" ? "去创建你的第一个歌单吧" : "去收藏一些喜欢的歌单吧"}
        />
      )}
    </div>
  );
}

function extractPlaylists(data: unknown): Playlist[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  // API returns { code: 200, data: { records: [...] } }
  const inner = d.data as Record<string, unknown> | undefined;
  if (inner && Array.isArray(inner.records)) {
    return (inner.records as Array<Record<string, unknown>>).map(mapPlaylist);
  }
  if (Array.isArray(d.playlists)) return d.playlists as Playlist[];
  if (Array.isArray(d.data)) return d.data as Playlist[];
  if (Array.isArray(d)) return d as Playlist[];
  return [];
}

function mapPlaylist(raw: Record<string, unknown>): Playlist {
  return {
    id: String(raw.id ?? raw.originalId ?? ""),
    name: String(raw.name ?? ""),
    description: raw.describe ? String(raw.describe) : undefined,
    coverUrl: raw.coverImgUrl ? String(raw.coverImgUrl) : undefined,
    trackCount: raw.trackCount ? Number(raw.trackCount) : undefined,
    playCount: raw.playCount ? Number(raw.playCount) : undefined,
    creator: raw.creatorNickName ? { nickname: String(raw.creatorNickName) } : undefined,
  };
}
