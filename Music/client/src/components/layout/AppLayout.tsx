import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Play, Sparkles, Home, Settings } from "lucide-react";
import MusicBar from "./MusicBar";
import { usePlaybackState } from "../../hooks/usePlaybackState";

export default function AppLayout({ children }: { children: ReactNode }) {
  usePlaybackState();
  const navigate = useNavigate();
  const location = useLocation();
  const isNowPlaying = location.pathname === "/now-playing";
  const goBack = () => {
    const historyIndex = Number(window.history.state?.idx ?? 0);
    if (historyIndex > 0) navigate(-1);
    else navigate("/", { replace: true });
  };
  return (
    <div className="h-screen flex flex-col bg-bg">
      <header className={`${isNowPlaying ? "absolute inset-x-0 top-0 z-30 bg-black/10 border-white/10 backdrop-blur-md" : "flex-shrink-0 bg-surface/95 border-border/70 shadow-[0_8px_24px_rgb(0_0_0_/_0.16)]"} h-12 flex items-center justify-between px-4 border-b`}>
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
      </header>
      <main className={`flex-1 overflow-y-auto ${isNowPlaying ? "min-h-0" : ""}`}>
        {children}
      </main>
      {!isNowPlaying && <MusicBar />}
    </div>
  );
}
