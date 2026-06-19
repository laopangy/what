import { cn } from "../../utils/cn";

interface StatusBadgeProps {
  status: "running" | "success" | "failed" | "stopped";
}

const styles: Record<string, string> = {
  running: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
  stopped: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

const labels: Record<string, string> = {
  running: "运行中",
  success: "成功",
  failed: "失败",
  stopped: "已停止",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        styles[status]
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "running" && "bg-blue-400 animate-pulse",
          status === "success" && "bg-emerald-400",
          status === "failed" && "bg-red-400",
          status === "stopped" && "bg-slate-400"
        )}
      />
      {labels[status]}
    </span>
  );
}
