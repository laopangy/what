import type { Exercise, PlanPreferences, Profile, WorkoutSession } from "./types.js";

type GeneratedSession = Omit<WorkoutSession, "id">;

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const addMinutes = (value: string, minutes: number) => {
  const [hour, minute] = value.split(":").map(Number);
  const total = (hour * 60 + minute + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const addDays = (value: string, days: number) => {
  const result = new Date(`${value}T12:00:00`);
  result.setDate(result.getDate() + days);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
};
const localToday = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};
const weekdayOf = (value: string) => new Date(`${value}T12:00:00`).getDay();
const mondayOf = (value: string) => addDays(value, -((weekdayOf(value) + 6) % 7));
const calendarDaysBetween = (from: string, to: string) => {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000);
};

const exercise = (id: string, name: string, muscle: string, sets: number, reps: string, restSeconds = 90): Exercise => ({ id, name, muscle, sets, reps, restSeconds });

const templates = {
  gym: [
    { name: "上肢综合", focus: "胸、背、肩和手臂", exercises: [exercise("bench", "杠铃卧推", "胸 / 肱三头", 3, "8–12"), exercise("row", "坐姿划船", "背 / 肱二头", 3, "8–12"), exercise("shoulder", "坐姿肩推", "肩", 3, "8–12"), exercise("pulldown", "高位下拉", "背阔肌", 3, "10–12"), exercise("lateral", "哑铃侧平举", "肩", 2, "12–15", 60)] },
    { name: "下肢与核心", focus: "股四头、臀腿和核心", exercises: [exercise("squat", "杠铃深蹲", "腿 / 臀", 3, "8–12", 120), exercise("rdl", "罗马尼亚硬拉", "臀腿", 3, "8–12", 120), exercise("lunge", "哑铃箭步蹲", "腿 / 臀", 3, "每侧10次"), exercise("calf", "站姿提踵", "小腿", 3, "12–15", 60), exercise("plank", "平板支撑", "核心", 3, "30–60秒", 60)] },
    { name: "全身训练", focus: "全身主要肌群", exercises: [exercise("goblet", "高脚杯深蹲", "腿 / 臀", 3, "10–12"), exercise("db-bench", "哑铃卧推", "胸", 3, "8–12"), exercise("cable-row", "绳索划船", "背", 3, "10–12"), exercise("hip-thrust", "臀推", "臀", 3, "10–12"), exercise("dead-bug", "死虫式", "核心", 3, "每侧10次", 60)] },
    { name: "上肢强化", focus: "上肢力量与肌肉", exercises: [exercise("incline", "上斜哑铃卧推", "上胸", 3, "8–12"), exercise("pullup", "辅助引体向上", "背", 3, "6–10"), exercise("arnold", "阿诺德推举", "肩", 3, "8–12"), exercise("curl", "哑铃弯举", "肱二头", 2, "10–15", 60), exercise("pushdown", "绳索下压", "肱三头", 2, "10–15", 60)] },
    { name: "下肢强化", focus: "下肢力量与稳定", exercises: [exercise("leg-press", "腿举", "腿", 3, "10–15"), exercise("split-squat", "保加利亚分腿蹲", "腿 / 臀", 3, "每侧8–12次"), exercise("leg-curl", "腿弯举", "腘绳肌", 3, "10–15"), exercise("back-extension", "罗马椅挺身", "后链", 3, "10–15"), exercise("side-plank", "侧平板支撑", "核心", 3, "每侧30秒", 60)] },
  ],
  home: [
    { name: "居家上肢", focus: "胸、背、肩和手臂", exercises: [exercise("pushup", "俯卧撑", "胸 / 肱三头", 3, "保留2次余力"), exercise("band-row", "弹力带划船", "背", 3, "10–15"), exercise("pike", "折刀俯卧撑", "肩", 3, "8–12"), exercise("band-pull", "弹力带拉开", "上背", 3, "12–20", 60)] },
    { name: "居家下肢", focus: "腿、臀和核心", exercises: [exercise("body-squat", "自重深蹲", "腿 / 臀", 4, "12–20"), exercise("reverse-lunge", "反向箭步蹲", "腿 / 臀", 3, "每侧10次"), exercise("glute-bridge", "臀桥", "臀", 4, "12–20"), exercise("plank-home", "平板支撑", "核心", 3, "30–60秒", 60)] },
    { name: "居家全身", focus: "全身循环与体能", exercises: [exercise("split", "分腿蹲", "腿 / 臀", 3, "每侧10次"), exercise("pushup-2", "俯卧撑", "胸", 3, "保留2次余力"), exercise("band-row-2", "弹力带划船", "背", 3, "12–15"), exercise("bird-dog", "鸟狗式", "核心", 3, "每侧10次", 60)] },
  ],
  none: [
    { name: "徒手全身 A", focus: "动作基础与全身激活", exercises: [exercise("air-squat", "徒手深蹲", "腿 / 臀", 3, "12–20"), exercise("incline-pushup", "斜板俯卧撑", "胸", 3, "8–15"), exercise("glute", "臀桥", "臀", 3, "15–20"), exercise("deadbug", "死虫式", "核心", 3, "每侧10次", 60)] },
    { name: "徒手全身 B", focus: "单腿稳定与核心", exercises: [exercise("lunge-none", "反向箭步蹲", "腿 / 臀", 3, "每侧8–12次"), exercise("knee-pushup", "跪姿俯卧撑", "胸 / 手臂", 3, "8–15"), exercise("good-morning", "徒手早安式", "后链", 3, "15–20"), exercise("side-plank-none", "侧平板支撑", "核心", 3, "每侧20–40秒", 60)] },
    { name: "徒手全身 C", focus: "全身耐力与协调", exercises: [exercise("stepup", "台阶踏步", "腿 / 臀", 3, "每侧12次"), exercise("wall-pushup", "墙壁俯卧撑", "胸", 3, "12–20"), exercise("superman", "俯卧两头起", "背", 3, "10–15"), exercise("bird-dog-none", "鸟狗式", "核心", 3, "每侧10次", 60)] },
  ],
} as const;

