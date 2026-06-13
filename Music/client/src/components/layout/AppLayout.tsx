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
      <header className="flex-shrink-0 h-14 flex items-center justify-between px-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <button onClick={() => navigate("/")}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tracking-tight">Music</span>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate("/", { state: { forceHome: Date.now() } })}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="首页">
            <Home className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/search")}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="搜索">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/now-playing")}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="正在播放">
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
