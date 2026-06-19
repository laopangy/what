import cron from "node-cron";
import { v4 as uuidv4 } from "uuid";
import type { Timer, ExecutionRecord } from "../types/timer.js";
import { getAllTimers, saveTimer, saveExecution, updateExecution } from "./storage.js";

const jobs = new Map<string, cron.ScheduledTask>();

const SUPPLY_WATCH_TIMER_PREFIX = "supply-watch-source-plan";
const OPENCLI_DIR = "D:\\work\\Projects\\OpenCLI";
const SUPPLY_WATCH_COMMAND =
  `cd /d ${OPENCLI_DIR} && set OPENCLI_BROWSER_COMMAND_TIMEOUT=180&& node dist\\src\\main.js supply-watch source-plan --once --latest 10 --dms-url https://dms.aliyun.com --pretty --format json`;

const SUPPLY_WATCH_TIMERS: Array<Pick<Timer, "id" | "name" | "description" | "cronExpression" | "taskType" | "taskConfig" | "enabled">> = [
  {
    id: `${SUPPLY_WATCH_TIMER_PREFIX}-0630`,
    name: "生产补货源单生成巡检 06:30-06:59",
    description: "每分钟检查 SchedulerX 最近 10 条源单生成计划单记录，发现失败则输出诊断报告。",
    cronExpression: "30-59 6 * * *",
    taskType: "shell-command",
    taskConfig: {
      command: SUPPLY_WATCH_COMMAND,
      timeoutMs: 180000,
    },
    enabled: true,
  },
  {
    id: `${SUPPLY_WATCH_TIMER_PREFIX}-0700`,
    name: "生产补货源单生成巡检 07:00-07:59",
    description: "每分钟检查 SchedulerX 最近 10 条源单生成计划单记录，发现失败则输出诊断报告。",
    cronExpression: "* 7 * * *",
    taskType: "shell-command",
    taskConfig: {
      command: SUPPLY_WATCH_COMMAND,
      timeoutMs: 180000,
    },
    enabled: true,
  },
  {
    id: `${SUPPLY_WATCH_TIMER_PREFIX}-0800`,
    name: "生产补货源单生成巡检 08:00-08:30",
    description: "每分钟检查 SchedulerX 最近 10 条源单生成计划单记录，发现失败则输出诊断报告。",
    cronExpression: "0-30 8 * * *",
    taskType: "shell-command",
    taskConfig: {
      command: SUPPLY_WATCH_COMMAND,
      timeoutMs: 180000,
    },
    enabled: true,
  },
];

function seedSupplyWatchTimers(): void {
  const timers = getAllTimers();
  const existingById = new Map(timers.map((timer) => [timer.id, timer]));
  const now = new Date().toISOString();

  for (const timer of SUPPLY_WATCH_TIMERS) {
    const existing = existingById.get(timer.id);
    if (existing) {
      saveTimer({
        ...existing,
        description: timer.description,
        cronExpression: timer.cronExpression,
        taskType: timer.taskType,
        taskConfig: timer.taskConfig,
        updatedAt: now,
      });
      continue;
    }
    saveTimer({
      ...timer,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// --- Task execution ---
async function executeTask(timer: Timer): Promise<void> {
  const record: ExecutionRecord = {
    id: uuidv4(),
    timerId: timer.id,
    timerName: timer.name,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  saveExecution(record);

  const startTime = Date.now();
  try {
    let result = "";
    if (timer.taskType === "http-request" && timer.taskConfig.url) {
      const method = timer.taskConfig.method || "GET";
      const options: RequestInit = { method };
      if (method === "POST" && timer.taskConfig.body) {
        options.headers = { "Content-Type": "application/json" };
        options.body = timer.taskConfig.body;
      }
      const res = await fetch(timer.taskConfig.url, options);
      result = `HTTP ${res.status} ${res.statusText}\n${await res.text().catch(() => "")}`;
    } else if (timer.taskType === "shell-command" && timer.taskConfig.command) {
      // Execute shell command using child_process
      const { execSync } = await import("child_process");
      try {
        const output = execSync(timer.taskConfig.command, {
          encoding: "utf-8",
          timeout: timer.taskConfig.timeoutMs ?? 30000,
          windowsHide: true,
        });
        result = output || "(no output)";
      } catch (execErr: unknown) {
        const err = execErr as { stdout?: string; stderr?: string; message?: string };
        result = `Exit code: ${(err as { status?: number }).status}\nStdout: ${err.stdout || ""}\nStderr: ${err.stderr || err.message || ""}`;
      }
    }

    updateExecution(record.id, {
      status: "success",
      finishedAt: new Date().toISOString(),
      result: result.slice(0, 2000), // Truncate
    });
    console.log(`[Timer] "${timer.name}" executed successfully (${Date.now() - startTime}ms)`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    updateExecution(record.id, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: message,
    });
    console.error(`[Timer] "${timer.name}" failed: ${message}`);
  }

  // Update lastRunAt
  const fresh = getAllTimers().find((t) => t.id === timer.id);
  if (fresh) {
    fresh.lastRunAt = new Date().toISOString();
    saveTimer(fresh);
  }
}

// --- Schedule management ---
export function scheduleTimer(timer: Timer): void {
  // Remove existing job if any
  unscheduleTimer(timer.id);

  if (!timer.enabled) return;

  if (!cron.validate(timer.cronExpression)) {
    console.error(`[Timer] Invalid cron expression for "${timer.name}": ${timer.cronExpression}`);
    return;
  }

  const job = cron.schedule(timer.cronExpression, () => {
    console.log(`[Timer] Triggering "${timer.name}" (${timer.cronExpression})`);
    executeTask(timer);
  });

  jobs.set(timer.id, job);
  console.log(`[Timer] Scheduled "${timer.name}" with cron "${timer.cronExpression}"`);
}

export function unscheduleTimer(id: string): void {
  const job = jobs.get(id);
  if (job) {
    job.stop();
    jobs.delete(id);
  }
}

export function isScheduled(id: string): boolean {
  return jobs.has(id);
}

// --- Initialize from storage ---
export function restoreSchedules(): void {
  seedSupplyWatchTimers();
  const timers = getAllTimers();
  for (const timer of timers) {
    if (timer.enabled) {
      scheduleTimer(timer);
    }
  }
  console.log(`[Timer] Restored ${jobs.size} scheduled timers`);
}

// --- Manual trigger ---
export async function triggerTimer(timer: Timer): Promise<void> {
  await executeTask(timer);
}
