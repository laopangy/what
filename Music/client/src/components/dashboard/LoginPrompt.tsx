import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Sparkles, Music4, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  LoginPrompt — embedded QR login using NeteaseCloudMusicApi        */
/*  Shows official QR image (base64) directly, no external service.    */
/* ------------------------------------------------------------------ */

interface Props {
  onLogin?: (nickname?: string) => void;
}

/* ---- Staggered entrance — respects reduced motion ---- */
function useEntrance(delay: number) {
  const [visible, setVisible] = useState(false);
  const prefersReduced = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReduced.current = mq.matches;
    if (prefersReduced.current) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return {
    className: `transition-all duration-700 ease-out ${
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    }`,
  };
}

export default function LoginPrompt({ onLogin }: Props) {
  const [qrKey, setQrKey] = useState<string | null>(null);
  const [qrimg, setQrimg] = useState<string | null>(null); // base64 data URL
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [nickname, setNickname] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState("");

  const heading = useEntrance(100);
  const qrEntrance = useEntrance(300);
  const actions = useEntrance(500);

  // ── get QR code ──

  const getQrCode = useCallback(async () => {
    setStep("loading");
    setErrorMsg(null);
    setStatusHint("");
    try {
      const res = await fetch("/api/user/login-qr", { method: "POST" });
      const json = await res.json();
      if (json?.data?.alreadyLoggedIn) {
        setStep("done");
        onLogin?.();
        return;
      }
      if (json?.data?.qrKey && json?.data?.qrimg) {
        setQrKey(json.data.qrKey);
        setQrimg(json.data.qrimg);
        setMessage(json.data.message || "使用网易云音乐 APP 扫描二维码即可登录");
        setStep("ready");
      } else {
        setErrorMsg(json?.error || "无法获取登录二维码");
        setStep("error");
      }
    } catch {
      setErrorMsg("无法连接音乐服务");
      setStep("error");
    }
  }, [onLogin]);

  // ── poll login status ──

  const checkStatus = useCallback(async () => {
    if (!qrKey) return;
    try {
      const res = await fetch("/api/user/login-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrKey }),
      });
      const json = await res.json();
      const data = json?.data;
      if (!data) return;

      if (data.status === "success") {
        setStep("done");
        setNickname(data.nickname || null);
        onLogin?.(data.nickname);
        return true;
      }
      if (data.status === "expired") {
        setStatusHint("二维码已过期，正在刷新…");
        await getQrCode();
        return;
      }
      if (data.status === "confirming") {
        setStatusHint("请在手机上确认登录");
      }
      if (data.status === "waiting") {
        setStatusHint("等待扫码…");
      }
    } catch { /* ignore */ }
    return false;
  }, [qrKey, onLogin, getQrCode]);

  useEffect(() => { getQrCode(); }, [getQrCode]);

  useEffect(() => {
    if (step !== "ready" || !qrKey) return;
    const t = setInterval(() => { checkStatus(); }, 2000);
    return () => clearInterval(t);
  }, [step, qrKey, checkStatus]);

  /* ================ Done ================ */
  if (step === "done") {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-center space-y-4 animate-in fade-in duration-500">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-xl font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
            {nickname ? `${nickname}` : "已登录"}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">正在加载播放器 &hellip;</p>
        </div>
      </div>
    );
  }

  /* ================ Loading ================ */
  if (step === "loading") {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto w-8 h-8 text-rose-400 animate-spin" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">获取登录二维码 &hellip;</p>
        </div>
      </div>
    );
  }

  /* ================ Error ================ */
  if (step === "error") {
    return (
      <div className="flex items-center justify-center min-h-full px-4">
        <div className="text-center max-w-sm space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">获取失败</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{errorMsg}</p>
          </div>
          <button
            onClick={getQrCode}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-medium
                       hover:bg-rose-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
        </div>
      </div>
    );
  }

  /* ================ QR Code Ready ================ */
  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Heading */}
        <div {...heading} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/30 ring-1 ring-rose-200/60 dark:ring-rose-800/40">
            <Music4 className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400 tracking-wide uppercase">
              网易云音乐
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-zinc-800 dark:text-zinc-100 leading-[1.1]">
            登录你的音乐
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 max-w-[48ch] mx-auto leading-relaxed">
            {message}
          </p>
        </div>

        {/* QR Card — official base64 image */}
        <div {...qrEntrance} className="flex flex-col items-center mb-8">
          {qrimg && (
            <div className="relative group">
              <div className="absolute inset-0 rounded-3xl shadow-[0_8px_40px_rgb(244_114_182_/_0.12)]" />
              <div className="relative p-4 rounded-3xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800">
                <img
                  src={qrimg}
                  alt="网易云音乐登录二维码"
                  className="w-60 h-60 rounded-xl"
                  loading="eager"
                />
              </div>
            </div>
          )}

          {/* Status hint */}
          {statusHint && (
            <p className="mt-4 text-sm text-zinc-400 animate-pulse">{statusHint}</p>
          )}
        </div>

        {/* Refresh button */}
        <div {...actions} className="flex justify-center">
          <button
            onClick={getQrCode}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100
                       text-white dark:text-zinc-900 text-sm font-medium
                       hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新二维码
          </button>
        </div>

        {/* Footer hint */}
        <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
          打开网易云音乐 APP &rarr; 扫一扫 &rarr; 确认登录
        </p>
      </div>
    </div>
  );
}
