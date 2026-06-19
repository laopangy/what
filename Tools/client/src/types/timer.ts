export interface Timer {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  taskType: "http-request" | "shell-command";
  taskConfig: {
    url?: string;
    method?: string;
    body?: string;
    command?: string;
    timeoutMs?: number;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  isScheduled?: boolean;
}

export interface ExecutionRecord {
  id: string;
  timerId: string;
  timerName: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "failed";
  result?: string;
  error?: string;
}

export type CreateTimerInput = Omit<
  Timer,
  "id" | "createdAt" | "updatedAt" | "lastRunAt" | "nextRunAt" | "isScheduled"
>;

export type UpdateTimerInput = Partial<CreateTimerInput>;
