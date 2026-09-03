import { Router } from "express";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { readState, writeState } from "./storage.js";
import { calculateFoodWithAi, type FoodCalculation } from "./aiNutrition.js";
import { generateWeeklyPlan } from "./planGenerator.js";
import { calculateProfileTargets } from "./profileCalculator.js";
import { evaluateWeightTrend } from "./weightAdapter.js";
import type { FitnessState } from "./types.js";

export const fitnessRouter = Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const profileSchema = z.object({
  name: z.string().trim().min(1).max(30), sex: z.enum(["male", "female"]), age: z.number().int().min(14).max(100),
  heightCm: z.number().min(100).max(250), weightKg: z.number().min(30).max(350),
  goal: z.enum(["gain", "lose", "maintain"]),
  targetWeightKg: z.number().min(30).max(350).optional(), targetDate: date.optional(),
});
const refreshProfileTargets = (state: FitnessState) => { state.profile = calculateProfileTargets(state.profile, state.plan.sessions, state.planAdaptation?.calorieAdjustment || 0); };
const mealSchema = z.object({
  date, mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]), name: z.string().trim().min(1).max(80),
  amount: z.string().trim().min(1).max(40), calories: z.number().min(0).max(10000), protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(2000), fat: z.number().min(0).max(1000),
});
const weightSchema = z.object({ date, weightKg: z.number().min(30).max(350), bodyFat: z.number().min(1).max(70).optional() });
const workoutSchema = z.object({
  sessionId: z.string(), date, durationMinutes: z.number().int().min(1).max(600), notes: z.string().max(300).default(""),
  distanceKm: z.number().min(0).max(10000).optional(), elevationM: z.number().min(0).max(100000).optional(),
  sets: z.array(z.object({
    exerciseId: z.string(), exerciseName: z.string(), setNumber: z.number().int().positive(),
    trackingType: z.enum(["weight_reps", "reps", "duration"]).optional(), weightKg: z.number().min(0).max(1000).optional(),
    reps: z.number().int().min(0).max(10000).optional(), durationSeconds: z.number().int().min(1).max(86400).optional(),
  }).superRefine((value, context) => {
    if (value.trackingType === "duration" && value.durationSeconds === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["durationSeconds"], message: "请填写动作时长" });
    if (value.trackingType === "reps" && value.reps === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["reps"], message: "请填写动作次数" });
    if ((!value.trackingType || value.trackingType === "weight_reps") && (value.weightKg === undefined || value.reps === undefined)) context.addIssue({ code: z.ZodIssueCode.custom, message: "请填写重量和次数" });
  })).max(100),
});
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const planPreferencesSchema = z.object({
  returnMode: z.enum(["gentle", "standard"]), trainingLevel: z.enum(["beginner", "intermediate", "advanced"]), equipment: z.enum(["gym", "home", "none"]),
  workSchedule: z.enum(["five_day", "big_small"]), bigWeekStartDate: date, workStart: time, workEnd: time, latestWorkEnd: time,
  overtimeFrequency: z.enum(["rare", "sometimes", "frequent"]), commuteMinutes: z.number().int().min(0).max(240), workoutDurationMinutes: z.number().int().min(20).max(120),
  preferredTrainingTime: z.enum(["adaptive", "before_work", "after_work", "rest_day"]), availableWeekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  healthNotes: z.string().trim().min(1).max(200), breakfast: z.string().trim().max(120), lunches: z.array(z.string().trim().max(120)).length(7),
  dinner: z.string().trim().max(120), snack: z.string().trim().max(120),
}).superRefine((value, context) => {
  if (value.workSchedule === "big_small" && new Date(`${value.bigWeekStartDate}T12:00:00`).getDay() !== 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ["bigWeekStartDate"], message: "大周开始日期必须选择周一" });
});
const optionalText = z.string().trim().max(120).optional();
const plannedActivitySchema = z.object({
  id: z.string().min(1).max(80), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), name: z.string().trim().min(1).max(60),
  activityType: z.enum(["daily", "strength", "cycling", "running", "hiking", "other"]), durationMinutes: z.number().int().min(1).max(1440).optional(), notes: z.string().trim().max(120).optional(),
});
const exerciseSchema = z.object({
  id: z.string().min(1).max(80), name: z.string().trim().min(1).max(60), muscle: z.string().trim().min(1).max(40),
  sets: z.number().int().min(1).max(20), reps: z.string().trim().min(1).max(40), restSeconds: z.number().int().min(0).max(1800),
  trackingType: z.enum(["weight_reps", "reps", "duration"]).optional(), estimatedDurationMinutes: z.number().int().min(1).max(600).optional(),
});
const sessionSchema = z.object({
  name: z.string().trim().min(1).max(60), activityType: z.enum(["daily", "strength", "cycling", "running", "hiking", "other"]),
  weekday: z.number().int().min(0).max(6), scheduledDate: date.optional(), focus: z.string().trim().max(120),
  targetDurationMinutes: z.number().int().min(0).max(1440), targetDistanceKm: z.number().min(0).max(10000).optional(),
  targetElevationM: z.number().min(0).max(100000).optional(), breakfast: optionalText, lunch: optionalText, dinner: optionalText, snack: optionalText,
  activities: z.array(plannedActivitySchema).max(30).default([]), exercises: z.array(exerciseSchema).max(30).default([]),
});
const planMealKeys = ["breakfast", "lunch", "dinner", "snack"] as const;
const localDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};
const mealFromText = (query: string) => {
  const mealType = /早餐|早饭|早上|早晨/.test(query) ? "breakfast"
    : /午餐|午饭|中餐|中午/.test(query) ? "lunch"
      : /晚餐|晚饭|晚上/.test(query) ? "dinner"
        : /加餐|夜宵|宵夜/.test(query) ? "snack"
          : new Date().getHours() < 10 ? "breakfast" : new Date().getHours() < 15 ? "lunch" : new Date().getHours() < 21 ? "dinner" : "snack";
  const foodQuery = query
    .replace(/^(我)?\s*(今天)?\s*(早上|早晨|早餐|早饭|中午|午餐|午饭|中餐|晚上|晚餐|晚饭|夜宵|宵夜|加餐)?\s*(我)?\s*(吃了|吃的是|吃了点|喝了|喝的是)?\s*/u, "")
    .trim();
  return { mealType, foodQuery: foodQuery || query } as const;
};
const hasScheduleConflict = (sessions: FitnessState["plan"]["sessions"], candidate: z.infer<typeof sessionSchema>, excludedId?: string) => sessions.some((session) => {
  if (session.id === excludedId) return false;
  return candidate.scheduledDate
    ? session.scheduledDate === candidate.scheduledDate
    : !session.scheduledDate && session.weekday === candidate.weekday;
});
const scheduleConflictMessage = (session: z.infer<typeof sessionSchema>) => session.scheduledDate
  ? `${session.scheduledDate} 已有计划，请编辑原计划`
  : `该星期已有计划，请编辑原计划`;
