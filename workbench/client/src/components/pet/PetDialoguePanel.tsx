import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { getPetAiStatus, sendPetDialogue, type PetDialogueMessage } from "../../api/petApi";

interface PetDialoguePanelProps {
  petName: string;
  currentAction: string;
  onClose: () => void;
  onReply: (reply: string) => void;
}

export default function PetDialoguePanel({ petName, currentAction, onClose, onReply }: PetDialoguePanelProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [provider, setProvider] = useState("");
  const [messages, setMessages] = useState<PetDialogueMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void getPetAiStatus().then((result) => {
      if (cancelled) return;
      setConfigured(result.dialogue.configured);
      setProvider(result.dialogue.provider);
    }).catch((statusError: unknown) => {
      if (cancelled) return;
      setConfigured(false);
      setError(statusError instanceof Error ? statusError.message : "无法读取 AI 服务状态");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || !configured || sending) return;
    const userMessage: PetDialogueMessage = { role: "user", text: message };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const result = await sendPetDialogue({
        message,
        currentAction,
        history: messages.slice(-8),
      });
      const assistantMessage: PetDialogueMessage = { role: "assistant", text: result.reply };
      setMessages((current) => [...current, assistantMessage]);
      onReply(result.reply);
    } catch (sendError: unknown) {
      setError(sendError instanceof Error ? sendError.message : "灵宠暂时没有回应");
    } finally {
      setSending(false);
    }
  };

  return (
    <section role="dialog" aria-label={`与${petName}对话`} className="pointer-events-auto absolute bottom-4 right-4 z-40 flex h-[430px] max-h-[calc(100%-2rem)] w-[340px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#24323b]/97 text-white shadow-[0_24px_70px_rgb(16_26_33_/.5)] backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-400/14 text-indigo-200">
            <MessageCircle className="h-4 w-4" strokeWidth={1.7} />
          </span>
          <div>
            <h2 className="text-xs font-semibold">和{petName}说说话</h2>
            <p className="mt-0.5 text-[9px] text-white/42">
              {configured === null ? "正在检查服务" : configured ? `${provider} 文本对话已配置` : "文本对话未配置"}
            </p>
          </div>
        </div>
        <button type="button" aria-label="关闭对话" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-white/48 transition hover:bg-white/[0.08] hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {configured === null && !error ? (
          <div className="grid h-full place-items-center text-[11px] text-white/48">
            <LoaderCircle className="mb-2 h-5 w-5 animate-spin text-indigo-200" />
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-56">
              <MessageCircle className="mx-auto h-6 w-6 text-indigo-200/72" strokeWidth={1.45} />
              <p className="mt-3 text-xs font-medium text-white/78">想聊点什么？</p>
              <p className="mt-1.5 text-[10px] leading-5 text-white/38">
                {configured ? "对话只发送你输入的内容、最近消息和灵宠当前状态。" : "请先在账号与服务设置中配置 AI Key；未接通时不会生成本地伪回复。"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[84%] rounded-xl px-3 py-2 text-[11px] leading-5 ${message.role === "user" ? "bg-indigo-400 text-[#17242b]" : "bg-white/[0.07] text-white/82"}`}>
                  {message.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-2 text-[10px] text-white/48">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />正在回应
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-200/14 bg-red-950/20 px-3 py-2 text-[10px] leading-4 text-red-100">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
        </div>
      )}

      <form onSubmit={(event) => void submit(event)} className="flex gap-2 border-t border-white/[0.08] p-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={!configured || sending}
          maxLength={500}
          autoFocus
          placeholder={configured ? "输入想说的话" : "AI 服务未配置"}
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-black/12 px-3 text-xs text-white outline-none transition placeholder:text-white/28 focus:border-indigo-300/38 disabled:cursor-not-allowed disabled:opacity-55"
        />
        <button type="submit" aria-label="发送消息" disabled={!configured || sending || !input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-400 text-[#17242b] transition hover:bg-indigo-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35">
          {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </section>
  );
}
