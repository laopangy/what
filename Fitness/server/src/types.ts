export type FitnessGoal = "gain" | "lose" | "maintain";
export type ActivityType = "daily" | "strength" | "cycling" | "running" | "hiking" | "other";

export interface Profile {
  name: string;
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: number;
  goal: FitnessGoal;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  waterTarget: number;
}

export interface Exercise { id: string; name: string; muscle: string; sets: number; reps: string; restSeconds: number; }
export interface WorkoutSession {
  id: string;
  name: string;
  weekday: number;
  focus: string;
  activityType: ActivityType;
  targetDurationMinutes: number;
  targetDistanceKm?: number;
  targetElevationM?: number;
  wakeTime?: string;
  sleepTime?: string;
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  snack?: string;
  exercises: Exercise[];
  custom?: boolean;
}
export interface WorkoutPlan { id: string; name: string; sessions: WorkoutSession[]; }
export interface CompletedSet { exerciseId: string; exerciseName: string; setNumber: number; weightKg: number; reps: number; }
export interface WorkoutLog {
  id: string;
  sessionId: string;
  sessionName: string;
  activityType: ActivityType;
  date: string;
  durationMinutes: number;
  distanceKm?: number;
  elevationM?: number;
  notes: string;
  sets: CompletedSet[];
}
export interface MealEntry {
  id: string; date: string; mealType: "breakfast" | "lunch" | "dinner" | "snack"; name: string; amount: string;
  calories: number; protein: number; carbs: number; fat: number; createdAt: string;
}
export interface WeightEntry { id: string; date: string; weightKg: number; bodyFat?: number; }
export interface FitnessState { profile: Profile; plan: WorkoutPlan; workoutLogs: WorkoutLog[]; meals: MealEntry[]; weights: WeightEntry[]; }
