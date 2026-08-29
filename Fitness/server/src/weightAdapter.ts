import { calculateProfileTargets } from "./profileCalculator.js";
import type { FitnessState, PlanAdaptation } from "./types.js";

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const daysBetween = (later: string, earlier: string) => Math.floor((new Date(`${later}T12:00:00`).getTime() - new Date(`${earlier}T12:00:00`).getTime()) / 86400000);

export function evaluateWeightTrend(state: FitnessState): void {
  const weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  const calorieAdjustment = state.planAdaptation?.calorieAdjustment || 0;
  const evaluatedAt = new Date().toISOString();
  let message = "每天晨起、如厕后、进食前称重；系统会用趋势判断，不会根据单日波动改计划。";
  let status: PlanAdaptation["status"] = "collecting";
  let trendKg: number | undefined;
  let nextAdjustment = calorieAdjustment;
  let lastAdjustedDate = state.planAdaptation?.lastAdjustedDate;

  if (weights.length >= 7 && daysBetween(weights[0].date, weights[6].date) >= 6) {
    const window = weights.slice(0, 7);
    trendKg = Number((average(window.slice(0, 3).map((item) => item.weightKg)) - average(window.slice(-3).map((item) => item.weightKg))).toFixed(2));
    const coolingDown = lastAdjustedDate && daysBetween(weights[0].date, lastAdjustedDate) < 7;
    let change = 0;
    if (!coolingDown) {
      if (state.profile.goal === "gain") change = trendKg < 0.05 ? 100 : trendKg > 0.6 ? -100 : 0;
      if (state.profile.goal === "lose") change = trendKg > -0.05 ? -100 : trendKg < -0.8 ? 100 : 0;
      if (state.profile.goal === "maintain") change = trendKg > 0.4 ? -100 : trendKg < -0.4 ? 100 : 0;
    }
    const adjusted = Math.max(-400, Math.min(400, calorieAdjustment + change));
    if (change !== 0 && adjusted !== calorieAdjustment) {
      nextAdjustment = adjusted;
      lastAdjustedDate = weights[0].date;
      status = "adjusted";
      const direction = change > 0 ? "增加" : "减少";
      message = `近一周体重趋势 ${trendKg > 0 ? "+" : ""}${trendKg} kg，已将每日饮食目标${direction} ${Math.abs(change)} kcal；训练仍按恢复节奏，不突然加量。`;
    } else {
      status = "stable";
      message = coolingDown
        ? `近一周体重趋势 ${trendKg > 0 ? "+" : ""}${trendKg} kg，已完成评估；距离上次调整不足7天，本次保持计划不变。`
        : `近一周体重趋势 ${trendKg > 0 ? "+" : ""}${trendKg} kg，处于当前目标的合理范围，计划暂不调整。`;
    }
  } else {
    message = `已记录 ${weights.length} / 7 天；至少连续一周后才调整饮食目标，避免被水分波动误导。`;
  }

  state.planAdaptation = { status, message, evaluatedAt, measurements: weights.length, ...(trendKg !== undefined ? { trendKg } : {}), calorieAdjustment: nextAdjustment, ...(lastAdjustedDate ? { lastAdjustedDate } : {}) };
  state.profile = calculateProfileTargets(state.profile, state.plan.sessions, nextAdjustment);
  state.plan.sessions = state.plan.sessions.map((session) => session.generated ? { ...session, adaptationNote: message } : session);
}
