import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, Apple, Beef, Bike, CalendarDays, Check, CircleGauge, Clock3, Coffee, Droplets, Dumbbell,
  ChevronDown, Flame, Footprints, HeartPulse, History, LayoutDashboard, ListTodo, LoaderCircle, Moon, Mountain, Pencil, Plus, Scale, Sparkles, Sunrise, Target, Timer, Trash2, TrendingUp, Utensils, X,
} from "lucide-react";
import { api } from "./api";
import type { ActivityType, CompletedSet, Exercise, ExerciseTrackingType, FitnessState, FoodCalculation, MealEntry, NutritionEstimate, PlannedActivity, PlannedMealType, PlanPreferences, Profile, Tab, WeightEntry, WorkoutSession } from "./types";

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const currentMonday = () => {
  const value = new Date();
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};
const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const dateWeekday = (value: string) => new Date(`${value}T12:00:00`).getDay();
const planForDate = (sessions: WorkoutSession[], value: string) => {
  const weekday = dateWeekday(value);
  return sessions.find((session) => session.scheduledDate === value)
    ?? sessions.find((session) => !session.scheduledDate && session.weekday === weekday);
};
const planScheduleLabel = (session: WorkoutSession) => session.scheduledDate
  ? `${session.scheduledDate} · ${weekdayNames[session.weekday]}`
  : `每${weekdayNames[session.weekday]}`;
const goalNames = { gain: "增肌", lose: "减脂", maintain: "保持" } as const;
const mealNames = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" } as const;
const activityNames: Record<ActivityType, string> = { daily: "日常安排", strength: "力量训练", cycling: "骑行", running: "跑步", hiking: "爬山", other: "其他活动" };
const activityIcons: Record<ActivityType, LucideIcon> = { daily: CalendarDays, strength: Dumbbell, cycling: Bike, running: Footprints, hiking: Mountain, other: Activity };
const sleepDuration = (wakeTime: string, sleepTime: string) => {
  const [wakeHour, wakeMinute] = wakeTime.split(":").map(Number);
  const [sleepHour, sleepMinute] = sleepTime.split(":").map(Number);
  const wake = wakeHour * 60 + wakeMinute;
  const sleep = sleepHour * 60 + sleepMinute;
  const minutes = (wake - sleep + 1440) % 1440 || 1440;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return { minutes, label: `${hours} 小时${remainder ? ` ${remainder} 分钟` : ""}` };
};

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

const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function TimePicker({ label, value, onChange, icon: Icon }: { label: string; value: string; onChange: (value: string) => void; icon: LucideIcon }) {
  const [hour = "00", minute = "00"] = value.split(":");
  const segmentClass = "appearance-none w-full rounded-lg border border-border bg-bg/55 px-3 py-3 pr-8 text-center text-base font-semibold text-text transition hover:border-accent/50 focus:border-accent";
  return <div className="rounded-xl border border-border/80 bg-black/10 p-3.5">
    <div className="flex items-center gap-2 text-muted text-[11px] mb-2.5"><Icon size={14} className="text-accent-light"/><span>{label}</span></div>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <label className="relative"><span className="sr-only">小时</span><select className={segmentClass} value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)}>{hourOptions.map((option) => <option key={option} value={option}>{option} 时</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"/></label>
      <span className="text-accent-light text-lg font-bold">:</span>
      <label className="relative"><span className="sr-only">分钟</span><select className={segmentClass} value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>{minuteOptions.map((option) => <option key={option} value={option}>{option} 分</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"/></label>
    </div>
  </div>;
}

function CompactTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [hour = "09", minute = "00"] = value.split(":");
  const selectClass = "appearance-none w-full rounded-lg border border-border bg-bg/55 px-2 py-2.5 pr-6 text-center text-[11px] font-semibold hover:border-accent/50 focus:border-accent";
  return <div><span className="label">开始时间</span><div className="grid grid-cols-[1fr_auto_1fr] gap-1 items-center"><label className="relative"><span className="sr-only">活动小时</span><select className={selectClass} value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)}>{hourOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted"/></label><span className="text-accent-light">:</span><label className="relative"><span className="sr-only">活动分钟</span><select className={selectClass} value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>{minuteOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted"/></label></div></div>;
}

function MealEstimate({ estimate, calculating }: { estimate?: NutritionEstimate; calculating?: boolean }) {
  if (calculating) return <div className="mt-1.5 text-[9px] text-muted animate-pulse">正在估算营养…</div>;
  if (!estimate) return <div className="mt-1.5 text-[9px] text-muted">填写食物和分量后自动估算</div>;
  return <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[9px]"><strong className="text-accent-light">约 {estimate.calories} kcal</strong><span className="text-muted">蛋白 {estimate.protein}g</span><span className="text-muted">碳水 {estimate.carbs}g</span><span className="text-muted">脂肪 {estimate.fat}g</span></div>;
}

function PlanMealField({ label, placeholder, value, estimate, calculating, onChange }: { label: string; placeholder: string; value: string; estimate?: NutritionEstimate; calculating?: boolean; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><input className="field" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)}/><MealEstimate estimate={estimate} calculating={calculating}/></label>;
}

function RoutineSummary({ session, routine, compact = false }: { session: WorkoutSession; routine: FitnessState["routine"]; compact?: boolean }) {
  const meals = [
    { key: "breakfast" as const, label: "早餐", value: session.breakfast, icon: Coffee },
    { key: "lunch" as const, label: "午餐", value: session.lunch, icon: Utensils },
    { key: "dinner" as const, label: "晚餐", value: session.dinner, icon: Utensils },
    { key: "snack" as const, label: "加餐", value: session.snack, icon: Apple },
  ];
  return <div className={compact ? "space-y-3" : "space-y-4"}>
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border/70 bg-black/10 p-3 flex items-center gap-3"><Clock3 size={16} className="text-accent-light"/><div><p className="text-muted text-[10px]">固定起床</p><strong>{routine.wakeTime}</strong></div></div>
      <div className="rounded-lg border border-border/70 bg-black/10 p-3 flex items-center gap-3"><Moon size={16} className="text-sky"/><div><p className="text-muted text-[10px]">固定睡觉</p><strong>{routine.sleepTime}</strong></div></div>
    </div>
    <div className={`grid ${compact ? "grid-cols-2" : "sm:grid-cols-2"} gap-2`}>{meals.map(({ key, label, value, icon: Icon }) => <div key={label} className="rounded-lg border border-border/70 bg-black/10 p-3"><div className="flex items-center gap-2 text-muted text-[10px] mb-1"><Icon size={13}/>{label}</div><p>{value || "未安排"}</p>{value && <MealEstimate estimate={session.mealNutrition?.[key]}/>}</div>)}</div>
    {session.activities && session.activities.length > 0 && <div className="rounded-lg border border-border/70 bg-black/10 p-3"><div className="flex items-center gap-2 text-accent-light text-[10px] mb-2"><ListTodo size={13}/>活动安排 · {session.activities.length} 项</div><div className="space-y-1.5">{[...session.activities].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((activity) => { const Icon = activityIcons[activity.activityType]; return <div key={activity.id} className="grid grid-cols-[42px_18px_1fr_auto] gap-2 items-center text-[10px] border-t border-border/50 pt-1.5 first:border-0 first:pt-0"><strong className="text-accent-light">{activity.startTime}</strong><Icon size={13} className="text-muted"/><div><span>{activity.name}</span>{activity.notes && <span className="text-muted"> · {activity.notes}</span>}</div>{activity.durationMinutes && <span className="text-muted">{activity.durationMinutes} 分钟</span>}</div>; })}</div></div>}
    {session.focus && <div className="rounded-lg border border-accent/25 bg-accent/10 p-3"><div className="flex items-center gap-2 text-accent-light text-[10px] mb-1"><ListTodo size={13}/>当天备注</div><p>{session.focus}</p></div>}
    {session.adaptationNote && <div className="rounded-lg border border-sky/25 bg-sky/10 p-3"><div className="flex items-center gap-2 text-sky text-[10px] mb-1"><TrendingUp size={13}/>体重趋势调整</div><p>{session.adaptationNote}</p></div>}
  </div>;
}

