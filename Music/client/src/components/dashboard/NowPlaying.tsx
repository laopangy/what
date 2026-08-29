import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown, ChevronUp, Disc3, Heart, ListMusic,
  MoreHorizontal, Pause, Play, Repeat1, Shuffle, SkipBack,
  SkipForward, Volume2,
} from "lucide-react";
import { usePlaybackStore } from "../../stores/playbackStore";
import { playbackApi, searchApi, songApi } from "../../api/client";
import { useLyrics } from "../../hooks/useLyrics";
import LyricsPanel from "./LyricsPanel";
import { formatTime } from "../../utils/formatTime";

const coverCache = new Map<string, { url: string; encryptedId: string }>();
const fallbackPalettes = [
  [35, 184, 196], [79, 142, 247], [163, 105, 231],
  [224, 116, 94], [83, 177, 119], [218, 154, 22],
] as const;

interface PlayerStyle extends CSSProperties {
  "--player-accent": string;
  "--player-rgb": string;
  "--ambient-rgb": string;
  "--color-accent": string;
  "--color-accent-dim": string;
}

export default function NowPlaying() {
  const navigate = useNavigate();
  const {
    playing, song, volume, togglePlay: optToggle,
    tick, setVolume, seekTo, currentSongId,
  } = usePlaybackStore();
  const lyrics = useLyrics(currentSongId ?? undefined);
  const [pos, setPos] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [encryptedId, setEncryptedId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [playMode, setPlayMode] = useState(0);
  const [palette, setPalette] = useState<[number, number, number]>([35, 184, 196]);
  const volTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!song) {
      setCoverUrl(null); setEncryptedId(null); setLiked(false);
      return;
    }
    const key = `${currentSongId ?? ""}|${song.name}|${song.artist}`;
    const isQQ = currentSongId?.startsWith("qq:") ?? false;
    setCoverUrl(null);
    setEncryptedId(isQQ ? null : currentSongId);
    setLiked(false);

    if (currentSongId && !isQQ) {
      songApi.isLiked(currentSongId).then((result) => {
        if (result.success && result.data) setLiked(result.data.liked);
      }).catch(() => {});
    }

    const cached = coverCache.get(key);
    if (cached) {
      setCoverUrl(cached.url);
      setEncryptedId(isQQ ? null : (currentSongId || cached.encryptedId));
      return;
    }

    let cancelled = false;
    searchApi.songs(`${song.name} ${song.artist}`, 1, isQQ ? "qq" : "netease").then((res) => {
      if (cancelled || !res.success || !res.data) return;
      const data = res.data as Record<string, unknown>;
      const inner = (data.data ?? data) as Record<string, unknown>;
      const records = (Array.isArray(data) ? data : inner.records) as Array<Record<string, unknown>> | undefined;
      const item = records?.[0];
      if (!item) return;
      const album = item.album as Record<string, unknown> | undefined;
      const url = album?.coverUrl as string | undefined;
      const id = currentSongId || item.id as string | undefined;
      if (!id) return;
      coverCache.set(key, { url: url || "", encryptedId: id });
      if (cancelled) return;
      if (url) setCoverUrl(url);
      setEncryptedId(isQQ ? null : id);
      if (!currentSongId && !isQQ) {
        songApi.isLiked(id).then((result) => {
          if (!cancelled && result.success && result.data) setLiked(result.data.liked);
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [song?.name, song?.artist, currentSongId]);

  useEffect(() => {
    if (!song) return;
    const fallback = fallbackColor(`${song.name}|${song.artist}|${coverUrl || ""}`);
    setPalette(fallback);
    if (!coverUrl) return;
    let cancelled = false;
    extractCoverColor(coverUrl).then((color) => {
      if (!cancelled && color) setPalette(color);
    });
    return () => { cancelled = true; };
  }, [coverUrl, song?.name, song?.artist]);

  useEffect(() => {
    const loop = () => {
      setPos(tick());
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [tick]);

  const playerStyle = useMemo<PlayerStyle>(() => {
    const [r, g, b] = palette;
    const accent = "rgb(0 232 139)";
    return {
      "--player-accent": accent,
      "--player-rgb": "0 232 139",
      "--ambient-rgb": `${r} ${g} ${b}`,
      "--color-accent": accent,
      "--color-accent-dim": "rgb(82 245 174)",
    };
  }, [palette]);

  const togglePlay = () => {
    optToggle();
    if (playing) playbackApi.pause();
    else playbackApi.resume();
  };

  const toggleLike = () => {
    if (!encryptedId) return;
    if (liked) songApi.dislike(encryptedId);
    else songApi.like(encryptedId);
    setLiked(!liked);
  };

  const cyclePlayMode = () => {
    const next = (playMode + 1) % 3;
    setPlayMode(next);
    if (next === 1) playbackApi.shuffle();
    playbackApi.loop(next === 2 ? "single" : "none");
  };

  const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!song?.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const seconds = Math.max(0, ((event.clientX - rect.left) / rect.width) * song.duration);
    setPos(seconds);
    seekTo(seconds);
    playbackApi.seek(seconds);
  }, [song?.duration, seekTo]);

  const handleVolume = useCallback((value: number) => {
    setVolume(value);
    if (volTimer.current) clearTimeout(volTimer.current);
    volTimer.current = setTimeout(() => playbackApi.volume(value), 400);
  }, [setVolume]);

  if (!song) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#090b0d]">
        <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center">
          <Disc3 className="w-10 h-10 text-white/25" />
        </div>
        <p className="text-lg font-medium text-white/55">等待播放</p>
        <p className="text-sm text-white/30">在主页或搜索中选择一首歌</p>
      </div>
    );
  }

  const duration = song.duration || 0;
  const progress = duration > 0 ? (pos / duration) * 100 : 0;

  return (
    <div className="player-theme h-full min-h-[540px] relative overflow-hidden text-white" style={playerStyle}>
      <div className="absolute -inset-20 bg-[#171817]">
        {coverUrl && <img src={coverUrl} alt="" className="w-full h-full object-cover scale-110 blur-[88px] opacity-75" />}
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(27,25,23,.48)_0%,rgba(27,26,24,.24)_42%,rgba(24,24,23,.46)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_43%,rgb(var(--ambient-rgb)/.24),transparent_34%),radial-gradient(circle_at_78%_36%,rgb(var(--ambient-rgb)/.12),transparent_42%)]" />
      <div className="absolute inset-0 bg-[rgba(104,117,127,.34)]" />
      {coverUrl && (
        <div className="player-art-dissolve absolute left-[6%] top-1/2 w-[min(36vw,52vh,420px)] aspect-square -translate-y-1/2">
          <img
            src={coverUrl}
            alt=""
            className="player-art-vertical-fade w-full h-full object-contain object-center brightness-[1.08] contrast-[1.05] saturate-[1.06]"
          />
        </div>
      )}
      <div className="absolute inset-0 opacity-[0.09] player-grain" />

      <div className="relative z-10 h-full flex flex-col px-5 sm:px-8 lg:px-10 pt-8 pb-20">
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-10 items-center">
          <div className="hidden md:flex items-center justify-center min-h-0" aria-hidden="true">
            {!coverUrl && <Disc3 className="w-24 h-24 text-white/16" />}
          </div>

          <section className="h-full min-h-0 flex flex-col justify-center max-w-[720px] mx-auto md:mx-0 w-full pt-2" aria-label="歌词">
            <div className="mb-2 text-center">
              <h1 className="text-lg lg:text-xl font-medium tracking-[0.02em] text-white/95 truncate">{song.name}</h1>
              <p className="mt-1 text-sm text-white/58 truncate">{song.artist}</p>
            </div>
            <div className="h-[46vh] min-h-56 max-h-[400px] overflow-hidden player-lyrics-mask">
              <LyricsPanel lyrics={lyrics} position={pos} playing={playing} />
            </div>
          </section>
        </div>

        <footer className="absolute bottom-2 left-5 right-5 sm:left-8 sm:right-8 lg:left-10 lg:right-10 pt-3">
          <div className="flex items-center gap-2 text-[11px] text-white/42 tabular-nums">
            <span className="sr-only">{formatTime(pos)}</span>
            <div className="group flex-1 h-4 flex items-center cursor-pointer" onClick={handleSeek} role="slider" aria-label="播放进度" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(pos)}>
              <div className="relative w-full h-[3px] bg-white/20">
                <div className="absolute inset-y-0 left-0 bg-[var(--player-accent)]" style={{ width: `${Math.min(progress, 100)}%` }} />
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${Math.min(progress, 100)}%` }} />
              </div>
            </div>
            <span className="sr-only">{formatTime(duration)}</span>
          </div>

          <div className="mt-1 flex items-center justify-between min-h-12">
            <div className="flex items-center gap-1 sm:gap-2">
              <ControlButton label="上一首" onClick={() => playbackApi.prev()}><SkipBack className="w-[18px] h-[18px] fill-current" /></ControlButton>
              <button onClick={togglePlay} className="p-2.5 text-white/82 hover:text-white transition-colors" title={playing ? "暂停" : "播放"}>
                {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-0.5 fill-current" />}
              </button>
              <ControlButton label="下一首" onClick={() => playbackApi.next()}><SkipForward className="w-[18px] h-[18px] fill-current" /></ControlButton>
              {encryptedId && (
                <ControlButton label={liked ? "取消喜欢" : "喜欢"} onClick={toggleLike} active={liked}>
                  <Heart className={`w-[19px] h-[19px] ${liked ? "fill-current" : ""}`} />
                </ControlButton>
              )}
              <ControlButton label="播放列表" onClick={() => navigate("/queue")}><ListMusic className="w-[19px] h-[19px]" /></ControlButton>
              <ControlButton label="播放模式" onClick={cyclePlayMode} active={playMode !== 0}>
                {playMode === 1 ? <Shuffle className="w-[19px] h-[19px]" /> : playMode === 2 ? <Repeat1 className="w-[19px] h-[19px]" /> : <MoreHorizontal className="w-5 h-5" />}
              </ControlButton>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden sm:flex items-center gap-2 text-white/55">
                <Volume2 className="w-4 h-4" />
                <input type="range" aria-label="音量" min={0} max={100} value={volume} onChange={(event) => handleVolume(Number(event.target.value))} style={{ "--range-fill": `${volume}%` } as CSSProperties} className="w-20 lg:w-24" />
              </div>
              <button title="收起播放页" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.08] text-white/80 hover:bg-white/[0.14] transition-colors">
                <ChevronUp className="w-5 h-5" />
              </button>
              <button title="返回首页" onClick={() => navigate("/", { state: { forceHome: Date.now() } })} className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--player-accent)] text-[#052217] hover:brightness-110 transition-all">
                <ChevronDown className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ControlButton({ children, label, onClick, active = false }: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button onClick={onClick} title={label} className={`p-2.5 rounded-full transition-all duration-200 ${active ? "text-[var(--player-accent)] bg-white/[0.07]" : "text-white/60 hover:text-white hover:bg-white/[0.07]"}`}>
      {children}
    </button>
  );
}

function fallbackColor(seed: string): [number, number, number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return [...fallbackPalettes[Math.abs(hash) % fallbackPalettes.length]];
}

async function extractCoverColor(url: string): Promise<[number, number, number] | null> {
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 40; canvas.height = 40;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, 40, 40);
        const pixels = context.getImageData(0, 0, 40, 40).data;
        const buckets = new Map<string, { score: number; r: number; g: number; b: number; count: number }>();
        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i]; const g = pixels[i + 1]; const b = pixels[i + 2]; const alpha = pixels[i + 3];
          if (alpha < 200) continue;
          const max = Math.max(r, g, b); const min = Math.min(r, g, b);
          const light = (max + min) / 2;
          const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * light - 255));
          if (light < 22 || light > 235 || saturation < 0.12) continue;
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const bucket = buckets.get(key) || { score: 0, r: 0, g: 0, b: 0, count: 0 };
          bucket.score += 0.35 + saturation;
          bucket.r += r; bucket.g += g; bucket.b += b; bucket.count += 1;
          buckets.set(key, bucket);
        }
        const best = [...buckets.values()].sort((a, b) => b.score - a.score)[0];
        if (!best) return resolve(null);
        let r = Math.round(best.r / best.count); let g = Math.round(best.g / best.count); let b = Math.round(best.b / best.count);
        const max = Math.max(r, g, b);
        if (max < 150) {
          const boost = 150 / Math.max(1, max);
          r = Math.min(235, Math.round(r * boost)); g = Math.min(235, Math.round(g * boost)); b = Math.min(235, Math.round(b * boost));
        }
        resolve([r, g, b]);
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = `/api/theme/cover-image?url=${encodeURIComponent(url)}`;
  });
}
