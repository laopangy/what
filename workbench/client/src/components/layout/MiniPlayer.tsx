import { useEffect, useRef, useState, useCallback } from "react";
import { Music, Play, Pause, GripVertical } from "lucide-react";
import { onMusicEvent } from "../../api/musicSocket";
import { usePlaybackStore } from "../../stores/playbackStore";

const MUSIC_API = "http://localhost:3001/api";

async function musicFetch(method: string, path: string) {
  try {
    await fetch(`${MUSIC_API}${path}`, { method });
  } catch { /* ignore */ }
}

export default function MiniPlayer() {
  const { playing, song } = usePlaybackStore();
  const update = usePlaybackStore((s) => s.update);
  const togglePlaying = usePlaybackStore((s) => s.togglePlaying);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(0);
  const rafRef = useRef<number>(0);

  const [drag, setDrag] = useState({ x: window.innerWidth - 340, y: 16 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });
  const dragged = useRef(false);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onMusicEvent("playback:state", (data) => {
      const d = data as Record<string, unknown> | undefined;
      if (!d) return;
      const pl = (typeof d.playing === "boolean") ? d.playing : false;
      const sng = d.song as Record<string, unknown> | undefined;
      const songInfo = sng?.name
        ? {
            name: sng.name as string,
            artist: (sng.artist as string) || "",
            duration: (sng.duration as number) || 0,
            position: (sng.position as number) || 0,
          }
        : null;
      const vol = (typeof d.volume === "number") ? d.volume : 70;
      update(pl, songInfo, vol);
      setVisible(!!songInfo);
      if (songInfo) setPos(songInfo.position);
    });
    return unsub;
  }, [update]);

  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const s = usePlaybackStore.getState();
      if (s.playing && s.song) {
        setPos((prev) => Math.min(prev + (now - last) / 1000, s.song!.duration));
      }
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragged.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, elX: drag.x, elY: drag.y };
  }, [drag.x, drag.y]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged.current = true;
      setDrag({
        x: Math.max(0, Math.min(dragStart.current.elX + dx, window.innerWidth - 320)),
        y: Math.max(0, Math.min(dragStart.current.elY + dy, window.innerHeight - 80)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlaying(); // instant UI feedback
    if (playing) {
      musicFetch("POST", "/playback/pause");
    } else {
      musicFetch("POST", "/playback/resume");
    }
  };

  const openMusic = () => {
    if (dragged.current) return;
    window.open("http://localhost:5173/now-playing", "_blank");
  };

  const progress = song && song.duration > 0 ? (pos / song.duration) * 100 : 0;

  if (!visible) return null;

  return (
    <div
      ref={elRef}
      className="fixed z-50 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-raised/95 backdrop-blur border border-accent/30 shadow-lg hover:border-accent/50 transition-colors select-none max-w-[300px]"
      style={{ left: drag.x, top: drag.y }}
    >
      {/* Drag handle */}
      <span
        onMouseDown={onMouseDown}
        className="cursor-grab active:cursor-grabbing text-text-dim shrink-0"
      >
        <GripVertical className="w-3 h-3" />
      </span>

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          playing ? "bg-accent/20 hover:bg-accent/30" : "bg-accent/10 hover:bg-accent/20"
        }`}
      >
        {playing ? (
          <div className="flex gap-0.5 items-end h-3">
            <span className="w-0.5 bg-accent-dim rounded-full animate-bounce" style={{ height: "60%", animationDelay: "0ms" }} />
            <span className="w-0.5 bg-accent-dim rounded-full animate-bounce" style={{ height: "100%", animationDelay: "120ms" }} />
            <span className="w-0.5 bg-accent-dim rounded-full animate-bounce" style={{ height: "40%", animationDelay: "240ms" }} />
          </div>
        ) : (
          <Music className="w-3.5 h-3.5 text-accent-dim" />
        )}
      </button>

      {/* Song info — click to open Music app */}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={openMusic}>
        <div className="text-[11px] font-medium text-text truncate">{song?.name || "未在播放"}</div>
        <div className="text-[10px] text-text-dim truncate">{song?.artist || ""}</div>
        {song && song.duration > 0 && (
          <div className="mt-0.5 h-0.5 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {/* Play/Pause toggle */}
      <button
        onClick={togglePlay}
        className="text-accent-dim hover:text-accent shrink-0 cursor-pointer p-0.5"
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
