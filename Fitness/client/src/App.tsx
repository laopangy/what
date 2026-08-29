import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, Apple, Beef, Bike, CalendarDays, Check, CircleGauge, Clock3, Coffee, Droplets, Dumbbell,
  Flame, Footprints, HeartPulse, History, LayoutDashboard, ListTodo, LoaderCircle, Moon, Mountain, Pencil, Plus, Scale, Sparkles, Target, Timer, Trash2, TrendingUp, Utensils, X,
} from "lucide-react";
import { api } from "./api";
import type { ActivityType, CompletedSet, FitnessState, FoodCalculation, MealEntry, Profile, Tab, WorkoutSession } from "./types";

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const goalNames = { gain: "增肌", lose: "减脂", maintain: "保持" } as const;
const mealNames = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" } as const;
const activityNames: Record<ActivityType, string> = { daily: "日常安排", strength: "力量训练", cycling: "骑行", running: "跑步", hiking: "爬山", other: "其他活动" };
const activityIcons: Record<ActivityType, LucideIcon> = { daily: CalendarDays, strength: Dumbbell, cycling: Bike, running: Footprints, hiking: Mountain, other: Activity };

const nav: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "今日总览", icon: LayoutDashboard },
  { id: "training", label: "每日计划", icon: CalendarDays },
  { id: "nutrition", label: "饮食记录", icon: Apple },
  { id: "body", label: "身体数据", icon: Scale },
];

function Progress({ value, target, color = "#d99a16" }: { value: number; target: number; color?: string }) {
  const width = Math.min(100, target ? (value / target) * 100 : 0);
  return <div className="progress"><i style={{ width: `${width}%`, background: color }} /></div>;
}

function Metric({ icon: Icon, label, value, note, color }: { icon: LucideIcon; label: string; value: string; note: string; color: string }) {
  return (
    <div className="panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-4"><span className="text-muted text-[11px] tracking-wider">{label}</span><Icon size={16} style={{ color }} /></div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-muted text-[11px] mt-1">{note}</div>
    </div>
  );
}

