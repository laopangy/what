import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { JournalUnlockError, useJournalStore } from "../../stores/journalStore";

const IDLE_LOCK_MS = 5 * 60 * 1000;
const IDLE_CHECK_MS = 15_000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

export default function JournalLockGate({ children }: { children: ReactNode }) {
  const token = useJournalStore((s) => s.token);
  const lock = useJournalStore((s) => s.lock);

  useEffect(() => () => lock(false), [lock]);

  useEffect(() => {
    const onPageHide = () => lock(true);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [lock]);

  useEffect(() => {
    if (!token) return;
    let lastActivity = Date.now();
    const markActive = () => {
      lastActivity = Date.now();
    };
    const lockIfIdle = () => {
      if (Date.now() - lastActivity >= IDLE_LOCK_MS) lock(true);
    };
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, markActive, { passive: true });
    document.addEventListener("visibilitychange", lockIfIdle);
    const timer = window.setInterval(lockIfIdle, IDLE_CHECK_MS);
    return () => {
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, markActive);
      document.removeEventListener("visibilitychange", lockIfIdle);
      window.clearInterval(timer);
    };
  }, [token, lock]);

  return token ? <>{children}</> : <LockScreen />;
}

function LockScreen() {
  const unlock = useJournalStore((s) => s.unlock);
  const hasDraft = useJournalStore((s) => s.draft.trim() !== "" || s.editDraft !== null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || unlocking || cooldown > 0) return;
    setUnlocking(true);
    setError("");
    try {
      await unlock(password);
    } catch (err: unknown) {
      setPassword("");
      if (err instanceof JournalUnlockError && err.retryAfter) setCooldown(err.retryAfter);
      else setError(err instanceof JournalUnlockError ? err.message : "无法连接 Tools 服务，请稍后重试");
      inputRef.current?.focus();
    } finally {
      setUnlocking(false);
    }
  };

  const message = cooldown > 0 ? `密码错误次数过多，请 ${cooldown} 秒后再试` : error;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10">
            <LockKeyhole className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-100">随手记已锁定</h1>
          <p className="mt-1 text-sm text-slate-400">输入工作台数据密码后查看日记</p>
        </div>

        <div className="relative">
          <input
            ref={inputRef}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            placeholder="工作台数据密码"
            aria-label="工作台数据密码"
            autoComplete="current-password"
            autoFocus
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-4 pr-10 text-sm text-slate-200 placeholder:text-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 transition-colors hover:text-slate-300"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {message && (
          <div role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {message}
          </div>
        )}

        {hasDraft && (
          <p className="mt-3 text-xs text-indigo-400">有未提交的草稿，解锁后自动恢复</p>
        )}

        <button
          type="submit"
          disabled={!password || unlocking || cooldown > 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {unlocking ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              验证中...
            </>
          ) : (
            "解锁"
          )}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">离开随手记、刷新页面或闲置 5 分钟后自动锁定</p>
      </form>
    </div>
  );
}