export function generateWeeklyPlan(profile: Profile, preferences: PlanPreferences, startDate = localToday()): GeneratedSession[] {
  const standardTrainingDays = preferences.trainingLevel === "beginner" ? 3 : preferences.trainingLevel === "intermediate" ? 4 : 5;
  const sourceTemplates = templates[preferences.equipment];
  const isAlternating = preferences.workSchedule === "big_small";
  const days = Array.from({ length: isAlternating ? 14 : 7 }, (_, index) => {
    const scheduledDate = addDays(startDate, index);
    const weekIndex = Math.floor(index / 7);
    const weekday = weekdayOf(scheduledDate);
    const weeksFromKnownBigWeek = Math.floor(calendarDaysBetween(preferences.bigWeekStartDate, mondayOf(scheduledDate)) / 7);
    const isBigWeek = isAlternating && ((weeksFromKnownBigWeek % 2) + 2) % 2 === 0;
    const workday = weekday >= 1 && weekday <= 5 || isAlternating && isBigWeek && weekday === 6;
    return { weekday, weekIndex, isBigWeek, workday, scheduledDate };
  });
  const trainingKeys = new Set(days.flatMap((day, index) => {
    const desiredTrainingDays = preferences.returnMode === "gentle" ? day.weekIndex === 0 ? 2 : 3 : standardTrainingDays;
    const previousSameWeek = days.slice(day.weekIndex * 7, index).filter((candidate) => preferences.availableWeekdays.includes(candidate.weekday) && (preferences.preferredTrainingTime !== "rest_day" || !candidate.workday)).length;
    const eligible = preferences.availableWeekdays.includes(day.weekday) && (preferences.preferredTrainingTime !== "rest_day" || !day.workday);
    return eligible && previousSameWeek < desiredTrainingDays ? [`${day.weekIndex}-${day.weekday}`] : [];
  }));
  let trainingIndex = 0;

  return days.map(({ weekday, weekIndex, isBigWeek, workday, scheduledDate }) => {
    const isTrainingDay = trainingKeys.has(`${weekIndex}-${weekday}`);
    const template = sourceTemplates[trainingIndex % sourceTemplates.length];
    if (isTrainingDay) trainingIndex += 1;
    const afterWorkBase = preferences.overtimeFrequency === "rare" ? preferences.workEnd : preferences.latestWorkEnd;
    const workoutDuration = preferences.returnMode === "gentle" ? Math.min(40, preferences.workoutDurationMinutes) : preferences.workoutDurationMinutes;
    const useBeforeWork = preferences.preferredTrainingTime === "before_work" || preferences.preferredTrainingTime === "adaptive" && preferences.overtimeFrequency !== "rare";
    const trainingTime = workday
      ? useBeforeWork ? addMinutes(preferences.workStart, -(preferences.commuteMinutes + workoutDuration + 20)) : addMinutes(afterWorkBase, preferences.commuteMinutes + 30)
      : "10:00";
    const idSuffix = scheduledDate || String(weekday);
    const overtimeNote = preferences.overtimeFrequency === "rare" ? `通常 ${preferences.workEnd} 下班` : `通常 ${preferences.workEnd} 下班，加班最晚约 ${preferences.latestWorkEnd}`;
    const activities = [
      ...(workday ? [{ id: `work-start-${idSuffix}`, startTime: preferences.workStart, name: "上班", activityType: "daily" as const, notes: `单程通勤约 ${preferences.commuteMinutes} 分钟${weekday === 6 ? " · 大周周六" : ""}` }] : []),
      ...(isTrainingDay ? [{ id: `training-${idSuffix}`, startTime: trainingTime, name: preferences.returnMode === "gentle" ? `恢复训练 · ${template.name}` : template.name, activityType: "strength" as const, durationMinutes: workoutDuration, notes: `${workday && preferences.preferredTrainingTime === "after_work" ? "按最晚下班时间预留；未加班可提前。" : workday && useBeforeWork && preferences.preferredTrainingTime === "adaptive" ? "考虑加班不确定，自动安排在上班前。" : ""}${preferences.returnMode === "gentle" ? "先完成动作、不追求力竭；感觉轻松也不要额外加量。" : "每组保留约2次余力。"}热身5–10分钟，动作不适立即停止` }] : [{ id: `recovery-${idSuffix}`, startTime: workday ? addMinutes(afterWorkBase, preferences.commuteMinutes + 30) : "10:00", name: "轻松步行与舒展", activityType: "daily" as const, durationMinutes: preferences.returnMode === "gentle" ? weekIndex === 0 ? 15 : 20 : profile.goal === "lose" ? 45 : 30, notes: preferences.returnMode === "gentle" ? "只建立每天活动的习惯，不追求速度；疲劳时可缩短" : "轻松强度，以能正常交谈为准；加班过晚可取消" }]),
      ...(workday ? [{ id: `work-end-${idSuffix}`, startTime: preferences.latestWorkEnd, name: "最晚下班预留", activityType: "daily" as const, notes: overtimeNote }] : []),
    ];
    const goalText = profile.goal === "gain" ? "增肌" : profile.goal === "lose" ? `减脂${profile.targetWeightKg ? `至 ${profile.targetWeightKg}kg` : ""}${profile.targetDate ? `（目标 ${profile.targetDate}）` : ""}` : "维持体能";
    return {
      name: `${isAlternating ? `${isBigWeek ? "大周" : "小周"} · ` : ""}${weekdayNames[weekday]} · ${isTrainingDay ? template.name : workday ? "工作与恢复" : "主动恢复"}`,
      weekday,
      scheduledDate,
      generated: true,
      focus: `${preferences.returnMode === "gentle" ? `恢复第${weekIndex + 1}周 · ${goalText} · 先规律活动和正常吃饭，不要求严格控卡` : `${goalText} · 每日约 ${profile.calorieTarget} kcal / 蛋白质 ${profile.proteinTarget}g`} · ${workday ? overtimeNote : "休息日"}${preferences.healthNotes === "无" ? "" : ` · 注意：${preferences.healthNotes}`}`.slice(0, 120),
      activityType: isTrainingDay ? "strength" : "daily",
      targetDurationMinutes: isTrainingDay ? workoutDuration : 0,
      breakfast: preferences.breakfast || (preferences.returnMode === "gentle" ? "正常吃早餐，增加一份蛋白质（鸡蛋或牛奶）" : "鸡蛋2个 / 牛奶300毫升 / 燕麦50克"),
      lunch: preferences.lunches[weekday] || (preferences.returnMode === "gentle" ? "按平时吃，优先保证一份蛋白质和蔬菜，吃到七八分饱" : "米饭1碗 / 鸡胸肉200克 / 蔬菜300克"),
      dinner: preferences.dinner || (preferences.returnMode === "gentle" ? "正常吃晚餐，少一点油炸和含糖饮料，不要求称重" : "米饭1碗 / 瘦肉或鱼200克 / 蔬菜300克"),
      snack: preferences.snack || (preferences.returnMode === "gentle" ? "饿了再加餐：水果、牛奶或酸奶任选一种" : "酸奶200克 / 水果1份"),
      activities,
      exercises: isTrainingDay ? template.exercises.map((item) => ({ ...item, id: `${item.id}-${idSuffix}`, sets: preferences.returnMode === "gentle" ? Math.min(2, item.sets) : item.sets })) : [],
      custom: true,
    };
  });
}