type PlanMealNutritionEntry = readonly [
  (typeof planMealKeys)[number],
  { calories: number; protein: number; carbs: number; fat: number },
];
const estimatePlanMeals = async (
  session: Partial<Record<(typeof planMealKeys)[number], string>>,
  cache = new Map<string, Promise<FoodCalculation>>(),
) => {
  const entries = await Promise.all(planMealKeys.map(async (key): Promise<PlanMealNutritionEntry | null> => {
    const query = session[key]?.trim();
    if (!query) return null;
    let calculation = cache.get(query);
    if (!calculation) {
      calculation = calculateFoodWithAi(query);
      cache.set(query, calculation);
    }
    const result = await calculation;
    return [key, { calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat }];
  }));
  return Object.fromEntries(entries.filter((entry): entry is PlanMealNutritionEntry => entry !== null));
};

fitnessRouter.get("/state", async (_req, res) => res.json(await readState()));

fitnessRouter.put("/routine", async (req, res) => {
  const parsed = z.object({ wakeTime: time, sleepTime: time }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "作息时间格式不正确" });
  const state = await readState(); state.routine = parsed.data; await writeState(state);
  return res.json(state.routine);
});

fitnessRouter.post("/foods/calculate", async (req, res) => {
  const parsed = z.object({ query: z.string().trim().min(1).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "请输入食物名称和分量" });
  try {
    return res.json(await calculateFoodWithAi(parsed.data.query));
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 营养估算失败";
    return res.status(503).json({ success: false, error: message });
  }
});

