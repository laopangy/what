import type { Amap } from "./amap.js";
import type { Place, RouteLeg, TripDraft } from "./journeyTypes.js";
export const roadRisk = (leg: RouteLeg) => leg.instructions.some(text => /台阶|楼梯|砂石|碎石|未铺装|禁止自行车|自行车禁行|禁止骑行/.test(text));
export function checkRoadLeg(leg: RouteLeg): void {
  if (!leg.paths.length && leg.km > 0) throw new Error("该骑行路段缺少道路几何，无法确认可骑达路线，请换一个路口或补给点");
  if (roadRisk(leg)) throw new Error("该路线包含台阶、非铺装或骑行禁行提示，不纳入公路车路线，请更换终点");
}
export async function rideOutbound(draft: TripDraft, place: Place, amap: Pick<Amap,"route">): Promise<RouteLeg> {
  const start = draft.origin!;
  if (draft.rideShape !== "loop") return amap.route(start,place,"cycling",draft.startDate,draft.startTime);
  if (!draft.rideVia || draft.rideVia.id === start.id || draft.rideVia.id === place.id)
    throw new Error("环线需先选择一个与起终点不同的途经点");
  const a = await amap.route(start,draft.rideVia,"cycling",draft.startDate,draft.startTime);
  const b = await amap.route(draft.rideVia,place,"cycling",draft.startDate,draft.startTime);
  return {...a,to:place,minutes:a.minutes+b.minutes,km:a.km+b.km,paths:[...a.paths,...b.paths],instructions:[...a.instructions,...b.instructions]};
}