function Dashboard({ data, go }: { data: FitnessState; go: (tab: Tab) => void }) {
  const date = today();
  const meals = data.meals.filter((meal) => meal.date === date);
  const nutrition = meals.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const todaySession = planForDate(data.plan.sessions, date);
  const thisWeek = data.workoutLogs.filter((log) => Date.now() - new Date(`${log.date}T12:00:00`).getTime() < 7 * 86400000);
  const lastWeight = data.weights[0]?.weightKg ?? data.profile.weightKg;
  const caloriePercent = Math.round(nutrition.calories / data.profile.calorieTarget * 100) || 0;
  const TodayIcon = todaySession ? activityIcons[todaySession.activityType] : CalendarDays;

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
          <div className="px-5 py-4 border-b border-border flex items-center justify-between"><div><p className="text-muted text-[10px] tracking-widest">TODAY'S PLAN</p><h2 className="text-lg font-semibold mt-1 flex items-center gap-2"><TodayIcon size={17} className="text-accent-light"/>{todaySession?.name ?? "今天暂无计划"}</h2></div><span className="text-accent-light text-sm">{todaySession && planScheduleLabel(todaySession)}</span></div>
          <div className="p-5">
            {todaySession ? <>{todaySession.activityType === "daily" || todaySession.breakfast || todaySession.lunch || todaySession.dinner || todaySession.snack ? <RoutineSummary session={todaySession} routine={data.routine} compact/> : <><p className="text-muted mb-4">{todaySession.focus} · 目标 {todaySession.targetDurationMinutes} 分钟{todaySession.targetDistanceKm ? ` · ${todaySession.targetDistanceKm} km` : ""}</p>{todaySession.exercises.length > 0 && <div className="space-y-2 mb-5">{todaySession.exercises.slice(0, 4).map((exercise, index) => <div key={exercise.id} className="flex items-center gap-3 py-2 border-b border-border/60"><span className="w-6 h-6 rounded bg-panel text-muted grid place-items-center text-[10px]">{index + 1}</span><span className="flex-1">{exercise.name}</span><span className="text-muted">{exercise.sets} × {exercise.reps}</span></div>)}</div>}</>}<button className="btn-primary flex items-center gap-2 mt-4" onClick={() => go("training")}><CalendarDays size={15}/>查看今日计划</button></> : <><p className="text-muted mb-4">今天还没有绑定计划，可以添加本星期的固定计划或指定今天的日期。</p><button className="btn-primary flex items-center gap-2" onClick={() => go("training")}><Plus size={15}/>安排今天</button></>}
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

interface SetValue { weight: string; reps: string; duration: string; done: boolean; }

const defaultPlanPreferences: PlanPreferences = {
  returnMode: "gentle", trainingLevel: "beginner", equipment: "gym", workSchedule: "big_small", bigWeekStartDate: currentMonday(), workStart: "09:00", workEnd: "18:00", latestWorkEnd: "21:00", overtimeFrequency: "sometimes", commuteMinutes: 30,
  workoutDurationMinutes: 60, preferredTrainingTime: "adaptive", availableWeekdays: [1, 3, 5], healthNotes: "无",
  breakfast: "", lunches: Array.from({ length: 7 }, () => ""), dinner: "", snack: "",
};

function WeekPlanGenerator({ data, refresh, notify, close }: { data: FitnessState; refresh: () => Promise<void>; notify: (message: string) => void; close: () => void }) {
  const [form, setForm] = useState<PlanPreferences>(() => { const saved = data.planPreferences; const legacy = Boolean(saved && !("workSchedule" in saved)); return { ...defaultPlanPreferences, ...saved, ...(legacy ? { preferredTrainingTime: "adaptive" as const } : {}), lunches: saved?.lunches || [...defaultPlanPreferences.lunches] }; });
  const [generating, setGenerating] = useState(false);
  const toggleDay = (weekday: number) => setForm((current) => ({ ...current, availableWeekdays: current.availableWeekdays.includes(weekday) ? current.availableWeekdays.filter((day) => day !== weekday) : [...current.availableWeekdays, weekday] }));
  const updateLunch = (weekday: number, value: string) => setForm((current) => ({ ...current, lunches: current.lunches.map((lunch, index) => index === weekday ? value : lunch) }));
  const generate = async () => {
    if (!form.healthNotes.trim()) return notify("请填写伤病或身体限制，没有请填“无”");
    if (form.availableWeekdays.length === 0) return notify("请至少选择一个可训练日");
    const caution = form.healthNotes.trim() === "无" ? "" : `\n你填写了身体限制：“${form.healthNotes}”。生成内容不能替代医生或康复师建议。`;
    if (form.workSchedule === "big_small" && dateWeekday(form.bigWeekStartDate) !== 1) return notify("请选择一个确定属于大周的周一");
    if (!window.confirm(`生成后会替换现有的重复计划和上次生成的日期计划，手动绑定的具体日期计划会保留。${caution}\n\n确定继续吗？`)) return;
    try {
      setGenerating(true);
      await api.generateWeek({ ...form, healthNotes: form.healthNotes.trim() });
      await refresh();
      notify(form.workSchedule === "big_small" ? "已从今天起生成连续两周计划" : "已从今天起生成一周计划");
      close();
    } catch (error) { notify(error instanceof Error ? error.message : "生成失败"); }
    finally { setGenerating(false); }
  };

  return <section className="panel rounded-xl p-5 border-accent/30"><div className="flex flex-wrap items-start justify-between gap-3 mb-5"><div><div className="flex items-center gap-2"><Sparkles size={17} className="text-accent-light"/><h2 className="font-semibold">生成个性化恢复计划</h2></div><p className="text-muted text-[10px] mt-1">身体数据自动读取；很久没运动时先恢复规律，再逐步增加训练和饮食要求。</p></div><button className="btn-quiet !p-2" onClick={close}><X size={15}/></button></div>
    <div className="rounded-xl border border-accent/25 bg-accent/10 p-4 mb-4"><p className="text-[10px] text-accent-light mb-2">已读取身体资料</p><div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]"><strong>{data.profile.sex === "male" ? "男" : "女"} · {data.profile.age} 岁</strong><span>{data.profile.heightCm} cm / {data.profile.weightKg} kg</span><span>目标：{goalNames[data.profile.goal]}</span><span>每日约 {data.profile.calorieTarget} kcal / 蛋白质 {data.profile.proteinTarget}g</span></div><p className="text-muted text-[9px] mt-2">资料不准确时，请先到“身体数据”保存后再生成。</p></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <label><span className="label">近期运动状态</span><select className="field" value={form.returnMode} onChange={(event) => setForm({ ...form, returnMode: event.target.value as PlanPreferences["returnMode"] })}><option value="gentle">很久没运动 · 循序恢复</option><option value="standard">近期有规律运动 · 标准计划</option></select></label>
      <label><span className="label">训练经验</span><select className="field" value={form.trainingLevel} onChange={(event) => setForm({ ...form, trainingLevel: event.target.value as PlanPreferences["trainingLevel"] })}><option value="beginner">新手（每周3练）</option><option value="intermediate">有基础（每周4练）</option><option value="advanced">进阶（每周5练）</option></select></label>
      <label><span className="label">训练条件</span><select className="field" value={form.equipment} onChange={(event) => setForm({ ...form, equipment: event.target.value as PlanPreferences["equipment"] })}><option value="gym">健身房</option><option value="home">居家，有简单器械</option><option value="none">无器械</option></select></label>
      <label><span className="label">每次训练分钟</span><input className="field" type="number" min="20" max="120" value={form.workoutDurationMinutes} onChange={(event) => setForm({ ...form, workoutDurationMinutes: Number(event.target.value) })}/></label>
      <label><span className="label">训练时段</span><select className="field" value={form.preferredTrainingTime} onChange={(event) => setForm({ ...form, preferredTrainingTime: event.target.value as PlanPreferences["preferredTrainingTime"] })}><option value="adaptive">自动避开加班（推荐）</option><option value="rest_day">只在休息日</option><option value="before_work">固定上班前</option><option value="after_work">下班后（按最晚时间）</option></select></label>
      <label><span className="label">工作周期</span><select className="field" value={form.workSchedule} onChange={(event) => setForm({ ...form, workSchedule: event.target.value as PlanPreferences["workSchedule"] })}><option value="big_small">大小周</option><option value="five_day">固定双休</option></select></label>
      {form.workSchedule === "big_small" && <label><span className="label">任意一个大周的周一</span><input className="field" type="date" value={form.bigWeekStartDate} onChange={(event) => setForm({ ...form, bigWeekStartDate: event.target.value })}/><span className="block text-muted text-[9px] mt-1">仅用于判断大小周；计划始终从今天开始。</span></label>}
      <label><span className="label">上班时间</span><input className="field" type="time" value={form.workStart} onChange={(event) => setForm({ ...form, workStart: event.target.value })}/></label>
      <label><span className="label">正常下班时间</span><input className="field" type="time" value={form.workEnd} onChange={(event) => setForm({ ...form, workEnd: event.target.value })}/></label>
      <label><span className="label">加班最晚下班</span><input className="field" type="time" value={form.latestWorkEnd} onChange={(event) => setForm({ ...form, latestWorkEnd: event.target.value })}/></label>
      <label><span className="label">加班频率</span><select className="field" value={form.overtimeFrequency} onChange={(event) => setForm({ ...form, overtimeFrequency: event.target.value as PlanPreferences["overtimeFrequency"] })}><option value="rare">很少加班</option><option value="sometimes">经常不准时</option><option value="frequent">频繁加班</option></select></label>
      <label><span className="label">单程通勤分钟</span><input className="field" type="number" min="0" max="240" value={form.commuteMinutes} onChange={(event) => setForm({ ...form, commuteMinutes: Number(event.target.value) })}/></label>
      <label><span className="label">伤病或身体限制</span><input className="field" placeholder="没有请填：无" value={form.healthNotes} onChange={(event) => setForm({ ...form, healthNotes: event.target.value })}/></label>
      <div className="sm:col-span-2 lg:col-span-4"><span className="label">可以训练的日期</span><div className="grid grid-cols-4 sm:grid-cols-7 gap-2">{[1, 2, 3, 4, 5, 6, 0].map((day) => <button key={day} type="button" className={`rounded-lg border px-2 py-2.5 text-[11px] transition ${form.availableWeekdays.includes(day) ? "border-accent/50 bg-accent/15 text-accent-light" : "border-border text-muted hover:border-accent/30"}`} onClick={() => toggleDay(day)}>{weekdayNames[day]}</button>)}</div></div>
      <label className="sm:col-span-2"><span className="label">早餐（留空使用推荐搭配）</span><input className="field" placeholder="例如：鸡蛋2个 / 牛奶300毫升" value={form.breakfast} onChange={(event) => setForm({ ...form, breakfast: event.target.value })}/></label>
      <label><span className="label">晚餐</span><input className="field" placeholder="留空使用推荐搭配" value={form.dinner} onChange={(event) => setForm({ ...form, dinner: event.target.value })}/></label>
      <label><span className="label">加餐</span><input className="field" placeholder="留空使用推荐搭配" value={form.snack} onChange={(event) => setForm({ ...form, snack: event.target.value })}/></label>
      <div className="sm:col-span-2 lg:col-span-4 rounded-xl border border-border/80 bg-black/10 p-4"><h3 className="font-semibold text-[11px] mb-3">每天中午吃什么（可以提前填写，留空使用推荐搭配）</h3><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{[1, 2, 3, 4, 5, 6, 0].map((day) => <label key={day}><span className="label">{weekdayNames[day]}午餐</span><input className="field" placeholder="食物和分量" value={form.lunches[day]} onChange={(event) => updateLunch(day, event.target.value)}/></label>)}</div></div>
    </div>
    <div className="flex flex-wrap items-center gap-3 mt-4"><button className="btn-primary flex items-center gap-2" disabled={generating} onClick={generate}>{generating ? <LoaderCircle size={15} className="animate-spin"/> : <Sparkles size={15}/>} {generating ? "正在生成…" : form.workSchedule === "big_small" ? "生成并应用两周计划" : "生成并应用一周计划"}</button><p className="text-muted text-[9px]">恢复模式每天都有小安排，第一周少量训练，第二周再小幅增加；异常不适时立即停止。</p></div>
  </section>;
}

