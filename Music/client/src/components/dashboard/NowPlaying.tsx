import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Disc3, Heart } from "lucide-react";
import { usePlaybackStore } from "../../stores/playbackStore";
import { playbackApi, searchApi, songApi } from "../../api/client";
import { useLyrics } from "../../hooks/useLyrics";
import LyricsPanel from "./LyricsPanel";
import { formatTime } from "../../utils/formatTime";

const coverCache = new Map<string, { url: string; encryptedId: string }>();

export default function NowPlaying() {
  const {
    playing, song, volume, togglePlay: optToggle,
    tick, setVolume, seekTo, currentSongId,
  } = usePlaybackStore();
  const lyrics = useLyrics(currentSongId ?? undefined);
  const [pos, setPos] = useState(0);
  const volTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const frameRef = useRef<number>(0);
  const fillRef = useRef<HTMLDivElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [encryptedId, setEncryptedId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  // Fetch cover and ID when song changes
  useEffect(() => {
    if (!song) { setCoverUrl(null); setEncryptedId(null); setLiked(false); return; }
    const key = `${song.name}|${song.artist}`;
    if (coverCache.has(key)) {
      const cached = coverCache.get(key)!;
      setCoverUrl(cached.url);
      setEncryptedId(cached.encryptedId);
      return;
    }
    let cancelled = false;
    searchApi.songs(`${song.name} ${song.artist}`, 1).then((res) => {
      if (cancelled || !res.success || !Array.isArray(res.data)) return;
      const item = res.data[0] as Record<string, unknown> | undefined;
      if (!item) return;
      const album = item.album as Record<string, unknown> | undefined;
      const url = album?.coverUrl as string | undefined;
      const id = item.id as string | undefined;
      if (url && id) {
        coverCache.set(key, { url, encryptedId: id });
        if (!cancelled) { setCoverUrl(url); setEncryptedId(id); }
      }
    });
    return () => { cancelled = true; };
  }, [song?.name, song?.artist]);

  const toggleLike = () => {
    if (!encryptedId) return;
    if (liked) {
      songApi.dislike(encryptedId);
    } else {
      songApi.like(encryptedId);
    }
    setLiked(!liked);
  };

  useEffect(() => {
    const loop = () => {
      setPos(tick());
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [tick]);

  const togglePlay = () => {
    optToggle();
    if (playing) playbackApi.pause();
    else playbackApi.resume();
  };

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!song?.duration) return;
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

  if (!song) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-border/50 flex items-center justify-center">
            <Disc3 className="w-10 h-10 text-text-dim" />
          </div>
          <div className="absolute inset-0 rounded-full border border-accent/10 animate-ping" />
        </div>
        <p className="text-lg font-medium text-text-dim">等待播放</p>
        <p className="text-sm text-text-dim/60">在 AI 对话或搜索中开始播放音乐</p>
      </div>
    );
  }

  const duration = song.duration || 0;
  const progress = duration > 0 ? (pos / duration) * 100 : 0;

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Album cover background */}
      {coverUrl && (
        <div className="absolute inset-0 z-0">
          <img
            src={coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface/75 via-surface/70 to-surface/85" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Left: Player */}
        <div className="w-[42%] min-w-[340px] flex flex-col items-center justify-center gap-6 px-8 py-6">
          {/* Album art */}
          <div className="relative flex-shrink-0">
            {coverUrl ? (
              <div className={`w-52 h-52 rounded-3xl overflow-hidden shadow-[0_4px_30px_rgba(180,150,160,0.25)] ${
                playing ? "animate-spin" : ""
              }`} style={{ animationDuration: "12s" }}>
                <img src={coverUrl} alt={song.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-52 h-52 rounded-3xl bg-surface-raised border border-border flex items-center justify-center ${
                playing ? "animate-spin" : ""
              }`} style={{ animationDuration: "8s" }}>
                <Disc3 className="w-16 h-16 text-accent/40" />
              </div>
            )}
            {playing && (
              <div className="absolute inset-0 rounded-3xl border-2 border-accent/20 animate-ping" style={{ animationDuration: "2s" }} />
            )}
          </div>

          {/* Track info */}
          <div className="text-center w-full max-w-xs">
            <h1 className="text-lg font-bold truncate text-text">{song.name}</h1>
            <p className="text-sm text-text-dim mt-1">{song.artist}</p>
          </div>

          {/* Like button */}
          {encryptedId && (
            <button
              onClick={toggleLike}
              className={`p-2 rounded-xl smooth ${
                liked
                  ? "text-accent bg-accent/10"
                  : "text-text-dim/50 hover:text-accent hover:bg-accent/5"
              }`}
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-accent" : ""}`} />
            </button>
          )}

          {/* Progress */}
          <div className="w-full max-w-xs flex items-center gap-3 text-xs text-text-dim">
            <span className="w-10 text-right tabular-nums">{formatTime(pos)}</span>
            <div
              className="flex-1 h-2 rounded-full bg-surface-raised/60 cursor-pointer group relative overflow-hidden border border-border/30"
              onClick={handleSeek}
            >
              <div
                ref={fillRef}
                className="h-full rounded-full bg-gradient-to-r from-accent via-purple to-pink relative"
                style={{ width: `${Math.min(progress, 100)}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-accent opacity-0 group-hover:opacity-100 smooth shadow-[0_1px_6px_rgba(240,184,196,0.3)]" />
              </div>
            </div>
            <span className="w-10 tabular-nums">{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-5">
            <button
              className="p-2.5 rounded-xl hover:bg-accent/10 text-text-dim hover:text-text smooth"
              onClick={() => playbackApi.prev()}
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              className={`p-5 rounded-2xl smooth ${
                playing
                  ? "bg-accent/15 text-accent pulse-ring"
                  : "bg-gradient-to-br from-accent to-purple text-white shadow-[0_2px_16px_rgba(240,184,196,0.2)]"
              }`}
              onClick={togglePlay}
            >
              {playing
                ? <Pause className="w-6 h-6" />
                : <Play className="w-6 h-6 ml-0.5" />
              }
            </button>
            <button
              className="p-2.5 rounded-xl hover:bg-accent/10 text-text-dim hover:text-text smooth"
              onClick={() => playbackApi.next()}
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3 text-text-dim w-40">
            <Volume2 className="w-4 h-4 flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolume(Number(e.target.value))}
              style={{ "--range-fill": `${volume}%` } as React.CSSProperties}
              className="flex-1"
            />
          </div>
        </div>

        {/* Right: Lyrics */}
        <div className="flex-1 flex flex-col min-w-0 pr-8 py-8 pl-2">
          <p className="text-xs text-text-dim/60 mb-4 flex items-center gap-2 flex-shrink-0 pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
            歌词
          </p>
          <div className="flex-1 min-h-0 overflow-hidden">
            <LyricsPanel lyrics={lyrics} position={pos} playing={playing} />
          </div>
        </div>
      </div>
    </div>
  );
}
