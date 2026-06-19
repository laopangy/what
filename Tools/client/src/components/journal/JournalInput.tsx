import { useState } from "react";
import { X, Sparkles, Send } from "lucide-react";

interface JournalInputProps {
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
  error: string;
}

export default function JournalInput({
  onSubmit,
  onClose,
  submitting,
  error,
}: JournalInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    await onSubmit(text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-100">写日记</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`随便写写今天发生了什么...\n\n比如：\n今天早上8点起床，吃了两个包子和一杯豆浆。上午在公司开会开到12点，累死了...`}
            rows={10}
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />

          <p className="text-xs text-slate-500 mt-2">
            AI 会自动识别心情、时间线、吃了什么、喝了什么、玩了什么...
            <br />
            按 Ctrl+Enter 快速提交
          </p>

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI 整理中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                提交
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
