import { useNavigate } from "react-router-dom";
import { ListMusic, Play } from "lucide-react";
import { playbackApi } from "../../api/client";
import type { Playlist } from "../../types/ncm";

export default function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const navigate = useNavigate();

  return (
    <div
      className="glass rounded-3xl p-3 cursor-pointer hover:border-accent/30 smooth group border border-accent/15 shadow-[0_4px_16px_rgba(180,150,160,0.1)]"
      onClick={() => navigate(`/playlist/${playlist.id}`)}
    >
      <div className="w-full aspect-square rounded-xl bg-accent/5 mb-3 overflow-hidden relative border border-accent/15">
        {playlist.coverUrl ? (
          <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <ListMusic className="w-8 h-8 m-auto text-text-dim/30 absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-text/20 opacity-0 group-hover:opacity-100 smooth flex items-center justify-center">
          <button
            className="p-2.5 rounded-full bg-accent text-white shadow-[0_2px_12px_rgba(240,184,196,0.3)]"
            onClick={(e) => {
              e.stopPropagation();
              playbackApi.playPlaylist(playlist.id, undefined);
            }}
          >
            <Play className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>
      <p className="text-sm font-medium truncate text-text">{playlist.name}</p>
      <p className="text-xs text-text-dim mt-0.5">
        {playlist.trackCount ? `${playlist.trackCount} 首` : ""}
      </p>
    </div>
  );
}
