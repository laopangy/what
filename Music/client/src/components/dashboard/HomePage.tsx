import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Heart, ListMusic, Clock, Play, ChevronRight, Disc3, Lightbulb } from "lucide-react";
import {
  recommendApi, userApi, playlistApi, playbackApi, qqApi,
  type QQHomeChart, type QQHomePlaylist,
} from "../../api/client";
import type { Song, Playlist } from "../../types/ncm";
import WorkPlaylistButton from "./WorkPlaylistButton";

export default function HomePage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState<"netease" | "qq">(() =>
    localStorage.getItem("music-home-provider") === "qq" ? "qq" : "netease"
  );
  const [daily, setDaily] = useState<Song[]>([]);
  const [liked, setLiked] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [personalized, setPersonalized] = useState<Playlist[]>([]);
  const [qqCharts, setQqCharts] = useState<QQHomeChart[]>([]);
  const [qqLibrary, setQqLibrary] = useState<{
    liked?: QQHomePlaylist;
    created: QQHomePlaylist[];
    collected: QQHomePlaylist[];
  }>({ created: [], collected: [] });
  const [qqLoggedIn, setQqLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);

  // Load all data, then show page
  useEffect(() => {
    let c = false;
    setReady(false);
    if (provider === "qq") {
      qqApi.home().then((result) => {
        if (c) return;
        setQqCharts(result.success && result.data ? result.data.charts : []);
        setQqLibrary(result.success && result.data ? result.data.library : { created: [], collected: [] });
        setQqLoggedIn(Boolean(result.data?.account.loggedIn));
      }).catch(() => {}).finally(() => { if (!c) setReady(true); });
      return () => { c = true; };
    }
    Promise.all([
      recommendApi.daily().then(r => extractSongs(r.data)).catch(() => [] as Song[]),
      userApi.liked().then(r => extractSongs(r.data)).catch(() => [] as Song[]),
      playlistApi.created(10).then(r => extractPlaylists(r.data)).catch(() => [] as Playlist[]),
      userApi.history(8).then(r => extractSongs(r.data)).catch(() => [] as Song[]),
      recommendApi.personalized(10).then(r => extractPlaylists(r.data)).catch(() => [] as Playlist[]),
    ]).then(([d, l, p, h, rp]) => {
      if (c) return;
      setDaily(d); setLiked(l); setPlaylists(p); setHistory(h); setPersonalized(rp);
      setTimeout(() => { if (!c) setReady(true); }, 300); // brief delay for smooth transition
    }).catch(() => { if (!c) setReady(true); });
    return () => { c = true; };
  }, [provider]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-center space-y-5">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-2xl bg-accent/20 animate-pulse" />
            <div className="absolute inset-2 rounded-xl bg-accent/40 animate-pulse" style={{ animationDelay: "0.15s" }} />
            <Sparkles className="relative w-8 h-8 text-accent m-auto mt-4 animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <p className="text-sm font-medium text-zinc-500 tracking-wide">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8 space-y-10">

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text">Music 主页</h1>
          <p className="text-xs text-text-dim mt-1">选择音源，发现今天想听的音乐</p>
        </div>
        <div className="flex gap-1 p-1 rounded-2xl border border-border/60 bg-surface/80">
          {(["netease", "qq"] as const).map((source) => (
            <button
              key={source}
              onClick={() => {
                setProvider(source);
                localStorage.setItem("music-home-provider", source);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-medium smooth ${
                provider === source ? "bg-accent text-white shadow-sm" : "text-text-dim hover:text-text"
              }`}
            >
              {source === "netease" ? "网易云音乐" : "QQ 音乐"}
            </button>
          ))}
        </div>
      </div>

      {provider === "qq" ? (
        <QQHome
          charts={qqCharts}
          library={qqLibrary}
          loggedIn={qqLoggedIn}
          onSettings={() => navigate("/settings")}
          onPlaylist={(id) => navigate(`/qq/playlist/${encodeURIComponent(id)}`)}
        />
      ) : <>

      {/* ======== Hero: 每日推荐 + 我喜欢 ======== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <HeroCard
          icon={<Sparkles className="w-5 h-5" />}
          label="每日推荐"
          subtitle={daily.length > 0 ? `${daily.length} 首新歌` : "暂无推荐"}
          tracks={daily.slice(0, 4)}
          action={daily.length > 0 ? () => playAll(daily) : undefined}
          onClick={() => navigate("/daily")}
        />
        <HeroCard
          icon={<Heart className="w-5 h-5 fill-current" />}
          label="我喜欢的"
          subtitle={liked.length > 0 ? `${liked.length} 首收藏` : "暂无收藏"}
          tracks={liked.slice(0, 4)}
          action={liked.length > 0 ? () => playAll(liked) : undefined}
          onClick={() => navigate("/liked")}
        />
      </div>

      {/* ======== AI 风格分析入口 ======== */}
      <button
        onClick={() => navigate("/analyze")}
        className="group w-full text-left p-5 rounded-2xl bg-gradient-to-r from-accent/5 to-purple-500/5
                   ring-1 ring-accent/20 hover:ring-accent/40 hover:shadow-[0_4px_24px_rgb(0_0_0_/_0.06)]
                   transition-all duration-300"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-text">AI 风格分析</h3>
            <p className="text-xs text-text-dim mt-0.5">扫描歌单，分析你的音乐品味，AI 生成精选歌单</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-dim/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
        </div>
      </button>

      {/* ======== 一键生成上班歌单 ======== */}
      <WorkPlaylistButton />

      {/* ======== 我的歌单 ======== */}
      <SectionHeader icon={<ListMusic className="w-4 h-4" />} title="我的歌单"
        more={playlists.length > 0 ? () => navigate("/playlists") : undefined} />
      {(playlists.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.map(pl => (
              <PlaylistTile key={pl.id} playlist={pl} onClick={() => navigate(`/playlist/${pl.id}`)} />
            ))}
          </div>
        ) : (
          <EmptyCard icon={<ListMusic className="w-6 h-6" />} text="暂无歌单" onClick={() => navigate("/playlists")} />
        )
      )}

      {/* ======== 猜你喜欢 ======== */}
      <SectionHeader icon={<Lightbulb className="w-4 h-4" />} title="猜你喜欢"
        more={personalized.length > 0 ? () => navigate("/personalized") : undefined} />
      {(personalized.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {personalized.map(pl => (
              <PlaylistTile key={pl.id} playlist={pl} onClick={() => navigate(`/playlist/${pl.id}`)} />
            ))}
          </div>
        ) : (
          <EmptyCard icon={<Lightbulb className="w-6 h-6" />} text="登录后获取个性化推荐" />
        )
      )}

      {/* ======== 最近播放 ======== */}
      <SectionHeader icon={<Clock className="w-4 h-4" />} title="最近播放" />
      {(history.length > 0 ? (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/80 dark:ring-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
            {history.map((s, i) => (
              <HistoryRow key={`${s.id}-${i}`} song={s} />
            ))}
          </div>
        ) : (
          <EmptyCard icon={<Clock className="w-6 h-6" />} text="播放歌曲后将在这里显示" />
        )
      )}

      </>}

    </div>
  );
}

/* ================================================================ */

function QQHome({ charts, library, loggedIn, onSettings, onPlaylist }: {
  charts: QQHomeChart[];
  library: { liked?: QQHomePlaylist; created: QQHomePlaylist[]; collected: QQHomePlaylist[] };
  loggedIn: boolean;
  onSettings: () => void;
  onPlaylist: (id: string) => void;
}) {
  const featured = charts.slice(0, 2);
  return (
    <div className="space-y-10">
      {!loggedIn && (
        <button onClick={onSettings} className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border border-green-400/15 bg-green-400/[0.04] text-left hover:bg-green-400/[0.07] smooth">
          <div>
            <p className="text-sm font-medium text-text">QQ 音乐公开内容已可使用</p>
            <p className="text-xs text-text-dim mt-1">扫码登录后可播放会员歌曲和受登录限制的内容</p>
          </div>
          <span className="text-xs text-green-400">去登录 <ChevronRight className="inline w-3.5 h-3.5" /></span>
        </button>
      )}

      {loggedIn && (
        <section className="space-y-4">
          <SectionHeader icon={<Heart className="w-4 h-4" />} title="我的 QQ 音乐" />
          {library.liked || library.created.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {library.liked && <QQPlaylistTile key={`liked-${library.liked.id}`} playlist={library.liked} onClick={() => onPlaylist(library.liked!.id)} />}
              {library.created.map((playlist) => <QQPlaylistTile key={`created-${playlist.id}`} playlist={playlist} onClick={() => onPlaylist(playlist.id)} />)}
            </div>
          ) : (
            <EmptyCard icon={<ListMusic className="w-6 h-6" />} text="账号中暂时没有创建的歌单" />
          )}
        </section>
      )}

      {loggedIn && library.collected.length > 0 && (
        <section className="space-y-4">
          <SectionHeader icon={<Disc3 className="w-4 h-4" />} title="收藏的 QQ 歌单" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {library.collected.map((playlist) => <QQPlaylistTile key={`collected-${playlist.id}`} playlist={playlist} onClick={() => onPlaylist(playlist.id)} />)}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {featured.map((chart) => (
          <HeroCard
            key={chart.id}
            icon={<Disc3 className="w-5 h-5" />}
            label={chart.name}
            subtitle={`${chart.tracks.length} 首 QQ 音乐热门歌曲`}
            tracks={chart.tracks.slice(0, 4)}
            action={chart.tracks.length > 0 ? () => playAll(chart.tracks) : undefined}
            onClick={() => playAll(chart.tracks)}
          />
        ))}
      </div>

      {charts.map((chart) => (
        <section key={chart.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader icon={<ListMusic className="w-4 h-4" />} title={chart.name} />
            {chart.tracks.length > 0 && (
              <button onClick={() => playAll(chart.tracks)} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-dim smooth">
                <Play className="w-3.5 h-3.5 fill-current" />播放全部
              </button>
            )}
          </div>
          <div className="rounded-2xl bg-surface/80 border border-border/60 divide-y divide-border/40 overflow-hidden">
            {chart.tracks.slice(0, 6).map((song, index) => <HistoryRow key={song.id} song={song} queue={chart.tracks} index={index} />)}
          </div>
        </section>
      ))}

      {charts.length === 0 && <EmptyCard icon={<Disc3 className="w-6 h-6" />} text="QQ 音乐首页暂时无法加载，请稍后重试" />}
    </div>
  );
}

function QQPlaylistTile({ playlist, onClick }: { playlist: QQHomePlaylist; onClick: () => void }) {
  const label = playlist.kind === "liked" ? "我喜欢" : playlist.kind === "collected" ? "收藏歌单" : "创建歌单";
  return (
    <button onClick={onClick} className="group w-full text-left rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/80 dark:ring-zinc-800 overflow-hidden hover:ring-accent/35 transition-all">
      <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
        {playlist.coverUrl ? (
          <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : playlist.kind === "liked" ? (
          <Heart className="w-10 h-10 text-accent/60 fill-current" />
        ) : (
          <Disc3 className="w-9 h-9 text-zinc-300 dark:text-zinc-600" />
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate">{playlist.name}</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          {label}{playlist.trackCount === undefined ? "" : ` · ${playlist.trackCount} 首`}
        </p>
      </div>
    </button>
  );
}

function HeroCard({ icon, label, subtitle, tracks, action, onClick }: {
  icon: React.ReactNode; label: string; subtitle: string;
  tracks: Song[]; action?: () => void; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="group text-left p-5 rounded-2xl bg-white dark:bg-zinc-900
                 ring-1 ring-zinc-200/80 dark:ring-zinc-800
                 hover:ring-accent/30 hover:shadow-[0_4px_20px_rgb(0_0_0_/_0.04)]
                 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
          {icon}
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-accent group-hover:translate-x-0.5 transition-all mt-1" />
      </div>
      <h2 className="text-[15px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">{label}</h2>
      <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
      {tracks.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {tracks.map((s, i) => (
            <p key={i} className="text-xs text-zinc-500 truncate">
              <span className="text-zinc-700 dark:text-zinc-300">{s.name}</span>
              <span className="text-zinc-400 ml-1">— {s.artists?.map(a => a.name).join(" / ")}</span>
            </p>
          ))}
        </div>
      )}
      {action && (
        <span onClick={e => { e.stopPropagation(); action(); }}
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-accent hover:text-accent-dim transition-colors">
          <Play className="w-3 h-3 fill-current" />播放全部
        </span>
      )}
    </button>
  );
}

function SectionHeader({ icon, title, more }: {
  icon: React.ReactNode; title: string; more?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <h2 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">{title}</h2>
      </div>
      {more && (
        <button onClick={more} className="text-xs text-zinc-400 hover:text-accent transition-colors flex items-center gap-1">
          查看全部 <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function PlaylistTile({ playlist, onClick }: { playlist: Playlist; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="group text-left rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/80 dark:ring-zinc-800
                 hover:ring-accent/30 hover:shadow-[0_4px_20px_rgb(0_0_0_/_0.04)] transition-all duration-300 overflow-hidden"
    >
      <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        {playlist.coverUrl ? (
          <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <Disc3 className="w-8 h-8 m-auto text-zinc-300 dark:text-zinc-600" />
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate">{playlist.name}</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">{playlist.trackCount ? `${playlist.trackCount} 首` : ""}</p>
      </div>
    </button>
  );
}

function HistoryRow({ song, queue, index }: { song: Song; queue?: Song[]; index?: number }) {
  return (
    <button
      onClick={() => queue && index !== undefined ? playFrom(queue, index) : playSong(song)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0">
        {song.album?.coverUrl ? (
          <img src={song.album.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Play className="w-3.5 h-3.5 m-auto text-zinc-300" />
        )}
      </div>
      <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-200 truncate">{song.name}</span>
      <span className="text-xs text-zinc-400 truncate max-w-[180px]">{song.artists?.map(a => a.name).join(" / ")}</span>
    </button>
  );
}

function EmptyCard({ icon, text, onClick }: { icon: React.ReactNode; text: string; onClick?: () => void }) {
  const inner = (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="text-zinc-300 dark:text-zinc-600">{icon}</div>
      <p className="text-sm text-zinc-400">{text}</p>
    </div>
  );
  if (onClick) {
    return (
      <button onClick={onClick}
        className="w-full rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/80 dark:ring-zinc-800
                   hover:ring-accent/20 transition-all">
        {inner}
      </button>
    );
  }
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/80 dark:ring-zinc-800">
      {inner}
    </div>
  );
}

function playAll(songs: Song[]) {
  playbackApi.playSongs(songs.map(s => ({
    provider: s.provider,
    providerId: s.providerId,
    qqMid: s.qqMid,
    mediaMid: s.mediaMid,
    encryptedId: s.encryptedId,
    originalId: s.originalId,
    name: s.name,
    artist: s.artists?.map(a => a.name).join(" / "),
    duration: s.duration,
  })));
}

function playSong(s: Song) {
  playbackApi.playSong(s.encryptedId, s.originalId, {
    name: s.name,
    artist: s.artists?.map(a => a.name).join(" / "),
    duration: s.duration / 1000,
    provider: s.provider,
    providerId: s.providerId,
    qqMid: s.qqMid,
    mediaMid: s.mediaMid,
  });
}

function playFrom(songs: Song[], index: number) {
  playAll(songs.slice(index));
}

/* ---- extractors ---- */

function extractSongs(data: unknown): Song[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const arr = (Array.isArray(d.data) ? d.data : null)
    ?? (Array.isArray(d.songs) ? d.songs : null)
    ?? (Array.isArray(d.tracks) ? d.tracks : null)
    ?? (Array.isArray(d.dailySongs) ? d.dailySongs : null)
    ?? (Array.isArray(d.allData) ? (d.allData as Array<Record<string, unknown>>).map(x => (x as Record<string, unknown>).song ?? x) : null)
    ?? (Array.isArray(d) ? d : null);
  if (!arr) return [];
  return (arr as Array<Record<string, unknown>>).map(raw => ({
    id: String(raw.id ?? raw.originalId ?? ""), name: String(raw.name ?? ""),
    encryptedId: raw.id ? String(raw.id) : undefined,
    originalId: raw.originalId ? Number(raw.originalId) : undefined,
    artists: Array.isArray(raw.artists)
      ? (raw.artists as Array<Record<string, unknown>>).map(a => ({ name: String(a.name ?? ""), id: a.id ? String(a.id) : undefined }))
      : Array.isArray(raw.ar) ? (raw.ar as Array<Record<string, unknown>>).map((a: Record<string, unknown>) => ({ name: String(a.name ?? ""), id: a.id ? String(a.id) : undefined })) : [],
    album: {
      name: raw.album && typeof raw.album === "object" ? String((raw.album as Record<string, unknown>).name ?? "") : raw.al && typeof raw.al === "object" ? String((raw.al as Record<string, unknown>).name ?? "") : "",
      coverUrl: raw.coverImgUrl ? String(raw.coverImgUrl) : raw.al && typeof raw.al === "object" ? String((raw.al as Record<string, unknown>).picUrl ?? "") : undefined,
    },
    duration: Number(raw.duration ?? raw.dt ?? 0),
  }));
}

function extractPlaylists(data: unknown): Playlist[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const arr = (Array.isArray(d.data) ? d.data : null)
    ?? (Array.isArray(d.playlists) ? d.playlists : null)
    ?? (Array.isArray(d) ? d : null);
  if (!arr) return [];
  return (arr as Array<Record<string, unknown>>).map(raw => ({
    id: String(raw.id ?? raw.originalId ?? ""), name: String(raw.name ?? ""),
    description: raw.description ? String(raw.description) : undefined,
    coverUrl: (raw.coverImgUrl || raw.coverUrl || raw.picUrl) ? String(raw.coverImgUrl || raw.coverUrl || raw.picUrl) : undefined,
    trackCount: raw.trackCount ? Number(raw.trackCount) : undefined,
    playCount: raw.playCount ? Number(raw.playCount) : undefined,
  }));
}