fitnessRouter.post("/sessions/generate-week", async (req, res) => {
  const parsed = planPreferencesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "生成条件不完整" });
  const state = await readState();
  const mealCache = new Map<string, Promise<FoodCalculation>>();
  const sessions = await Promise.all(generateWeeklyPlan(state.profile, parsed.data).map(async (session) => ({
    id: uuid(), ...session, adaptationNote: state.planAdaptation?.message, mealNutrition: await estimatePlanMeals(session, mealCache),
  })));
  state.planPreferences = parsed.data;
  state.plan.name = `${state.profile.name}的个性化一周计划`;
  state.plan.sessions = [...state.plan.sessions.filter((session) => Boolean(session.scheduledDate) && !session.generated), ...sessions];
  refreshProfileTargets(state);
  await writeState(state);
  return res.status(201).json({ sessions, preferences: parsed.data });
});

fitnessRouter.post("/sessions", async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "计划格式不正确" });
  const state = await readState();
  if (hasScheduleConflict(state.plan.sessions, parsed.data)) return res.status(409).json({ success: false, error: scheduleConflictMessage(parsed.data) });
  const session = { id: uuid(), ...parsed.data, mealNutrition: await estimatePlanMeals(parsed.data), custom: true };
  state.plan.sessions.push(session); refreshProfileTargets(state); await writeState(state);
  return res.status(201).json(session);
});

fitnessRouter.put("/sessions/:id", async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "计划格式不正确" });
  const state = await readState();
  const index = state.plan.sessions.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ success: false, error: "计划不存在" });
  if (hasScheduleConflict(state.plan.sessions, parsed.data, req.params.id)) return res.status(409).json({ success: false, error: scheduleConflictMessage(parsed.data) });
  state.plan.sessions[index] = {
    ...state.plan.sessions[index], ...parsed.data,
    scheduledDate: parsed.data.scheduledDate,
    targetDistanceKm: parsed.data.targetDistanceKm, targetElevationM: parsed.data.targetElevationM,
    breakfast: parsed.data.breakfast || "", lunch: parsed.data.lunch || "", dinner: parsed.data.dinner || "", snack: parsed.data.snack || "",
    mealNutrition: await estimatePlanMeals(parsed.data),
    wakeTime: undefined, sleepTime: undefined,
  };
  refreshProfileTargets(state);
  await writeState(state);
  return res.json(state.plan.sessions[index]);
});

fitnessRouter.post("/sessions/bulk-delete", async (req, res) => {
  const parsed = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "请选择需要删除的计划" });
  const state = await readState();
  const selected = new Set(parsed.data.ids);
  const next = state.plan.sessions.filter((session) => !selected.has(session.id));
  const deleted = state.plan.sessions.length - next.length;
  if (deleted === 0) return res.status(404).json({ success: false, error: "所选计划不存在" });
  state.plan.sessions = next;
  refreshProfileTargets(state);
  await writeState(state);
  return res.json({ success: true, deleted });
});

fitnessRouter.delete("/sessions/:id", async (req, res) => {
  const state = await readState();
  const session = state.plan.sessions.find((item) => item.id === req.params.id);
  if (!session) return res.status(404).json({ success: false, error: "计划不存在" });
  state.plan.sessions = state.plan.sessions.filter((item) => item.id !== req.params.id); refreshProfileTargets(state); await writeState(state);
  return res.json({ success: true });
});

