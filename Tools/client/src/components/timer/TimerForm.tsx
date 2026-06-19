import { useState } from "react";
import { X, Globe, Terminal } from "lucide-react";
import { useTimerStore } from "../../stores/timerStore";
import type { Timer, CreateTimerInput } from "../../types/timer";
import { cn } from "../../utils/cn";

interface TimerFormProps {
  timer?: Timer | null;
  onClose: () => void;
}

const CRON_PRESETS = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每 5 分钟", value: "*/5 * * * *" },
  { label: "每 10 分钟", value: "*/10 * * * *" },
  { label: "每 30 分钟", value: "*/30 * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天 09:00", value: "0 9 * * *" },
  { label: "工作日 09:00", value: "0 9 * * 1-5" },
  { label: "每周日 00:00", value: "0 0 * * 0" },
  { label: "每月 1 号", value: "0 0 1 * *" },
];

export default function TimerForm({ timer, onClose }: TimerFormProps) {
  const { createTimer, updateTimer } = useTimerStore();
  const [name, setName] = useState(timer?.name || "");
  const [description, setDescription] = useState(timer?.description || "");
  const [cronExpression, setCronExpression] = useState(timer?.cronExpression || "*/5 * * * *");
  const [customCron, setCustomCron] = useState(!CRON_PRESETS.some((p) => p.value === cronExpression));
  const [taskType, setTaskType] = useState<"http-request" | "shell-command">(
    timer?.taskType || "shell-command"
  );
  const [url, setUrl] = useState(timer?.taskConfig.url || "");
  const [method, setMethod] = useState(timer?.taskConfig.method || "GET");
  const [body, setBody] = useState(timer?.taskConfig.body || "");
  const [command, setCommand] = useState(timer?.taskConfig.command || "");
  const [enabled, setEnabled] = useState(timer?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!name.trim()) {
      setError("请输入定时器名称");
      return;
    }
    if (!cronExpression.trim()) {
      setError("请输入 Cron 表达式");
      return;
    }
    if (taskType === "http-request" && !url.trim()) {
      setError("请输入请求 URL");
      return;
    }
    if (taskType === "shell-command" && !command.trim()) {
      setError("请输入 Shell 命令");
      return;
    }

    const data: CreateTimerInput = {
      name: name.trim(),
      description: description.trim(),
      cronExpression: cronExpression.trim(),
      taskType,
      taskConfig:
        taskType === "http-request"
          ? { url: url.trim(), method, body: method === "POST" ? body : undefined }
          : { command: command.trim() },
      enabled,
    };

    setSubmitting(true);
    try {
      if (timer) {
        await updateTimer(timer.id, data);
      } else {
        await createTimer(data);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">
            {timer ? "编辑定时器" : "新建定时器"}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：每日数据备份"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="定时器的用途说明（可选）"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Cron */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">执行规则 (Cron)</label>
            {!customCron && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setCronExpression(p.value)}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      cronExpression === p.value
                        ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setCustomCron(true)}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  自定义...
                </button>
              </div>
            )}
            {customCron && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="分 时 日 月 周，如 */5 * * * *"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={() => {
                    setCustomCron(false);
                    setCronExpression("*/5 * * * *");
                  }}
                  className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  预设
                </button>
              </div>
            )}
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">任务类型</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTaskType("http-request")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                  taskType === "http-request"
                    ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                )}
              >
                <Globe className="w-4 h-4" />
                HTTP 请求
              </button>
              <button
                onClick={() => setTaskType("shell-command")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                  taskType === "shell-command"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                )}
              >
                <Terminal className="w-4 h-4" />
                Shell 命令
              </button>
            </div>
          </div>

          {/* Task Config */}
          {taskType === "http-request" ? (
            <div className="space-y-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/api/endpoint"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              {method === "POST" && (
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="echo hello world"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Enabled */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800">
            <span className="text-sm text-slate-300">创建后立即启用</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "relative w-10 h-5 rounded-full transition-colors",
                enabled ? "bg-indigo-500" : "bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  enabled ? "left-5" : "left-0.5"
                )}
              />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
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
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "保存中..." : timer ? "保存修改" : "创建定时器"}
          </button>
        </div>
      </div>
    </div>
  );
}
