import { Play } from "lucide-react";
import { playbackApi } from "../../api/client";
import { usePlaybackStore } from "../../stores/playbackStore";
import { formatTime } from "../../utils/formatTime";
import type { Song } from "../../types/ncm";

export default function TrackRow({
  song, index, showCover = true,
}: {
  song: Song;
  index?: number;
  showCover?: boolean;
}) {
  const setCurrentSongId = usePlaybackStore((s) => s.setCurrentSongId);

  const updateStore = usePlaybackStore((s) => s.update);
  const storeVolume = usePlaybackStore((s) => s.volume);

  const handlePlay = () => {
    if (song.encryptedId) setCurrentSongId(song.encryptedId);
    // Optimistic UI update — shows song immediately without waiting for WebSocket
    updateStore({
      playing: true,
      song: {
        name: song.name,
        artist: song.artists?.map(a => a.name).join(" / ") || "",
        duration: song.duration / 1000,
        position: 0,
      },
      volume: storeVolume,
    });
    playbackApi.playSong(song.encryptedId, song.originalId, {
      name: song.name,
      artist: song.artists?.map(a => a.name).join(" / "),
      duration: song.duration / 1000,
    });
  };

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-accent/5 cursor-pointer group smooth border border-transparent hover:border-accent/20"
      onClick={handlePlay}
    >
      {index !== undefined && (
        <span className="w-5 text-xs text-text-dim/50 text-right tabular-nums">{index + 1}</span>
      )}
      {showCover && (
        <div className="w-10 h-10 rounded-xl bg-accent/5 flex-shrink-0 overflow-hidden border border-accent/15">
          {song.album?.coverUrl ? (
            <img src={song.album.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Play className="w-4 h-4 m-auto text-text-dim/30" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate text-text">{song.name}</p>
        <p className="text-xs text-text-dim truncate">
          {song.artists?.map((a) => a.name).join(" / ")}
          {song.album?.name ? ` · ${song.album.name}` : ""}
        </p>
      </div>
      <span className="text-xs text-text-dim/50 tabular-nums">{formatTime(song.duration / 1000)}</span>
      <button
        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent/10 text-accent smooth"
        onClick={(e) => { e.stopPropagation(); handlePlay(); }}
      >
        <Play className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
