import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Disc3, ListMusic, Play } from "lucide-react";
import { playbackApi, qqApi, type QQHomePlaylist } from "../../api/client";
import TrackRow from "../shared/TrackRow";
import LoadingSpinner from "../shared/LoadingSpinner";
import type { Song } from "../../types/ncm";

interface Detail extends QQHomePlaylist {
  description?: string;
  creator?: string;
  tracks: Song[];
}

export default function QQPlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    qqApi.playlist(id).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) setDetail(result.data);
      else setError(result.error || "QQ 音乐歌单加载失败");
    }).catch(() => {
      if (!cancelled) setError("QQ 音乐歌单加载失败");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!detail) {
    return <p className="text-sm text-text-dim text-center py-20">{error || "找不到这个 QQ 音乐歌单"}</p>;
  }

  const playAll = () => {
    playbackApi.playSongs(detail.tracks.map((song) => ({
      provider: "qq",
      providerId: song.providerId,
      qqMid: song.qqMid,
      mediaMid: song.mediaMid,
      name: song.name,
      artist: song.artists.map((artist) => artist.name).join(" / "),
      duration: song.duration,
    })));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="w-40 h-40 rounded-3xl bg-accent/5 border border-accent/15 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {detail.coverUrl ? (
            <img src={detail.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : detail.kind === "liked" ? (
            <Disc3 className="w-12 h-12 text-accent/45" />
          ) : (
            <ListMusic className="w-10 h-10 text-text-dim/30" />
          )}
        </div>
        <div className="flex flex-col justify-center min-w-0">
          <p className="text-xs text-accent mb-2">QQ 音乐歌单</p>
          <h1 className="text-2xl font-bold text-text break-words">{detail.name}</h1>
          {detail.creator && <p className="text-sm text-text-dim mt-1">{detail.creator}</p>}
          <p className="text-xs text-text-dim mt-2">{detail.trackCount ?? detail.tracks.length} 首</p>
          {detail.description && <p className="text-xs text-text-dim/75 mt-3 line-clamp-2">{detail.description}</p>}
          <button
            onClick={playAll}
            disabled={detail.tracks.length === 0}
            className="flex items-center gap-2 mt-4 px-5 py-2.5 rounded-2xl bg-accent text-[#17130a] text-sm font-medium hover:bg-accent-dim smooth self-start disabled:opacity-40"
          >
            <Play className="w-4 h-4 fill-current" />播放全部
          </button>
        </div>
      </div>

      {detail.tracks.length > 0 ? (
        <div className="space-y-0.5">
          {detail.tracks.map((song, index) => <TrackRow key={song.id || index} song={song} index={index} queue={detail.tracks} />)}
        </div>
      ) : (
        <p className="text-sm text-text-dim text-center py-12">这个歌单暂无歌曲</p>
      )}
    </div>
  );
}
