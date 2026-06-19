import { readFileSync, writeFileSync, existsSync } from "fs";
import { config } from "../config.js";
import type { Timer, ExecutionRecord } from "../types/timer.js";

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Timer CRUD
export function getAllTimers(): Timer[] {
  return readJsonFile<Timer[]>(config.timersFile, []);
}

export function getTimerById(id: string): Timer | undefined {
  const timers = getAllTimers();
  return timers.find((t) => t.id === id);
}

export function saveTimer(timer: Timer): void {
  const timers = getAllTimers();
  const idx = timers.findIndex((t) => t.id === timer.id);
  if (idx >= 0) {
    timers[idx] = timer;
  } else {
    timers.push(timer);
  }
  writeJsonFile(config.timersFile, timers);
}

export function deleteTimer(id: string): boolean {
  const timers = getAllTimers();
  const filtered = timers.filter((t) => t.id !== id);
  if (filtered.length === timers.length) return false;
  writeJsonFile(config.timersFile, filtered);
  return true;
}

// Execution History
export function getAllHistory(): ExecutionRecord[] {
  return readJsonFile<ExecutionRecord[]>(config.historyFile, []);
}

export function getHistoryByTimerId(timerId: string): ExecutionRecord[] {
  const all = getAllHistory();
  return all.filter((h) => h.timerId === timerId);
}

export function saveExecution(record: ExecutionRecord): void {
  const history = getAllHistory();
  history.unshift(record);
  // Keep only the latest maxHistory records
  if (history.length > config.maxHistory) {
    history.length = config.maxHistory;
  }
  writeJsonFile(config.historyFile, history);
}

export function updateExecution(id: string, updates: Partial<ExecutionRecord>): void {
  const history = getAllHistory();
  const idx = history.findIndex((h) => h.id === id);
  if (idx >= 0) {
    history[idx] = { ...history[idx], ...updates };
    writeJsonFile(config.historyFile, history);
  }
}
