import { useEffect, useState } from "react";
import { Ban, CircleCheck, CircleX, Hourglass, LoaderCircle, ShieldAlert, type LucideIcon } from "lucide-react";
import { chatApi } from "../../api/client";
import { useChatStore } from "../../stores/chatStore";
import type { ConfirmationStatus, ToolConfirmation } from "../../types/chat";

const STATUS: Record<Exclude<ConfirmationStatus, "pending">, { text: string; icon: LucideIcon; tone: string }> = {
  running: { text: "正在执行…", icon: LoaderCircle, tone: "text-amber-100/80" },
  done: { text: "已执行", icon: CircleCheck, tone: "text-accent-dim" },
  failed: { text: "执行失败", icon: CircleX, tone: "text-red-200/90" },
  cancelled: { text: "已取消", icon: Ban, tone: "text-text-dim/70" },
  expired: { text: "已过期，未执行", icon: Hourglass, tone: "text-text-dim/70" },
};

const textField = (value: unknown, key: string) => {
  const field = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  return typeof field === "string" && field ? field : undefined;
};

interface Props {
  messageId: string;
  confirmation: ToolConfirmation;
}

export default function ConfirmActionCard({ messageId, confirmation }: Props) {
  const { actionId, summary, expiresAt } = confirmation;
  const status = confirmation.status ?? "pending";
  const [error, setError] = useState("");

  // Outcomes are added to the conversation so the assistant knows what really happened on the next turn.
  const settle = (patch: Partial<ToolConfirmation>, note: string) => {
    const store = useChatStore.getState();
    store.updateConfirmation(messageId, actionId, patch);
    store.addMessage({ role: "assistant", content: note });
  };

  useEffect(() => {
    if (status !== "pending") return;
    const timer = window.setTimeout(
      () => settle({ status: "expired" }, `未执行：${summary}（确认已过期）`),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [status, expiresAt]);

  const confirm = async () => {
    setError("");
    const store = useChatStore.getState();
    store.updateConfirmation(messageId, actionId, { status: "running" });
    try {
      const res = await chatApi.confirmAction(actionId, store.journalToken);
      if (res.status === 404) {
        settle({ status: "expired" }, `未执行：${summary}（${res.error ?? "确认已过期"}）`);
        return;
      }
      const failure = res.success ? textField(res.data?.result, "error") : (res.error ?? "未知错误");
      if (failure) {
        settle({ status: "failed" }, `执行失败：${summary}\n${failure}`);
        return;
      }
      const message = textField(res.data?.result, "message");
      settle({ status: "done" }, message ? `已执行：${summary}\n${message}` : `已执行：${summary}`);
    } catch {
      store.updateConfirmation(messageId, actionId, { status: "pending" });
      setError("网络错误，请检查服务器连接后重试");
    }
  };

  const cancel = () => {
    settle({ status: "cancelled" }, `已取消：${summary}`);
    chatApi.cancelAction(actionId).catch(() => {});
  };

  const state = status === "pending" ? undefined : STATUS[status];

  return (
    <div className="mt-1.5 w-[22rem] max-w-full rounded-xl border border-amber-200/25 bg-amber-200/[0.06] p-3">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/85" strokeWidth={1.7} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium tracking-wide text-amber-100/70">需要你确认</p>
          <p className="mt-0.5 break-words text-[12px] leading-relaxed text-text">{summary}</p>
        </div>
      </div>

      {state ? (
        <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${state.tone}`}>
          <state.icon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} strokeWidth={1.8} />
          {state.text}
        </p>
      ) : (
        <div className="mt-2.5 flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-[10px] text-red-200/90" aria-live="polite">{error}</p>}
          <button
            type="button"
            onClick={cancel}
            className="h-7 rounded-lg px-3 text-[11px] text-text-dim hover:bg-white/[0.06] hover:text-text smooth"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            className="h-7 rounded-lg bg-amber-200/90 px-3.5 text-[11px] font-semibold text-[#3a2a0c] hover:bg-amber-200 smooth"
          >
            确认
          </button>
        </div>
      )}
    </div>
  );
}
