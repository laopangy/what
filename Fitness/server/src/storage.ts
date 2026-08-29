import { existsSync, readFileSync, writeFileSync } from "fs";
import { config } from "./config.js";
import type { FitnessState } from "./types.js";

const initialState: FitnessState = {
  profile: {
    name: "阿潘", sex: "male", age: 28, heightCm: 175, weightKg: 70, activityLevel: 1.45, goal: "gain",
    calorieTarget: 2550, proteinTarget: 140, carbsTarget: 330, fatTarget: 70, waterTarget: 2500,
  },
  routine: { wakeTime: "07:00", sleepTime: "23:00" },
  plan: {
    id: "starter-ppl",
    name: "增肌基础 · 每周三练",
    sessions: [
      {
        id: "push", name: "推 · 胸肩三头", weekday: 1, focus: "胸 / 肩 / 肱三头肌", activityType: "strength", targetDurationMinutes: 60,
        exercises: [
          { id: "bench-press", name: "杠铃卧推", muscle: "胸", sets: 4, reps: "6–10", restSeconds: 120 },
          { id: "incline-db", name: "上斜哑铃卧推", muscle: "上胸", sets: 3, reps: "8–12", restSeconds: 90 },
          { id: "shoulder-press", name: "坐姿肩推", muscle: "肩", sets: 3, reps: "8–12", restSeconds: 90 },
          { id: "lateral-raise", name: "哑铃侧平举", muscle: "肩", sets: 4, reps: "12–15", restSeconds: 60 },
          { id: "triceps-pushdown", name: "绳索下压", muscle: "肱三头", sets: 3, reps: "10–15", restSeconds: 60 }
        ]
      },
      {
        id: "pull", name: "拉 · 背部二头", weekday: 3, focus: "背 / 后束 / 肱二头肌", activityType: "strength", targetDurationMinutes: 60,
        exercises: [
          { id: "deadlift", name: "硬拉", muscle: "背链", sets: 3, reps: "5–8", restSeconds: 150 },
          { id: "lat-pulldown", name: "高位下拉", muscle: "背阔肌", sets: 4, reps: "8–12", restSeconds: 90 },
          { id: "row", name: "坐姿划船", muscle: "中背", sets: 3, reps: "8–12", restSeconds: 90 },
          { id: "face-pull", name: "面拉", muscle: "肩后束", sets: 3, reps: "12–15", restSeconds: 60 },
          { id: "curl", name: "哑铃弯举", muscle: "肱二头", sets: 3, reps: "10–12", restSeconds: 60 }
        ]
      },
      {
        id: "legs", name: "腿 · 下肢核心", weekday: 5, focus: "股四头 / 臀腿 / 核心", activityType: "strength", targetDurationMinutes: 65,
        exercises: [
          { id: "squat", name: "杠铃深蹲", muscle: "股四头", sets: 4, reps: "6–10", restSeconds: 150 },
          { id: "rdl", name: "罗马尼亚硬拉", muscle: "臀腿", sets: 3, reps: "8–12", restSeconds: 120 },
          { id: "leg-press", name: "腿举", muscle: "腿", sets: 3, reps: "10–15", restSeconds: 90 },
          { id: "calf-raise", name: "站姿提踵", muscle: "小腿", sets: 4, reps: "12–20", restSeconds: 60 },
          { id: "plank", name: "平板支撑", muscle: "核心", sets: 3, reps: "45–60秒", restSeconds: 60 }
        ]
      }
    ]
  },
  workoutLogs: [], meals: [], weights: [],
};

export function readState(): FitnessState {
  try {
    if (!existsSync(config.dataFile)) return structuredClone(initialState);
    const state = JSON.parse(readFileSync(config.dataFile, "utf8")) as FitnessState;
    const legacyRoutine = state.plan.sessions.find((session) => session.wakeTime || session.sleepTime);
    state.routine = state.routine || { wakeTime: legacyRoutine?.wakeTime || "07:00", sleepTime: legacyRoutine?.sleepTime || "23:00" };
    state.plan.sessions = state.plan.sessions.map((session) => ({
      ...session,
      activityType: session.activityType || "strength",
      targetDurationMinutes: session.targetDurationMinutes ?? 60,
      wakeTime: session.wakeTime || "",
      sleepTime: session.sleepTime || "",
      breakfast: session.breakfast || "",
      lunch: session.lunch || "",
      dinner: session.dinner || "",
      snack: session.snack || "",
      exercises: session.exercises || [],
    }));
    state.workoutLogs = state.workoutLogs.map((log) => ({ ...log, activityType: log.activityType || "strength", sets: log.sets || [] }));
    return state;
  } catch {
    return structuredClone(initialState);
  }
}

export function writeState(state: FitnessState): void {
  writeFileSync(config.dataFile, JSON.stringify(state, null, 2), "utf8");
}
