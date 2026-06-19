import { useState, useEffect } from "react";
import { useJournalStore } from "../../stores/journalStore";
import JournalInput from "./JournalInput";
import JournalCard from "./JournalCard";
import JournalDetail from "./JournalDetail";
import EmptyState from "../shared/EmptyState";
import LoadingSpinner from "../shared/LoadingSpinner";
import { BookOpen, Plus, Lock, Eye, EyeOff } from "lucide-react";

const JOURNAL_PASSWORD = "438711";
const AUTH_KEY = "journal_authenticated";

function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === "true";
}

export default function JournalHome() {
  const { entries, loading, submitting, error, fetchEntries, createEntry } =
    useJournalStore();
  const [authed, setAuthed] = useState(isAuthenticated);
  const [pwd, setPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (authed) fetchEntries();
  }, [fetchEntries, authed]);

  const handleUnlock = () => {
    if (pwd === JOURNAL_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "true");
      setAuthed(true);
      setPwdError("");
    } else {
      setPwdError("密码错误");
      setPwd("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleUnlock();
  };

  // ── Password gate ──
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-5">
        <div className="w-full max-w-sm mx-auto p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-[0_18px_50px_rgb(0_0_0_/_0.28)]">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-1">随手记</h2>
            <p className="text-sm text-slate-500">输入密码以查看日记</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={pwd}
                onChange={(e) => { setPwd(e.target.value); setPwdError(""); }}
                onKeyDown={handleKeyDown}
                placeholder="请输入密码"
                autoFocus
                className="w-full px-4 py-3 pr-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {pwdError && (
              <p className="text-center text-sm text-red-400">{pwdError}</p>
            )}

            <button
              onClick={handleUnlock}
              disabled={!pwd}
              className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              解锁
            </button>
          </div>
        </div>
      </div>
    );
  }

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
