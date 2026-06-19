export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  rawText: string;
  structured: JournalStructured;
  createdAt: string;
  updatedAt: string;
}

export interface JournalStructured {
  title: string;
  mood: string;
  moodEmoji: string;
  summary: string;
  timeline: { time: string; event: string }[];
  highlights: string[];
  meals: { type: string; content: string }[];
  drinks: string[];
  entertainment: string[];
  exercise: string[];
  weight?: number; // kg，可选
  thoughts: string;
  tomorrowPlan: string;
}

export type CreateJournalInput = {
  rawText: string;
  date?: string; // defaults to today
};
