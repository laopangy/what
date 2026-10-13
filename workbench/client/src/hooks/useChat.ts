import { useNavigate } from "react-router-dom";
import { useChatStore } from "../stores/chatStore";
import { chatApi } from "../api/client";
import type { ChatResponse } from "../types/chat";

const HISTORY_LIMIT = 40;
const CONTINUE_AFTER_UNLOCK = "已解锁随手记，请继续";

export function useChat() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const navigate = useNavigate();

  const sendMessage = async (text: string) => {
    const store = useChatStore.getState();
    if (store.isLoading) return;
    // Later turns can quote journal content from history, so they stay sensitive until everything is masked.
    const followsSensitive = store.messages.some((m) => m.sensitive && !m.masked);
    const { journalToken: token, lockCount } = store;
    const userId = store.addMessage({ role: "user", content: text });
    const history = useChatStore.getState().messages.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content }));
    store.setLoading(true);

    let reply: ChatResponse | undefined;
    let failure = "";
    try {
      const res = await chatApi.send(history, token);
      if (res.success && res.data) reply = res.data;
      else failure = `出错了：${res.error ?? "未知错误"}`;
    } catch {
      failure = "网络错误，请检查服务器连接。";
    }

    const current = useChatStore.getState();
    const lockedWhileWaiting = current.lockCount !== lockCount;
    // The Tools session expired on its own: revoke it here too and hide what it revealed before this turn.
    if (reply?.journalLocked && current.journalToken) current.lockJournal();
    const sensitive = followsSensitive || reply?.sensitive === true;
    if (sensitive) current.updateMessage(userId, { sensitive: true });
    current.addMessage(reply
      ? { role: "assistant", content: reply.content, toolCalls: reply.toolCalls, sensitive: sensitive || undefined, journalLocked: reply.journalLocked }
      : { role: "assistant", content: failure });
    if (lockedWhileWaiting && sensitive) current.lockJournal();
    current.setLoading(false);
    if (reply?.navigate) navigate(reply.navigate);
  };

  const continueAfterUnlock = () => sendMessage(CONTINUE_AFTER_UNLOCK);

  return { messages, isLoading, sendMessage, continueAfterUnlock };
}
