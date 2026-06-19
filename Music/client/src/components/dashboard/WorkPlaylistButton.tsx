import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Sparkles, CheckCircle, Loader2, ChevronRight, RefreshCw } from "lucide-react";
import { analyzeApi } from "../../api/client";
import { onSocketEvent } from "../../api/socket";

type BtnState = "idle" | "working" | "done";

interface WorkResult {
  playlistId: string;
  trackCount: number;
  totalDuration: string;
  styleProfile: string;
  discoveredTotal: number;
  excludedKnownCount: number;
}

export default function WorkPlaylistButton() {
  const navigate = useNavigate();
  const [state, setState] = useState<BtnState>("idle");
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<WorkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for progress via WebSocket
  useEffect(() => {
    const unsub = onSocketEvent("analysis:progress", (data) => {
      const p = data as { phase: string; message: string };
      setProgress(p.message || "");
    });
    return unsub;
  }, []);

  const handleClick = async () => {
    setState("working");
    setError(null);
    setProgress("正在查找 PANGY 歌单...");
    try {
      const res = await analyzeApi.workPlaylist();
      if (res.success && res.data) {
        setResult({
          playlistId: res.data.playlistId,
          trackCount: res.data.trackCount,
          totalDuration: res.data.totalDuration,
          styleProfile: res.data.styleProfile,
          discoveredTotal: res.data.discoveredTotal,
          excludedKnownCount: res.data.excludedKnownCount,
        });
        setState("done");
        // Auto-reset after 8 seconds
        setTimeout(() => {
          setState("idle");
          setResult(null);
        }, 8000);
      } else {
        setError(res.error || "生成失败");
        setState("idle");
      }
    } catch (e) {
      setError(`请求失败: ${(e as Error).message}`);
      setState("idle");
    }
  };

  if (state === "working") {
    return (
      <button
        disabled
        className="group w-full text-left p-5 rounded-2xl bg-gradient-to-r from-amber-500/5 to-orange-500/5
                   ring-1 ring-amber-500/20 animate-pulse"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-text">AI 正在生成上班歌单…</h3>
            <p className="text-xs text-text-dim mt-0.5">{progress || "分析中，请稍候..."}</p>
          </div>
        </div>
      </button>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="space-y-3">
        <div className="w-full text-left p-5 rounded-2xl bg-gradient-to-r from-emerald-500/5 to-teal-500/5
                        ring-1 ring-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-text">上班听歌单已生成！</h3>
              <p className="text-xs text-text-dim mt-0.5">
                {result.trackCount} 首新歌 · 约 {result.totalDuration}
                <span className="text-text-dim/50">（从 {result.discoveredTotal} 首中发现，排除 {result.excludedKnownCount} 首已知）</span>
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/playlist/${result.playlistId}`)}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-accent text-white text-sm font-medium hover:bg-accent-dim smooth flex items-center justify-center gap-1.5"
          >
            查看歌单 <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClick}
            className="px-4 py-2.5 rounded-2xl bg-surface-raised text-text-dim text-sm hover:text-text smooth flex items-center gap-1.5 border border-border/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        className="group w-full text-left p-5 rounded-2xl bg-gradient-to-r from-amber-500/5 to-orange-500/5
                   ring-1 ring-amber-500/20 hover:ring-amber-500/40
                   hover:shadow-[0_4px_24px_rgb(251_191_36_/_0.06)]
                   transition-all duration-300"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center
                          group-hover:bg-amber-500/20 transition-colors">
            <Briefcase className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-text">一键生成上班歌单</h3>
            <p className="text-xs text-text-dim mt-0.5">
              分析 PANGY 品味 → 从网易云发现你没听过的新歌 → 生成「上班听」
            </p>
          </div>
          <Sparkles className="w-4 h-4 text-amber-500/40 group-hover:text-amber-500 group-hover:scale-110 transition-all" />
        </div>
      </button>
      {error && (
        <p className="text-xs text-red-400 px-2">{error}</p>
      )}
    </div>
  );
}
