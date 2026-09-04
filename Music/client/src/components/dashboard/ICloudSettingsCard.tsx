import { useEffect, useState } from "react";

type CalendarStatus = {connected: boolean; username: string; calendarId: string; reminderMinutes: number | null; calendars: {id: string; name: string}[]};
async function calendarRequest(path: string, method = "GET", data?: unknown): Promise<CalendarStatus> {
  const response = await fetch(`http://127.0.0.1:3004/api/outdoor/calendar/${path}`, {
    method, ...(data === undefined ? {} : {headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)}),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "日历服务请求失败");
  return body as CalendarStatus;
}

export default function ICloudSettingsCard() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [reminder, setReminder] = useState("15");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [changingAccount, setChangingAccount] = useState(false);

  async function run(action: () => Promise<CalendarStatus>, success = "") {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await action(); setStatus(result); setCalendarId(result.calendarId);
      setReminder(result.reminderMinutes === null ? "none" : String(result.reminderMinutes));
      setMessage(success);
    } catch (e) { setError(e instanceof Error && e.name === "Error" ? e.message : "无法连接日历服务，请确认户外服务已启动、数据已解锁，再重试。"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void run(() => calendarRequest("status")); }, []);

  const inputClass = "mt-1.5 h-11 w-full rounded-2xl border border-border/60 bg-bg/50 px-3 outline-none text-sm text-text focus:border-accent/50";
  return <section className="mb-4 rounded-3xl border border-border/60 bg-surface/80 p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-text">iCloud 日历</h2><span className="text-xs text-text-dim">{busy ? "处理中…" : status?.connected ? "已连接" : "未连接"}</span></div>
    <p className="mt-2 text-xs leading-6 text-text-dim">把“我的行程”同步到 iPhone 日历，包含活动时间、地点、私人行程备注与提醒。</p>
    <fieldset disabled={busy} className="mt-4 grid gap-3 disabled:opacity-60">
      {(!status?.connected || changingAccount) && <form className="grid gap-3" onSubmit={event => {
        event.preventDefault();
        void run(async () => {
          const result = await calendarRequest("connect", "POST", {username: username.trim(), password: password.trim()});
          setPassword(""); setChangingAccount(false); return result;
        }, "连接成功，请选择目标日历并保存设置。");
      }}>
        <label className="text-xs text-text-dim">Apple 账号<input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Apple 账号邮箱或电话号码" className={inputClass}/></label>
        <label className="text-xs text-text-dim">App 专用密码<input required type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" className={inputClass}/></label>
        <p className="text-xs leading-6 text-text-dim">在 Apple 账户的“登录和安全”→“App 专用密码”中生成。账号需开启双重认证；这里填写专用密码，不是 Apple 账户登录密码。凭据加密保存且密码不回显。</p>
        <div className="flex items-center justify-between gap-3"><a href="https://account.apple.com/" target="_blank" rel="noreferrer" className="text-xs text-accent">打开 Apple 账户 ↗</a><button className="px-5 h-10 rounded-2xl bg-accent text-white text-sm">连接 iCloud</button></div>
        {changingAccount && <button type="button" onClick={() => {setChangingAccount(false); setPassword("");}} className="text-xs text-text-dim">取消更换</button>}
      </form>}
      {status?.connected && !changingAccount && <>
        <p className="text-sm text-text">{status.username}</p>
        <label className="text-xs text-text-dim">目标日历<select value={calendarId} onChange={e => setCalendarId(e.target.value)} className={inputClass}><option value="">请选择日历</option>{status.calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label>
        <label className="text-xs text-text-dim">活动提醒<select value={reminder} onChange={e => setReminder(e.target.value)} className={inputClass}>{[["none", "不提醒"], ["0", "开始时"], ["5", "提前 5 分钟"], ["15", "提前 15 分钟"], ["30", "提前 30 分钟"], ["60", "提前 1 小时"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p className="text-xs leading-6 text-text-dim">选择自己的可编辑日历，建议单独建一个“工具栈行程”。点击行程同步时才写入；再次同步以应用行程覆盖对应日程。切换目标日历会在新日历生成一份，原日历保留。</p>
        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={() => void run(() => calendarRequest("refresh", "POST", {}), "日历列表已刷新")} className="text-xs text-text-dim">刷新日历</button>
          <button disabled={!calendarId} onClick={() => void run(() => calendarRequest("selection", "PUT", {calendarId, reminderMinutes: reminder === "none" ? null : Number(reminder)}), "设置已保存，可以前往我的行程同步。")} className="px-5 h-10 rounded-2xl bg-accent text-white text-sm disabled:opacity-50">保存日历设置</button>
        </div>
        <div className="flex gap-4 text-xs text-text-dim"><button onClick={() => {setUsername(status.username); setChangingAccount(true);}}>更换账号 / 专用密码</button><button onClick={() => void run(() => calendarRequest("connection", "DELETE"), "已断开连接，苹果日历中已有的日程保留。")} className="text-red-400">断开连接</button></div>
      </>}
      {!status && <button onClick={() => void run(() => calendarRequest("status"))} className="text-xs text-accent">重新读取状态</button>}
    </fieldset>
    {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
    {message && <p role="status" className="mt-3 text-xs text-emerald-400">{message}</p>}
  </section>;
}
