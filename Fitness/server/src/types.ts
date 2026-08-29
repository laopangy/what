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

export type ExerciseTrackingType = "weight_reps" | "reps" | "duration";
export interface Exercise { id: string; name: string; muscle: string; sets: number; reps: string; restSeconds: number; trackingType?: ExerciseTrackingType; }
export type PlannedMealType = "breakfast" | "lunch" | "dinner" | "snack";
export interface NutritionEstimate { calories: number; protein: number; carbs: number; fat: number; }
export interface PlannedActivity { id: string; startTime: string; name: string; activityType: ActivityType; durationMinutes?: number; notes?: string; }
export interface WorkoutSession {
  id: string;
  name: string;
  weekday: number;
  scheduledDate?: string;
  generated?: boolean;
  adaptationNote?: string;
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
  mealNutrition?: Partial<Record<PlannedMealType, NutritionEstimate>>;
  activities?: PlannedActivity[];
  exercises: Exercise[];
  custom?: boolean;
}
export interface WorkoutPlan { id: string; name: string; sessions: WorkoutSession[]; }
export interface DailyRoutine { wakeTime: string; sleepTime: string; }
export interface PlanPreferences {
  returnMode: "gentle" | "standard";
  trainingLevel: "beginner" | "intermediate" | "advanced";
  equipment: "gym" | "home" | "none";
  workSchedule: "five_day" | "big_small";
  bigWeekStartDate: string;
  workStart: string;
  workEnd: string;
  latestWorkEnd: string;
  overtimeFrequency: "rare" | "sometimes" | "frequent";
  commuteMinutes: number;
  workoutDurationMinutes: number;
  preferredTrainingTime: "adaptive" | "before_work" | "after_work" | "rest_day";
  availableWeekdays: number[];
  healthNotes: string;
  breakfast: string;
  lunches: string[];
  dinner: string;
  snack: string;
}
export interface CompletedSet { exerciseId: string; exerciseName: string; setNumber: number; trackingType?: ExerciseTrackingType; weightKg?: number; reps?: number; durationSeconds?: number; }
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
export interface PlanAdaptation { status: "collecting" | "stable" | "adjusted"; message: string; evaluatedAt: string; measurements: number; trendKg?: number; calorieAdjustment: number; lastAdjustedDate?: string; }
export interface FitnessState { profile: Profile; routine: DailyRoutine; planPreferences?: PlanPreferences; planAdaptation?: PlanAdaptation; plan: WorkoutPlan; workoutLogs: WorkoutLog[]; meals: MealEntry[]; weights: WeightEntry[]; }
