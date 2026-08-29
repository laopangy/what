import { readVault, updateVault } from "../vault.js";
import { config } from "../config.js";
import type { Timer, ExecutionRecord } from "../types/timer.js";

export async function getAllTimers(): Promise<Timer[]> {
  const data = await readVault();
  return (data.timers || []) as Timer[];
}

export async function getTimerById(id: string): Promise<Timer | undefined> {
  return (await getAllTimers()).find((timer) => timer.id === id);
}

export async function saveTimer(timer: Timer): Promise<void> {
  await updateVault((data) => {
    const timers = (data.timers || []) as Timer[];
    const index = timers.findIndex((item) => item.id === timer.id);
    if (index >= 0) timers[index] = timer; else timers.push(timer);
    data.timers = timers;
  });
}

export async function deleteTimer(id: string): Promise<boolean> {
  return updateVault((data) => {
    const timers = (data.timers || []) as Timer[];
    const next = timers.filter((timer) => timer.id !== id);
    data.timers = next;
    return next.length !== timers.length;
  });
}

export async function getAllHistory(): Promise<ExecutionRecord[]> {
  const data = await readVault();
  return ((data.history || []) as ExecutionRecord[]).slice(0, config.maxHistory);
}

export async function getHistoryByTimerId(timerId: string): Promise<ExecutionRecord[]> {
  return (await getAllHistory()).filter((record) => record.timerId === timerId);
}

export async function saveExecution(record: ExecutionRecord): Promise<void> {
  await updateVault((data) => {
    const history = (data.history || []) as ExecutionRecord[];
    const existing = history.findIndex((item) => item.id === record.id);
    if (existing >= 0) history[existing] = record; else history.unshift(record);
    data.history = history.slice(0, config.maxHistory);
  });
}

export async function updateExecution(id: string, updates: Partial<ExecutionRecord>): Promise<void> {
  await updateVault((data) => {
    const history = (data.history || []) as ExecutionRecord[];
    const index = history.findIndex((record) => record.id === id);
    if (index >= 0) history[index] = { ...history[index], ...updates };
    data.history = history;
  });
}
