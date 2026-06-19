import { useEffect, useState } from "react";
import { Plus, Play, Pause, Clock, Activity } from "lucide-react";
import { useTimerStore } from "../../stores/timerStore";
import TimerCard from "./TimerCard";
import TimerForm from "./TimerForm";
import EmptyState from "../shared/EmptyState";
import LoadingSpinner from "../shared/LoadingSpinner";

export default function TimerDashboard() {
  const { timers, loading, fetchTimers } = useTimerStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTimer, setEditingTimer] = useState<string | null>(null);

  useEffect(() => {
    fetchTimers();
    // Poll every 3 seconds for live updates
    const interval = setInterval(fetchTimers, 3000);
    return () => clearInterval(interval);
  }, [fetchTimers]);

  const active = timers.filter((t) => t.enabled).length;
  const stopped = timers.filter((t) => !t.enabled).length;
  const todayExecs = timers.reduce((sum, t) => {
    if (t.lastRunAt && new Date(t.lastRunAt).toDateString() === new Date().toDateString()) {
      return sum + 1;
    }
    return sum;
  }, 0);

  const editingData = editingTimer ? timers.find((t) => t.id === editingTimer) : null;

  return (
    <div className="p-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">定时器</h1>
          <p className="text-sm text-slate-400 mt-1">管理和监控所有定时任务</p>
        </div>
        <button
          onClick={() => {
            setEditingTimer(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          新建定时器
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {[
          { label: "定时器总数", value: timers.length, icon: Clock, color: "text-slate-400" },
          { label: "运行中", value: active, icon: Play, color: "text-emerald-400" },
          { label: "已停止", value: stopped, icon: Pause, color: "text-slate-400" },
          { label: "今日执行", value: todayExecs, icon: Activity, color: "text-indigo-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3 shadow-[0_10px_24px_rgb(0_0_0_/_0.14)]"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Timer list */}
      {loading && timers.length === 0 ? (
        <LoadingSpinner />
      ) : timers.length === 0 ? (
        <EmptyState
          title="还没有定时器"
          description="创建你的第一个定时任务，支持 HTTP 请求和 Shell 命令两种类型"
          action={
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建定时器
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {timers.map((timer) => (
            <TimerCard
              key={timer.id}
              timer={timer}
              onEdit={() => {
                setEditingTimer(timer.id);
                setShowForm(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <TimerForm
          timer={editingData}
          onClose={() => {
            setShowForm(false);
            setEditingTimer(null);
          }}
        />
      )}
    </div>
  );
}
