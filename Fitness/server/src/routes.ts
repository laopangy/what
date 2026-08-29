import { Router } from "express";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { readState, writeState } from "./storage.js";
import { calculateFood, foodCatalog } from "./foodCalculator.js";

export const fitnessRouter = Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const profileSchema = z.object({
  name: z.string().trim().min(1).max(30), sex: z.enum(["male", "female"]), age: z.number().int().min(14).max(100),
  heightCm: z.number().min(100).max(250), weightKg: z.number().min(30).max(350), activityLevel: z.number().min(1.2).max(2),
  goal: z.enum(["gain", "lose", "maintain"]),
});
const mealSchema = z.object({
  date, mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]), name: z.string().trim().min(1).max(80),
  amount: z.string().trim().min(1).max(40), calories: z.number().min(0).max(10000), protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(2000), fat: z.number().min(0).max(1000),
});
const workoutSchema = z.object({
  sessionId: z.string(), date, durationMinutes: z.number().int().min(1).max(600), notes: z.string().max(300).default(""),
  distanceKm: z.number().min(0).max(10000).optional(), elevationM: z.number().min(0).max(100000).optional(),
  sets: z.array(z.object({ exerciseId: z.string(), exerciseName: z.string(), setNumber: z.number().int().positive(), weightKg: z.number().min(0).max(1000), reps: z.number().int().min(0).max(1000) })).max(100),
});

fitnessRouter.get("/state", (_req, res) => res.json(readState()));

fitnessRouter.get("/foods", (_req, res) => res.json(foodCatalog.map((food) => food.name)));

fitnessRouter.post("/foods/calculate", (req, res) => {
  const parsed = z.object({ query: z.string().trim().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "请输入食物名称和分量" });
  const result = calculateFood(parsed.data.query);
  if (!result) return res.status(404).json({ success: false, error: "暂时没有找到这种食物，可手动填写营养数据" });
  return res.json(result);
});

fitnessRouter.post("/sessions", (req, res) => {
  const optionalText = z.string().trim().max(120).optional();
  const parsed = z.object({
    name: z.string().trim().min(1).max(60), activityType: z.enum(["daily", "strength", "cycling", "running", "hiking", "other"]),
    weekday: z.number().int().min(0).max(6), focus: z.string().trim().min(1).max(120),
    targetDurationMinutes: z.number().int().min(0).max(1440), targetDistanceKm: z.number().min(0).max(10000).optional(),
    targetElevationM: z.number().min(0).max(100000).optional(),
    wakeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), sleepTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    breakfast: optionalText, lunch: optionalText, dinner: optionalText, snack: optionalText,
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "计划格式不正确" });
  const state = readState();
  const session = { id: uuid(), ...parsed.data, exercises: [], custom: true };
  state.plan.sessions.push(session); writeState(state);
  return res.status(201).json(session);
});

fitnessRouter.delete("/sessions/:id", (req, res) => {
  const state = readState();
  const session = state.plan.sessions.find((item) => item.id === req.params.id);
  if (!session) return res.status(404).json({ success: false, error: "计划不存在" });
  state.plan.sessions = state.plan.sessions.filter((item) => item.id !== req.params.id); writeState(state);
  return res.json({ success: true });
});

fitnessRouter.put("/profile", (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "资料格式不正确" });
  const state = readState();
  const input = parsed.data;
  const bmr = input.sex === "male" ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5 : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;
  const adjustment = input.goal === "gain" ? 250 : input.goal === "lose" ? -350 : 0;
  const calories = Math.max(1200, Math.round((bmr * input.activityLevel + adjustment) / 10) * 10);
  const protein = Math.round(input.weightKg * (input.goal === "gain" ? 2 : 1.8));
  const fat = Math.round(input.weightKg * 0.9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  state.profile = { ...input, calorieTarget: calories, proteinTarget: protein, carbsTarget: carbs, fatTarget: fat, waterTarget: Math.round(input.weightKg * 35 / 50) * 50 };
  writeState(state);
  return res.json(state.profile);
});

fitnessRouter.post("/meals", (req, res) => {
  const parsed = mealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "饮食记录格式不正确" });
  const state = readState();
  const meal = { id: uuid(), ...parsed.data, createdAt: new Date().toISOString() };
  state.meals.unshift(meal); writeState(state);
  return res.status(201).json(meal);
});

fitnessRouter.delete("/meals/:id", (req, res) => {
  const state = readState();
  const next = state.meals.filter((meal) => meal.id !== req.params.id);
  if (next.length === state.meals.length) return res.status(404).json({ success: false, error: "记录不存在" });
  state.meals = next; writeState(state);
  return res.json({ success: true });
});

fitnessRouter.post("/workouts", (req, res) => {
  const parsed = workoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "训练记录格式不正确" });
  const state = readState();
  const session = state.plan.sessions.find((item) => item.id === parsed.data.sessionId);
  if (!session) return res.status(404).json({ success: false, error: "训练日不存在" });
  const log = { id: uuid(), sessionName: session.name, activityType: session.activityType, ...parsed.data };
  state.workoutLogs.unshift(log); writeState(state);
  return res.status(201).json(log);
});

fitnessRouter.post("/weights", (req, res) => {
  const parsed = z.object({ date, weightKg: z.number().min(30).max(350), bodyFat: z.number().min(1).max(70).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "身体数据格式不正确" });
  const state = readState();
  const entry = { id: uuid(), ...parsed.data };
  const existing = state.weights.findIndex((item) => item.date === entry.date);
  if (existing >= 0) state.weights[existing] = entry; else state.weights.unshift(entry);
  state.weights.sort((a, b) => b.date.localeCompare(a.date)); writeState(state);
  return res.status(201).json(entry);
});
