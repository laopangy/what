import { randomUUID } from "node:crypto";
import { ProviderError, type Amap } from "./amap.js";
import type { Candidate, Journey, Place, RouteLeg, TripDraft, TripEvent } from "./journeyTypes.js";
import { checkRoadLeg, rideOutbound } from "./roadRide.js";
const DAY = 86400000;
export const tripDays = (draft: TripDraft) => Math.round((Date.parse(draft.endDate) - Date.parse(draft.startDate)) / DAY) + 1;
const clockMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
export function withinLimits(leg: RouteLeg, draft: TripDraft): boolean {
  return (draft.maxMinutes === null || leg.minutes <= draft.maxMinutes) && (draft.maxKm === null || leg.km <= draft.maxKm);
}
export async function recommend(draft: TripDraft, amap: Amap): Promise<{ candidates: Candidate[]; note: string }> {
  if (!draft.origin) throw new Error("请先确认出发地点");
  const keywords = { hiking: "山", cycling: "绿道", touring: "风景名胜", leisure: "公园" };
  // Candidate discovery is bounded; reachability is checked on road/transit routes, never straight-line distance.
  const roadRide = draft.mode === "cycling";
  if (roadRide && draft.rideShape === "loop" && !draft.rideVia) throw new Error("请先选择环线途经点");
  const nearby = await amap.search(roadRide ? "路口|骑行驿站" : keywords[draft.activity], { near: draft.origin, explore: true, ...(roadRide ? {} : {type: "110000"}) });
  const regional = (draft.maxMinutes === null || draft.maxMinutes >= 120) && draft.mode !== "cycling"
    ? await amap.search(keywords[draft.activity], { region: draft.origin.adcode.slice(0, 2) + "0000", type: "110000" }) : [];
  const interleaved = nearby.flatMap((place,index) => regional[index] ? [place,regional[index]] : [place]);
  const places = [...new Map([...interleaved, ...regional].map(p => [p.id, p])).values()].filter(p => p.id !== draft.origin?.id && p.id !== draft.rideVia?.id).slice(0, 24);
  const candidates: Candidate[] = [];
  let unavailable = 0;
  for (const place of places) {
    try {
      const outbound = roadRide ? await rideOutbound(draft,place,amap) : await amap.route(draft.origin, place, draft.mode, draft.startDate, draft.startTime);
      if (!withinLimits(outbound, draft)) continue;
      const returnRoute = await amap.route(place, draft.origin, draft.mode, draft.endDate, "15:00");
      if (!withinLimits(returnRoute, draft)) continue;
      if (roadRide) {
        try { checkRoadLeg(outbound); checkRoadLeg(returnRoute); } catch { unavailable++; continue; }
        if (draft.rideTotalKm && outbound.km + returnRoute.km > draft.rideTotalKm) continue;
        if (outbound.minutes + returnRoute.minutes > draft.activityMinutes) continue;
      }
      if (tripDays(draft) === 1 && outbound.minutes + returnRoute.minutes + (roadRide ? 30 + (draft.rideShape === "loop" ? 15 : 0) : draft.activityMinutes) + 90 >
          clockMinutes(draft.endTime) - clockMinutes(draft.startTime)) continue;
      candidates.push({ place, outbound, returnRoute });
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      // Configuration/quota/network errors must not masquerade as "no matching destinations".
      if (!error.message.includes("未找到") && !error.message.includes("未返回含铁路")) throw error;
      unavailable += 1;
    }
  }
  candidates.sort((a,b) => a.outbound.km-b.outbound.km);
  return { candidates, note: "按高德实际去程路程分组（边界计入较近一档），不是直线距离。在周边 50km 及所在省份的有限候选中筛选；空档不代表该范围没有地点。" +
    (roadRide ? "公路车以路口/驿站作候选，不推荐景区内部步行终点；已排除返回信息中明确的台阶、非铺装和禁骑提示，但路面、爬升、车流与自行车通行仍待实地核实。环线经途经点闭合，部分路段可能重合。" : "自驾以游玩目的地为主，停车和开放信息待核实。") +
    (unavailable ? "部分地点未返回所选交通路线。" : "") +
    (candidates.length ? "活动细线及住宿接驳将在生成时进一步校验。" : "没有找到满足条件的候选，请扩大时间/距离或直接搜索目的地。") };
}
export async function buildJourney(draft: TripDraft, amap: Pick<Amap, "route">): Promise<Journey> {
  if (!draft.origin || !draft.destination) throw new Error("请确认出发地和目的地");
  const days = tripDays(draft);
  if (days > 1 && (!draft.hotel || draft.lodging === "later")) throw new Error("过夜行程需要先选择住宿地点，才能计算每日接驳与返程");
  const roadRide = draft.mode === "cycling";
  const activeRoute = !roadRide && (draft.activity === "hiking" || draft.activity === "cycling");
  if (roadRide && (draft.origin.id === draft.destination.id || draft.origin.location.every((value,index)=>value === draft.destination!.location[index])))
    throw new Error("请选择与出发地不同的公路车终点，不能生成零距离骑行");
  if (activeRoute && (!draft.activityEnd || draft.activityEnd.id === draft.destination.id))
    throw new Error("请为徒步/骑行选择一个不同的折返点，以生成实际往返活动路线");
  const events: TripEvent[] = [];
  const warnings = [
    "交通时间为高德查询时的预计值，不是未来路况保证；每段交通另预留 15 分钟机动时间。",
    "开放时间、门票、天气、停车及餐饮需出发前核实；用餐节点是时间预留，不代表已选餐厅。",
  ];
  if (roadRide) warnings.push("公路车路线：已过滤导航中明确的台阶、非铺装、禁骑提示；无提示不代表适合公路车。路面、爬升、车流、补给营业和终点通行仍待核实，不保证全程可骑。");
  if (draft.activity === "hiking") warnings.push("徒步线仅为普通步行导航，不是已核实的登山轨迹。山路开放、路况、海拔和安全性未验证，不可直接作为野外导航依据。");
  if (draft.activity === "cycling") warnings.push("骑行路线为道路导航；租车、携车、骑行许可与补给需自行确认。");
  if (draft.mode === "rail" || draft.mode === "transit") warnings.push("公共交通/铁路为换乘参考，需核实实际车次、运营日期、票价和余票，尚未出票。");
  if (days > 1) warnings.push("住宿地点已纳入路线；每间每晚预算仅为你的意向，高德 POI 不提供实时房价、房态或预订确认。");
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const day = new Date(Date.parse(draft.startDate) + dayIndex * DAY).toISOString().slice(0, 10);
    let cursor = dayIndex === 0 ? clockMinutes(draft.startTime) : 8 * 60;
    const finishBy = dayIndex === days - 1 ? clockMinutes(draft.endTime) : 21 * 60;
    const focus = draft.dailyPlaces[dayIndex] || draft.destination;
    const dayStart = events.length;
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
      if (roadRide) checkRoadLeg(leg);
      if (checkLimit && !withinLimits(leg, draft)) throw new Error(title + "超过单程时间或距离上限，请返回调整");
      add(title, kind, to, leg.minutes + (leg.minutes ? 15 : 0), "交通 " + leg.minutes + " 分钟" + (leg.minutes ? " + 15 分钟机动" : ""), leg);
      return leg;
    };
    add(dayIndex === 0 ? "从出发地启程" : "早餐与退房准备", "departure", current, dayIndex === 0 ? 0 : 45, dayIndex === 0 ? "请提前检查装备" : "在住宿地预留早餐时间");
    if (roadRide && draft.rideShape === "loop") {
      if (days !== 1 || !draft.rideVia || [current.id,focus.id].includes(draft.rideVia.id)) throw new Error("当天环线需选择与起终点不同的途经点");
      const first = await travel(draft.rideVia, "公路车途经 · " + draft.rideVia.name, "activity", "cycling", false);
      const second = await travel(focus, "公路车终点 · " + focus.name, "activity", "cycling", false);
      if (!withinLimits({...first,km:first.km+second.km,minutes:first.minutes+second.minutes},draft)) throw new Error("环线去程超过单程上限");
    } else await travel(focus, (roadRide ? "公路车去程 · " : "前往 ") + focus.name, "activity");
    if (roadRide) {
      add("终点补给与休息", "activity", focus, 30, "终点以可达道路节点为目标；补给和现场通行待确认");
    } else if (activeRoute) {
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
    if (roadRide && events.slice(dayStart).reduce((sum,event)=>sum+(event.leg?.minutes || 0),0) > draft.activityMinutes)
      throw new Error(day + " 总骑行时间超过每天骑行预算");
    if (!finalDay) {
      add(draft.lodging === "booked" ? "入住（用户标记已订）" : "入住安排（尚未预订）", "hotel", destination, 30, "住宿至次日；请自行核实入住/退房时间及房态");
      if (cursor < 18 * 60) add("自由休整", "hotel", destination, 18 * 60 - cursor, "入住后自由安排，休息至晚餐时间");
      add("晚餐与晚间休息", "meal", destination, 60, "在住宿地点预留晚餐；商家待确认，之后住宿至次日");
    }
  }
  if (roadRide && draft.rideTotalKm && events.reduce((sum,event)=>sum+(event.leg?.km || 0),0) > draft.rideTotalKm)
    throw new Error("完整路线超过骑行总里程上限，请缩短路线或调整上限");
  return {version: 2, id: randomUUID(), title: (roadRide ? "公路车" + (draft.rideShape === "loop" ? "环线" : "往返") + " · " : "") + draft.destination.name + " · " + days + " 日行程",
    draft, events, warnings, createdAt: new Date().toISOString(), saved: false};
}
