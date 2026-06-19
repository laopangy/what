import { useEffect } from "react";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useTimerStore } from "../../stores/timerStore";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import LoadingSpinner from "../shared/LoadingSpinner";
import { cn } from "../../utils/cn";

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function durationMs(start: string, end?: string): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ExecutionHistory() {
  const { history, loading, fetchAllHistory } = useTimerStore();

  useEffect(() => {
    fetchAllHistory();
    const interval = setInterval(fetchAllHistory, 3000);
    return () => clearInterval(interval);
  }, [fetchAllHistory]);

  if (loading && history.length === 0) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">执行历史</h1>
        <p className="text-sm text-slate-400 mt-1">所有定时任务的执行记录</p>
      </div>

      {history.length === 0 ? (
        <EmptyState
          title="暂无执行记录"
          description="创建定时器后，执行记录会显示在这里"
        />
      ) : (
        <div className="space-y-2">
          {history.map((record) => (
            <div
              key={record.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {record.status === "running" ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : record.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-slate-200">
                      {record.timerName}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      {formatFullTime(record.startedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {durationMs(record.startedAt, record.finishedAt)}
                  </span>
                  <StatusBadge status={record.status} />
                </div>
              </div>

              {/* Result / Error */}
              {(record.result || record.error) && (
                <div
                  className={cn(
                    "mt-2 p-2.5 rounded-lg text-xs font-mono max-h-32 overflow-auto",
                    record.status === "failed"
                      ? "bg-red-500/5 border border-red-500/10 text-red-400"
                      : "bg-slate-950/50 border border-slate-800 text-slate-400"
                  )}
                >
                  <pre className="whitespace-pre-wrap break-all">
                    {record.error || record.result}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
