import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Play, ListMusic } from "lucide-react";
import { playlistApi, playbackApi } from "../../api/client";
import TrackRow from "../shared/TrackRow";
import LoadingSpinner from "../shared/LoadingSpinner";
import type { Song, Playlist } from "../../types/ncm";

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([playlistApi.detail(id), playlistApi.tracks(id)])
      .then(([detailRes, tracksRes]) => {
        setPlaylist(extractPlaylist(detailRes.data));
        setTracks(extractSongs(tracksRes.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {playlist && (
        <div className="flex gap-6 mb-8">
          <div className="w-40 h-40 rounded-3xl bg-accent/5 border border-accent/15 flex-shrink-0 overflow-hidden">
            {playlist.coverUrl ? (
              <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <ListMusic className="w-10 h-10 m-auto text-text-dim/30" />
            )}
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-bold text-text">{playlist.name}</h1>
            {playlist.creator && <p className="text-sm text-text-dim mt-1">{playlist.creator.nickname}</p>}
            <p className="text-xs text-text-dim mt-1">
              {playlist.trackCount ? `${playlist.trackCount} 首` : ""}
              {playlist.playCount ? ` · 播放 ${formatCount(playlist.playCount)}` : ""}
            </p>
            <button
              onClick={() => { if (id) playbackApi.playPlaylist(id, undefined); }}
              className="flex items-center gap-2 mt-4 px-5 py-2.5 rounded-2xl bg-gradient-to-br from-accent to-purple text-white text-sm font-medium hover:shadow-[0_2px_12px_rgba(240,184,196,0.2)] smooth self-start"
            >
              <Play className="w-4 h-4 fill-current" /> 播放全部
            </button>
          </div>
        </div>
      )}
      {tracks.length > 0 ? (
        <div className="space-y-0.5">
          {tracks.map((song, i) => <TrackRow key={song.id || `${i}`} song={song} index={i} />)}
        </div>
      ) : (
        <p className="text-sm text-text-dim text-center py-12">暂无歌曲</p>
      )}
    </div>
  );
}

function extractPlaylist(data: unknown): Playlist | null {
  const d = data as Record<string, unknown> | null;
  if (!d) return null;
  // API returns { data: { ...playlistFields } }
  const inner = (d.data || d.playlist || d) as Record<string, unknown>;
  if (!inner || !inner.id) return null;
  return {
    id: String(inner.id ?? inner.originalId ?? ""),
    name: String(inner.name ?? ""),
    description: inner.describe ? String(inner.describe) : undefined,
    coverUrl: inner.coverImgUrl ? String(inner.coverImgUrl) : undefined,
    trackCount: inner.trackCount ? Number(inner.trackCount) : undefined,
    playCount: inner.playCount ? Number(inner.playCount) : undefined,
    creator: inner.creatorNickName ? { nickname: String(inner.creatorNickName) } : undefined,
  };
}

function extractSongs(data: unknown): Song[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const arr =
    (Array.isArray(d.data) ? d.data : null) ??
    (Array.isArray(d.tracks) ? d.tracks : null) ??
    (Array.isArray(d.songs) ? d.songs : null) ??
    (Array.isArray(d) ? d : null);
  if (!arr) return [];
  return (arr as Array<Record<string, unknown>>).map(mapSong);
}

function mapSong(raw: Record<string, unknown>): Song {
  const artists = Array.isArray(raw.artists)
    ? (raw.artists as Array<Record<string, unknown>>).map((a) => ({ name: String(a.name ?? ""), id: a.id ? String(a.id) : undefined }))
    : [];
  const album = raw.album && typeof raw.album === "object"
    ? { name: String((raw.album as Record<string, unknown>).name ?? ""), id: (raw.album as Record<string, unknown>).id ? String((raw.album as Record<string, unknown>).id) : undefined, coverUrl: (raw.album as Record<string, unknown>).coverImgUrl ? String((raw.album as Record<string, unknown>).coverImgUrl) : undefined }
    : { name: "", id: undefined, coverUrl: undefined };
  return {
    id: String(raw.id ?? raw.originalId ?? ""),
    name: String(raw.name ?? ""),
    encryptedId: raw.id ? String(raw.id) : undefined,
    originalId: raw.originalId ? Number(raw.originalId) : undefined,
    artists,
    album,
    duration: Number(raw.duration ?? 0),
  };
}

function formatCount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  return String(n);
}
