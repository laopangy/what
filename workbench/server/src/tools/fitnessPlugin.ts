import { AI_TIMEOUT_MS, createModuleClient } from "./moduleFetch.js";
import { isIsoDate, localDate, shiftDate, weekdayName, weekdayOf } from "./dates.js";
import type { ModuleToolPlugin } from "./types.js";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type TrackingType = "weight_reps" | "reps" | "duration";

interface Nutrition { calories: number; protein: number; carbs: number; fat: number }
interface MealEntry extends Nutrition { id: string; date: string; mealType: MealType; name: string; amount: string }
interface WeightEntry { date: string; weightKg: number; bodyFat?: number }
interface Exercise { id: string; name: string; muscle: string; sets: number; reps: string; trackingType?: TrackingType }
interface WorkoutSession {
  id: string; name: string; weekday: number; scheduledDate?: string; focus: string; activityType: string;
  targetDurationMinutes: number; targetDistanceKm?: number; targetElevationM?: number;
  breakfast?: string; lunch?: string; dinner?: string; snack?: string;
  activities?: { startTime: string; name: string; durationMinutes?: number }[];
  exercises: Exercise[];
}
interface WorkoutLog {
  sessionName: string; activityType: string; date: string; durationMinutes: number;
  distanceKm?: number; elevationM?: number; notes: string; sets: unknown[];
}
interface FitnessState {
  profile: {
    goal: string; targetWeightKg?: number; targetDate?: string; goalPaceStatus?: string; weightKg: number;
    mealCalorieTargets: Record<MealType, number>;
    calorieTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number; waterTarget: number;
  };
  planAdaptation?: { message: string; trendKg?: number };
  plan: { sessions: WorkoutSession[] };
  workoutLogs: WorkoutLog[];
  meals: MealEntry[];
  weights: WeightEntry[];
}
interface FoodCalculation extends Nutrition {
  name: string; amount: string; grams: number;
  items: (Nutrition & { name: string; amount: string; grams: number; note?: string })[];
  unmatched: string[]; note?: string;
}