function RoutineSummary({ session, routine, compact = false }: { session: WorkoutSession; routine: FitnessState["routine"]; compact?: boolean }) {
  const meals = [
    { label: "早餐", value: session.breakfast, icon: Coffee },
    { label: "午餐", value: session.lunch, icon: Utensils },
    { label: "晚餐", value: session.dinner, icon: Utensils },
    { label: "加餐", value: session.snack, icon: Apple },
  ];
  return <div className={compact ? "space-y-3" : "space-y-4"}>
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border/70 bg-black/10 p-3 flex items-center gap-3"><Clock3 size={16} className="text-accent-light"/><div><p className="text-muted text-[10px]">固定起床</p><strong>{routine.wakeTime}</strong></div></div>
      <div className="rounded-lg border border-border/70 bg-black/10 p-3 flex items-center gap-3"><Moon size={16} className="text-sky"/><div><p className="text-muted text-[10px]">固定睡觉</p><strong>{routine.sleepTime}</strong></div></div>
    </div>
    <div className={`grid ${compact ? "grid-cols-2" : "sm:grid-cols-2"} gap-2`}>{meals.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-lg border border-border/70 bg-black/10 p-3"><div className="flex items-center gap-2 text-muted text-[10px] mb-1"><Icon size={13}/>{label}</div><p>{value || "未安排"}</p></div>)}</div>
    <div className="rounded-lg border border-accent/25 bg-accent/10 p-3"><div className="flex items-center gap-2 text-accent-light text-[10px] mb-1"><ListTodo size={13}/>今天要做什么</div><p>{session.focus}</p></div>
  </div>;
}

function Dashboard({ data, go }: { data: FitnessState; go: (tab: Tab) => void }) {
  const date = today();
  const meals = data.meals.filter((meal) => meal.date === date);
  const nutrition = meals.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const weekday = new Date().getDay();
  const nextSession = [...data.plan.sessions].sort((a, b) => ((a.weekday - weekday + 7) % 7) - ((b.weekday - weekday + 7) % 7))[0];
  const thisWeek = data.workoutLogs.filter((log) => Date.now() - new Date(`${log.date}T12:00:00`).getTime() < 7 * 86400000);
  const lastWeight = data.weights[0]?.weightKg ?? data.profile.weightKg;
  const caloriePercent = Math.round(nutrition.calories / data.profile.calorieTarget * 100) || 0;
  const NextIcon = nextSession ? activityIcons[nextSession.activityType] : CalendarDays;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-accent-light text-[10px] tracking-[.2em] uppercase mb-2">Daily briefing</p><h1 className="text-2xl font-semibold">今天，继续变强。</h1><p className="text-muted mt-1">训练、饮食和恢复都算数。</p></div>
        <div className="flex items-center gap-2 text-muted"><CalendarDays size={15} /><span>{new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</span></div>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Metric icon={Flame} label="今日热量" value={`${nutrition.calories}`} note={`${caloriePercent}% / ${data.profile.calorieTarget} kcal`} color="#d99a16" />
        <Metric icon={Beef} label="蛋白质" value={`${nutrition.protein}g`} note={`目标 ${data.profile.proteinTarget}g`} color="#a4514d" />
        <Metric icon={CalendarDays} label="每日计划" value={`${data.plan.sessions.length} 项`} note={`近 7 天运动 ${thisWeek.length} 次`} color="#7f8750" />
        <Metric icon={Scale} label="最近体重" value={`${lastWeight} kg`} note={`${goalNames[data.profile.goal]}阶段`} color="#74898d" />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-4">
        <section className="panel rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between"><div><p className="text-muted text-[10px] tracking-widest">DAILY PLAN</p><h2 className="text-lg font-semibold mt-1 flex items-center gap-2"><NextIcon size={17} className="text-accent-light"/>{nextSession?.name ?? "暂无每日计划"}</h2></div><span className="text-accent-light text-sm">{nextSession && weekdayNames[nextSession.weekday]}</span></div>
          <div className="p-5">
            {nextSession ? <>{nextSession.activityType === "daily" || nextSession.breakfast || nextSession.lunch || nextSession.dinner || nextSession.snack ? <RoutineSummary session={nextSession} routine={data.routine} compact/> : <><p className="text-muted mb-4">{nextSession.focus} · 目标 {nextSession.targetDurationMinutes} 分钟{nextSession.targetDistanceKm ? ` · ${nextSession.targetDistanceKm} km` : ""}</p>{nextSession.exercises.length > 0 && <div className="space-y-2 mb-5">{nextSession.exercises.slice(0, 4).map((exercise, index) => <div key={exercise.id} className="flex items-center gap-3 py-2 border-b border-border/60"><span className="w-6 h-6 rounded bg-panel text-muted grid place-items-center text-[10px]">{index + 1}</span><span className="flex-1">{exercise.name}</span><span className="text-muted">{exercise.sets} × {exercise.reps}</span></div>)}</div>}</>}<button className="btn-primary flex items-center gap-2 mt-4" onClick={() => go("training")}><CalendarDays size={15}/>查看完整计划</button></> : <><p className="text-muted mb-4">添加一项计划，安排每天的饮食和要做的事情。</p><button className="btn-primary flex items-center gap-2" onClick={() => go("training")}><Plus size={15}/>添加计划</button></>}
          </div>
        </section>

        <section className="panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-5"><div><p className="text-muted text-[10px] tracking-widest">NUTRITION</p><h2 className="text-lg font-semibold mt-1">今日营养</h2></div><button className="btn-quiet !p-2" onClick={() => go("nutrition")}><Plus size={15} /></button></div>
          {[
            ["热量", nutrition.calories, data.profile.calorieTarget, "kcal", "#d99a16"],
            ["蛋白质", nutrition.protein, data.profile.proteinTarget, "g", "#a4514d"],
            ["碳水", nutrition.carbs, data.profile.carbsTarget, "g", "#74898d"],
            ["脂肪", nutrition.fat, data.profile.fatTarget, "g", "#7f8750"],
          ].map(([label, value, target, unit, color]) => <div key={String(label)} className="mb-4"><div className="flex justify-between text-[11px] mb-1.5"><span>{label}</span><span className="text-muted">{value} / {target} {unit}</span></div><Progress value={Number(value)} target={Number(target)} color={String(color)} /></div>)}
          <div className="mt-6 pt-4 border-t border-border flex items-center gap-3"><Droplets size={18} className="text-sky" /><div><p>饮水目标</p><p className="text-muted text-[11px]">每日约 {data.profile.waterTarget} ml</p></div></div>
        </section>
      </div>
    </div>
  );
}

interface SetValue { weight: string; reps: string; done: boolean; }
function Training({ data, refresh, notify }: { data: FitnessState; refresh: () => Promise<void>; notify: (message: string) => void }) {
  const weekday = new Date().getDay();
  const defaultSession = [...data.plan.sessions].sort((a, b) => ((a.weekday - weekday + 7) % 7) - ((b.weekday - weekday + 7) % 7))[0];
  const [selectedId, setSelectedId] = useState(defaultSession?.id ?? "");
  const [sets, setSets] = useState<Record<string, SetValue>>({});
  const [rest, setRest] = useState(0);
  const [duration, setDuration] = useState("60");
  const [distance, setDistance] = useState("");
  const [elevation, setElevation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [routineForm, setRoutineForm] = useState(data.routine);
  const emptyPlanForm = { name: "", activityType: "daily" as ActivityType, weekday, focus: "", breakfast: "", lunch: "", dinner: "", snack: "", targetDurationMinutes: "60", targetDistanceKm: "", targetElevationM: "" };
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const session = data.plan.sessions.find((item) => item.id === selectedId) ?? defaultSession;

  useEffect(() => { if (rest <= 0) return; const id = window.setInterval(() => setRest((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(id); }, [rest]);
  useEffect(() => {
    if (!session) return;
    const lastLog = data.workoutLogs.find((log) => log.sessionId === session.id);
    const initial: Record<string, SetValue> = {};
    session.exercises.forEach((exercise) => Array.from({ length: exercise.sets }, (_, index) => {
      const previous = lastLog?.sets.find((item) => item.exerciseId === exercise.id && item.setNumber === index + 1);
      initial[`${exercise.id}-${index + 1}`] = { weight: previous ? String(previous.weightKg) : "", reps: previous ? String(previous.reps) : "", done: false };
    }));
    setSets(initial);
    setDuration(String(session.targetDurationMinutes || 60));
    setDistance(session.targetDistanceKm ? String(session.targetDistanceKm) : "");
    setElevation(session.targetElevationM ? String(session.targetElevationM) : "");
  }, [session?.id]);

  const completedCount = Object.values(sets).filter((item) => item.done).length;
  const totalSets = session?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
  const updateSet = (key: string, patch: Partial<SetValue>) => setSets((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  const completeSet = (key: string, seconds: number) => { const next = !sets[key]?.done; updateSet(key, { done: next }); if (next) setRest(seconds); };
  const closePlanForm = () => { setShowAdd(false); setEditingId(""); setPlanForm({ ...emptyPlanForm }); };
  const editPlan = (item: WorkoutSession) => {
    setEditingId(item.id); setShowAdd(true); setSelectedId(item.id);
    setPlanForm({ name: item.name, activityType: item.activityType, weekday: item.weekday, focus: item.focus, breakfast: item.breakfast || "", lunch: item.lunch || "", dinner: item.dinner || "", snack: item.snack || "", targetDurationMinutes: String(item.targetDurationMinutes || 60), targetDistanceKm: item.targetDistanceKm ? String(item.targetDistanceKm) : "", targetElevationM: item.targetElevationM ? String(item.targetElevationM) : "" });
  };
  const saveRoutine = async () => {
    try { setSavingRoutine(true); await api.routine(routineForm); await refresh(); notify("固定作息已保存"); }
    catch (error) { notify(error instanceof Error ? error.message : "作息保存失败"); }
    finally { setSavingRoutine(false); }
  };
  const addPlan = async () => {
    if (!planForm.name.trim() || !planForm.focus.trim()) return notify("请填写计划名称和计划内容");
    try {
      setSaving(true);
      const payload = {
        name: planForm.name, activityType: planForm.activityType, weekday: planForm.weekday, focus: planForm.focus,
        targetDurationMinutes: planForm.activityType === "daily" ? 0 : Number(planForm.targetDurationMinutes) || 60,
        ...(planForm.targetDistanceKm ? { targetDistanceKm: Number(planForm.targetDistanceKm) } : {}),
        ...(planForm.targetElevationM ? { targetElevationM: Number(planForm.targetElevationM) } : {}),
        breakfast: planForm.breakfast, lunch: planForm.lunch, dinner: planForm.dinner, snack: planForm.snack,
      };
      const saved = editingId ? await api.updateSession(editingId, payload) : await api.addSession(payload);
      await refresh(); setSelectedId(saved.id); closePlanForm();
      notify(editingId ? "计划已更新" : "新计划已添加；同一天还可以继续添加其他活动");
    } catch (error) { notify(error instanceof Error ? error.message : "添加失败"); } finally { setSaving(false); }
  };
  const deletePlan = async (id: string, name: string) => {
    if (!window.confirm(`确定删除“${name}”吗？已保存的运动记录会保留。`)) return;
    const nextSession = [...data.plan.sessions]
      .filter((item) => item.id !== id)
      .sort((a, b) => ((a.weekday - weekday + 7) % 7) - ((b.weekday - weekday + 7) % 7))[0];
    try {
      setDeletingId(id);
      await api.deleteSession(id);
      if (editingId === id) closePlanForm();
      if (session?.id === id) setSelectedId(nextSession?.id ?? "");
      await refresh();
      notify("计划已删除");
    } catch (error) { notify(error instanceof Error ? error.message : "删除失败"); }
    finally { setDeletingId(""); }
  };
  const finish = async () => {
    if (!session) return;
    if (session.exercises.length > 0 && completedCount === 0) return notify("至少完成一组后再保存训练");
    const completed: CompletedSet[] = [];
    session.exercises.forEach((exercise) => Array.from({ length: exercise.sets }, (_, index) => {
      const key = `${exercise.id}-${index + 1}`; const value = sets[key];
      if (value?.done) completed.push({ exerciseId: exercise.id, exerciseName: exercise.name, setNumber: index + 1, weightKg: Number(value.weight) || 0, reps: Number(value.reps) || 0 });
    }));
    try { setSaving(true); await api.addWorkout({ sessionId: session.id, date: today(), durationMinutes: Number(duration) || 60, ...(distance ? { distanceKm: Number(distance) } : {}), ...(elevation ? { elevationM: Number(elevation) } : {}), notes, sets: completed }); await refresh(); notify("运动记录已保存，今天又向前一步"); setNotes(""); setSets((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, done: false }]))); }
    catch (error) { notify(error instanceof Error ? error.message : "保存失败"); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-accent-light text-[10px] tracking-[.2em] uppercase mb-2">Daily plan</p><h1 className="text-2xl font-semibold">我的每日计划</h1><p className="text-muted mt-1">固定作息只设置一次；同一天可以添加多条活动计划。</p></div><button className="btn-primary flex items-center gap-2" onClick={() => showAdd ? closePlanForm() : setShowAdd(true)}>{showAdd ? <X size={15}/> : <Plus size={15}/>} {showAdd ? "取消" : "添加计划"}</button></header>
      <section className="panel rounded-xl p-5"><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2"><Clock3 size={16} className="text-accent-light"/><div><h2 className="font-semibold">固定作息</h2><p className="text-muted text-[10px] mt-0.5">这里设置一次，应用到所有星期和活动计划。</p></div></div><button className="btn-quiet" disabled={savingRoutine} onClick={saveRoutine}>{savingRoutine ? "保存中…" : "保存作息"}</button></div><div className="grid grid-cols-2 gap-3 max-w-lg"><label><span className="label">每天几点起床</span><input className="field" type="time" value={routineForm.wakeTime} onChange={(event) => setRoutineForm({ ...routineForm, wakeTime: event.target.value })}/></label><label><span className="label">每天几点睡觉</span><input className="field" type="time" value={routineForm.sleepTime} onChange={(event) => setRoutineForm({ ...routineForm, sleepTime: event.target.value })}/></label></div></section>
      {showAdd && <section className="panel rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><CalendarDays size={16} className="text-accent-light"/><h2 className="font-semibold">{editingId ? "编辑计划" : "新增计划"}</h2></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label><span className="label">安排类型</span><select className="field" value={planForm.activityType} onChange={(event) => setPlanForm({ ...planForm, activityType: event.target.value as ActivityType })}>{Object.entries(activityNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span className="label">计划名称</span><input className="field" placeholder="例如：周一日常 / 周末骑行" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })}/></label>
        <label><span className="label">安排在</span><select className="field" value={planForm.weekday} onChange={(event) => setPlanForm({ ...planForm, weekday: Number(event.target.value) })}>{weekdayNames.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>
        <div className="hidden lg:block"/>
        <label><span className="label">早餐吃什么</span><input className="field" placeholder="例如：鸡蛋、燕麦、牛奶" value={planForm.breakfast} onChange={(event) => setPlanForm({ ...planForm, breakfast: event.target.value })}/></label>
        <label><span className="label">中午吃什么</span><input className="field" placeholder="例如：米饭、鸡胸肉、蔬菜" value={planForm.lunch} onChange={(event) => setPlanForm({ ...planForm, lunch: event.target.value })}/></label>
        <label><span className="label">晚上吃什么</span><input className="field" placeholder="例如：面条、牛肉、青菜" value={planForm.dinner} onChange={(event) => setPlanForm({ ...planForm, dinner: event.target.value })}/></label>
        <label><span className="label">加餐是什么</span><input className="field" placeholder="例如：水果、酸奶、坚果" value={planForm.snack} onChange={(event) => setPlanForm({ ...planForm, snack: event.target.value })}/></label>
        <label className="sm:col-span-2"><span className="label">这项计划做什么</span><textarea className="field min-h-20 resize-y" placeholder="工作、学习、买菜、训练、散步……同一天可继续添加其他计划" value={planForm.focus} onChange={(event) => setPlanForm({ ...planForm, focus: event.target.value })}/></label>
        {planForm.activityType !== "daily" && <><label><span className="label">活动时长（分钟）</span><input className="field" type="number" min="1" value={planForm.targetDurationMinutes} onChange={(event) => setPlanForm({ ...planForm, targetDurationMinutes: event.target.value })}/></label><label><span className="label">目标距离 km（可选）</span><input className="field" type="number" min="0" step=".1" value={planForm.targetDistanceKm} onChange={(event) => setPlanForm({ ...planForm, targetDistanceKm: event.target.value })}/></label><label><span className="label">目标爬升 m（可选）</span><input className="field" type="number" min="0" value={planForm.targetElevationM} onChange={(event) => setPlanForm({ ...planForm, targetElevationM: event.target.value })}/></label></>}
      </div><div className="flex items-center gap-3 mt-4"><button className="btn-primary" disabled={saving} onClick={addPlan}>{saving ? "保存中…" : editingId ? "保存修改" : "添加此计划"}</button><span className="text-muted text-[10px]">保存后可在同一星期继续添加另一项活动。</span></div></section>}
      <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
        <aside className="panel rounded-xl p-3 space-y-2">
          {[...data.plan.sessions].sort((a, b) => a.weekday - b.weekday).map((item) => { const Icon = activityIcons[item.activityType]; return <div key={item.id} className={`rounded-lg border transition ${item.id === session?.id ? "bg-accent/10 border-accent/40" : "bg-transparent border-border hover:bg-white/[.025]"}`}><button onClick={() => setSelectedId(item.id)} className="w-full text-left p-3"><div className="flex justify-between items-center"><strong className="flex items-center gap-2"><Icon size={14} className="text-accent-light"/>{item.name}</strong><span className="text-muted text-[11px]">{weekdayNames[item.weekday]}</span></div><p className="text-muted text-[11px] mt-1.5 line-clamp-2">{item.focus}</p><div className="flex flex-wrap gap-2 mt-2 text-[9px] text-muted"><span>{activityNames[item.activityType]}</span>{item.activityType !== "daily" && <span>· {item.targetDurationMinutes} 分钟</span>}</div></button><div className="grid grid-cols-2 border-t border-border/70"><button className="py-2 text-[10px] text-muted hover:text-accent-light hover:bg-white/[.025] flex items-center justify-center gap-1.5" onClick={() => editPlan(item)}><Pencil size={12}/>编辑</button><button className="border-l border-border/70 py-2 text-[10px] text-muted hover:text-red-300 hover:bg-red-400/5 disabled:cursor-wait disabled:opacity-50 flex items-center justify-center gap-1.5" disabled={Boolean(deletingId)} onClick={() => deletePlan(item.id, item.name)}><Trash2 size={12}/>{deletingId === item.id ? "删除中…" : "删除"}</button></div></div>; })}
          {data.plan.sessions.length === 0 && <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center"><CalendarDays size={20} className="mx-auto mb-2 text-muted"/><p className="font-medium">还没有每日计划</p><p className="text-muted text-[10px] mt-1">点击右上角添加第一项计划</p></div>}
          <div className="pt-3 border-t border-border text-muted text-[11px] flex items-center gap-2"><History size={13} />累计完成 {data.workoutLogs.length} 次训练</div>
        </aside>

        {session ? <section className="panel rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3"><div><p className="text-muted text-[10px] tracking-widest">{weekdayNames[session.weekday]} · DAILY PLAN</p><h2 className="text-lg font-semibold mt-1">{session.name}</h2></div><div className="text-right"><p className="text-accent-light font-semibold">{session.exercises.length > 0 ? `${completedCount} / ${totalSets} 组` : activityNames[session.activityType]}</p><p className="text-muted text-[10px]">{session.activityType === "daily" ? `${data.routine.wakeTime} 起 · ${data.routine.sleepTime} 睡` : session.exercises.length > 0 ? "已完成" : `${session.targetDurationMinutes || 0} 分钟目标`}</p></div></div>
          {rest > 0 && <div className="mx-5 mt-4 p-3 rounded-lg border border-accent/35 bg-accent/10 flex items-center justify-between"><div className="flex items-center gap-2"><Timer size={17} className="text-accent-light"/><span>组间休息</span></div><button className="text-xl font-semibold text-accent-light" onClick={() => setRest(0)}>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}</button></div>}
          <div className="p-5 space-y-5">
            {(session.activityType === "daily" || session.breakfast || session.lunch || session.dinner || session.snack) && <RoutineSummary session={session} routine={data.routine}/>}
            {session.activityType !== "daily" && session.exercises.length === 0 && (() => { const Icon = activityIcons[session.activityType]; return <div className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent/10 to-transparent p-6"><Icon size={30} className="text-accent-light mb-4"/><h3 className="text-xl font-semibold">{session.focus}</h3><div className="flex flex-wrap gap-2 mt-4 text-[11px] text-muted"><span className="border border-border rounded-full px-3 py-1">目标 {session.targetDurationMinutes} 分钟</span>{session.targetDistanceKm && <span className="border border-border rounded-full px-3 py-1">距离 {session.targetDistanceKm} km</span>}{session.targetElevationM && <span className="border border-border rounded-full px-3 py-1">爬升 {session.targetElevationM} m</span>}</div></div>; })()}
            {session?.exercises.map((exercise, exerciseIndex) => <div key={exercise.id}>
              <div className="flex items-center gap-3 mb-2"><span className="w-7 h-7 rounded bg-panel grid place-items-center text-muted text-[11px]">{exerciseIndex + 1}</span><div className="flex-1"><h3 className="font-semibold">{exercise.name}</h3><p className="text-muted text-[10px]">{exercise.muscle} · 目标 {exercise.reps} · 休息 {exercise.restSeconds}秒</p></div></div>
              <div className="ml-10 space-y-1.5">{Array.from({ length: exercise.sets }, (_, index) => { const key = `${exercise.id}-${index + 1}`; const value = sets[key] ?? { weight: "", reps: "", done: false }; return <div key={key} className={`grid grid-cols-[38px_1fr_1fr_72px] gap-2 items-center rounded-lg p-2 border ${value.done ? "border-mint/50 bg-mint/10" : "border-border/70 bg-black/10"}`}><span className="text-muted text-center">{index + 1}</span><label className="relative"><input className="field !py-2 pr-8" type="number" min="0" placeholder="重量" value={value.weight} onChange={(event) => updateSet(key, { weight: event.target.value })}/><span className="absolute right-2 top-2.5 text-muted text-[10px]">kg</span></label><label className="relative"><input className="field !py-2 pr-8" type="number" min="0" placeholder="次数" value={value.reps} onChange={(event) => updateSet(key, { reps: event.target.value })}/><span className="absolute right-2 top-2.5 text-muted text-[10px]">次</span></label><button className={value.done ? "btn-primary !p-2" : "btn-quiet !p-2"} onClick={() => completeSet(key, exercise.restSeconds)}>{value.done ? <Check size={15} className="mx-auto"/> : "完成"}</button></div>; })}</div>
            </div>)}
            {session.activityType !== "daily" && <div className="grid sm:grid-cols-2 lg:grid-cols-[120px_120px_120px_1fr_auto] gap-3 pt-4 border-t border-border items-end"><label><span className="label">时长（分钟）</span><input className="field" type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label><label><span className="label">距离 km</span><input className="field" type="number" min="0" step=".1" placeholder="可选" value={distance} onChange={(event) => setDistance(event.target.value)} /></label><label><span className="label">爬升 m</span><input className="field" type="number" min="0" placeholder="可选" value={elevation} onChange={(event) => setElevation(event.target.value)} /></label><label><span className="label">运动感受</span><input className="field" placeholder="路线、强度、身体状态……" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button className="btn-primary h-[38px]" disabled={saving} onClick={finish}>{saving ? "保存中…" : "结束并保存"}</button></div>}
          </div>
        </section> : <section className="panel rounded-xl min-h-72 grid place-items-center p-8 text-center"><div><CalendarDays size={28} className="mx-auto text-muted mb-3"/><h2 className="text-lg font-semibold">先添加一项每日计划</h2><p className="text-muted mt-1">设置作息、饮食和今天要做的事情，就能开始安排生活。</p><button className="btn-primary mt-5 inline-flex items-center gap-2" onClick={() => setShowAdd(true)}><Plus size={15}/>添加计划</button></div></section>}
      </div>
    </div>
  );
}

function Nutrition({ data, refresh, notify }: { data: FitnessState; refresh: () => Promise<void>; notify: (message: string) => void }) {
  const blank = { date: today(), mealType: "breakfast" as MealEntry["mealType"], name: "", amount: "1份", calories: "", protein: "", carbs: "", fat: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [foodQuery, setFoodQuery] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [calculation, setCalculation] = useState<FoodCalculation | null>(null);
  const meals = data.meals.filter((meal) => meal.date === today());
  const totals = meals.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const nutrientCards: { label: string; value: number; target: number; unit: string; icon: LucideIcon; color: string }[] = [
    { label: "热量", value: totals.calories, target: data.profile.calorieTarget, unit: "kcal", icon: Flame, color: "#d99a16" },
    { label: "蛋白质", value: totals.protein, target: data.profile.proteinTarget, unit: "g", icon: Beef, color: "#a4514d" },
    { label: "碳水", value: totals.carbs, target: data.profile.carbsTarget, unit: "g", icon: Activity, color: "#74898d" },
    { label: "脂肪", value: totals.fat, target: data.profile.fatTarget, unit: "g", icon: CircleGauge, color: "#7f8750" },
  ];
  const calculate = async () => {
    if (!foodQuery.trim()) return notify("输入食物和分量，例如：鸡胸肉 200克");
    try {
      setCalculating(true);
      const result = await api.calculateFood(foodQuery);
      setForm((current) => ({ ...current, name: result.name, amount: result.amount, calories: String(result.calories), protein: String(result.protein), carbs: String(result.carbs), fat: String(result.fat) }));
      setCalculation(result);
      notify(result.unmatched.length > 0 ? `已计算 ${result.items.length} 项，另有 ${result.unmatched.length} 项未识别` : result.items.some((item) => item.note) ? "已根据营养标签换算热量" : `已分项计算 ${result.items.length} 项食物`);
    } catch (error) { notify(error instanceof Error ? error.message : "计算失败"); } finally { setCalculating(false); }
  };
  const add = async () => {
    if (!form.name.trim()) return notify("先填写食物名称");
    try { setSaving(true); await api.addMeal({ ...form, calories: Number(form.calories) || 0, protein: Number(form.protein) || 0, carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0 }); setForm(blank); await refresh(); notify("饮食记录已添加"); }
    catch (error) { notify(error instanceof Error ? error.message : "保存失败"); } finally { setSaving(false); }
  };
  const remove = async (id: string) => { try { await api.deleteMeal(id); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "删除失败"); } };

  return (
    <div className="space-y-5">
      <header><p className="text-accent-light text-[10px] tracking-[.2em] uppercase mb-2">Nutrition</p><h1 className="text-2xl font-semibold">今天吃得怎么样？</h1><p className="text-muted mt-1">先盯住总热量和蛋白质，记录不必追求绝对精确。</p></header>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{nutrientCards.map(({ label, value, target, unit, icon: Icon, color }) => <div className="panel rounded-xl p-4" key={label}><div className="flex justify-between mb-3"><span className="text-muted text-[11px]">{label}</span><Icon size={15} style={{ color }}/></div><p className="text-xl font-semibold">{value}<small className="text-muted text-[11px] font-normal ml-1">/ {target} {unit}</small></p><div className="mt-3"><Progress value={value} target={target} color={color}/></div></div>)}</div>

      <div className="grid xl:grid-cols-[.8fr_1.2fr] gap-4 items-start">
        <section className="panel rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><Plus size={16} className="text-accent-light"/><h2 className="font-semibold">添加一餐</h2></div><div className="rounded-lg border border-accent/30 bg-accent/10 p-3 mb-4"><label><span className="label !text-accent-light flex items-center gap-1"><Sparkles size={12}/>自动计算热量</span><div className="flex gap-2"><input className="field" placeholder="鸡胸肉 200克 / 米饭 1碗 / 鸡蛋 2个" value={foodQuery} onChange={(event) => { setFoodQuery(event.target.value); setCalculation(null); }} onKeyDown={(event) => { if (event.key === "Enter") calculate(); }}/><button className="btn-primary shrink-0" disabled={calculating} onClick={calculate}>{calculating ? "计算中…" : "自动计算"}</button></div></label>{calculation && <div className="mt-3 border-t border-accent/20 pt-2 space-y-1.5"><div className="flex justify-between text-[10px] text-accent-light"><span>分项估算</span><strong>合计 {calculation.calories} kcal</strong></div>{calculation.items.map((item, index) => <div key={`${item.name}-${index}`}><div className="flex justify-between text-[10px]"><span>{item.name} · {item.amount}</span><span className="text-muted">{item.calories} kcal</span></div>{item.note && <p className="text-[9px] text-amber-300/80 mt-0.5">{item.note}</p>}</div>)}{calculation.unmatched.map((item) => <div key={item} className="text-[10px] text-red-300">未识别：{item}</div>)}</div>}<p className="text-[9px] text-muted mt-2">支持“每100克/每百毫升 674kJ，吃了300毫升”等营养标签输入；多种食物请用“/”分隔。</p></div><div className="grid grid-cols-2 gap-3">
          <label><span className="label">餐次</span><select className="field" value={form.mealType} onChange={(event) => setForm({ ...form, mealType: event.target.value as MealEntry["mealType"] })}>{Object.entries(mealNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label><span className="label">分量</span><input className="field" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></label>
          <label className="col-span-2"><span className="label">食物或餐食</span><input className="field" placeholder="自动带出，也可以手动填写" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
          {(["calories", "protein", "carbs", "fat"] as const).map((key) => <label key={key}><span className="label">{{ calories: "热量 kcal", protein: "蛋白质 g", carbs: "碳水 g", fat: "脂肪 g" }[key]}</span><input className="field" type="number" min="0" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}/></label>)}
        </div><button className="btn-primary w-full mt-4" disabled={saving} onClick={add}>{saving ? "保存中…" : "添加到今天"}</button></section>

        <section className="panel rounded-xl overflow-hidden"><div className="px-5 py-4 border-b border-border flex justify-between"><h2 className="font-semibold">今日饮食</h2><span className="text-muted text-[11px]">{meals.length} 条记录</span></div>{meals.length === 0 ? <div className="py-16 text-center text-muted"><Apple size={28} className="mx-auto mb-3 opacity-40"/><p>还没有饮食记录</p></div> : <div className="divide-y divide-border">{meals.map((meal) => <div key={meal.id} className="px-5 py-3 flex items-center gap-3"><span className="w-10 text-muted text-[11px]">{mealNames[meal.mealType]}</span><div className="flex-1"><p>{meal.name} <span className="text-muted text-[11px]">· {meal.amount}</span></p><p className="text-muted text-[10px] mt-1">蛋白 {meal.protein}g · 碳水 {meal.carbs}g · 脂肪 {meal.fat}g</p></div><strong className="text-accent-light">{meal.calories}<small className="text-muted text-[9px] ml-1">kcal</small></strong><button className="text-muted hover:text-red-400 p-2" onClick={() => remove(meal.id)}><Trash2 size={14}/></button></div>)}</div>}</section>
      </div>
    </div>
  );
}

function BodyData({ data, refresh, notify }: { data: FitnessState; refresh: () => Promise<void>; notify: (message: string) => void }) {
  const [profile, setProfile] = useState(data.profile);
  const [weight, setWeight] = useState(String(data.weights[0]?.weightKg ?? data.profile.weightKg));
  const [bodyFat, setBodyFat] = useState(data.weights[0]?.bodyFat ? String(data.weights[0].bodyFat) : "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setProfile(data.profile), [data.profile]);
  const field = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const saveProfile = async () => { try { setSaving(true); await api.profile({ name: profile.name, sex: profile.sex, age: Number(profile.age), heightCm: Number(profile.heightCm), weightKg: Number(profile.weightKg), activityLevel: Number(profile.activityLevel), goal: profile.goal }); await refresh(); notify("目标已重算并保存"); } catch (error) { notify(error instanceof Error ? error.message : "保存失败"); } finally { setSaving(false); } };
  const saveWeight = async () => { try { await api.addWeight({ date: today(), weightKg: Number(weight), ...(bodyFat ? { bodyFat: Number(bodyFat) } : {}) }); await refresh(); notify("今日身体数据已记录"); } catch (error) { notify(error instanceof Error ? error.message : "保存失败"); } };
  const weights = data.weights.slice(0, 8).reverse();
  const min = Math.min(...weights.map((item) => item.weightKg), data.profile.weightKg) - 1;
  const max = Math.max(...weights.map((item) => item.weightKg), data.profile.weightKg) + 1;

  return (
    <div className="space-y-5">
      <header><p className="text-accent-light text-[10px] tracking-[.2em] uppercase mb-2">Body & target</p><h1 className="text-2xl font-semibold">身体数据与目标</h1><p className="text-muted mt-1">热量目标使用 Mifflin-St Jeor 公式估算，可随体重变化重新计算。</p></header>
      <div className="grid xl:grid-cols-[1fr_.9fr] gap-4 items-start">
        <section className="panel rounded-xl p-5"><div className="flex items-center gap-2 mb-5"><Target size={17} className="text-accent-light"/><h2 className="font-semibold">基础资料</h2></div><div className="grid sm:grid-cols-2 gap-3">
          <label><span className="label">称呼</span><input className="field" value={profile.name} onChange={(event) => field("name", event.target.value)}/></label>
          <label><span className="label">目标</span><select className="field" value={profile.goal} onChange={(event) => field("goal", event.target.value as Profile["goal"])}><option value="gain">增肌</option><option value="lose">减脂</option><option value="maintain">保持</option></select></label>
          <label><span className="label">性别</span><select className="field" value={profile.sex} onChange={(event) => field("sex", event.target.value as Profile["sex"])}><option value="male">男</option><option value="female">女</option></select></label>
          <label><span className="label">年龄</span><input className="field" type="number" value={profile.age} onChange={(event) => field("age", Number(event.target.value))}/></label>
          <label><span className="label">身高 cm</span><input className="field" type="number" value={profile.heightCm} onChange={(event) => field("heightCm", Number(event.target.value))}/></label>
          <label><span className="label">当前体重 kg</span><input className="field" type="number" step=".1" value={profile.weightKg} onChange={(event) => field("weightKg", Number(event.target.value))}/></label>
          <label className="sm:col-span-2"><span className="label">日常活动量</span><select className="field" value={profile.activityLevel} onChange={(event) => field("activityLevel", Number(event.target.value))}><option value="1.2">久坐，基本不运动</option><option value="1.375">轻量活动，每周 1–3 次</option><option value="1.55">中等活动，每周 3–5 次</option><option value="1.725">高活动，每周 6–7 次</option></select></label>
        </div><button className="btn-primary mt-4" disabled={saving} onClick={saveProfile}>{saving ? "计算中…" : "保存并重算目标"}</button></section>

        <div className="space-y-4">
          <section className="panel rounded-xl p-5"><h2 className="font-semibold mb-4">当前每日目标</h2><div className="grid grid-cols-2 gap-3">{[["热量", `${data.profile.calorieTarget} kcal`], ["蛋白质", `${data.profile.proteinTarget} g`], ["碳水", `${data.profile.carbsTarget} g`], ["脂肪", `${data.profile.fatTarget} g`]].map(([label, value]) => <div key={label} className="bg-black/15 border border-border rounded-lg p-3"><p className="text-muted text-[10px]">{label}</p><p className="text-lg font-semibold mt-1">{value}</p></div>)}</div></section>
          <section className="panel rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><TrendingUp size={16} className="text-sky"/><h2 className="font-semibold">今日测量</h2></div><div className="grid grid-cols-2 gap-3"><label><span className="label">体重 kg</span><input className="field" type="number" step=".1" value={weight} onChange={(event) => setWeight(event.target.value)}/></label><label><span className="label">体脂 %（可选）</span><input className="field" type="number" step=".1" value={bodyFat} onChange={(event) => setBodyFat(event.target.value)}/></label></div><button className="btn-quiet w-full mt-3" onClick={saveWeight}>记录今日数据</button></section>
        </div>
      </div>
      <section className="panel rounded-xl p-5"><div className="flex justify-between items-center mb-5"><h2 className="font-semibold">体重趋势</h2><span className="text-muted text-[11px]">最近 {weights.length} 次记录</span></div>{weights.length === 0 ? <p className="text-muted text-center py-8">记录体重后，这里会出现趋势</p> : <div className="h-40 flex items-end gap-3 border-b border-border px-2">{weights.map((item) => { const height = 28 + ((item.weightKg - min) / Math.max(1, max - min)) * 82; return <div key={item.id} className="flex-1 h-full flex flex-col justify-end items-center gap-2"><span className="text-[10px] text-text">{item.weightKg}</span><div className="w-full max-w-12 rounded-t bg-gradient-to-t from-sky/45 to-sky" style={{ height }}/><span className="text-[9px] text-muted pb-2">{item.date.slice(5)}</span></div>; })}</div>}</section>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<FitnessState | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const refresh = async () => { const next = await api.state(); setData(next); setError(""); };
  useEffect(() => { refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "无法连接健身服务")); }, []);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(id); }, [toast]);
  const pageTitle = useMemo(() => nav.find((item) => item.id === tab)?.label, [tab]);

  if (error) return <div className="min-h-screen grid place-items-center p-8"><div className="panel rounded-xl p-8 text-center max-w-sm"><HeartPulse className="mx-auto text-accent mb-4"/><h1 className="text-lg font-semibold">健身服务没有响应</h1><p className="text-muted mt-2 mb-5">{error}</p><button className="btn-primary" onClick={() => refresh().catch(() => undefined)}>重新连接</button></div></div>;
  if (!data) return <div className="min-h-screen grid place-items-center text-muted"><LoaderCircle className="animate-spin text-accent mb-3"/><span>正在准备训练计划…</span></div>;

  return (
    <div className="app-shell min-h-screen grid grid-cols-[190px_1fr] relative">
      <aside className="side-nav h-screen sticky top-0 border-r border-border bg-surface/95 p-3 flex flex-col gap-1">
        <div className="side-brand px-2 py-4 mb-3"><div className="w-9 h-9 rounded-lg bg-accent grid place-items-center mb-3 shadow-[0_8px_25px_rgb(217_154_22_/_0.2)]"><Dumbbell size={18} className="text-[#17130a]"/></div><h1 className="font-semibold text-base">肌肉大</h1><p className="text-muted text-[9px] tracking-[.18em] uppercase mt-1">Train · Eat · Recover</p></div>
        {nav.map((item) => <button key={item.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition shrink-0 ${tab === item.id ? "bg-accent/10 border-accent/30 text-accent-light shadow-[inset_2px_0_0_#d99a16]" : "border-transparent text-muted hover:text-text hover:bg-white/[.025]"}`} onClick={() => setTab(item.id)}><item.icon size={15}/>{item.label}</button>)}
        <div className="mt-auto side-brand panel rounded-lg p-3"><p className="text-[10px] text-muted">当前目标</p><div className="flex items-center justify-between mt-1"><strong>{goalNames[data.profile.goal]}</strong><span className="text-accent-light">{data.profile.calorieTarget} kcal</span></div></div>
      </aside>
      <main className="min-w-0 max-h-screen overflow-y-auto"><div className="max-w-7xl mx-auto p-5 lg:p-7"><div className="text-[10px] text-muted tracking-widest mb-5">肌肉大 / {pageTitle}</div>{tab === "dashboard" && <Dashboard data={data} go={setTab}/>} {tab === "training" && <Training data={data} refresh={refresh} notify={setToast}/>} {tab === "nutrition" && <Nutrition data={data} refresh={refresh} notify={setToast}/>} {tab === "body" && <BodyData data={data} refresh={refresh} notify={setToast}/>}</div></main>
      {toast && <div className="fixed right-5 bottom-5 z-50 panel rounded-lg px-4 py-3 flex items-center gap-2 shadow-2xl"><Check size={15} className="text-mint"/><span>{toast}</span></div>}
    </div>
  );
}
