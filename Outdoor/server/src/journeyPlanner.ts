import { randomUUID } from "node:crypto";
import { ProviderError, type Amap } from "./amap.js";
import type { Candidate, Journey, Place, RouteLeg, TripDraft, TripEvent } from "./journeyTypes.js";
const DAY = 86400000;
export const tripDays = (draft: TripDraft) => Math.round((Date.parse(draft.endDate) - Date.parse(draft.startDate)) / DAY) + 1;
const clockMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
export function withinLimits(leg: RouteLeg, draft: TripDraft): boolean {
  return leg.minutes <= draft.maxMinutes && (draft.maxKm === null || leg.km <= draft.maxKm);
}
export async function recommend(draft: TripDraft, amap: Amap): Promise<{ candidates: Candidate[]; note: string }> {
  if (!draft.origin) throw new Error("请先确认出发地点");
  const keywords = { hiking: "山", cycling: "绿道", touring: "风景名胜", leisure: "公园" };
  // Candidate discovery is bounded; reachability is checked on road/transit routes, never straight-line distance.
  const nearby = await amap.search(keywords[draft.activity], { near: draft.origin, type: "110000" });
  const regional = draft.maxMinutes >= 120 && draft.mode !== "cycling"
    ? await amap.search(keywords[draft.activity], { region: draft.origin.adcode.slice(0, 2) + "0000", type: "110000" }) : [];
  const places = [...new Map([...nearby, ...regional].map(p => [p.id, p])).values()].filter(p => p.id !== draft.origin?.id).slice(0, 12);
  const candidates: Candidate[] = [];
  let unavailable = 0;
  for (const place of places) {
    try {
      const outbound = await amap.route(draft.origin, place, draft.mode, draft.startDate, draft.startTime);
      if (!withinLimits(outbound, draft)) continue;
      const returnRoute = await amap.route(place, draft.origin, draft.mode, draft.endDate, "15:00");
      if (!withinLimits(returnRoute, draft)) continue;
      if (tripDays(draft) === 1 && outbound.minutes + returnRoute.minutes + draft.activityMinutes + 90 >
          clockMinutes(draft.endTime) - clockMinutes(draft.startTime)) continue;
      candidates.push({ place, outbound, returnRoute });
      if (candidates.length >= 4) break;
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      // Configuration/quota/network errors must not masquerade as "no matching destinations".
      if (!error.message.includes("未找到") && !error.message.includes("未返回含铁路")) throw error;
      unavailable += 1;
    }
  }
  return { candidates, note: "在高德周边 50km 及所在省份的有限候选中筛选，并校验往返交通限制；不是全国穷举。" +
    (unavailable ? "部分地点未返回所选交通路线。" : "") +
    (candidates.length ? "活动细线及住宿接驳将在生成时进一步校验。" : "没有找到满足条件的候选，请扩大时间/距离或直接搜索目的地。") };
}
export async function buildJourney(draft: TripDraft, amap: Pick<Amap, "route">): Promise<Journey> {
  if (!draft.origin || !draft.destination) throw new Error("请确认出发地和目的地");
  const days = tripDays(draft);
  if (days > 1 && (!draft.hotel || draft.lodging === "later")) throw new Error("过夜行程需要先选择住宿地点，才能计算每日接驳与返程");
  const activeRoute = draft.activity === "hiking" || draft.activity === "cycling";
  if (activeRoute && (!draft.activityEnd || draft.activityEnd.id === draft.destination.id))
    throw new Error("请为徒步/骑行选择一个不同的折返点，以生成实际往返活动路线");
  const events: TripEvent[] = [];
  const warnings = [
    "交通时间为高德查询时的预计值，不是未来路况保证；每段交通另预留 15 分钟机动时间。",
    "开放时间、门票、天气、停车及餐饮需出发前核实；用餐节点是时间预留，不代表已选餐厅。",
  ];
  if (draft.activity === "hiking") warnings.push("徒步线仅为普通步行导航，不是已核实的登山轨迹。山路开放、路况、海拔和安全性未验证，不可直接作为野外导航依据。");
  if (draft.activity === "cycling") warnings.push("骑行路线为道路导航；租车、携车、骑行许可与补给需自行确认。");
  if (draft.mode === "rail" || draft.mode === "transit") warnings.push("公共交通/铁路为换乘参考，需核实实际车次、运营日期、票价和余票，尚未出票。");
  if (days > 1) warnings.push("住宿地点已纳入路线；每间每晚预算仅为你的意向，高德 POI 不提供实时房价、房态或预订确认。");
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const day = new Date(Date.parse(draft.startDate) + dayIndex * DAY).toISOString().slice(0, 10);
    let cursor = dayIndex === 0 ? clockMinutes(draft.startTime) : 8 * 60;
    const finishBy = dayIndex === days - 1 ? clockMinutes(draft.endTime) : 21 * 60;
    const focus = draft.dailyPlaces[dayIndex] || draft.destination;
    let current = dayIndex === 0 ? draft.origin : draft.hotel!;
    const add = (title: string, kind: TripEvent["kind"], place: Place, duration: number, note: string, leg?: RouteLeg) => {
      const start = cursor;
      cursor += duration;
      if (cursor > finishBy) throw new Error(day + " 时间不足：无法在截止时间前完成「" + title + "」。请缩短活动、换近一些的地点或调整起止时间");
      events.push({ id: randomUUID(), day, title, kind, place, start: clock(start), end: clock(cursor), note, ...(leg ? {leg} : {}) });
      current = place;
    };
    const travel = async (to: Place, title: string, kind: TripEvent["kind"], mode = draft.mode, checkLimit = true) => {
      const leg = await amap.route(current, to, mode, day, clock(cursor));
      if (checkLimit && !withinLimits(leg, draft)) throw new Error(title + "超过单程时间或距离上限，请返回调整");
      add(title, kind, to, leg.minutes + (leg.minutes ? 15 : 0), "交通 " + leg.minutes + " 分钟" + (leg.minutes ? " + 15 分钟机动" : ""), leg);
      return leg;
    };
    add(dayIndex === 0 ? "从出发地启程" : "早餐与退房准备", "departure", current, dayIndex === 0 ? 0 : 45, dayIndex === 0 ? "请提前检查装备" : "在住宿地预留早餐时间");
    await travel(focus, "前往 " + focus.name, "activity");
    if (activeRoute) {
      const mode = draft.activity === "cycling" ? "cycling" : "walking";
      const outward = await amap.route(focus, draft.activityEnd!, mode, day, clock(cursor));
      const inward = await amap.route(draft.activityEnd!, focus, mode, day, clock(cursor + outward.minutes + 30));
      if (outward.km + inward.km > draft.activityKm || outward.minutes + inward.minutes + 30 > draft.activityMinutes)
        throw new Error(day + " 活动往返超过距离/时间上限，请换近一些的折返点或调整活动限制");
      add("活动去程 · " + draft.activityEnd!.name, "activity", draft.activityEnd!, outward.minutes, "高德道路路线；登山安全性未验证", outward);
      add("补给与休息", "meal", current, 30, "自备补给或现场选择，不代表已选商家");
      add("活动返回 · " + focus.name, "activity", focus, inward.minutes, "返回活动起点", inward);
      add("自由游览与休息", "activity", focus, draft.activityMinutes - outward.minutes - inward.minutes - 30, "活动总时间内的剩余留白");
    } else {
      add("游览与自由活动", "activity", focus, draft.activityMinutes, "按你设置的活动时间预留；景区内部游线未核实");
    }
    add("用餐与整理装备", "meal", focus, 60, "在当前地点预留用餐；餐厅、营业时间与费用待确认");
    const finalDay = dayIndex === days - 1;
    const destination = finalDay ? draft.origin : draft.hotel!;
    await travel(destination, finalDay ? "返程到家" : "前往住宿 · " + destination.name, finalDay ? "return" : "hotel");
    if (!finalDay) {
      add(draft.lodging === "booked" ? "入住（用户标记已订）" : "入住安排（尚未预订）", "hotel", destination, 30, "住宿至次日；请自行核实入住/退房时间及房态");
      if (cursor < 18 * 60) add("自由休整", "hotel", destination, 18 * 60 - cursor, "入住后自由安排，休息至晚餐时间");
      add("晚餐与晚间休息", "meal", destination, 60, "在住宿地点预留晚餐；商家待确认，之后住宿至次日");
    }
  }
  return {version: 2, id: randomUUID(), title: draft.destination.name + " · " + days + " 日行程",
    draft, events, warnings, createdAt: new Date().toISOString(), saved: false};
}
