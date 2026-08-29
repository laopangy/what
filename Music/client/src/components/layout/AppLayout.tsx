import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, RotateCcw, Search, Play, Sparkles, Home, Settings } from "lucide-react";
import MusicBar from "./MusicBar";
import { usePlaybackState } from "../../hooks/usePlaybackState";
import { usePlaybackStore } from "../../stores/playbackStore";

export default function AppLayout({ children }: { children: ReactNode }) {
  usePlaybackState();
  const navigate = useNavigate();
  const location = useLocation();
  const hasSong = usePlaybackStore((state) => !!state.song?.name);
  const forceHome = (location.state as { forceHome?: number } | null)?.forceHome;
  const embedded = new URLSearchParams(location.search).get("embedded") === "1";
  const isNowPlaying = location.pathname === "/now-playing" || (location.pathname === "/" && hasSong && !forceHome);
  const goBack = () => {
    const historyIndex = Number(window.history.state?.idx ?? 0);
    if (historyIndex > 0) navigate(-1);
    else navigate("/", { replace: true });
  };
  return (
    <div className="h-screen flex flex-col bg-bg">
      {!embedded && <header className={`${isNowPlaying ? "absolute inset-x-0 top-0 z-30 bg-transparent border-transparent" : "flex-shrink-0 bg-surface/95 border-border/70 shadow-[0_8px_24px_rgb(0_0_0_/_0.16)]"} h-12 flex items-center justify-between px-4 border-b`}>
        {isNowPlaying ? (
          <>
            <nav className="flex items-center gap-1 text-white/58" aria-label="播放页导航">
              <button onClick={goBack} className="p-2 rounded-full hover:text-white hover:bg-white/10 transition-colors" title="返回上一页"><ArrowLeft className="w-[19px] h-[19px]" /></button>
              <button onClick={() => navigate(1)} className="p-2 rounded-full hover:text-white hover:bg-white/10 transition-colors" title="前进"><ChevronRight className="w-[19px] h-[19px]" /></button>
              <button onClick={() => window.location.reload()} className="p-2 rounded-full hover:text-white hover:bg-white/10 transition-colors" title="刷新"><RotateCcw className="w-[18px] h-[18px]" /></button>
              <button onClick={() => navigate("/search")} className="ml-2 h-8 w-48 lg:w-64 rounded-xl bg-white/[0.12] hover:bg-white/[0.17] text-white/45 hover:text-white/70 flex items-center gap-2 px-3 transition-colors">
                <Search className="w-4 h-4" />
                <span className="text-xs">搜索音乐</span>
              </button>
            </nav>
            <button onClick={() => navigate("/settings")} className="p-2 rounded-full text-white/55 hover:text-white hover:bg-white/10 transition-colors" title="账号与服务设置"><Settings className="w-[18px] h-[18px]" /></button>
          </>
        ) : (
          <>
        <div className="flex items-center gap-2">
          {location.pathname !== "/" && (
            <button onClick={goBack} className={`p-2 rounded-md transition-colors ${isNowPlaying ? "text-white/55 hover:text-white hover:bg-white/10" : "text-text-dim hover:text-accent-dim hover:bg-accent/10"}`} title="返回上一页">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => navigate("/")}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${isNowPlaying ? "bg-white/10 ring-1 ring-white/15" : "bg-accent"}`}>
            <Sparkles className={`w-3.5 h-3.5 ${isNowPlaying ? "text-white/70" : "text-[#17130a]"}`} />
          </div>
          <span className={`text-sm font-semibold tracking-wide ${isNowPlaying ? "text-white/85" : "text-text"}`}>Music</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate("/", { state: { forceHome: Date.now() } })}
            className="p-2 rounded-md text-text-dim hover:text-accent-dim hover:bg-accent/10 transition-colors" title="首页">
            <Home className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/search")}
            className="p-2 rounded-md text-text-dim hover:text-accent-dim hover:bg-accent/10 transition-colors" title="搜索">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/now-playing")}
            className="p-2 rounded-md text-text-dim hover:text-accent-dim hover:bg-accent/10 transition-colors" title="正在播放">
            <Play className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/settings")}
            className="p-2 rounded-md text-text-dim hover:text-accent-dim hover:bg-accent/10 transition-colors" title="账号与服务设置">
            <Settings className="w-4 h-4" />
          </button>
        </div>
          </>
        )}
      </header>}
      <main className={`flex-1 overflow-y-auto ${isNowPlaying ? "min-h-0" : ""}`}>
        {children}
      </main>
      {!isNowPlaying && <MusicBar />}
    </div>
  );
}
