import type { DailyRoutine, FitnessState, FoodCalculation, MealEntry, PlanPreferences, Profile, WeightEntry, WorkoutLog, WorkoutSession } from "./types";

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
  routine: (data: DailyRoutine) => request<DailyRoutine>("/api/fitness/routine", json("PUT", data)),
  generateWeek: (data: PlanPreferences) => request<{ sessions: WorkoutSession[]; preferences: PlanPreferences }>("/api/fitness/sessions/generate-week", json("POST", data)),
  addSession: (data: Pick<WorkoutSession, "name" | "activityType" | "weekday" | "scheduledDate" | "focus" | "targetDurationMinutes" | "targetDistanceKm" | "targetElevationM" | "breakfast" | "lunch" | "dinner" | "snack" | "activities" | "exercises">) => request<WorkoutSession>("/api/fitness/sessions", json("POST", data)),
  updateSession: (id: string, data: Pick<WorkoutSession, "name" | "activityType" | "weekday" | "scheduledDate" | "focus" | "targetDurationMinutes" | "targetDistanceKm" | "targetElevationM" | "breakfast" | "lunch" | "dinner" | "snack" | "activities" | "exercises">) => request<WorkoutSession>(`/api/fitness/sessions/${id}`, json("PUT", data)),
  deleteSession: (id: string) => request<{ success: boolean }>(`/api/fitness/sessions/${id}`, { method: "DELETE" }),
  deleteSessions: (ids: string[]) => request<{ success: boolean; deleted: number }>("/api/fitness/sessions/bulk-delete", json("POST", { ids })),
  profile: (data: Pick<Profile, "name" | "sex" | "age" | "heightCm" | "weightKg" | "goal" | "targetWeightKg" | "targetDate">) => request<Profile>("/api/fitness/profile", json("PUT", data)),
  addMeal: (data: Omit<MealEntry, "id" | "createdAt">) => request<MealEntry>("/api/fitness/meals", json("POST", data)),
  addMealFromText: (query: string) => request<{ meal: MealEntry; calculation: FoodCalculation }>("/api/fitness/meals/from-text", json("POST", { query })),
  deleteMeal: (id: string) => request<{ success: boolean }>(`/api/fitness/meals/${id}`, { method: "DELETE" }),
  addWorkout: (data: Omit<WorkoutLog, "id" | "sessionName" | "activityType">) => request<WorkoutLog>("/api/fitness/workouts", json("POST", data)),
  addWeight: (data: Omit<WeightEntry, "id">) => request<WeightEntry>("/api/fitness/weights", json("POST", data)),
  updateWeight: (id: string, data: Omit<WeightEntry, "id">) => request<WeightEntry>(`/api/fitness/weights/${id}`, json("PUT", data)),
  deleteWeight: (id: string) => request<{ success: boolean }>(`/api/fitness/weights/${id}`, { method: "DELETE" }),
};
