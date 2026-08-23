import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { searchApi } from "../../api/client";
import TrackRow from "../shared/TrackRow";
import PlaylistCard from "../shared/PlaylistCard";
import LoadingSpinner from "../shared/LoadingSpinner";
import EmptyState from "../shared/EmptyState";
import type { Song, Playlist } from "../../types/ncm";

type Tab = "songs" | "playlists" | "albums";
type Provider = "netease" | "qq";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("songs");
  const [provider, setProvider] = useState<Provider>("netease");
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      if (tab === "songs") {
        const res = await searchApi.songs(query, undefined, provider);
        setSongs(extractSongs(res.data));
      } else if (tab === "playlists") {
        const res = await searchApi.playlists(query);
        setPlaylists(extractPlaylists(res.data));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [query, tab, provider]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "songs", label: "歌曲" },
    { key: "playlists", label: "歌单" },
    { key: "albums", label: "专辑" },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-5 text-text">搜索</h1>

      <div className="flex gap-1 mb-4 p-1 w-fit rounded-2xl glass border border-border/50">
        {(["netease", "qq"] as Provider[]).map((source) => (
          <button
            key={source}
            onClick={() => {
              setProvider(source);
              setTab("songs");
              setSongs([]);
              setPlaylists([]);
              setHasSearched(false);
            }}
            className={`px-4 py-2 rounded-xl text-xs smooth ${
              provider === source ? "bg-accent text-white" : "text-text-dim hover:text-text"
            }`}
          >
            {source === "netease" ? "网易云音乐" : "QQ 音乐"}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        <div className="flex-1 flex items-center gap-3 glass rounded-2xl border border-border/50 focus-within:border-accent/40 focus-within:shadow-[0_2px_12px_rgba(240,184,196,0.1)] smooth px-4 py-3">
          <Search className="w-4 h-4 text-text-dim/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索歌曲、歌单、专辑..."
            className="flex-1 bg-transparent text-sm text-text placeholder-text-dim/40 outline-none"
          />
        </div>
        <button
          onClick={doSearch}
          disabled={!query.trim() || loading}
          className="px-5 py-3 rounded-2xl bg-accent text-white text-sm font-medium hover:bg-accent-dim disabled:opacity-30 smooth"
        >
          {loading ? "搜索中..." : "搜索"}
        </button>
      </div>

      <div className="flex gap-1 mb-6">
        {tabs.filter(({ key }) => provider === "netease" || key === "songs").map(({ key, label }) => (
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
      ) : hasSearched ? (
        tab === "songs" ? (
          songs.length > 0 ? (
            <div className="space-y-0.5">
              {songs.map((song, i) => <TrackRow key={song.id || `${i}`} song={song} index={i} queue={songs} />)}
            </div>
          ) : (
            <EmptyState icon={<Search className="w-10 h-10" />} title="没有找到歌曲" />
          )
        ) : playlists.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {playlists.map((pl) => <PlaylistCard key={pl.id} playlist={pl} />)}
          </div>
        ) : (
          <EmptyState icon={<Search className="w-10 h-10" />} title="没有找到歌单" />
        )
      ) : (
        <EmptyState
          icon={<Search className="w-14 h-14" />}
          title="输入关键词搜索"
          description="支持歌曲名、歌手名、歌单名"
        />
      )}
    </div>
  );
}

function extractSongs(data: unknown): Song[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const inner = d.data as Record<string, unknown> | undefined;
  const records = (inner && Array.isArray(inner.records) ? inner.records : null)
    ?? (Array.isArray(d.records) ? d.records : null)
    ?? (Array.isArray(d.songs) ? d.songs : null)
    ?? (Array.isArray(d.data) ? d.data : null)
    ?? (Array.isArray(d) ? d : null);
  if (!records) return [];
  return (records as Array<Record<string, unknown>>).map((raw) => ({
    id: String(raw.id ?? raw.originalId ?? ""),
    name: String(raw.name ?? ""),
    encryptedId: raw.id ? String(raw.id) : undefined,
    originalId: raw.originalId ? Number(raw.originalId) : undefined,
    provider: raw.provider === "qq" ? "qq" : "netease",
    providerId: raw.providerId ? String(raw.providerId) : undefined,
    qqMid: raw.qqMid ? String(raw.qqMid) : undefined,
    mediaMid: raw.mediaMid ? String(raw.mediaMid) : undefined,
    artists: Array.isArray(raw.artists)
      ? (raw.artists as Array<Record<string, unknown>>).map((a) => ({ name: String(a.name ?? ""), id: a.id ? String(a.id) : undefined }))
      : [],
    album: {
      name: raw.album && typeof raw.album === "object" ? String((raw.album as Record<string, unknown>).name ?? "") : "",
      id: raw.album && typeof raw.album === "object" && (raw.album as Record<string, unknown>).id ? String((raw.album as Record<string, unknown>).id) : undefined,
      coverUrl: raw.coverImgUrl ? String(raw.coverImgUrl) : undefined,
    },
    duration: Number(raw.duration ?? 0),
  }));
}

function extractPlaylists(data: unknown): Playlist[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const inner = d.data as Record<string, unknown> | undefined;
  const records = (inner && Array.isArray(inner.records) ? inner.records : null)
    ?? (Array.isArray(d.playlists) ? d.playlists : null)
    ?? (Array.isArray(d.data) ? d.data : null)
    ?? (Array.isArray(d) ? d : null);
  if (!records) return [];
  return (records as Array<Record<string, unknown>>).map((raw) => ({
    id: String(raw.id ?? raw.originalId ?? ""),
    name: String(raw.name ?? ""),
    description: raw.describe ? String(raw.describe) : undefined,
    coverUrl: raw.coverImgUrl ? String(raw.coverImgUrl) : undefined,
    trackCount: raw.trackCount ? Number(raw.trackCount) : undefined,
    playCount: raw.playCount ? Number(raw.playCount) : undefined,
    creator: raw.creatorNickName ? { nickname: String(raw.creatorNickName) } : undefined,
  }));
}
