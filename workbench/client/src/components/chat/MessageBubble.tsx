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
    <div className={`flex gap-3 msg-enter ${isUser ? "justify-end" : "justify-start"}`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-purple/20 border border-accent/20 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_2px_8px_rgb(99_102_241_/_0.15)]">
          <Sparkles className="w-3.5 h-3.5 text-accent-dim" />
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
          className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-gradient-to-br from-accent/20 to-purple/15 text-text rounded-br-md border border-accent/10"
              : "glass border border-border/50 text-text rounded-bl-md"
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
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple/20 to-pink/20 border border-purple/20 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_2px_8px_rgb(168_85_247_/_0.15)]">
          <User className="w-3.5 h-3.5 text-purple" />
        </div>
      )}
    </div>
  );
}
