import { useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useJournalStore } from "../../stores/journalStore";
import JournalInput from "./JournalInput";
import JournalCard from "./JournalCard";
import JournalDetail from "./JournalDetail";
import EmptyState from "../shared/EmptyState";
import LoadingSpinner from "../shared/LoadingSpinner";
import { BookOpen, Lock, Plus } from "lucide-react";

export default function JournalHome() {
  const { entries, loading, submitting, error } = useJournalStore(
    useShallow((s) => ({ entries: s.entries, loading: s.loading, submitting: s.submitting, error: s.error }))
  );
  const { fetchEntries, createEntry, lock, setDraft, setEditDraft } = useJournalStore.getState();
  const [showInput, setShowInput] = useState(() => useJournalStore.getState().draft.trim() !== "");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => useJournalStore.getState().editDraft?.id ?? null
  );
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => lock(true)}
            title="锁定随手记"
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Lock className="w-4 h-4" />
            锁定
          </button>
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
          onClose={() => {
            setDraft("");
            setShowInput(false);
          }}
          submitting={submitting}
          error={submitError}
        />
      )}

      {/* Detail modal */}
      {selected && (
        <JournalDetail
          entry={selected}
          onClose={() => {
            setEditDraft(null);
            setSelectedId(null);
          }}
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