function Training({ data, refresh, notify }: { data: FitnessState; refresh: () => Promise<void>; notify: (message: string) => void }) {
  const weekday = new Date().getDay();
  const todayPlan = planForDate(data.plan.sessions, today());
  const defaultSession = todayPlan ?? [...data.plan.sessions].sort((a, b) => a.weekday - b.weekday)[0];
  const [selectedId, setSelectedId] = useState(defaultSession?.id ?? "");
  const [sets, setSets] = useState<Record<string, SetValue>>({});
  const [rest, setRest] = useState(0);
  const [duration, setDuration] = useState("60");
  const [distance, setDistance] = useState("");
  const [elevation, setElevation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [routineStatus, setRoutineStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [planMealEstimates, setPlanMealEstimates] = useState<Partial<Record<PlannedMealType, NutritionEstimate>>>({});
  const [calculatingPlanMeals, setCalculatingPlanMeals] = useState<Partial<Record<PlannedMealType, boolean>>>({});
  const [routineForm, setRoutineForm] = useState(data.routine);
  const emptyPlanForm = { name: "", activityType: "daily" as ActivityType, weekday, scheduledDate: "", focus: "", breakfast: "", lunch: "", dinner: "", snack: "", activities: [] as PlannedActivity[], exercises: [] as Exercise[], targetDurationMinutes: "60", targetDistanceKm: "", targetElevationM: "" };
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const session = data.plan.sessions.find((item) => item.id === selectedId) ?? defaultSession;
  const plannedSleep = sleepDuration(routineForm.wakeTime, routineForm.sleepTime);

  useEffect(() => { if (rest <= 0) return; const id = window.setInterval(() => setRest((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(id); }, [rest]);
  useEffect(() => {
    if (routineForm.wakeTime === data.routine.wakeTime && routineForm.sleepTime === data.routine.sleepTime) return;
    setRoutineStatus("saving");
    const id = window.setTimeout(() => {
      api.routine(routineForm).then(() => setRoutineStatus("saved")).catch((error) => {
        setRoutineStatus("idle"); notify(error instanceof Error ? error.message : "作息自动保存失败");
      });
    }, 450);
    return () => window.clearTimeout(id);
  }, [routineForm.wakeTime, routineForm.sleepTime]);
  useEffect(() => {
    if (!showAdd) return;
    const queries = { breakfast: planForm.breakfast.trim(), lunch: planForm.lunch.trim(), dinner: planForm.dinner.trim(), snack: planForm.snack.trim() };
    const active = (Object.entries(queries) as [PlannedMealType, string][]).filter(([, query]) => query);
    setPlanMealEstimates((current) => Object.fromEntries(Object.entries(current).filter(([key]) => queries[key as PlannedMealType])));
    if (active.length === 0) { setCalculatingPlanMeals({}); return; }
    setCalculatingPlanMeals(Object.fromEntries(active.map(([key]) => [key, true])));
    let cancelled = false;
    const id = window.setTimeout(async () => {
      const results = await Promise.all(active.map(async ([key, query]) => {
        try { const result = await api.calculateFood(query); return [key, { calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat }] as const; }
        catch { return [key, undefined] as const; }
      }));
      if (cancelled) return;
      setPlanMealEstimates(Object.fromEntries(results.filter((entry): entry is readonly [PlannedMealType, NutritionEstimate] => Boolean(entry[1]))));
      setCalculatingPlanMeals({});
    }, 500);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [showAdd, planForm.breakfast, planForm.lunch, planForm.dinner, planForm.snack]);
  useEffect(() => {
    if (!session) return;
    const lastLog = data.workoutLogs.find((log) => log.sessionId === session.id);
    const initial: Record<string, SetValue> = {};
    session.exercises.forEach((exercise) => Array.from({ length: exercise.sets }, (_, index) => {
      const previous = lastLog?.sets.find((item) => item.exerciseId === exercise.id && item.setNumber === index + 1);
      initial[`${exercise.id}-${index + 1}`] = { weight: previous?.weightKg !== undefined ? String(previous.weightKg) : "", reps: previous?.reps !== undefined ? String(previous.reps) : "", duration: previous?.durationSeconds !== undefined ? String(previous.durationSeconds) : "", done: false };
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
  const addActivity = () => setPlanForm((current) => ({ ...current, activities: [...current.activities, { id: crypto.randomUUID(), startTime: current.activities.length === 0 ? "09:00" : "14:00", name: "", activityType: "other", durationMinutes: 60, notes: "" }] }));
  const updateActivity = (id: string, patch: Partial<PlannedActivity>) => setPlanForm((current) => ({ ...current, activities: current.activities.map((activity) => activity.id === id ? { ...activity, ...patch } : activity) }));
  const removeActivity = (id: string) => setPlanForm((current) => ({ ...current, activities: current.activities.filter((activity) => activity.id !== id) }));
  const addExercise = () => setPlanForm((current) => ({ ...current, activityType: "strength", exercises: [...current.exercises, { id: crypto.randomUUID(), name: "", muscle: "", sets: 3, reps: "", restSeconds: 60, trackingType: "weight_reps" }] }));
  const updateExercise = (id: string, patch: Partial<Exercise>) => setPlanForm((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id === id ? { ...exercise, ...patch } : exercise) }));
  const removeExercise = (id: string) => setPlanForm((current) => ({ ...current, exercises: current.exercises.filter((exercise) => exercise.id !== id) }));
  const closePlanForm = () => { setShowAdd(false); setEditingId(""); setPlanForm({ ...emptyPlanForm }); setPlanMealEstimates({}); setCalculatingPlanMeals({}); };
  const editPlan = (item: WorkoutSession, exerciseId?: string) => {
    setEditingId(item.id); setShowAdd(true); setShowGenerator(false); setSelectedId(item.id);
    setPlanMealEstimates(item.mealNutrition || {});
    setPlanForm({ name: item.name, activityType: item.activityType, weekday: item.weekday, scheduledDate: item.scheduledDate || "", focus: item.focus, breakfast: item.breakfast || "", lunch: item.lunch || "", dinner: item.dinner || "", snack: item.snack || "", activities: item.activities || [], exercises: item.exercises || [], targetDurationMinutes: String(item.targetDurationMinutes || 60), targetDistanceKm: item.targetDistanceKm ? String(item.targetDistanceKm) : "", targetElevationM: item.targetElevationM ? String(item.targetElevationM) : "" });
    window.setTimeout(() => document.getElementById(exerciseId ? `exercise-editor-${exerciseId}` : "plan-editor")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };
  const addPlan = async () => {
    if (!planForm.name.trim()) return notify("请填写计划名称");
    if (planForm.activities.some((activity) => !activity.name.trim())) return notify("请填写每项活动的名称");
    if (planForm.exercises.some((exercise) => !exercise.name.trim() || !exercise.muscle.trim() || !exercise.reps.trim())) return notify("请补全每个训练动作的名称、类型和目标");
    const conflict = data.plan.sessions.find((item) => item.id !== editingId && (planForm.scheduledDate ? item.scheduledDate === planForm.scheduledDate : !item.scheduledDate && item.weekday === planForm.weekday));
    if (conflict) return notify(planForm.scheduledDate ? `${planForm.scheduledDate} 已有“${conflict.name}”，请直接编辑` : `${weekdayNames[planForm.weekday]}已有“${conflict.name}”，请直接编辑`);
    try {
      setSaving(true);
      const payload = {
        name: planForm.name, activityType: planForm.activityType, weekday: planForm.weekday, ...(planForm.scheduledDate ? { scheduledDate: planForm.scheduledDate } : {}), focus: planForm.focus,
        targetDurationMinutes: planForm.activityType === "daily" ? 0 : Number(planForm.targetDurationMinutes) || 60,
        ...(planForm.targetDistanceKm ? { targetDistanceKm: Number(planForm.targetDistanceKm) } : {}),
        ...(planForm.targetElevationM ? { targetElevationM: Number(planForm.targetElevationM) } : {}),
        breakfast: planForm.breakfast, lunch: planForm.lunch, dinner: planForm.dinner, snack: planForm.snack,
        activities: planForm.activities.map((activity) => ({ ...activity, name: activity.name.trim(), notes: activity.notes?.trim() || undefined })),
        exercises: planForm.exercises.map((exercise) => ({ ...exercise, name: exercise.name.trim(), muscle: exercise.muscle.trim(), reps: exercise.reps.trim(), trackingType: exercise.trackingType || "weight_reps" })),
      };
      const saved = editingId ? await api.updateSession(editingId, payload) : await api.addSession(payload);
      await refresh(); setSelectedId(saved.id); closePlanForm();
      notify(editingId ? "计划已更新" : "计划已绑定到所选时间");
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
  const toggleSelectedPlan = (id: string) => setSelectedPlanIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const deleteSelectedPlans = async () => {
    if (selectedPlanIds.length === 0) return notify("请先选择需要删除的计划");
    if (!window.confirm(`确定一次删除选中的 ${selectedPlanIds.length} 个计划吗？已保存的运动记录会保留。`)) return;
    const nextSession = data.plan.sessions.find((item) => !selectedPlanIds.includes(item.id));
    try {
      setBatchDeleting(true);
      const result = await api.deleteSessions(selectedPlanIds);
      if (session && selectedPlanIds.includes(session.id)) setSelectedId(nextSession?.id || "");
      if (editingId && selectedPlanIds.includes(editingId)) closePlanForm();
      setSelectedPlanIds([]); setSelectionMode(false); await refresh(); notify(`已删除 ${result.deleted} 个计划`);
    } catch (error) { notify(error instanceof Error ? error.message : "批量删除失败"); }
    finally { setBatchDeleting(false); }
  };
  const finish = async () => {
    if (!session) return;
    if (session.exercises.length > 0 && completedCount === 0) return notify("至少完成一组后再保存训练");
    const hasIncompleteSet = session.exercises.some((exercise) => Array.from({ length: exercise.sets }, (_, index) => sets[`${exercise.id}-${index + 1}`]).some((value) => value?.done && ((exercise.trackingType === "duration" && !(Number(value.duration) > 0)) || (exercise.trackingType === "reps" && !(Number(value.reps) > 0)) || ((!exercise.trackingType || exercise.trackingType === "weight_reps") && (!(Number(value.reps) > 0) || value.weight === "")))));
    if (hasIncompleteSet) return notify("请补全已完成组的记录数据");
    const completed: CompletedSet[] = [];
    session.exercises.forEach((exercise) => Array.from({ length: exercise.sets }, (_, index) => {
      const key = `${exercise.id}-${index + 1}`; const value = sets[key];
      const trackingType = exercise.trackingType || "weight_reps";
      if (value?.done) completed.push({
        exerciseId: exercise.id, exerciseName: exercise.name, setNumber: index + 1, trackingType,
        ...(trackingType === "weight_reps" ? { weightKg: Number(value.weight) || 0, reps: Number(value.reps) || 0 } : {}),
        ...(trackingType === "reps" ? { reps: Number(value.reps) || 0 } : {}),
        ...(trackingType === "duration" ? { durationSeconds: Number(value.duration) } : {}),
      });
    }));
    try { setSaving(true); await api.addWorkout({ sessionId: session.id, date: today(), durationMinutes: Number(duration) || 60, ...(distance ? { distanceKm: Number(distance) } : {}), ...(elevation ? { elevationM: Number(elevation) } : {}), notes, sets: completed }); await refresh(); notify("运动记录已保存，今天又向前一步"); setNotes(""); setSets((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, done: false }]))); }
    catch (error) { notify(error instanceof Error ? error.message : "保存失败"); } finally { setSaving(false); }
  };
  const sortedSessions = [...data.plan.sessions].sort((a, b) => a.scheduledDate && b.scheduledDate ? a.scheduledDate.localeCompare(b.scheduledDate) : a.scheduledDate ? 1 : b.scheduledDate ? -1 : a.weekday - b.weekday);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-accent-light text-[10px] tracking-[.2em] uppercase mb-2">Daily plan</p><h1 className="text-2xl font-semibold">我的每日计划</h1><p className="text-muted mt-1">按星期重复或绑定具体日期；每个星期和日期都只有一份计划，活动统一放在计划内。</p></div><div className="flex flex-wrap gap-2"><button className="btn-quiet flex items-center gap-2" onClick={() => { setShowGenerator(!showGenerator); if (showAdd) closePlanForm(); }}><Sparkles size={15}/>{showGenerator ? "收起生成器" : "生成一周计划"}</button><button className="btn-primary flex items-center gap-2" onClick={() => { setShowGenerator(false); showAdd ? closePlanForm() : setShowAdd(true); }}>{showAdd ? <X size={15}/> : <Plus size={15}/>} {showAdd ? "取消" : "添加计划"}</button></div></header>
      {showGenerator && <WeekPlanGenerator data={data} refresh={refresh} notify={notify} close={() => setShowGenerator(false)}/>}
      <section className="panel rounded-xl p-5"><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2"><Clock3 size={16} className="text-accent-light"/><div><h2 className="font-semibold">固定作息</h2><p className="text-muted text-[10px] mt-0.5">选择后自动保存，并应用到所有计划。</p></div></div><div className={`text-[10px] flex items-center gap-1.5 transition ${routineStatus === "saving" ? "text-muted" : "text-accent-light"}`}><span className={`w-1.5 h-1.5 rounded-full ${routineStatus === "saving" ? "bg-muted animate-pulse" : "bg-accent"}`}/>{routineStatus === "saving" ? "保存中…" : routineStatus === "saved" ? "已自动保存" : "自动保存"}</div></div><div className="grid sm:grid-cols-2 gap-3 max-w-2xl"><TimePicker label="每天几点起床" value={routineForm.wakeTime} icon={Sunrise} onChange={(wakeTime) => setRoutineForm({ ...routineForm, wakeTime })}/><TimePicker label="每天几点睡觉" value={routineForm.sleepTime} icon={Moon} onChange={(sleepTime) => setRoutineForm({ ...routineForm, sleepTime })}/></div><div className="mt-3 max-w-2xl rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Moon size={16} className="text-accent-light"/><div><p className="text-muted text-[10px]">预计睡眠时长</p><strong className="text-base text-accent-light">{plannedSleep.label}</strong></div></div><p className="text-muted text-[10px]">{routineForm.sleepTime} 入睡 → 次日 {routineForm.wakeTime} 起床 · 共 {plannedSleep.label}</p></div></section>
      {showAdd && <section id="plan-editor" className="panel rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><CalendarDays size={16} className="text-accent-light"/><h2 className="font-semibold">{editingId ? "编辑计划" : "新增计划"}</h2></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="sm:col-span-2"><span className="label">计划名称</span><input className="field" placeholder="例如：周一计划 / 生日当天安排" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })}/></label>
        <div className="sm:col-span-2"><span className="label">计划时间</span><div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-bg/30 p-1"><button type="button" className={`rounded-md px-3 py-2 text-[11px] transition ${!planForm.scheduledDate ? "bg-accent text-black font-semibold" : "text-muted hover:text-text"}`} onClick={() => setPlanForm({ ...planForm, scheduledDate: "" })}>每周重复</button><button type="button" className={`rounded-md px-3 py-2 text-[11px] transition ${planForm.scheduledDate ? "bg-accent text-black font-semibold" : "text-muted hover:text-text"}`} onClick={() => setPlanForm({ ...planForm, scheduledDate: planForm.scheduledDate || today(), weekday: dateWeekday(planForm.scheduledDate || today()) })}>指定日期</button></div></div>
        {!planForm.scheduledDate ? <label><span className="label">安排在</span><select className="field" value={planForm.weekday} onChange={(event) => setPlanForm({ ...planForm, weekday: Number(event.target.value) })}>{weekdayNames.map((label, index) => { const occupied = data.plan.sessions.some((item) => item.id !== editingId && !item.scheduledDate && item.weekday === index); return <option key={label} value={index}>{label}{occupied ? "（已有计划）" : ""}</option>; })}</select></label> : <label><span className="label">具体年月日</span><input className="field" type="date" value={planForm.scheduledDate} onChange={(event) => setPlanForm({ ...planForm, scheduledDate: event.target.value, weekday: event.target.value ? dateWeekday(event.target.value) : planForm.weekday })}/></label>}
        <div className="flex items-end pb-2 text-[10px] text-muted">{planForm.scheduledDate ? `${planForm.scheduledDate} · ${weekdayNames[planForm.weekday]}` : `${weekdayNames[planForm.weekday]}每周自动生效`}</div>
        <PlanMealField label="早餐吃什么" placeholder="例如：鸡蛋2个 / 牛奶300毫升" value={planForm.breakfast} estimate={planMealEstimates.breakfast} calculating={calculatingPlanMeals.breakfast} onChange={(breakfast) => setPlanForm({ ...planForm, breakfast })}/>
        <PlanMealField label="中午吃什么" placeholder="例如：米饭1碗 / 鸡胸肉200克" value={planForm.lunch} estimate={planMealEstimates.lunch} calculating={calculatingPlanMeals.lunch} onChange={(lunch) => setPlanForm({ ...planForm, lunch })}/>
        <PlanMealField label="晚上吃什么" placeholder="例如：面条1碗 / 牛肉150克" value={planForm.dinner} estimate={planMealEstimates.dinner} calculating={calculatingPlanMeals.dinner} onChange={(dinner) => setPlanForm({ ...planForm, dinner })}/>
        <PlanMealField label="加餐是什么" placeholder="例如：酸奶200克 / 坚果30克" value={planForm.snack} estimate={planMealEstimates.snack} calculating={calculatingPlanMeals.snack} onChange={(snack) => setPlanForm({ ...planForm, snack })}/>
        <div className="sm:col-span-2 lg:col-span-4 rounded-xl border border-border/80 bg-black/10 p-4"><div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="font-semibold flex items-center gap-2"><ListTodo size={15} className="text-accent-light"/>活动安排</h3><p className="text-muted text-[10px] mt-1">同一天可以安排骑车、跑步、打麻将等多项活动。</p></div><button type="button" className="btn-quiet flex items-center gap-1.5" onClick={addActivity}><Plus size={13}/>添加活动</button></div>{planForm.activities.length === 0 ? <div className="border border-dashed border-border rounded-lg py-6 text-center text-muted text-[11px]">还没有活动，点击“添加活动”开始安排</div> : <div className="space-y-3">{planForm.activities.map((activity, index) => <div key={activity.id} className="rounded-lg border border-border/70 bg-bg/25 p-3"><div className="flex items-center justify-between mb-2"><strong className="text-[11px]">活动 {index + 1}</strong><button type="button" className="text-muted hover:text-red-300 p-1" onClick={() => removeActivity(activity.id)} aria-label={`删除活动 ${index + 1}`}><Trash2 size={13}/></button></div><div className="grid sm:grid-cols-2 lg:grid-cols-[150px_150px_1fr_110px] gap-2 items-end"><CompactTimePicker value={activity.startTime} onChange={(startTime) => updateActivity(activity.id, { startTime })}/><label><span className="label">活动类型</span><select className="field" value={activity.activityType} onChange={(event) => updateActivity(activity.id, { activityType: event.target.value as ActivityType })}>{Object.entries(activityNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span className="label">活动名称</span><input className="field" placeholder="例如：骑车 / 跑步 / 打麻将" value={activity.name} onChange={(event) => updateActivity(activity.id, { name: event.target.value })}/></label><label><span className="label">时长（分钟）</span><input className="field" type="number" min="1" placeholder="可选" value={activity.durationMinutes ?? ""} onChange={(event) => updateActivity(activity.id, { durationMinutes: event.target.value ? Number(event.target.value) : undefined })}/></label><label className="sm:col-span-2 lg:col-span-4"><span className="label">备注（可选）</span><input className="field" placeholder="路线、地点、和谁一起、需要准备什么……" value={activity.notes || ""} onChange={(event) => updateActivity(activity.id, { notes: event.target.value })}/></label></div></div>)}</div>}</div>
        <div className="sm:col-span-2 lg:col-span-4 rounded-xl border border-accent/25 bg-accent/5 p-4"><div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="font-semibold flex items-center gap-2"><Dumbbell size={15} className="text-accent-light"/>训练动作</h3><p className="text-muted text-[10px] mt-1">动作内容完全由你填写，生成结果也可以在这里逐项修改或删除。</p></div><button type="button" className="btn-quiet flex items-center gap-1.5" onClick={addExercise}><Plus size={13}/>添加空白动作</button></div>{planForm.exercises.length === 0 ? <div className="border border-dashed border-border rounded-lg py-6 text-center text-muted text-[11px]">暂无训练动作；点击“添加空白动作”后自行填写</div> : <div className="space-y-3">{planForm.exercises.map((exercise, index) => <div id={`exercise-editor-${exercise.id}`} key={exercise.id} className="rounded-lg border border-border/70 bg-bg/25 p-3 scroll-mt-5"><div className="flex items-center justify-between mb-2"><strong className="text-[11px]">动作 {index + 1}</strong><button type="button" className="text-muted hover:text-red-300 p-1" onClick={() => removeExercise(exercise.id)} aria-label={`删除动作 ${exercise.name || index + 1}`}><Trash2 size={13}/></button></div><div className="grid sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_130px_90px_120px_100px] gap-2 items-end"><label><span className="label">动作名称</span><input className="field" placeholder="例如：哑铃卧推" value={exercise.name} onChange={(event) => updateExercise(exercise.id, { name: event.target.value })}/></label><label><span className="label">部位 / 类型</span><input className="field" placeholder="例如：胸" value={exercise.muscle} onChange={(event) => updateExercise(exercise.id, { muscle: event.target.value })}/></label><label><span className="label">记录方式</span><select className="field" value={exercise.trackingType || "weight_reps"} onChange={(event) => updateExercise(exercise.id, { trackingType: event.target.value as ExerciseTrackingType })}><option value="weight_reps">重量＋次数</option><option value="reps">只记次数</option><option value="duration">记录时长</option></select></label><label><span className="label">组数</span><input className="field" type="number" min="1" max="20" value={exercise.sets} onChange={(event) => updateExercise(exercise.id, { sets: Number(event.target.value) || 1 })}/></label><label><span className="label">目标</span><input className="field" placeholder="8–12 / 60秒" value={exercise.reps} onChange={(event) => updateExercise(exercise.id, { reps: event.target.value })}/></label><label><span className="label">休息（秒）</span><input className="field" type="number" min="0" max="1800" value={exercise.restSeconds} onChange={(event) => updateExercise(exercise.id, { restSeconds: Number(event.target.value) || 0 })}/></label></div></div>)}</div>}</div>
        <label className="sm:col-span-2 lg:col-span-4"><span className="label">当天备注（可选）</span><textarea className="field min-h-20 resize-y" placeholder="记录这一天的其他提醒……" value={planForm.focus} onChange={(event) => setPlanForm({ ...planForm, focus: event.target.value })}/></label>
      </div><div className="flex items-center gap-3 mt-4"><button className="btn-primary" disabled={saving} onClick={addPlan}>{saving ? "保存中…" : editingId ? "保存修改" : "添加此计划"}</button><span className="text-muted text-[10px]">计划内可以包含多项按时间排序的活动。</span></div></section>}
      <div className="space-y-4">
        <section className="panel rounded-xl p-4"><div className="flex flex-wrap items-end gap-3"><label className="flex-1 min-w-56"><span className="label">当前计划 · 共 {data.plan.sessions.length} 个</span><select className="field" value={session?.id || ""} onChange={(event) => setSelectedId(event.target.value)} disabled={selectionMode || data.plan.sessions.length === 0}>{sortedSessions.map((item) => <option key={item.id} value={item.id}>{planForDate(data.plan.sessions, today())?.id === item.id ? "今天 · " : ""}{planScheduleLabel(item)} · {item.name}</option>)}</select></label><div className="flex flex-wrap gap-2">{session && !selectionMode && <><button className="btn-quiet flex items-center gap-1.5" onClick={() => editPlan(session)}><Pencil size={13}/>编辑当前</button><button className="btn-quiet flex items-center gap-1.5 text-red-300" disabled={Boolean(deletingId)} onClick={() => deletePlan(session.id, session.name)}><Trash2 size={13}/>删除当前</button></>}<button className={selectionMode ? "btn-primary flex items-center gap-1.5" : "btn-quiet flex items-center gap-1.5"} onClick={() => { setSelectionMode(!selectionMode); setSelectedPlanIds([]); }}><Check size={13}/>{selectionMode ? "退出选择" : "批量选择"}</button></div></div>
          {selectionMode && <div className="mt-4 pt-4 border-t border-border"><div className="flex flex-wrap items-center justify-between gap-3 mb-3"><p className="text-muted text-[10px]">已选择 {selectedPlanIds.length} / {data.plan.sessions.length} 个计划</p><div className="flex gap-2"><button className="btn-quiet" onClick={() => setSelectedPlanIds(selectedPlanIds.length === data.plan.sessions.length ? [] : data.plan.sessions.map((item) => item.id))}>{selectedPlanIds.length === data.plan.sessions.length ? "取消全选" : "全选"}</button><button className="btn-primary !bg-red-500/85 flex items-center gap-1.5 disabled:opacity-50" disabled={selectedPlanIds.length === 0 || batchDeleting} onClick={deleteSelectedPlans}><Trash2 size={13}/>{batchDeleting ? "删除中…" : `一键删除 (${selectedPlanIds.length})`}</button></div></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">{sortedSessions.map((item) => { const selected = selectedPlanIds.includes(item.id); return <button key={item.id} className={`rounded-lg border p-3 text-left transition ${selected ? "border-red-400/60 bg-red-400/10" : "border-border bg-black/10 hover:border-accent/30"}`} onClick={() => toggleSelectedPlan(item.id)}><div className="flex items-start gap-2"><span className={`mt-0.5 w-4 h-4 rounded border grid place-items-center shrink-0 ${selected ? "border-red-300 bg-red-400 text-black" : "border-border"}`}>{selected && <Check size={11}/>}</span><div className="min-w-0"><strong className="block truncate text-[11px]">{item.name}</strong><span className="text-muted text-[9px]">{planScheduleLabel(item)}</span></div></div></button>; })}</div></div>}
          {data.plan.sessions.length === 0 && <div className="py-5 text-center text-muted text-[11px]">还没有计划，请添加或生成计划。</div>}<div className="mt-3 text-muted text-[10px] flex items-center gap-2"><History size={12}/>累计完成 {data.workoutLogs.length} 次训练</div></section>

        {session ? <section className="panel rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3"><div><p className="text-muted text-[10px] tracking-widest">{planScheduleLabel(session)} · DAILY PLAN</p><h2 className="text-lg font-semibold mt-1">{session.name}</h2></div><div className="text-right"><p className="text-accent-light font-semibold">{session.activities?.length ? `${session.activities.length} 项活动` : session.exercises.length > 0 ? `${completedCount} / ${totalSets} 组` : activityNames[session.activityType]}</p><p className="text-muted text-[10px]">{session.activityType === "daily" ? `${data.routine.wakeTime} 起 · ${data.routine.sleepTime} 睡` : session.exercises.length > 0 ? "已完成" : `${session.targetDurationMinutes || 0} 分钟目标`}</p></div></div>
          {rest > 0 && <div className="mx-5 mt-4 p-3 rounded-lg border border-accent/35 bg-accent/10 flex items-center justify-between"><div className="flex items-center gap-2"><Timer size={17} className="text-accent-light"/><span>组间休息</span></div><button className="text-xl font-semibold text-accent-light" onClick={() => setRest(0)}>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}</button></div>}
          <div className="p-5 space-y-5">
            {(session.activityType === "daily" || session.breakfast || session.lunch || session.dinner || session.snack || session.activities?.length) && <RoutineSummary session={session} routine={data.routine}/>}
            {session.activityType !== "daily" && session.exercises.length === 0 && (() => { const Icon = activityIcons[session.activityType]; return <div className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent/10 to-transparent p-6"><Icon size={30} className="text-accent-light mb-4"/><h3 className="text-xl font-semibold">{session.focus}</h3><div className="flex flex-wrap gap-2 mt-4 text-[11px] text-muted"><span className="border border-border rounded-full px-3 py-1">目标 {session.targetDurationMinutes} 分钟</span>{session.targetDistanceKm && <span className="border border-border rounded-full px-3 py-1">距离 {session.targetDistanceKm} km</span>}{session.targetElevationM && <span className="border border-border rounded-full px-3 py-1">爬升 {session.targetElevationM} m</span>}</div></div>; })()}
            {session?.exercises.map((exercise, exerciseIndex) => <div key={exercise.id}>
              <div className="flex items-center gap-3 mb-2"><span className="w-7 h-7 rounded bg-panel grid place-items-center text-muted text-[11px]">{exerciseIndex + 1}</span><div className="flex-1"><h3 className="font-semibold">{exercise.name}</h3><p className="text-muted text-[10px]">{exercise.muscle} · 目标 {exercise.reps} · 休息 {exercise.restSeconds}秒</p></div><button type="button" className="btn-quiet !px-2.5 !py-1.5 flex items-center gap-1 text-[10px]" onClick={() => editPlan(session, exercise.id)}><Pencil size={11}/>编辑</button></div>
              <div className="ml-10 space-y-1.5">{Array.from({ length: exercise.sets }, (_, index) => { const key = `${exercise.id}-${index + 1}`; const value = sets[key] ?? { weight: "", reps: "", duration: "", done: false }; const trackingType = exercise.trackingType || "weight_reps"; return <div key={key} className={`grid ${trackingType === "weight_reps" ? "grid-cols-[38px_1fr_1fr_72px]" : "grid-cols-[38px_1fr_72px]"} gap-2 items-center rounded-lg p-2 border ${value.done ? "border-mint/50 bg-mint/10" : "border-border/70 bg-black/10"}`}><span className="text-muted text-center">{index + 1}</span>{trackingType === "weight_reps" && <label className="relative"><input className="field !py-2 pr-8" type="number" min="0" placeholder="重量" value={value.weight} onChange={(event) => updateSet(key, { weight: event.target.value })}/><span className="absolute right-2 top-2.5 text-muted text-[10px]">kg</span></label>}{trackingType !== "duration" ? <label className="relative"><input className="field !py-2 pr-8" type="number" min="0" placeholder="次数" value={value.reps} onChange={(event) => updateSet(key, { reps: event.target.value })}/><span className="absolute right-2 top-2.5 text-muted text-[10px]">次</span></label> : <label className="relative"><input className="field !py-2 pr-8" type="number" min="1" placeholder="时长" value={value.duration} onChange={(event) => updateSet(key, { duration: event.target.value })}/><span className="absolute right-2 top-2.5 text-muted text-[10px]">秒</span></label>}<button className={value.done ? "btn-primary !p-2" : "btn-quiet !p-2"} onClick={() => completeSet(key, exercise.restSeconds)}>{value.done ? <Check size={15} className="mx-auto"/> : "完成"}</button></div>; })}</div>
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
  const [recordingFromText, setRecordingFromText] = useState(false);
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
      notify(result.estimationMethod === "ai" ? `AI 已拆分并估算 ${result.items.length} 项食物` : result.unmatched.length > 0 ? `已计算 ${result.items.length} 项，另有 ${result.unmatched.length} 项未识别` : result.items.some((item) => item.note) ? "已根据营养标签换算热量" : `已分项计算 ${result.items.length} 项食物`);
    } catch (error) { notify(error instanceof Error ? error.message : "计算失败"); } finally { setCalculating(false); }
  };
  const add = async () => {
    if (!form.name.trim()) return notify("先填写食物名称");
    try { setSaving(true); await api.addMeal({ ...form, calories: Number(form.calories) || 0, protein: Number(form.protein) || 0, carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0 }); setForm(blank); await refresh(); notify("饮食记录已添加"); }
    catch (error) { notify(error instanceof Error ? error.message : "保存失败"); } finally { setSaving(false); }
  };
  const recordFromText = async () => {
    if (!foodQuery.trim()) return notify("例如：我今天中午吃了沙县鸡腿饭，另外加一个去皮鸭腿");
    try {
      setRecordingFromText(true);
      const result = await api.addMealFromText(foodQuery);
      setCalculation(result.calculation);
      setFoodQuery("");
      await refresh();
      notify(`已自动记录到今天${mealNames[result.meal.mealType]}`);
    } catch (error) { notify(error instanceof Error ? error.message : "自动记录失败"); }
    finally { setRecordingFromText(false); }
  };
  const remove = async (id: string) => { try { await api.deleteMeal(id); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "删除失败"); } };

  return (
    <div className="space-y-5">
      <header><p className="text-accent-light text-[10px] tracking-[.2em] uppercase mb-2">Nutrition</p><h1 className="text-2xl font-semibold">今天吃得怎么样？</h1><p className="text-muted mt-1">先盯住总热量和蛋白质，记录不必追求绝对精确。</p></header>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{nutrientCards.map(({ label, value, target, unit, icon: Icon, color }) => <div className="panel rounded-xl p-4" key={label}><div className="flex justify-between mb-3"><span className="text-muted text-[11px]">{label}</span><Icon size={15} style={{ color }}/></div><p className="text-xl font-semibold">{value}<small className="text-muted text-[11px] font-normal ml-1">/ {target} {unit}</small></p><div className="mt-3"><Progress value={value} target={target} color={color}/></div></div>)}</div>

      <div className="grid xl:grid-cols-[.8fr_1.2fr] gap-4 items-start">
        <section className="panel rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><Plus size={16} className="text-accent-light"/><h2 className="font-semibold">添加一餐</h2></div><div className="rounded-lg border border-accent/30 bg-accent/10 p-3 mb-4"><label><span className="label !text-accent-light flex items-center gap-1"><Sparkles size={12}/>AI 智能饮食记录</span><input className="field" placeholder="例如：我今天中午吃了沙县鸡腿饭，另外加一个去皮鸭腿" value={foodQuery} onChange={(event) => { setFoodQuery(event.target.value); setCalculation(null); }} onKeyDown={(event) => { if (event.key === "Enter") recordFromText(); }}/></label><div className="flex flex-wrap gap-2 mt-2"><button className="btn-primary flex-1 min-w-32" disabled={recordingFromText || calculating} onClick={recordFromText}>{recordingFromText ? "AI 识别并记录中…" : "识别并自动记录"}</button><button className="btn-quiet shrink-0" disabled={calculating || recordingFromText} onClick={calculate}>{calculating ? "计算中…" : "只计算不记录"}</button></div>{calculation && <div className="mt-3 border-t border-accent/20 pt-2 space-y-1.5"><div className="flex justify-between text-[10px] text-accent-light"><span>{calculation.estimationMethod === "ai" ? "AI 分项估算" : "本地分项估算"}</span><strong>合计 {calculation.calories} kcal</strong></div>{calculation.items.map((item, index) => <div key={`${item.name}-${index}`}><div className="flex justify-between text-[10px]"><span>{item.name} · {item.amount}</span><span className="text-muted">{item.calories} kcal · 蛋白 {item.protein}g · 碳水 {item.carbs}g · 脂肪 {item.fat}g</span></div>{item.note && <p className="text-[9px] text-amber-300/80 mt-0.5">{item.note}</p>}</div>)}{calculation.note && <p className="text-[9px] text-muted border-t border-accent/15 pt-1.5">{calculation.note}</p>}{calculation.unmatched.map((item) => <div key={item} className="text-[10px] text-red-300">未识别：{item}</div>)}</div>}<p className="text-[9px] text-muted mt-2">说出“今天早餐 / 中午 / 晚上 / 加餐吃了什么”即可自动归类并入账；不写餐次时按当前时间判断。结果仍可使用下方表单手动调整。</p></div><div className="grid grid-cols-2 gap-3">
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

interface WeightDraft { id: string; date: string; weightKg: string; bodyFat: string; }
type AutoSaveStatus = "idle" | "saving" | "saved";

function SaveStatus({ status }: { status: AutoSaveStatus }) {
  return <span className={`text-[10px] flex items-center gap-1.5 ${status === "saving" ? "text-muted" : "text-accent-light"}`}><i className={`w-1.5 h-1.5 rounded-full ${status === "saving" ? "bg-muted animate-pulse" : "bg-accent"}`}/>{status === "saving" ? "保存中…" : status === "saved" ? "已自动保存" : "自动保存"}</span>;
}

function BodyData({ data, refresh, notify }: { data: FitnessState; refresh: () => Promise<void>; notify: (message: string) => void }) {
  const todayEntry = data.weights.find((item) => item.date === today());
  const [profile, setProfile] = useState(data.profile);
  const [weight, setWeight] = useState(String(todayEntry?.weightKg ?? data.weights[0]?.weightKg ?? data.profile.weightKg));
  const [bodyFat, setBodyFat] = useState(todayEntry?.bodyFat ? String(todayEntry.bodyFat) : "");
  const [profileStatus, setProfileStatus] = useState<AutoSaveStatus>("idle");
  const [measurementStatus, setMeasurementStatus] = useState<AutoSaveStatus>("idle");
  const [measurementTouched, setMeasurementTouched] = useState(false);
  const [editingWeight, setEditingWeight] = useState<WeightDraft | null>(null);
  const [editStatus, setEditStatus] = useState<AutoSaveStatus>("idle");
  const [deletingWeightId, setDeletingWeightId] = useState("");
  useEffect(() => setProfile(data.profile), [data.profile]);
  const field = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const input = { name: profile.name.trim(), sex: profile.sex, age: Number(profile.age), heightCm: Number(profile.heightCm), weightKg: Number(profile.weightKg), goal: profile.goal };
    const current = { name: data.profile.name, sex: data.profile.sex, age: data.profile.age, heightCm: data.profile.heightCm, weightKg: data.profile.weightKg, goal: data.profile.goal };
    if (JSON.stringify(input) === JSON.stringify(current)) return;
    if (!input.name || input.age < 14 || input.age > 100 || input.heightCm < 100 || input.heightCm > 250 || input.weightKg < 30 || input.weightKg > 350) return;
    setProfileStatus("saving");
    const id = window.setTimeout(async () => {
      try { await api.profile(input); await refresh(); setProfileStatus("saved"); }
      catch (error) { setProfileStatus("idle"); notify(error instanceof Error ? error.message : "身体资料保存失败"); }
    }, 500);
    return () => window.clearTimeout(id);
  }, [profile, data.profile]);

  useEffect(() => {
    if (!measurementTouched) return;
    const weightKg = Number(weight); const fat = bodyFat ? Number(bodyFat) : undefined;
    if (weightKg < 30 || weightKg > 350 || (fat !== undefined && (fat < 1 || fat > 70))) return;
    setMeasurementStatus("saving");
    const id = window.setTimeout(async () => {
      try { await api.addWeight({ date: today(), weightKg, ...(fat !== undefined ? { bodyFat: fat } : {}) }); setMeasurementTouched(false); await refresh(); setMeasurementStatus("saved"); }
      catch (error) { setMeasurementStatus("idle"); notify(error instanceof Error ? error.message : "今日测量保存失败"); }
    }, 500);
    return () => window.clearTimeout(id);
  }, [weight, bodyFat, measurementTouched]);

  useEffect(() => {
    if (!editingWeight) return;
    const source = data.weights.find((item) => item.id === editingWeight.id);
    const weightKg = Number(editingWeight.weightKg); const fat = editingWeight.bodyFat ? Number(editingWeight.bodyFat) : undefined;
    if (!source || (source.date === editingWeight.date && source.weightKg === weightKg && source.bodyFat === fat)) return;
    if (!editingWeight.date || weightKg < 30 || weightKg > 350 || (fat !== undefined && (fat < 1 || fat > 70))) return;
    setEditStatus("saving");
    const id = window.setTimeout(async () => {
      try { await api.updateWeight(editingWeight.id, { date: editingWeight.date, weightKg, ...(fat !== undefined ? { bodyFat: fat } : {}) }); await refresh(); setEditStatus("saved"); }
      catch (error) { setEditStatus("idle"); notify(error instanceof Error ? error.message : "体重记录保存失败"); }
    }, 500);
    return () => window.clearTimeout(id);
  }, [editingWeight, data.weights]);

  const removeWeight = async (item: WeightEntry) => {
    if (!window.confirm(`确定删除 ${item.date} 的体重记录吗？`)) return;
    try { setDeletingWeightId(item.id); await api.deleteWeight(item.id); if (editingWeight?.id === item.id) setEditingWeight(null); await refresh(); notify("体重记录已删除"); }
    catch (error) { notify(error instanceof Error ? error.message : "删除失败"); }
    finally { setDeletingWeightId(""); }
  };
  const weights = data.weights.slice(0, 8).reverse();
  const recentWeights = data.weights.slice(0, 8);
  const min = Math.min(...weights.map((item) => item.weightKg), data.profile.weightKg) - 1;
  const max = Math.max(...weights.map((item) => item.weightKg), data.profile.weightKg) + 1;

  return (
    <div className="space-y-5">
      <header><p className="text-accent-light text-[10px] tracking-[.2em] uppercase mb-2">Body & target</p><h1 className="text-2xl font-semibold">身体数据与目标</h1><p className="text-muted mt-1">所有内容修改后自动保存，热量与营养目标也会实时重算。</p></header>
      <div className="grid xl:grid-cols-[1fr_.9fr] gap-4 items-start">
        <section className="panel rounded-xl p-5"><div className="flex items-center justify-between gap-3 mb-5"><div className="flex items-center gap-2"><Target size={17} className="text-accent-light"/><h2 className="font-semibold">基础资料</h2></div><SaveStatus status={profileStatus}/></div><div className="grid sm:grid-cols-2 gap-3">
          <label><span className="label">称呼</span><input className="field" value={profile.name} onChange={(event) => field("name", event.target.value)}/></label>
          <label><span className="label">目标</span><select className="field" value={profile.goal} onChange={(event) => field("goal", event.target.value as Profile["goal"])}><option value="gain">增肌</option><option value="lose">减脂</option><option value="maintain">保持</option></select></label>
          <label><span className="label">性别</span><select className="field" value={profile.sex} onChange={(event) => field("sex", event.target.value as Profile["sex"])}><option value="male">男</option><option value="female">女</option></select></label>
          <label><span className="label">年龄</span><input className="field" type="number" value={profile.age} onChange={(event) => field("age", Number(event.target.value))}/></label>
          <label><span className="label">身高 cm</span><input className="field" type="number" value={profile.heightCm} onChange={(event) => field("heightCm", Number(event.target.value))}/></label>
          <label><span className="label">当前体重 kg</span><input className="field" type="number" step=".1" value={profile.weightKg} onChange={(event) => field("weightKg", Number(event.target.value))}/></label>
          <label className="sm:col-span-2"><span className="label">日常活动量 · 根据每日计划自动分析</span><select className="field disabled:cursor-not-allowed disabled:opacity-70" value={profile.activityLevel} disabled><option value="1.2">久坐 / 暂无规律活动</option><option value="1.375">轻量活动</option><option value="1.55">中等活动</option><option value="1.725">高活动</option></select><span className="block text-muted text-[9px] mt-1.5">新增、编辑、删除或重新生成每周计划后自动更新，无法手动选择。</span></label>
        </div></section>

        <div className="space-y-4">
          <section className="panel rounded-xl p-5"><h2 className="font-semibold mb-4">当前每日目标</h2><div className="grid grid-cols-2 gap-3">{[["热量", `${data.profile.calorieTarget} kcal`], ["蛋白质", `${data.profile.proteinTarget} g`], ["碳水", `${data.profile.carbsTarget} g`], ["脂肪", `${data.profile.fatTarget} g`]].map(([label, value]) => <div key={label} className="bg-black/15 border border-border rounded-lg p-3"><p className="text-muted text-[10px]">{label}</p><p className="text-lg font-semibold mt-1">{value}</p></div>)}</div></section>
          <section className="panel rounded-xl p-5"><div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2"><TrendingUp size={16} className="text-sky"/><h2 className="font-semibold">今日测量</h2></div><SaveStatus status={measurementStatus}/></div><div className="grid grid-cols-2 gap-3"><label><span className="label">体重 kg</span><input className="field" type="number" step=".1" value={weight} onChange={(event) => { setWeight(event.target.value); setMeasurementTouched(true); }}/></label><label><span className="label">体脂 %（可选）</span><input className="field" type="number" step=".1" value={bodyFat} onChange={(event) => { setBodyFat(event.target.value); setMeasurementTouched(true); }}/></label></div><p className="text-muted text-[9px] mt-3">修改后自动写入今天的记录，并立即评估趋势；至少一周数据才会调整计划。</p>{data.planAdaptation && <div className={`mt-3 rounded-lg border p-3 ${data.planAdaptation.status === "adjusted" ? "border-accent/35 bg-accent/10" : "border-sky/25 bg-sky/10"}`}><div className="flex items-center justify-between gap-2 mb-1"><strong className="text-[10px]">{data.planAdaptation.status === "collecting" ? "正在建立体重基线" : data.planAdaptation.status === "adjusted" ? "计划已自动调整" : "本次保持不变"}</strong><span className="text-muted text-[9px]">热量修正 {data.planAdaptation.calorieAdjustment > 0 ? "+" : ""}{data.planAdaptation.calorieAdjustment} kcal</span></div><p className="text-muted text-[9px] leading-relaxed">{data.planAdaptation.message}</p></div>}</section>
        </div>
      </div>
      <section className="panel rounded-xl p-5"><div className="flex justify-between items-center mb-5"><div><h2 className="font-semibold">体重趋势</h2><p className="text-muted text-[9px] mt-1">可编辑日期、体重和体脂，修改后自动保存。</p></div><span className="text-muted text-[11px]">最近 {weights.length} 次记录</span></div>{weights.length === 0 ? <p className="text-muted text-center py-8">修改今日测量后，这里会出现趋势</p> : <><div className="h-40 flex items-end gap-3 border-b border-border px-2">{weights.map((item) => { const height = 28 + ((item.weightKg - min) / Math.max(1, max - min)) * 82; return <div key={item.id} className="flex-1 h-full flex flex-col justify-end items-center gap-2"><span className="text-[10px] text-text">{item.weightKg}</span><div className="w-full max-w-12 rounded-t bg-gradient-to-t from-sky/45 to-sky" style={{ height }}/><span className="text-[9px] text-muted pb-2">{item.date.slice(5)}</span></div>; })}</div><div className="mt-4 space-y-2">{recentWeights.map((item) => <div key={item.id} className="rounded-lg border border-border/70 bg-black/10 p-3">{editingWeight?.id === item.id ? <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"><label><span className="label">日期</span><input className="field" type="date" value={editingWeight.date} onChange={(event) => setEditingWeight({ ...editingWeight, date: event.target.value })}/></label><label><span className="label">体重 kg</span><input className="field" type="number" step=".1" value={editingWeight.weightKg} onChange={(event) => setEditingWeight({ ...editingWeight, weightKg: event.target.value })}/></label><label><span className="label">体脂 %</span><input className="field" type="number" step=".1" value={editingWeight.bodyFat} onChange={(event) => setEditingWeight({ ...editingWeight, bodyFat: event.target.value })}/></label><div className="flex items-center gap-2 pb-1"><SaveStatus status={editStatus}/><button className="btn-quiet !p-2" onClick={() => setEditingWeight(null)} aria-label="关闭编辑"><X size={14}/></button></div></div> : <div className="flex items-center gap-3"><div className="flex-1"><strong>{item.weightKg} kg</strong><span className="text-muted text-[10px] ml-3">{item.date}{item.bodyFat ? ` · 体脂 ${item.bodyFat}%` : ""}</span></div><button className="btn-quiet !p-2" onClick={() => { setEditStatus("idle"); setEditingWeight({ id: item.id, date: item.date, weightKg: String(item.weightKg), bodyFat: item.bodyFat ? String(item.bodyFat) : "" }); }} aria-label="编辑体重记录"><Pencil size={13}/></button><button className="text-muted hover:text-red-300 p-2 disabled:opacity-50" disabled={Boolean(deletingWeightId)} onClick={() => removeWeight(item)} aria-label="删除体重记录"><Trash2 size={13}/></button></div>}</div>)}</div></>}</section>
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