fitnessRouter.put("/profile", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "资料格式不正确" });
  const state = await readState();
  const input = parsed.data;
  state.profile = calculateProfileTargets(input, state.plan.sessions, state.planAdaptation?.calorieAdjustment || 0);
  await writeState(state);
  return res.json(state.profile);
});

fitnessRouter.post("/meals", async (req, res) => {
  const parsed = mealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "饮食记录格式不正确" });
  const state = await readState();
  const meal = { id: uuid(), ...parsed.data, createdAt: new Date().toISOString() };
  state.meals.unshift(meal); await writeState(state);
  return res.status(201).json(meal);
});

fitnessRouter.post("/meals/from-text", async (req, res) => {
  const parsed = z.object({ query: z.string().trim().min(1).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "请描述今天吃了什么" });
  try {
    const { mealType, foodQuery } = mealFromText(parsed.data.query);
    const calculation = await calculateFoodWithAi(foodQuery);
    const state = await readState();
    const meal = {
      id: uuid(), date: localDate(), mealType, name: calculation.name, amount: calculation.amount,
      calories: calculation.calories, protein: calculation.protein, carbs: calculation.carbs, fat: calculation.fat,
      createdAt: new Date().toISOString(),
    };
    state.meals.unshift(meal); await writeState(state);
    return res.status(201).json({ meal, calculation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 饮食记录失败";
    return res.status(503).json({ success: false, error: message });
  }
});

fitnessRouter.delete("/meals/:id", async (req, res) => {
  const state = await readState();
  const next = state.meals.filter((meal) => meal.id !== req.params.id);
  if (next.length === state.meals.length) return res.status(404).json({ success: false, error: "记录不存在" });
  state.meals = next; await writeState(state);
  return res.json({ success: true });
});

fitnessRouter.post("/workouts", async (req, res) => {
  const parsed = workoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "训练记录格式不正确" });
  const state = await readState();
  const session = state.plan.sessions.find((item) => item.id === parsed.data.sessionId);
  if (!session) return res.status(404).json({ success: false, error: "训练日不存在" });
  const log = { id: uuid(), sessionName: session.name, activityType: session.activityType, ...parsed.data };
  state.workoutLogs.unshift(log); await writeState(state);
  return res.status(201).json(log);
});

fitnessRouter.post("/weights", async (req, res) => {
  const parsed = weightSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "身体数据格式不正确" });
  const state = await readState();
  const entry = { id: uuid(), ...parsed.data };
  const existing = state.weights.findIndex((item) => item.date === entry.date);
  if (existing >= 0) state.weights[existing] = entry; else state.weights.unshift(entry);
  state.weights.sort((a, b) => b.date.localeCompare(a.date)); state.profile.weightKg = state.weights[0].weightKg; evaluateWeightTrend(state); await writeState(state);
  return res.status(201).json(entry);
});

fitnessRouter.put("/weights/:id", async (req, res) => {
  const parsed = weightSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "身体数据格式不正确" });
  const state = await readState();
  const index = state.weights.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ success: false, error: "体重记录不存在" });
  if (state.weights.some((item) => item.id !== req.params.id && item.date === parsed.data.date)) return res.status(409).json({ success: false, error: "该日期已有体重记录" });
  const entry = { id: req.params.id, ...parsed.data };
  state.weights[index] = entry;
  state.weights.sort((a, b) => b.date.localeCompare(a.date));
  state.profile.weightKg = state.weights[0].weightKg;
  evaluateWeightTrend(state);
  await writeState(state);
  return res.json(entry);
});

fitnessRouter.delete("/weights/:id", async (req, res) => {
  const state = await readState();
  const next = state.weights.filter((item) => item.id !== req.params.id);
  if (next.length === state.weights.length) return res.status(404).json({ success: false, error: "体重记录不存在" });
  state.weights = next;
  if (state.weights[0]) state.profile.weightKg = state.weights[0].weightKg;
  evaluateWeightTrend(state);
  await writeState(state);
  return res.json({ success: true });
});
