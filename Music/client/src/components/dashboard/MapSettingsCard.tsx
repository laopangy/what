import { useEffect, useState } from "react";

type MapStatus = { ready: boolean; jsReady: boolean; serviceReady: boolean };
const emptyKeys = { jsKey: "", securityCode: "", serviceKey: "" };

async function mapRequest(keys?: typeof emptyKeys): Promise<MapStatus> {
  const response = await fetch(`http://127.0.0.1:3004/api/outdoor/map/${keys ? "config" : "status"}`, {
    method: keys ? "PUT" : "GET",
    ...(keys ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(keys) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "地图服务请求失败");
  return body as MapStatus;
}

export default function MapSettingsCard() {
  const [status, setStatus] = useState<MapStatus | null>(null);
  const [keys, setKeys] = useState(emptyKeys);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setBusy(true); setError("");
    try { setStatus(await mapRequest()); }
    catch (e) { setError(e instanceof Error ? e.message : "无法连接户外服务，请确认服务已启动并解锁数据仓库"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);

  return <section className="mb-4 rounded-3xl border border-border/60 bg-surface/80 p-5">
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-semibold text-text">高德地图服务</h2>
      <span className="text-xs text-text-dim">{status ? status.ready ? "已配置" : "未完成配置" : busy ? "正在检测…" : "状态不可用"}</span>
    </div>
    <p className="mt-2 text-xs leading-6 text-text-dim">用于户外地图、地点搜索和路线规划。密钥加密保存，已保存值不会回显；更换后请刷新户外页面。</p>
    <form className="mt-4 grid gap-3" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(""); setMessage("");
      try {
        setStatus(await mapRequest({ jsKey: keys.jsKey.trim(), securityCode: keys.securityCode.trim(), serviceKey: keys.serviceKey.trim() }));
        setKeys(emptyKeys); setMessage("高德配置已加密保存，请刷新户外页面以使用新配置。");
      } catch (e) { setError(e instanceof Error ? e.message : "保存失败，请稍后重试"); }
      finally { setBusy(false); }
    }}>
      {([["jsKey", "Web 端（JS API）Key"], ["securityCode", "JS 安全密钥 securityJsCode"], ["serviceKey", "Web 服务 Key"]] as const).map(([field, label]) => <label key={field}>
        <span className="text-xs text-text-dim">{label}</span>
        <input type="password" required autoComplete="off" disabled={busy} value={keys[field]} onChange={event => setKeys({ ...keys, [field]: event.target.value })} placeholder="填写对应密钥，保存时同时替换三项配置" className="mt-1.5 h-11 w-full rounded-2xl border border-border/60 bg-bg/50 px-3 outline-none text-sm text-text focus:border-accent/50" />
      </label>)}
      <p className="text-xs text-text-dim">Web 端 Key 与安全密钥供本机地图运行使用，Web 服务 Key 仅供后端使用。</p>
      {error && <p role="alert" className="text-xs text-red-400">{error}；请确认户外服务已启动，并在工作台解锁数据仓库。</p>}
      {message && <p role="status" className="text-xs text-emerald-400">{message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="https://console.amap.com/dev/key/app" target="_blank" rel="noreferrer" className="text-xs text-accent">打开高德控制台 ↗</a>
        <div className="flex gap-3">
          <button type="button" disabled={busy} onClick={() => void refresh()} className="text-xs text-text-dim disabled:opacity-50">刷新状态</button>
          <button disabled={busy} className="px-5 h-10 rounded-2xl bg-accent text-white text-sm font-medium disabled:opacity-50">{busy ? "处理中…" : "保存地图设置"}</button>
        </div>
      </div>
    </form>
  </section>;
}
