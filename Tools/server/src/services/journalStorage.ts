import { readVault, updateVault } from "../vault.js";
import type { JournalEntry } from "../types/journal.js";

export async function getAllEntries(): Promise<JournalEntry[]> {
  const data = await readVault();
  return ((data.journals || []) as JournalEntry[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getEntryById(id: string): Promise<JournalEntry | undefined> {
  return (await getAllEntries()).find((entry) => entry.id === id);
}

export async function getEntryByDate(date: string): Promise<JournalEntry | undefined> {
  return (await getAllEntries()).find((entry) => entry.date === date);
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  await updateVault((data) => {
    const entries = (data.journals || []) as JournalEntry[];
    const index = entries.findIndex((item) => item.id === entry.id);
    if (index >= 0) entries[index] = entry; else entries.push(entry);
    data.journals = entries;
  });
}

export async function deleteEntry(id: string): Promise<boolean> {
  return updateVault((data) => {
    const entries = (data.journals || []) as JournalEntry[];
    const next = entries.filter((entry) => entry.id !== id);
    data.journals = next;
    return next.length !== entries.length;
  });
}
