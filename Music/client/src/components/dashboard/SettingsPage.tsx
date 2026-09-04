import { useCallback, useEffect, useState } from "react";
import { Bot, Check, KeyRound, Loader2, LogOut, QrCode, RefreshCw, Settings } from "lucide-react";
import { settingsApi, userApi, type ApiResponse, type SettingsStatus } from "../../api/client";

import MapSettingsCard from "./MapSettingsCard";
import ICloudSettingsCard from "./ICloudSettingsCard";
import appInfo from "../../../../../package.json";

type LoginResult = {
  status: "waiting" | "confirming" | "success" | "expired" | "error";
  message?: string;
};

interface AccountCardProps {
  name: string;
  description: string;
  appName: string;
  loggedIn: boolean;
  accountLabel?: string;
  accentClass: string;
  startLogin: () => Promise<ApiResponse<{ qrKey: string; qrimg: string; message: string; alreadyLoggedIn?: boolean }>>;
  checkLogin: (qrKey: string) => Promise<ApiResponse<LoginResult>>;
  logout: () => Promise<ApiResponse>;
  onChanged: () => void;
}

function AccountCard({
  name, description, appName, loggedIn, accountLabel, accentClass,
  startLogin, checkLogin, logout, onChanged,
}: AccountCardProps) {
  const [qrKey, setQrKey] = useState<string | null>(null);
  const [qrimg, setQrimg] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadQr = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const result = await startLogin();
    setLoading(false);
    if (result.success && result.data?.alreadyLoggedIn) {
      onChanged();
      return;
    }
    if (result.success && result.data?.qrKey && result.data.qrimg) {
      setQrKey(result.data.qrKey);
      setQrimg(result.data.qrimg);
      setMessage(result.data.message);
    } else {
      setMessage(result.error || "无法获取登录二维码");
    }
  }, [onChanged, startLogin]);

  useEffect(() => {
    if (!qrKey || loggedIn) return;
    const timer = setInterval(async () => {
      const result = await checkLogin(qrKey);
      const data = result.data;
      if (!result.success || !data) return;
      setMessage(data.message || "等待扫码…");
      if (data.status === "success") {
        setQrKey(null);
        setQrimg(null);
        onChanged();
      } else if (data.status === "expired") {
        setQrKey(null);
        setQrimg(null);
      }
    }, 2_000);
    return () => clearInterval(timer);
  }, [checkLogin, loggedIn, onChanged, qrKey]);

  const handleLogout = async () => {
    await logout();
    setQrKey(null);
    setQrimg(null);
    setMessage("");
    onChanged();
  };

  return (
    <section className="rounded-3xl border border-border/60 bg-surface/80 p-5 shadow-[0_10px_30px_rgb(0_0_0_/_0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${accentClass}`} />
            <h2 className="font-semibold text-text">{name}</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-text-dim">{description}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] ${
          loggedIn ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-text-dim"
        }`}>
          {loggedIn ? "已连接" : "未登录"}
        </span>
      </div>

      {loggedIn ? (
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-text">{accountLabel || "账号已登录"}</p>
              <p className="text-[11px] text-text-dim">Cookie 已安全保存在本机</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl text-text-dim hover:text-red-400 hover:bg-red-500/10 smooth" title="退出登录">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : qrimg ? (
        <div className="mt-5 flex flex-col items-center">
          <div className="p-3 rounded-2xl bg-white shadow-xl">
            <img src={qrimg} alt={`${name}登录二维码`} className="w-44 h-44" />
          </div>
          <p className="mt-3 text-xs text-text-dim">{message || `使用${appName}扫码登录`}</p>
          <button onClick={loadQr} className="mt-3 flex items-center gap-1.5 text-xs text-accent hover:text-accent-dim smooth">
            <RefreshCw className="w-3.5 h-3.5" />刷新二维码
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <button
            onClick={loadQr}
            disabled={loading}
            className="w-full h-11 rounded-2xl bg-accent text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent-dim disabled:opacity-50 smooth"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            {loading ? "正在生成…" : "显示登录二维码"}
          </button>
          {message && <p className="mt-2 text-xs text-center text-red-400">{message}</p>}
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const refresh = useCallback(() => {
    settingsApi.status().then((result) => {
      if (!result.success || !result.data) return;
      setStatus(result.data);
      setBaseUrl(result.data.ai.baseUrl);
      setModel(result.data.ai.model);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveAi = async () => {
    if (!apiKey.trim()) {
      setSaveMessage("请输入 API Key");
      return;
    }
    setSaving(true);
    const result = await settingsApi.saveAi(apiKey.trim(), baseUrl.trim(), model.trim());
    setSaving(false);
    if (result.success) {
      setApiKey("");
      setSaveMessage("已保存；Music 立即生效，Workbench 重启后生效");
      refresh();
    } else setSaveMessage(result.error || "保存失败");
  };

  if (!status) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pb-28">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">账号与服务设置</h1>
          <p className="text-xs text-text-dim mt-0.5">统一管理应用信息、音乐账号、AI 服务与地图服务</p>
        </div>
      </div>

      <section className="mb-4 rounded-3xl border border-border/60 bg-surface/80 p-5">
        <h2 className="font-semibold text-text">应用信息</h2>
        <p className="mt-2 text-sm text-text">{appInfo.build.productName} · v{appInfo.version}</p>
        <p className="mt-2 text-xs leading-6 text-text-dim">AI 对话、音乐、随手记、户外、肌肉大与工具的统一工作台。下方管理账号连接及应用服务配置。</p>
      </section>
      <MapSettingsCard />
      <ICloudSettingsCard />
      <div className="grid md:grid-cols-2 gap-4">
        <AccountCard
          name="网易云音乐"
          description="用于网易云收藏、歌单、每日推荐和会员歌曲。"
          appName="网易云音乐 APP"
          loggedIn={status.netease.loggedIn}
          accountLabel={status.netease.nickname}
          accentClass="bg-red-400"
          startLogin={userApi.loginQr}
          checkLogin={userApi.loginCheck}
          logout={userApi.logout}
          onChanged={refresh}
        />
        <AccountCard
          name="QQ 音乐"
          description="用于 QQ 音乐会员歌曲和受登录限制的播放地址。"
          appName="手机 QQ"
          loggedIn={status.qq.loggedIn}
          accountLabel={status.qq.uin ? `QQ ${status.qq.uin}` : undefined}
          accentClass="bg-green-400"
          startLogin={settingsApi.qqLoginQr}
          checkLogin={settingsApi.qqLoginCheck}
          logout={settingsApi.qqLogout}
          onChanged={refresh}
        />
      </div>

      <section className="mt-4 rounded-3xl border border-border/60 bg-surface/80 p-5 shadow-[0_10px_30px_rgb(0_0_0_/_0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-text">AI 服务</h2>
              <p className="text-xs text-text-dim mt-1">供工作台、音乐分析、日记 AI 和饮食识别使用；密钥不会回显。</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] ${
            status.ai.configured ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
          }`}>
            {status.ai.configured ? "已配置" : "未配置"}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-3 mt-5">
          <div className="md:col-span-2 rounded-2xl border border-border/60 bg-bg/50 px-3 py-3">
            <span className="text-xs text-text-dim">AI 提供商</span>
            <p className="mt-1 text-sm font-medium text-text">DeepSeek</p>
          </div>
          <label className="md:col-span-2">
            <span className="text-xs text-text-dim">API Key</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border/60 bg-bg/50 px-3">
              <KeyRound className="w-4 h-4 text-text-dim" />
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={status.ai.configured ? "输入新密钥以替换现有配置" : "输入 DeepSeek API Key"} className="h-11 flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text-dim/40" />
            </div>
          </label>
          <label>
            <span className="text-xs text-text-dim">API 地址</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-border/60 bg-bg/50 px-3 outline-none text-sm text-text focus:border-accent/50" />
          </label>
          <label>
            <span className="text-xs text-text-dim">模型</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-border/60 bg-bg/50 px-3 outline-none text-sm text-text focus:border-accent/50" />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-text-dim">{saveMessage}</p>
          <button onClick={saveAi} disabled={saving} className="px-5 h-10 rounded-2xl bg-accent text-white text-sm font-medium hover:bg-accent-dim disabled:opacity-50 smooth">
            {saving ? "保存中…" : "保存 AI 设置"}
          </button>
        </div>
      </section>
    </div>
  );
}
