import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Pause, SkipBack, SkipForward, Volume2, ListMusic, X, Trash2, Shuffle, Repeat, Repeat1 } from "lucide-react";
import { usePlaybackStore } from "../../stores/playbackStore";
import { playbackApi } from "../../api/client";
import { formatTime } from "../../utils/formatTime";

interface QueueItem { index: number; name: string; artist: string; current: boolean; }

export default function MusicBar() {
  const { playing, song, volume, togglePlay: optToggle, tick, setVolume, seekTo } = usePlaybackStore();
  const navigate = useNavigate();
  const [pos, setPos] = useState(0);
  const volTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const frameRef = useRef<number>(0);
  const fillRef = useRef<HTMLDivElement>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [playMode, setPlayMode] = useState(0); // 0=sequential 1=shuffle 2=single-loop

  const cyclePlayMode = () => {
    const next = (playMode + 1) % 3;
    setPlayMode(next);
    if (next === 1) playbackApi.shuffle(); // one-time shuffle
    playbackApi.loop(next === 2 ? "single" : "none");
  };

  useEffect(() => {
    const loop = () => {
      setPos(tick());
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [tick]);

  const fetchQueue = useCallback(async () => {
    const res = await playbackApi.queue();
    if (res.success && res.data) {
      const items = (Array.isArray(res.data) ? res.data : []) as Array<Record<string, unknown>>;
      setQueue(items.map(i => ({
        index: (i.index) as number,
        name: (i.name ?? "") as string,
        artist: (i.artist ?? "") as string,
        current: (i.current) as boolean,
      })));
    }
  }, []);

  const removeFromQueue = async (idx: number) => {
    await playbackApi.queueRemove(idx);
    fetchQueue();
  };

  const togglePlay = () => {
    optToggle();
    if (playing) playbackApi.pause();
    else playbackApi.resume();
  };

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!song?.duration) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const seconds = Math.max(0, ratio * song.duration);
    const pct = (seconds / song.duration) * 100;
    setPos(seconds);
    seekTo(seconds);
    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
    playbackApi.seek(seconds);
  }, [song?.duration, seekTo]);

  const handleVolume = useCallback((value: number) => {
    setVolume(value);
    if (volTimer.current) clearTimeout(volTimer.current);
    volTimer.current = setTimeout(() => playbackApi.volume(value), 400);
  }, [setVolume]);

  const duration = song?.duration || 0;
  const progress = duration > 0 ? (pos / duration) * 100 : 0;

  return (
    <>
      <div className="h-16 glass-strong border-t border-border/50 flex items-center px-5 gap-4 cursor-pointer rounded-t-3xl"
        onClick={() => navigate("/now-playing")}>
        <div className="flex-shrink-0 flex items-center gap-1">
          {playing ? (
            <div className="flex items-end gap-[2px] h-5">
              {[0,1,2,3].map(i => <div key={i} className="eq-bar w-[3px] rounded-full bg-accent" />)}
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-accent/5 border border-accent/15 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-text-dim" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {song ? (
            <>
              <p className="text-sm font-medium truncate text-text">{song.name}</p>
              <p className="text-xs text-text-dim truncate">{song.artist}</p>
            </>
          ) : (
            <p className="text-sm text-text-dim">等待播放...</p>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button className="p-1.5 rounded-lg hover:bg-accent/8 text-text-dim hover:text-text smooth" onClick={() => playbackApi.prev()}>
            <SkipBack className="w-4 h-4" />
          </button>
          <button className={`p-2 rounded-xl smooth ${playing ? "bg-accent/10 text-accent hover:bg-accent/20" : "bg-accent/10 text-text hover:bg-accent/20"}`} onClick={togglePlay}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button className="p-1.5 rounded-lg hover:bg-accent/8 text-text-dim hover:text-text smooth" onClick={() => playbackApi.next()}>
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
        {/* Play mode cycle: sequential → shuffle → single-loop */}
        {song && (
          <button onClick={(e) => { e.stopPropagation(); cyclePlayMode(); }}
            className={`p-1.5 rounded-lg smooth ${playMode !== 0 ? "text-accent bg-accent/10" : "text-text-dim/40 hover:text-text-dim"}`}
            title={playMode === 0 ? "顺序播放" : playMode === 1 ? "乱序播放" : "单曲循环"}>
            {playMode === 0 ? <Repeat className="w-4 h-4" /> : playMode === 1 ? <Shuffle className="w-4 h-4" /> : <Repeat1 className="w-4 h-4" />}
          </button>
        )}
        {song && (
          <div className="hidden md:flex items-center gap-2 text-[11px] text-text-dim w-32" onClick={e => e.stopPropagation()}>
            <span className="tabular-nums w-8 text-right">{formatTime(pos)}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] cursor-pointer group relative" onClick={handleSeek}>
              <div ref={fillRef} className="h-full rounded-full bg-accent relative" style={{ width: `${Math.min(progress, 100)}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-accent opacity-0 group-hover:opacity-100 smooth" />
              </div>
            </div>
            <span className="tabular-nums w-8">{formatTime(duration)}</span>
          </div>
        )}
        <div className="hidden md:flex items-center gap-2 text-text-dim" onClick={e => e.stopPropagation()}>
          <button className="p-1.5 rounded-lg hover:bg-accent/8 hover:text-text smooth"
            onClick={(e) => { e.stopPropagation(); fetchQueue(); setQueueOpen(true); }} title="播放列表">
            <ListMusic className="w-4 h-4" />
          </button>
          <Volume2 className="w-4 h-4 flex-shrink-0" />
          <input type="range" min={0} max={100} value={volume}
            onChange={e => handleVolume(Number(e.target.value))}
            style={{"--range-fill": `${volume}%`} as React.CSSProperties} className="w-24" />
        </div>
      </div>

      {/* Queue popup */}
      {queueOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center pb-20" onClick={() => setQueueOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative w-full max-w-md mx-4 max-h-[60vh] bg-white dark:bg-zinc-900 rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-sm font-semibold text-text">播放列表</span>
              <button onClick={() => setQueueOpen(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-dim">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {queue.length === 0 ? (
                <p className="text-sm text-text-dim text-center py-10">暂无待播歌曲</p>
              ) : (
                queue.map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b border-zinc-50 dark:border-zinc-800/50 ${item.current ? "bg-accent/5 text-accent" : "text-text"}`}>
                    <span className="w-5 text-xs text-text-dim text-right">{item.index + 1}</span>
                    <span className="flex-1 truncate">{item.name}</span>
                    <span className="text-xs text-text-dim truncate max-w-[100px]">{item.artist}</span>
                    {!item.current && (
                      <button onClick={() => removeFromQueue(item.index)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-text-dim/40 hover:text-red-400 transition-colors"
                        title="移除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
