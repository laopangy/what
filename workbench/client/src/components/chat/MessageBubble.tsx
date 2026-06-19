import type { ChatMessage } from "../../types/chat";
import ToolCallCard from "./ToolCallCard";
import LoginQRCard from "./LoginQRCard";
import { User, Bot, Sparkles } from "lucide-react";

function findLoginQr(toolCalls?: ChatMessage["toolCalls"]) {
  if (!toolCalls) return null;
  for (const tc of toolCalls) {
    if (!tc.result) continue;
    const r = tc.result as Record<string, unknown>;
    if (r.needLogin && r.qrCodeUrl) {
      return { qrCodeUrl: String(r.qrCodeUrl), message: r.message ? String(r.message) : undefined };
    }
  }
  return null;
}

function detectQrUrlInText(content: string): string | null {
  const m = content.match(/https:\/\/163cn\.tv\/\S+/);
  return m ? m[0] : null;
}

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const loginQr = findLoginQr(message.toolCalls);
  const textQrUrl = !isUser && !loginQr ? detectQrUrlInText(message.content) : null;

  return (
    <div className={`flex gap-2.5 msg-enter ${isUser ? "justify-end" : "justify-start"}`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-accent-dim" strokeWidth={1.7} />
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
        {/* Tool calls */}
        {message.toolCalls?.map((tc, i) => (
          <ToolCallCard key={i} toolCall={tc} />
        ))}

        {loginQr && (
          <LoginQRCard qrCodeUrl={loginQr.qrCodeUrl} message={loginQr.message} />
        )}

        {/* Message bubble */}
        <div
          className={`px-3.5 py-2.5 rounded-xl text-[12px] leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-accent/[0.13] text-text rounded-br-sm border border-accent/20"
              : "glass border border-border/60 text-text rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>

        {textQrUrl && (
          <LoginQRCard qrCodeUrl={textQrUrl} message="请使用网易云音乐 APP 扫码登录" />
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-purple/15 border border-purple/25 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-[#b9829d]" strokeWidth={1.7} />
        </div>
      )}
    </div>
  );
}
