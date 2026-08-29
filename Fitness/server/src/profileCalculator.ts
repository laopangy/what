import type { Profile, WorkoutSession } from "./types.js";

const trainingTypes = new Set(["strength", "cycling", "running", "hiking"]);

export function analyzeActivityLevel(sessions: WorkoutSession[]): number {
  const recurring = sessions.filter((session) => !session.scheduledDate);
  const source = recurring.length > 0 ? recurring : sessions;
  const weeklyLoad = source.reduce((sum, session) => {
    const activities = session.activities || [];
    const hasTraining = session.exercises.length > 0 || trainingTypes.has(session.activityType) || activities.some((activity) => trainingTypes.has(activity.activityType));
    if (hasTraining) return sum + 1;
    const hasActiveRecovery = activities.some((activity) => activity.durationMinutes && activity.durationMinutes >= 20 && !["上班", "下班"].includes(activity.name));
    return sum + (hasActiveRecovery ? 0.35 : 0);
  }, 0);
  if (weeklyLoad < 0.5) return 1.2;
  if (weeklyLoad < 3) return 1.375;
  if (weeklyLoad < 5.5) return 1.55;
  return 1.725;
}

export function calculateProfileTargets(input: Pick<Profile, "name" | "sex" | "age" | "heightCm" | "weightKg" | "goal">, sessions: WorkoutSession[]): Profile {
  const activityLevel = analyzeActivityLevel(sessions);
  const bmr = input.sex === "male" ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5 : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;
  const adjustment = input.goal === "gain" ? 250 : input.goal === "lose" ? -350 : 0;
  const calories = Math.max(1200, Math.round((bmr * activityLevel + adjustment) / 10) * 10);
  const protein = Math.round(input.weightKg * (input.goal === "gain" ? 2 : 1.8));
  const fat = Math.round(input.weightKg * 0.9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { ...input, activityLevel, calorieTarget: calories, proteinTarget: protein, carbsTarget: carbs, fatTarget: fat, waterTarget: Math.round(input.weightKg * 35 / 50) * 50 };
}