const MEAL_NAMES: Record<MealType, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
const ACTIVITY_NAMES: Record<string, string> = {
  daily: "日常安排", strength: "力量训练", cycling: "骑行", running: "跑步", hiking: "爬山", other: "其他活动",
};
const GOAL_NAMES: Record<string, string> = { gain: "增肌", lose: "减脂", maintain: "保持" };
const PACE_NAMES: Record<string, string> = {
  unset: "未设置目标日期", on_track: "进度合理", too_fast: "目标过快", below_healthy_range: "低于健康范围", achieved: "已达成",
};
const ID_PATTERN = /^[\w-]{1,100}$/;

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;
const sum = (meals: Nutrition[]): Nutrition => {
  const total = meals.reduce(
    (acc, meal) => ({ calories: acc.calories + meal.calories, protein: acc.protein + meal.protein, carbs: acc.carbs + meal.carbs, fat: acc.fat + meal.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { calories: round1(total.calories), protein: round1(total.protein), carbs: round1(total.carbs), fat: round1(total.fat) };
};

function planForDate(sessions: WorkoutSession[], date: string): WorkoutSession | undefined {
  const weekday = weekdayOf(date);
  return sessions.find((session) => session.scheduledDate === date)
    ?? sessions.find((session) => !session.scheduledDate && session.weekday === weekday);
}

const describeMeal = (meal: MealEntry) => ({
  id: meal.id, date: meal.date, mealType: MEAL_NAMES[meal.mealType] ?? meal.mealType, name: meal.name, amount: meal.amount,
  calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat,
});
const describeLog = (log: WorkoutLog) => ({
  sessionName: log.sessionName, activityType: ACTIVITY_NAMES[log.activityType] ?? log.activityType,
  durationMinutes: log.durationMinutes, distanceKm: log.distanceKm, elevationM: log.elevationM,
  sets: log.sets.length, notes: log.notes || undefined,
});
const scheduleLabel = (session: WorkoutSession) => (session.scheduledDate
  ? `${session.scheduledDate}（${weekdayName(session.weekday)}）`
  : `每${weekdayName(session.weekday)}`);

function resolveDate(value: unknown, today: string): { date: string } | { error: string } {
  if (value === undefined || value === null || value === "") return { date: today };
  if (!isIsoDate(value)) return { error: "日期格式应为 YYYY-MM-DD" };
  if (value > today) return { error: "不能记录未来日期" };
  return { date: value };
}

const optionalNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

export function createFitnessPlugin({ baseUrl }: { baseUrl: string }): ModuleToolPlugin {
  const request = createModuleClient({ baseUrl, label: "肌肉大" });
  const readState = () => request<FitnessState>("GET", "/api/fitness/state");

  return {
    name: "fitness",
    label: "肌肉大",
    summary: "健身与饮食：查看今日热量和营养目标、训练计划、近期记录，记录饮食、体重和训练，估算食物热量",
    intent: /肌肉大|健身|训练|锻炼|撸铁|练了|有氧|卧推|深蹲|硬拉|饮食|热量|卡路里|大卡|千卡|蛋白质|碳水|脂肪|早餐|早饭|午餐|午饭|中饭|晚餐|晚饭|夜宵|加餐|零食|吃了|喝了|体重|称重|增肌|减脂|\d+(?:\.\d+)?\s*(?:斤|kg|公斤)/i,
    prompt: `肌肉大模块使用提示：
- 用户说吃了什么并希望记录时用 fitness_log_meal；只是问某样食物的热量时用 fitness_estimate_food，不要记录。
- “今天还能吃多少”“今天吃了多少”等问题先用 fitness_today 查询，再根据剩余热量和营养回答。
- 记录体重时，用户说“斤”要换算成公斤（1 斤 = 0.5 公斤）。
- 删除饮食记录前先用 fitness_today 找到那条记录的 id。
- 训练计划、个人资料和目标只能查看，不能修改。`,
    tools: [
      {
        name: "fitness_today",
        label: "今日概况",
        risk: "read",
        description: "查看某天（默认今天）的饮食记录、已摄入和剩余的热量与营养、当天训练计划和训练记录、最近体重与目标进度。",
        input_schema: {
          type: "object",
          properties: { date: { type: "string", description: "日期 YYYY-MM-DD，默认今天" } },
        },
      },
      {
        name: "fitness_history",
        label: "近期记录",
        risk: "read",
        description: "查看最近若干天每天的热量与营养摄入、训练和体重，只列出有记录的日期。",
        input_schema: {
          type: "object",
          properties: { days: { type: "number", description: "天数，默认 7，最多 31" } },
        },
      },
      {
        name: "fitness_plan",
        label: "训练计划",
        risk: "read",
        description: "查看当前训练计划：每周固定安排和指定日期的安排，以及每个训练日的动作。",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "fitness_estimate_food",
        label: "估算热量",
        risk: "read",
        description: "估算食物的热量和三大营养素，只计算不记录。",
        input_schema: {
          type: "object",
          properties: { query: { type: "string", description: "食物和分量，例如“牛肉面一碗、可乐一罐”" } },
          required: ["query"],
        },
      },
      {
        name: "fitness_log_meal",
        label: "记录饮食",
        risk: "write",
        description: "根据描述记录一餐饮食，会自动估算营养并写入饮食记录。",
        input_schema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "吃了什么和分量，开头带上餐次词（早餐/午餐/晚餐/加餐），例如“午餐 牛肉面一碗”；用户没说餐次时按当前时间选择合适的餐次词",
            },
            date: { type: "string", description: "日期 YYYY-MM-DD，默认今天，不能是未来日期" },
          },
          required: ["text"],
        },
      },
      {
        name: "fitness_log_weight",
        label: "记录体重",
        risk: "write",
        description: "记录体重（公斤），同一天已有记录时会替换为新数值。",
        input_schema: {
          type: "object",
          properties: {
            weightKg: { type: "number", description: "体重（公斤），30-350" },
            bodyFat: { type: "number", description: "体脂率（%），可选" },
            date: { type: "string", description: "日期 YYYY-MM-DD，默认今天，不能是未来日期" },
          },
          required: ["weightKg"],
        },
      },
      {
        name: "fitness_log_workout",
        label: "记录训练",
        risk: "write",
        description: "记录一次训练或运动。默认使用该日期计划中的训练日；sets 可选，用于记录力量动作每组的数据，exerciseId 来自 fitness_today 或 fitness_plan 返回的动作 id。",
        input_schema: {
          type: "object",
          properties: {
            date: { type: "string", description: "日期 YYYY-MM-DD，默认今天，不能是未来日期" },
            sessionId: { type: "string", description: "训练日 id，可选，默认使用该日期计划中的训练日" },
            durationMinutes: { type: "number", description: "运动时长（分钟），1-600" },
            distanceKm: { type: "number", description: "距离（公里），骑行、跑步等可选" },
            elevationM: { type: "number", description: "爬升（米），可选" },
            notes: { type: "string", description: "备注，可选" },
            sets: {
              type: "array",
              description: "可选，每组数据",
              items: {
                type: "object",
                properties: {
                  exerciseId: { type: "string" },
                  setNumber: { type: "number" },
                  weightKg: { type: "number" },
                  reps: { type: "number" },
                  durationSeconds: { type: "number" },
                },
                required: ["exerciseId", "setNumber"],
              },
            },
          },
          required: ["durationMinutes"],
        },
      },
      {
        name: "fitness_delete_meal",
        label: "删除饮食记录",
        risk: "confirm",
        description: "删除一条饮食记录，mealId 来自 fitness_today 返回的 meals[].id。",
        input_schema: {
          type: "object",
          properties: { mealId: { type: "string", description: "饮食记录 id" } },
          required: ["mealId"],
        },
      },
    ],

    async prepare(name, args) {
      if (name !== "fitness_delete_meal") return { result: { error: `未知工具：${name}` } };
      const mealId = String(args.mealId ?? "");
      if (!ID_PATTERN.test(mealId)) return { result: { error: "饮食记录 id 不正确" } };
      const state = await readState();
      if (!state.ok) return { result: { error: state.error } };
      const meal = state.data.meals.find((item) => item.id === mealId);
      if (!meal) return { result: { error: "这条饮食记录不存在，可能已被删除" } };
      return {
        summary: `删除 ${meal.date} ${MEAL_NAMES[meal.mealType] ?? meal.mealType}「${meal.name} ${meal.amount}」（${round1(meal.calories)} kcal）`,
      };
    },

    async execute(name, args) {
      const today = localDate();

      switch (name) {
        case "fitness_today": {
          const resolved = args.date === undefined || args.date === "" ? { date: today } : isIsoDate(args.date) ? { date: args.date } : null;
          if (!resolved) return { error: "日期格式应为 YYYY-MM-DD" };
          const state = await readState();
          if (!state.ok) return { error: state.error };
          const { profile, plan, meals, workoutLogs, weights, planAdaptation } = state.data;
          const dayMeals = meals.filter((meal) => meal.date === resolved.date);
          const intake = sum(dayMeals);
          const session = planForDate(plan.sessions, resolved.date);
          const latestWeight = weights[0];
          return {
            date: resolved.date,
            weekday: weekdayName(weekdayOf(resolved.date)),
            targets: {
              calories: profile.calorieTarget, protein: profile.proteinTarget, carbs: profile.carbsTarget,
              fat: profile.fatTarget, waterMl: profile.waterTarget,
              mealCalories: Object.fromEntries(
                Object.entries(profile.mealCalorieTargets ?? {}).map(([key, value]) => [MEAL_NAMES[key as MealType] ?? key, value]),
              ),
            },
            intake,
            remaining: {
              calories: round1(profile.calorieTarget - intake.calories), protein: round1(profile.proteinTarget - intake.protein),
              carbs: round1(profile.carbsTarget - intake.carbs), fat: round1(profile.fatTarget - intake.fat),
            },
            meals: dayMeals.map(describeMeal),
            plannedSession: session && {
              id: session.id, name: session.name, schedule: scheduleLabel(session), focus: session.focus,
              activityType: ACTIVITY_NAMES[session.activityType] ?? session.activityType,
              targetDurationMinutes: session.targetDurationMinutes, targetDistanceKm: session.targetDistanceKm,
              targetElevationM: session.targetElevationM,
              suggestedMeals: { 早餐: session.breakfast || undefined, 午餐: session.lunch || undefined, 晚餐: session.dinner || undefined, 加餐: session.snack || undefined },
              activities: session.activities?.map((item) => ({ startTime: item.startTime, name: item.name, durationMinutes: item.durationMinutes })),
              exercises: session.exercises.map((item) => ({
                id: item.id, name: item.name, muscle: item.muscle, sets: item.sets, reps: item.reps, trackingType: item.trackingType ?? "weight_reps",
              })),
            },
            workouts: workoutLogs.filter((log) => log.date === resolved.date).map(describeLog),
            latestWeight: latestWeight
              ? { date: latestWeight.date, weightKg: latestWeight.weightKg, bodyFat: latestWeight.bodyFat }
              : { weightKg: profile.weightKg },
            goal: {
              goal: GOAL_NAMES[profile.goal] ?? profile.goal, targetWeightKg: profile.targetWeightKg, targetDate: profile.targetDate,
              pace: profile.goalPaceStatus ? PACE_NAMES[profile.goalPaceStatus] ?? profile.goalPaceStatus : undefined,
            },
            adaptation: planAdaptation ? { message: planAdaptation.message, trendKg: planAdaptation.trendKg } : undefined,
          };
        }

        case "fitness_history": {
          const days = Math.min(31, Math.max(1, Math.trunc(optionalNumber(args.days) ?? 7)));
          const state = await readState();
          if (!state.ok) return { error: state.error };
          const { meals, workoutLogs, weights, profile } = state.data;
          const history = [];
          for (let offset = 0; offset < days; offset++) {
            const date = shiftDate(today, -offset);
            const dayMeals = meals.filter((meal) => meal.date === date);
            const workouts = workoutLogs.filter((log) => log.date === date);
            const weight = weights.find((entry) => entry.date === date);
            if (dayMeals.length === 0 && workouts.length === 0 && !weight) continue;
            history.push({
              date,
              intake: dayMeals.length > 0 ? sum(dayMeals) : undefined,
              workouts: workouts.length > 0 ? workouts.map((log) => `${log.sessionName} ${log.durationMinutes} 分钟`) : undefined,
              weightKg: weight?.weightKg,
            });
          }
          return { days, calorieTarget: profile.calorieTarget, proteinTarget: profile.proteinTarget, history };
        }

        case "fitness_plan": {
          const state = await readState();
          if (!state.ok) return { error: state.error };
          const sessions = [...state.data.plan.sessions].sort((a, b) => (a.scheduledDate && b.scheduledDate
            ? a.scheduledDate.localeCompare(b.scheduledDate)
            : a.scheduledDate ? 1 : b.scheduledDate ? -1 : a.weekday - b.weekday));
          return {
            sessions: sessions.map((session) => ({
              id: session.id, name: session.name, schedule: scheduleLabel(session), focus: session.focus,
              activityType: ACTIVITY_NAMES[session.activityType] ?? session.activityType,
              targetDurationMinutes: session.targetDurationMinutes,
              exercises: session.exercises.map((item) => `${item.name} ${item.sets}组×${item.reps}`),
            })),
          };
        }

        case "fitness_estimate_food": {
          const query = String(args.query ?? "").trim();
          if (!query) return { error: "请说明食物和分量" };
          const result = await request<FoodCalculation>("POST", "/api/fitness/foods/calculate", {
            body: { query: query.slice(0, 500) }, timeoutMs: AI_TIMEOUT_MS,
          });
          if (!result.ok) return { error: result.error };
          const food = result.data;
          return {
            name: food.name, amount: food.amount, grams: food.grams,
            calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat,
            items: food.items.map((item) => ({
              name: item.name, amount: item.amount, grams: item.grams, calories: item.calories,
              protein: item.protein, carbs: item.carbs, fat: item.fat,
            })),
            unmatched: food.unmatched.length > 0 ? food.unmatched : undefined,
            note: food.note,
          };
        }

        case "fitness_log_meal": {
          const text = String(args.text ?? "").trim();
          if (!text) return { error: "请说明吃了什么" };
          const resolved = resolveDate(args.date, today);
          if ("error" in resolved) return resolved;
          const result = await request<{ meal: MealEntry; calculation: FoodCalculation }>("POST", "/api/fitness/meals/from-text", {
            body: { query: text.slice(0, 500), date: resolved.date }, timeoutMs: AI_TIMEOUT_MS,
          });
          if (!result.ok) return { error: result.error };
          const { meal, calculation } = result.data;
          return {
            logged: true,
            meal: describeMeal(meal),
            unmatched: calculation.unmatched.length > 0 ? calculation.unmatched : undefined,
            note: calculation.note,
            message: `已记录到 ${meal.date} ${MEAL_NAMES[meal.mealType] ?? meal.mealType}`,
          };
        }

        case "fitness_log_weight": {
          const weightKg = optionalNumber(args.weightKg);
          if (weightKg === undefined || weightKg < 30 || weightKg > 350) return { error: "体重应在 30-350 公斤之间" };
          const bodyFat = optionalNumber(args.bodyFat);
          if (bodyFat !== undefined && (bodyFat < 1 || bodyFat > 70)) return { error: "体脂率应在 1-70% 之间" };
          const resolved = resolveDate(args.date, today);
          if ("error" in resolved) return resolved;
          const state = await readState();
          if (!state.ok) return { error: state.error };
          const previous = state.data.weights.find((entry) => entry.date === resolved.date);
          const result = await request<WeightEntry>("POST", "/api/fitness/weights", {
            body: { date: resolved.date, weightKg: round1(weightKg), ...(bodyFat === undefined ? {} : { bodyFat: round1(bodyFat) }) },
          });
          if (!result.ok) return { error: result.error };
          return {
            logged: true, date: result.data.date, weightKg: result.data.weightKg, bodyFat: result.data.bodyFat,
            replacedWeightKg: previous?.weightKg,
            message: previous ? `已把 ${resolved.date} 的体重从 ${previous.weightKg} 公斤更新为 ${result.data.weightKg} 公斤` : `已记录 ${resolved.date} 的体重`,
          };
        }

        case "fitness_log_workout": {
          const resolved = resolveDate(args.date, today);
          if ("error" in resolved) return resolved;
          const durationMinutes = optionalNumber(args.durationMinutes);
          if (durationMinutes === undefined || durationMinutes < 1 || durationMinutes > 600) return { error: "运动时长应在 1-600 分钟之间" };
          const state = await readState();
          if (!state.ok) return { error: state.error };
          const sessionId = typeof args.sessionId === "string" && args.sessionId ? args.sessionId : undefined;
          const session = sessionId
            ? state.data.plan.sessions.find((item) => item.id === sessionId)
            : planForDate(state.data.plan.sessions, resolved.date);
          if (!session) {
            return { error: sessionId ? "训练日不存在，请先用 fitness_plan 查看" : "该日期没有对应的训练计划，请指定训练日或先在肌肉大中添加计划" };
          }

          const rawSets = Array.isArray(args.sets) ? args.sets.slice(0, 100) : [];
          const sets = [];
          for (const raw of rawSets) {
            const item = (raw ?? {}) as Record<string, unknown>;
            const exercise = session.exercises.find((entry) => entry.id === item.exerciseId);
            if (!exercise) return { error: `动作 ${String(item.exerciseId)} 不在训练日「${session.name}」中` };
            const trackingType = exercise.trackingType ?? "weight_reps";
            const weightKg = optionalNumber(item.weightKg);
            const reps = optionalNumber(item.reps);
            const durationSeconds = optionalNumber(item.durationSeconds);
            if (trackingType === "duration" && durationSeconds === undefined) return { error: `「${exercise.name}」需要填写每组时长` };
            if (trackingType === "reps" && reps === undefined) return { error: `「${exercise.name}」需要填写每组次数` };
            if (trackingType === "weight_reps" && (weightKg === undefined || reps === undefined)) return { error: `「${exercise.name}」需要填写每组重量和次数` };
            sets.push({
              exerciseId: exercise.id, exerciseName: exercise.name, setNumber: Math.max(1, Math.trunc(optionalNumber(item.setNumber) ?? sets.length + 1)),
              trackingType, weightKg, reps: reps === undefined ? undefined : Math.trunc(reps),
              durationSeconds: durationSeconds === undefined ? undefined : Math.trunc(durationSeconds),
            });
          }

          const result = await request<WorkoutLog>("POST", "/api/fitness/workouts", {
            body: {
              sessionId: session.id, date: resolved.date, durationMinutes: Math.round(durationMinutes),
              notes: String(args.notes ?? "").slice(0, 300),
              distanceKm: optionalNumber(args.distanceKm), elevationM: optionalNumber(args.elevationM), sets,
            },
          });
          if (!result.ok) return { error: result.error };
          return {
            logged: true, date: result.data.date, sessionName: result.data.sessionName,
            durationMinutes: result.data.durationMinutes, sets: sets.length,
            message: `已记录 ${result.data.date}「${result.data.sessionName}」${result.data.durationMinutes} 分钟`,
          };
        }

        case "fitness_delete_meal": {
          const mealId = String(args.mealId ?? "");
          if (!ID_PATTERN.test(mealId)) return { error: "饮食记录 id 不正确" };
          const result = await request("DELETE", `/api/fitness/meals/${encodeURIComponent(mealId)}`);
          if (!result.ok) return { error: result.error };
          return { deleted: true, message: "已删除这条饮食记录" };
        }

        default:
          return { error: `未知工具：${name}` };
      }
    },
  };
}
