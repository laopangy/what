import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Lock } from "lucide-react";
import { chatApi } from "../../api/client";
import { useChatStore } from "../../stores/chatStore";

export default function JournalUnlockCard({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = window.setTimeout(() => setWaitSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [waitSeconds]);

  const unlock = async () => {
    if (!password || submitting || waitSeconds > 0) return;
    const attempt = password;
    setPassword("");
    setError("");
    setSubmitting(true);
    try {
      const res = await chatApi.unlockJournal(attempt);
      if (res.success && res.data) {
        useChatStore.getState().setJournalToken(res.data.token);
        onUnlocked();
        return;
      }
      setError(res.error ?? "解锁失败，请重试");
      if (res.retryAfter) setWaitSeconds(res.retryAfter);
    } catch {
      setError("网络错误，请检查服务器连接");
    } finally {
      setSubmitting(false);
    }
  };

  const blocked = !password || submitting || waitSeconds > 0;

  return (
    <div className="msg-enter ml-[38px] w-[22rem] max-w-[calc(100%-38px)] rounded-xl glass border border-border/60 p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/[0.10] ring-1 ring-inset ring-accent/25">
          <Lock className="h-3.5 w-3.5 text-accent-dim" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-text">随手记已锁定</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-text-dim/70">
            输入工作台数据密码解锁，密码只用于本次解锁，不会发给 AI。5 分钟无操作会自动锁定。
          </p>
        </div>
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void unlock();
        }}
      >
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-bg/60 px-2.5 ring-1 ring-inset ring-border/70 focus-within:ring-accent/45 smooth">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-text-dim/50" strokeWidth={1.7} />
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            maxLength={1000}
            autoComplete="current-password"
            autoFocus
            aria-label="工作台数据密码"
            placeholder="工作台数据密码"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-text outline-none placeholder:text-text-dim/40"
          />
        </label>
        <button
          type="submit"
          disabled={blocked}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-[11px] font-semibold text-[#123a2b] hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40 smooth"
        >
          {waitSeconds > 0 ? `${waitSeconds} 秒后重试` : "解锁并继续"}
          {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </form>

      <p className="mt-2 min-h-4 text-[10px] text-red-200/90" aria-live="polite">{error}</p>
    </div>
  );
}
