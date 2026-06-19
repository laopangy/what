import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { config } from "../config.js";
import type { JournalEntry } from "../types/journal.js";

const JOURNAL_FILE = resolve(config.dataDir, "journal.json");

function read(): JournalEntry[] {
  try {
    if (!existsSync(JOURNAL_FILE)) return [];
    return JSON.parse(readFileSync(JOURNAL_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function write(entries: JournalEntry[]): void {
  writeFileSync(JOURNAL_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function getAllEntries(): JournalEntry[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getEntryById(id: string): JournalEntry | undefined {
  return read().find((e) => e.id === id);
}

export function getEntryByDate(date: string): JournalEntry | undefined {
  return read().find((e) => e.date === date);
}

export function saveEntry(entry: JournalEntry): void {
  const entries = read();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  write(entries);
}

export function deleteEntry(id: string): boolean {
  const entries = read();
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) return false;
  write(filtered);
  return true;
}
