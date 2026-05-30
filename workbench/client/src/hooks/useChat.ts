import { useChatStore } from "../stores/chatStore";
import { chatApi } from "../api/client";

export function useChat() {
  const { messages, isLoading, addMessage, setLoading } = useChatStore();

  const sendMessage = async (text: string) => {
    addMessage({ role: "user", content: text });
    setLoading(true);

    try {
      const history = useChatStore.getState().messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await chatApi.send(history);
      if (res.success && res.data) {
        addMessage({
          role: "assistant",
          content: res.data.content,
          toolCalls: res.data.toolCalls,
        });
      } else {
        addMessage({ role: "assistant", content: `出错了: ${res.error || "未知错误"}` });
      }
    } catch {
      addMessage({ role: "assistant", content: "网络错误，请检查服务器连接。" });
    } finally {
      setLoading(false);
    }
  };

  return { messages, isLoading, sendMessage };
}
