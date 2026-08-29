import { useState, useEffect } from "react";
import { useJournalStore } from "../../stores/journalStore";
import JournalInput from "./JournalInput";
import JournalCard from "./JournalCard";
import JournalDetail from "./JournalDetail";
import EmptyState from "../shared/EmptyState";
import LoadingSpinner from "../shared/LoadingSpinner";
import { BookOpen, Plus } from "lucide-react";

export default function JournalHome() {
  const { entries, loading, submitting, error, fetchEntries, createEntry } =
    useJournalStore();
  const [showInput, setShowInput] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const selected = selectedId
    ? entries.find((e) => e.id === selectedId)
    : null;

  const handleSubmit = async (text: string) => {
    setSubmitError("");
    try {
      await createEntry(text);
      setShowInput(false);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "提交失败");
    }
  };

  return (
    <div className="p-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            随手记
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            用白话文写日记，AI 帮你整理
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedId(null);
            setShowInput(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          写日记
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Input modal */}
      {showInput && (
        <JournalInput
          onSubmit={handleSubmit}
          onClose={() => setShowInput(false)}
          submitting={submitting}
          error={submitError}
        />
      )}

      {/* Detail modal */}
      {selected && (
        <JournalDetail
          entry={selected}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Entry list */}
      {loading && entries.length === 0 ? (
        <LoadingSpinner />
      ) : entries.length === 0 ? (
        <EmptyState
          title="还没有日记"
          description="随便写点今天发生的事，AI 会帮你整理成漂亮的日记"
          action={
            <button
              onClick={() => setShowInput(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              写第一篇日记
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <JournalCard
              key={entry.id}
              entry={entry}
              onClick={() => setSelectedId(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
