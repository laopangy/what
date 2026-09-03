import type { Profile, WorkoutSession } from "./types.js";

const trainingTypes = new Set(["strength", "cycling", "running", "hiking"]);

export function analyzeActivityLevel(sessions: WorkoutSession[]): number {
  const recurring = sessions.filter((session) => !session.scheduledDate);
  const source = recurring.length > 0 ? recurring : sessions;
  const totalLoad = source.reduce((sum, session) => {
    const activities = session.activities || [];
    const hasTraining = session.exercises.length > 0 || trainingTypes.has(session.activityType) || activities.some((activity) => trainingTypes.has(activity.activityType));
    if (hasTraining) return sum + 1;
    const hasActiveRecovery = activities.some((activity) => activity.durationMinutes && activity.durationMinutes >= 20 && !["上班", "下班"].includes(activity.name));
    return sum + (hasActiveRecovery ? 0.35 : 0);
  }, 0);
  const weeklyLoad = totalLoad * Math.min(1, 7 / Math.max(1, source.length));
  if (weeklyLoad < 0.5) return 1.2;
  if (weeklyLoad < 3) return 1.375;
  if (weeklyLoad < 5.5) return 1.55;
  return 1.725;
}

const localDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};
const daysBetween = (from: string, to: string) => {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000);
};
const addDays = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
};

export function calculateProfileTargets(input: Pick<Profile, "name" | "sex" | "age" | "heightCm" | "weightKg" | "goal" | "targetWeightKg" | "targetDate">, sessions: WorkoutSession[], calorieAdjustment = 0): Profile {
  const activityLevel = analyzeActivityLevel(sessions);
  const bmr = input.sex === "male" ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5 : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;
  const maintenanceCalories = Math.round(bmr * activityLevel / 10) * 10;
  const today = localDate();
  const configuredLoss = input.goal === "lose" && input.targetWeightKg !== undefined && input.targetWeightKg < input.weightKg && Boolean(input.targetDate);
  const goalDurationDays = configuredLoss ? Math.max(1, daysBetween(today, input.targetDate!)) : undefined;
  const weightToLose = configuredLoss ? input.weightKg - input.targetWeightKg! : 0;
  const weeklyWeightChangeTarget = configuredLoss ? Number((weightToLose / goalDurationDays! * 7).toFixed(2)) : undefined;
  const requiredDailyCalorieDeficit = configuredLoss ? Math.round(weightToLose * 7700 / goalDurationDays! / 10) * 10 : undefined;
  const targetBmi = input.targetWeightKg ? input.targetWeightKg / ((input.heightCm / 100) ** 2) : undefined;
  const reachedTarget = input.goal === "lose" && input.targetWeightKg !== undefined && input.weightKg <= input.targetWeightKg;
  const belowHealthyTarget = input.goal === "lose" && targetBmi !== undefined && targetBmi < 18.5;
  const plannedBaseDeficit = reachedTarget || belowHealthyTarget ? 0 : configuredLoss ? Math.min(1000, requiredDailyCalorieDeficit!) : 350;
  const adjustment = input.goal === "gain" ? 250 : input.goal === "lose" ? -plannedBaseDeficit : 0;
  const calories = Math.max(1200, Math.round((bmr * activityLevel + adjustment + calorieAdjustment) / 10) * 10);
  const effectiveDeficit = Math.max(0, maintenanceCalories - calories);
  const projectedGoalDate = configuredLoss && effectiveDeficit > 0 ? addDays(today, Math.ceil(weightToLose * 7700 / effectiveDeficit)) : undefined;
  const goalPaceStatus: Profile["goalPaceStatus"] = input.goal !== "lose" || !input.targetWeightKg || !input.targetDate
    ? "unset"
    : reachedTarget
      ? "achieved"
      : belowHealthyTarget
        ? "below_healthy_range"
        : weeklyWeightChangeTarget !== undefined && weeklyWeightChangeTarget > 0.9
          ? "too_fast"
          : "on_track";
  const protein = Math.round(input.weightKg * (input.goal === "gain" ? 2 : 1.8));
  const fat = Math.round(input.weightKg * 0.9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const breakfastCalories = Math.round(calories * 0.25 / 10) * 10;
  const lunchCalories = Math.round(calories * 0.35 / 10) * 10;
  const dinnerCalories = Math.round(calories * 0.3 / 10) * 10;
  return {
    ...input,
    activityLevel,
    bmr: Math.round(bmr),
    maintenanceCalories,
    calorieGapTarget: calories - maintenanceCalories,
    ...(goalDurationDays !== undefined ? { goalDurationDays } : {}),
    ...(weeklyWeightChangeTarget !== undefined ? { weeklyWeightChangeTarget } : {}),
    ...(requiredDailyCalorieDeficit !== undefined ? { requiredDailyCalorieDeficit } : {}),
    ...(projectedGoalDate ? { projectedGoalDate } : {}),
    goalPaceStatus,
    mealCalorieTargets: { breakfast: breakfastCalories, lunch: lunchCalories, dinner: dinnerCalories, snack: Math.max(0, calories - breakfastCalories - lunchCalories - dinnerCalories) },
    calorieTarget: calories,
    proteinTarget: protein,
    carbsTarget: carbs,
    fatTarget: fat,
    waterTarget: Math.round(input.weightKg * 35 / 50) * 50,
  };
}
