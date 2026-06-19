import { X, Clock, Utensils, Coffee, Gamepad2, Dumbbell, Lightbulb, Calendar, Trash2, Weight, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { JournalEntry } from "../../types/journal";
import { useJournalStore } from "../../stores/journalStore";
import { cn } from "../../utils/cn";

interface JournalDetailProps {
  entry: JournalEntry;
  onClose: () => void;
}

export default function JournalDetail({ entry, onClose }: JournalDetailProps) {
  const { deleteEntry, updateEntry, reprocessEntry, submitting } = useJournalStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(entry.rawText);
  const { structured, date, rawText } = entry;

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await deleteEntry(entry.id);
    onClose();
  };

  const handleEdit = async () => {
    if (!editText.trim() || submitting) return;
    try {
      await updateEntry(entry.id, editText.trim());
      setEditing(false);
    } catch {
      // error shown by store
    }
  };

  const handleReprocess = async () => {
    try {
      await reprocessEntry(entry.id);
    } catch {
      // error shown by store
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleEdit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto shadow-2xl">
        {/* Header */}
        <div
          className="relative p-6 pb-4"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))",
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{structured.moodEmoji}</span>
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                {structured.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <Calendar className="w-3 h-3" />
                {date}
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {structured.mood}
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            {structured.summary}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Edit mode */}
          {editing && (
            <div className="space-y-3">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="编辑日记原文..."
                rows={10}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
              <p className="text-xs text-slate-500">
                编辑原文后保存，AI 会重新整理。按 Ctrl+Enter 快速保存
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditText(entry.rawText);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleEdit}
                  disabled={!editText.trim() || submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      AI 整理中...
                    </>
                  ) : (
                    "保存"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          {!editing && structured.timeline.length > 0 && (
            <Section icon={Clock} title="时间线" color="text-blue-400">
              <div className="space-y-2">
                {structured.timeline.map((t, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-xs text-slate-500 w-16 shrink-0 mt-0.5">
                      {t.time}
                    </span>
                    <span className="text-slate-300">{t.event}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Meals */}
          {!editing && structured.meals.length > 0 && (
            <Section icon={Utensils} title="饮食" color="text-amber-400">
              <div className="flex flex-wrap gap-2">
                {structured.meals.map((m, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs"
                  >
                    {m.type}: {m.content}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Drinks */}
          {!editing && structured.drinks.length > 0 && (
            <Section icon={Coffee} title="饮品" color="text-cyan-400">
              <div className="flex flex-wrap gap-2">
                {structured.drinks.map((d, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Entertainment */}
          {!editing && structured.entertainment.length > 0 && (
            <Section icon={Gamepad2} title="娱乐" color="text-purple-400">
              <div className="flex flex-wrap gap-2">
                {structured.entertainment.map((e, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-xs"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Exercise */}
          {!editing && structured.exercise.length > 0 && (
            <Section icon={Dumbbell} title="运动" color="text-emerald-400">
              <div className="flex flex-wrap gap-2">
                {structured.exercise.map((e, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Weight */}
          {!editing && structured.weight != null && (
            <Section icon={Weight} title="体重" color="text-rose-400">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-rose-300">
                  {structured.weight}
                </span>
                <span className="text-sm text-slate-500">kg</span>
              </div>
            </Section>
          )}

          {/* Thoughts */}
          {!editing && structured.thoughts && (
            <Section icon={Lightbulb} title="感想" color="text-yellow-400">
              <p className="text-sm text-slate-300 leading-relaxed">
                {structured.thoughts}
              </p>
            </Section>
          )}

          {/* Tomorrow plan */}
          {!editing && structured.tomorrowPlan && (
            <Section icon={Calendar} title="明日计划" color="text-indigo-400">
              <p className="text-sm text-slate-300">{structured.tomorrowPlan}</p>
            </Section>
          )}

          {/* Raw text toggle */}
          {!editing && (
          <details className="group">
            <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition-colors select-none">
              查看原文
            </summary>
            <p className="mt-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-500 whitespace-pre-wrap">
              {rawText}
            </p>
          </details>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(!editing);
                setEditText(entry.rawText);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              {editing ? "取消编辑" : "编辑"}
            </button>
            <button
              onClick={handleReprocess}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", submitting && "animate-spin")} />
              重新分析
            </button>
          </div>
          <button
            onClick={handleDelete}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              confirmDelete
                ? "text-red-400 bg-red-500/10"
                : "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmDelete ? "确认删除" : "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={cn("flex items-center gap-2 mb-2", color)}>
        <Icon className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
