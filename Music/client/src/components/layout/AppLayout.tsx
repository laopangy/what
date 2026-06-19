import { type ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Play, Sparkles, Home } from "lucide-react";
import MusicBar from "./MusicBar";
import LoginPrompt from "../dashboard/LoginPrompt";
import { usePlaybackState } from "../../hooks/usePlaybackState";
import { userApi } from "../../api/client";

export default function AppLayout({ children }: { children: ReactNode }) {
  usePlaybackState();
  const navigate = useNavigate();
  const [loginChecked, setLoginChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Check login on first load — don't wait for user to click Music
  useEffect(() => {
    userApi.loginStatus().then(res => {
      if (res.success && res.data?.loggedIn === false) setIsLoggedIn(false);
      setLoginChecked(true);
    }).catch(() => setLoginChecked(true));
  }, []);

  if (loginChecked && !isLoggedIn) {
    return <LoginPrompt onLogin={() => setIsLoggedIn(true)} />;
  }

  if (!loginChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <p className="text-sm text-text-dim">正在检查登录状态...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg">
      <header className="flex-shrink-0 h-12 flex items-center justify-between px-4 border-b border-border/70 bg-surface/95 shadow-[0_8px_24px_rgb(0_0_0_/_0.16)]">
        <button onClick={() => navigate("/")}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#17130a]" />
          </div>
          <span className="text-sm font-semibold text-text tracking-wide">Music</span>
        </button>
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
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <MusicBar />
    </div>
  );
}
