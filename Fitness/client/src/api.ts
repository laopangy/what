import type { FitnessState, FoodCalculation, MealEntry, Profile, WeightEntry, WorkoutLog, WorkoutSession } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `请求失败 (${response.status})`);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
export const api = {
  state: () => request<FitnessState>("/api/fitness/state"),
  calculateFood: (query: string) => request<FoodCalculation>("/api/fitness/foods/calculate", json("POST", { query })),
  addSession: (data: Pick<WorkoutSession, "name" | "activityType" | "weekday" | "focus" | "targetDurationMinutes" | "targetDistanceKm" | "targetElevationM" | "wakeTime" | "sleepTime" | "breakfast" | "lunch" | "dinner" | "snack">) => request<WorkoutSession>("/api/fitness/sessions", json("POST", data)),
  deleteSession: (id: string) => request<{ success: boolean }>(`/api/fitness/sessions/${id}`, { method: "DELETE" }),
  profile: (data: Pick<Profile, "name" | "sex" | "age" | "heightCm" | "weightKg" | "activityLevel" | "goal">) => request<Profile>("/api/fitness/profile", json("PUT", data)),
  addMeal: (data: Omit<MealEntry, "id" | "createdAt">) => request<MealEntry>("/api/fitness/meals", json("POST", data)),
  deleteMeal: (id: string) => request<{ success: boolean }>(`/api/fitness/meals/${id}`, { method: "DELETE" }),
  addWorkout: (data: Omit<WorkoutLog, "id" | "sessionName" | "activityType">) => request<WorkoutLog>("/api/fitness/workouts", json("POST", data)),
  addWeight: (data: Omit<WeightEntry, "id">) => request<WeightEntry>("/api/fitness/weights", json("POST", data)),
};
