import { useState } from "react";
import {
  Trash2,
  Edit3,
  Zap,
  Globe,
  Terminal,
} from "lucide-react";
import { useTimerStore } from "../../stores/timerStore";
import type { Timer } from "../../types/timer";
import { cn } from "../../utils/cn";

interface TimerCardProps {
  timer: Timer;
  onEdit: () => void;
}

// Human-readable cron descriptions
function describeCron(expr: string): string {
  const presets: Record<string, string> = {
    "* * * * *": "每分钟",
    "*/5 * * * *": "每 5 分钟",
    "*/10 * * * *": "每 10 分钟",
    "*/15 * * * *": "每 15 分钟",
    "*/30 * * * *": "每 30 分钟",
    "0 * * * *": "每小时",
    "0 */2 * * *": "每 2 小时",
    "0 0 * * *": "每天 00:00",
    "0 9 * * *": "每天 09:00",
    "0 9 * * 1-5": "工作日 09:00",
    "0 0 * * 0": "每周日 00:00",
    "0 0 1 * *": "每月 1 号 00:00",
  };
  return presets[expr] || expr;
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function TimerCard({ timer, onEdit }: TimerCardProps) {
  const { deleteTimer, toggleTimer, triggerTimer } = useTimerStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await deleteTimer(timer.id);
  };

  return (
    <div
      className={cn(
        "bg-slate-900 border rounded-xl p-5 transition-all",
        timer.enabled
          ? "border-slate-800 hover:border-indigo-500/30"
          : "border-slate-800/50 opacity-70"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              timer.taskType === "http-request"
                ? "bg-blue-500/15"
                : "bg-amber-500/15"
            )}
          >
            {timer.taskType === "http-request" ? (
              <Globe className="w-4 h-4 text-blue-400" />
            ) : (
              <Terminal className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-slate-200 text-sm">{timer.name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {describeCron(timer.cronExpression)}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => toggleTimer(timer.id)}
          className={cn(
            "relative w-10 h-5 rounded-full transition-colors",
            timer.enabled ? "bg-indigo-500" : "bg-slate-700"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              timer.enabled ? "left-5" : "left-0.5"
            )}
          />
        </button>
      </div>

      {/* Description */}
      {timer.description && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{timer.description}</p>
      )}

      {/* Task config preview */}
      <div className="mb-3 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
        {timer.taskType === "http-request" ? (
          <div className="text-xs font-mono">
            <span className="text-blue-400">{timer.taskConfig.method || "GET"}</span>{" "}
            <span className="text-slate-400 truncate block">{timer.taskConfig.url || "—"}</span>
          </div>
        ) : (
          <div className="text-xs font-mono text-amber-400 truncate">
            $ {timer.taskConfig.command || "—"}
          </div>
        )}
      </div>

      {/* Times */}
      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
        <div>
          <span className="text-slate-600">上次: </span>
          {formatTime(timer.lastRunAt)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => triggerTimer(timer.id)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-400 hover:bg-indigo-500/10 transition-colors"
          title="手动触发"
        >
          <Zap className="w-3 h-3" />
          触发
        </button>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 transition-colors"
        >
          <Edit3 className="w-3 h-3" />
          编辑
        </button>
        <button
          onClick={handleDelete}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ml-auto",
            confirmDelete
              ? "text-red-400 bg-red-500/10"
              : "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
          )}
        >
          <Trash2 className="w-3 h-3" />
          {confirmDelete ? "确认删除" : "删除"}
        </button>
      </div>
    </div>
  );
}
