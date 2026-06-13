import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Check, ExternalLink, RefreshCw, Sparkles } from "lucide-react";

interface Props {
  qrCodeUrl: string;
  message?: string;
}

export default function LoginQRCard({ qrCodeUrl, message }: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/music/user/login-status");
      const json = await res.json();
      if (json?.data?.loggedIn) {
        setLoggedIn(true);
        setNickname(json.data.nickname || null);
        setChecking(false);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }, []);

  useEffect(() => {
    checkStatus().then((done) => {
      if (done) return;
      setChecking(false);
    });
    const timer = setInterval(async () => {
      const done = await checkStatus();
      if (done) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [checkStatus]);

  if (loggedIn) {
    return (
      <div className="my-3 p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-mint-500/5 border border-emerald-500/30 text-center shadow-[0_4px_20px_rgb(52_211_153_/_0.1)]">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
          <Check className="w-5 h-5 text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-emerald-300">
          {nickname ? `${nickname}，登录成功！` : "登录成功！"}
        </p>
        <p className="text-xs text-emerald-400/60 mt-1">现在可以播放音乐了</p>
      </div>
    );
  }

  if (!qrCodeUrl) {
    return (
      <div className="my-3 p-5 rounded-2xl bg-surface-raised/60 border border-border/40 text-center">
        <p className="text-sm text-text-dim">{message || "请先登录网易云音乐"}</p>
        <button
          onClick={() => window.open("http://localhost:5173/now-playing", "_blank")}
          className="mt-3 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent/20 to-purple/20 border border-accent/20 text-accent-dim text-sm font-medium hover:from-accent/30 hover:to-purple/30 smooth"
        >
          打开音乐播放器登录
        </button>
      </div>
    );
  }

  return (
    <div className="my-3 p-5 rounded-2xl bg-surface-raised/40 border border-accent/20 shadow-[0_4px_24px_rgb(99_102_241_/_0.08)]">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center">
          <QrCode className="w-3.5 h-3.5 text-accent-dim" />
        </div>
        <span className="text-sm font-medium text-accent-dim">登录网易云音乐</span>
        {checking && (
          <RefreshCw className="w-3.5 h-3.5 text-accent-dim/60 animate-spin ml-auto" />
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="bg-white p-3 rounded-2xl shadow-[0_2px_12px_rgb(0_0_0_/_0.1)]">
          <QRCodeSVG value={qrCodeUrl} size={150} level="M" includeMargin={false} />
        </div>

        <p className="text-xs text-text-dim/70 text-center max-w-[240px]">
          {message || "请使用网易云音乐 APP 扫描二维码登录"}
        </p>

        <a
          href={qrCodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-accent-dim/70 hover:text-accent-dim smooth"
        >
          <ExternalLink className="w-3 h-3" />
          在浏览器中打开登录链接
        </a>
      </div>
    </div>
  );
}
