import { createModuleClient } from "./moduleFetch.js";
import { formatLocalDateTime } from "./dates.js";
import type { ModuleToolPlugin } from "./types.js";

interface Timer {
  id: string; name: string; description: string; cronExpression: string;
  taskType: "http-request" | "shell-command"; enabled: boolean; isScheduled: boolean;
  lastRunAt?: string; nextRunAt?: string;
}
interface ExecutionRecord {
  timerId: string; timerName: string; startedAt: string; finishedAt?: string;
  status: "running" | "success" | "failed"; result?: string; error?: string;
}

const TASK_TYPES: Record<Timer["taskType"], string> = { "http-request": "HTTP 请求", "shell-command": "Shell 命令" };
const TIMER_ID = /^[\w-]{1,100}$/;
const MAX_REASON = 200;

// Execution output may embed tokens or URLs with credentials; only short, redacted failure reasons reach the model.
function redact(text: string): string {
  return text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/(https?:\/\/[^\s?#]+)[?#]\S*/gi, "$1?…")
    .replace(/[A-Za-z0-9_\-+=]{32,}/g, "…")
    .trim()
    .slice(0, MAX_REASON);
}

function summarizeRecord(record: ExecutionRecord) {
  const started = new Date(record.startedAt).getTime();
  const finished = record.finishedAt ? new Date(record.finishedAt).getTime() : NaN;
  const base = {
    timerId: record.timerId,
    timerName: record.timerName,
    startedAt: formatLocalDateTime(record.startedAt),
    durationSeconds: Number.isFinite(finished - started) ? Math.max(0, Math.round((finished - started) / 1000)) : undefined,
  };
  if (record.status === "running") return { ...base, status: "执行中" };
  if (record.status === "failed") return { ...base, status: "失败", reason: redact(record.error ?? "未知错误") };

  const result = record.result ?? "";
  const exit = /^Exit code: (\S+)/.exec(result);
  if (exit) {
    const code = Number(exit[1]);
    const stderrLines = (/\nStderr: ([\s\S]*)$/.exec(result)?.[1] ?? "").split(/\r?\n/).filter((line) => line.trim());
    const stderr = stderrLines.find((line) => /error|fail|denied|refused|not found|exception|失败|错误/i.test(line)) ?? stderrLines[0] ?? "";
    return {
      ...base,
      status: "失败",
      exitCode: Number.isFinite(code) ? code : undefined,
      reason: redact(stderr || (Number.isFinite(code) ? `命令退出码 ${code}` : "命令超时或被终止")),
    };
  }
  const http = /^HTTP (\d{3}) ?([^\n]*)/.exec(result);
  if (http && Number(http[1]) >= 400) {
    return { ...base, status: "失败", httpStatus: Number(http[1]), reason: redact(`HTTP ${http[1]} ${http[2]}`) };
  }
  return { ...base, status: "成功", httpStatus: http ? Number(http[1]) : undefined };
}

export function createTimerPlugin({ baseUrl }: { baseUrl: string }): ModuleToolPlugin {
  const request = createModuleClient({ baseUrl, label: "工具" });

  const readTimer = async (timerId: unknown) => {
    const id = String(timerId ?? "");
    if (!TIMER_ID.test(id)) return { error: "定时任务 id 不正确" } as const;
    const result = await request<Timer>("GET", `/api/timer/${encodeURIComponent(id)}`);
    if (!result.ok) return { error: result.status === 404 ? "定时任务不存在" : result.error } as const;
    return { timer: result.data } as const;
  };

  return {
    name: "timer",
    label: "定时任务",
    summary: "查看定时任务和执行历史，启用/停用或立即执行任务（不能新建、修改或删除）",
    intent: /定时|cron|巡检|执行历史|执行记录|任务.*(?:执行|失败|成功|运行)|(?:执行|运行|触发).*任务/i,
    prompt: `定时任务模块使用提示：
- 询问任务执行情况时用 timer_history，回答时概括成功和失败情况以及失败原因。
- 启用、停用和立即执行都需要用户确认，直接调用对应工具即可；timerId 来自 timer_list。
- 新建、修改或删除定时任务需要用户到工具页面手动操作。`,
    tools: [
      {
        name: "timer_list",
        label: "定时任务列表",
        risk: "read",
        description: "列出所有定时任务：名称、说明、cron 表达式、是否启用，以及上次和下次执行时间。",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "timer_history",
        label: "执行历史",
        risk: "read",
        description: "查看定时任务的执行历史（最新在前），包含执行状态和失败原因，可按任务筛选。",
        input_schema: {
          type: "object",
          properties: {
            timerId: { type: "string", description: "只看某个任务时传入任务 id，可选" },
            limit: { type: "number", description: "条数，默认 10，最多 30" },
          },
        },
      },
      {
        name: "timer_toggle",
        label: "启用/停用任务",
        risk: "confirm",
        description: "启用或停用一个定时任务。",
        input_schema: {
          type: "object",
          properties: {
            timerId: { type: "string", description: "任务 id" },
            enabled: { type: "boolean", description: "true=启用，false=停用" },
          },
          required: ["timerId", "enabled"],
        },
      },
      {
        name: "timer_trigger",
        label: "立即执行任务",
        risk: "confirm",
        description: "立即执行一次定时任务，不影响原有计划。",
        input_schema: {
          type: "object",
          properties: { timerId: { type: "string", description: "任务 id" } },
          required: ["timerId"],
        },
      },
    ],

    async prepare(name, args) {
      const found = await readTimer(args.timerId);
      if ("error" in found) return { result: { error: found.error } };
      const { timer } = found;
      if (name === "timer_toggle") {
        if (typeof args.enabled !== "boolean") return { result: { error: "请说明要启用还是停用" } };
        if (timer.enabled === args.enabled) {
          return { result: { unchanged: true, message: `「${timer.name}」已经是${timer.enabled ? "启用" : "停用"}状态` } };
        }
        return { summary: args.enabled ? `启用定时任务「${timer.name}」（${timer.cronExpression}）` : `停用定时任务「${timer.name}」，停用后不会再按计划自动执行` };
      }
      if (name === "timer_trigger") return { summary: `立即执行定时任务「${timer.name}」（${TASK_TYPES[timer.taskType] ?? timer.taskType}）` };
      return { result: { error: `未知工具：${name}` } };
    },

    async execute(name, args) {
      switch (name) {
        case "timer_list": {
          const result = await request<Timer[]>("GET", "/api/timer");
          if (!result.ok) return { error: result.error };
          return {
            timers: result.data.map((timer) => ({
              id: timer.id, name: timer.name, description: timer.description || undefined, cron: timer.cronExpression,
              taskType: TASK_TYPES[timer.taskType] ?? timer.taskType, enabled: timer.enabled, scheduled: timer.isScheduled,
              lastRunAt: formatLocalDateTime(timer.lastRunAt), nextRunAt: formatLocalDateTime(timer.nextRunAt),
            })),
          };
        }

        case "timer_history": {
          const limit = Math.min(30, Math.max(1, Math.trunc(typeof args.limit === "number" ? args.limit : 10)));
          const timerId = typeof args.timerId === "string" && args.timerId ? args.timerId : undefined;
          if (timerId && !TIMER_ID.test(timerId)) return { error: "定时任务 id 不正确" };
          const result = await request<ExecutionRecord[]>("GET", timerId ? `/api/timer/${encodeURIComponent(timerId)}/history` : "/api/timer/history/all");
          if (!result.ok) return { error: result.status === 404 ? "定时任务不存在" : result.error };
          const records = [...result.data].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
          return { total: records.length, records: records.slice(0, limit).map(summarizeRecord) };
        }

        case "timer_toggle": {
          if (typeof args.enabled !== "boolean") return { error: "请说明要启用还是停用" };
          const found = await readTimer(args.timerId);
          if ("error" in found) return { error: found.error };
          // The toggle endpoint flips state, so re-check to avoid undoing a change made since confirmation.
          if (found.timer.enabled === args.enabled) {
            return { unchanged: true, message: `「${found.timer.name}」已经是${found.timer.enabled ? "启用" : "停用"}状态` };
          }
          const result = await request<Timer>("POST", `/api/timer/${encodeURIComponent(found.timer.id)}/toggle`);
          if (!result.ok) return { error: result.error };
          return {
            enabled: result.data.enabled,
            scheduled: result.data.isScheduled,
            message: `已${result.data.enabled ? "启用" : "停用"}「${result.data.name}」`,
          };
        }

        case "timer_trigger": {
          const found = await readTimer(args.timerId);
          if ("error" in found) return { error: found.error };
          const result = await request("POST", `/api/timer/${encodeURIComponent(found.timer.id)}/trigger`);
          if (!result.ok) return { error: result.error };
          return { triggered: true, message: `已开始执行「${found.timer.name}」，结果稍后可在执行历史中查看` };
        }

        default:
          return { error: `未知工具：${name}` };
      }
    },
  };
}
