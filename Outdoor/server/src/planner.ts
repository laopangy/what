import { v4 as uuid } from "uuid";
import type { Intensity, Itinerary, ItineraryStop, PlacePhoto, TransportMode, TripIntent } from "./types.js";

interface DestinationTemplate {
  aliases: string[];
  name: string;
  origin: string;
  driveMinutes: number;
  railMinutes: number;
  cycleMinutes: number;
  distanceKm: number;
  activity: string;
  lunch: string;
  secondActivity: string;
  rest: string;
  photos: PlacePhoto[];
}

const destinationTemplates: DestinationTemplate[] = [
  {
    aliases: ["莫干山", "竹林", "德清"], name: "莫干山", origin: "上海", driveMinutes: 110, railMinutes: 150, cycleMinutes: 420, distanceKm: 142,
    activity: "剑池竹林徒步", lunch: "庾村午餐", secondActivity: "芦花荡公园", rest: "观景台休息",
    photos: [
      { url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82", alt: "林间步道", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=82", alt: "山间午餐", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=82", alt: "山间公园", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=82", alt: "日落观景台", source: "Unsplash" },
    ],
  },
  {
    aliases: ["西湖", "杭州"], name: "杭州西湖", origin: "上海", driveMinutes: 125, railMinutes: 105, cycleMinutes: 520, distanceKm: 176,
    activity: "北山街与孤山漫步", lunch: "湖滨午餐", secondActivity: "曲院风荷", rest: "杨公堤休息",
    photos: [
      { url: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?auto=format&fit=crop&w=1200&q=82", alt: "湖畔步道", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1548919973-5cef591cdbc9?auto=format&fit=crop&w=1200&q=82", alt: "中式午餐", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=82", alt: "湖光山色", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=82", alt: "湖边日落", source: "Unsplash" },
    ],
  },
  {
    aliases: ["滴水湖", "临港"], name: "滴水湖", origin: "上海", driveMinutes: 70, railMinutes: 115, cycleMinutes: 190, distanceKm: 72,
    activity: "湖岸骑行", lunch: "环湖午餐", secondActivity: "南汇嘴观海公园", rest: "东岸草坪休息",
    photos: [
      { url: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=82", alt: "湖岸骑行道", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=82", alt: "湖边午餐", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=82", alt: "海边公园", source: "Unsplash" },
      { url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=82", alt: "湖边草坪", source: "Unsplash" },
    ],
  },
];

const genericPhotos: PlacePhoto[] = [
  { url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82", alt: "林间步道", source: "Unsplash" },
  { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=82", alt: "当地午餐", source: "Unsplash" },
  { url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=82", alt: "山地景观", source: "Unsplash" },
  { url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82", alt: "日落观景点", source: "Unsplash" },
];

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const chineseNumber = (value: string) => {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, units] = value.split("十");
    return (tens ? digits[tens] : 1) * 10 + (units ? digits[units] : 0);
  }
  return digits[value] || 0;
};

function resolveTemplate(query: string, destination: string): DestinationTemplate {
  const matched = destinationTemplates.find((template) => template.aliases.some((alias) => `${query}${destination}`.includes(alias)));
  if (matched) return matched;
  return {
    aliases: [destination], name: destination, origin: "上海", driveMinutes: 100, railMinutes: 135, cycleMinutes: 240, distanceKm: 118,
    activity: `${destination}核心景区漫步`, lunch: "当地午餐", secondActivity: "周边自然景点", rest: "观景点休息", photos: genericPhotos,
  };
}

export function parseIntent(query: string): TripIntent {
  const normalized = query.trim();
  const originMatch = normalized.match(/从([^，。,.\s]{2,12}?)(?:出发|去|到)/);
  const knownDestination = destinationTemplates.find((template) => template.aliases.some((alias) => normalized.includes(alias)));
  const destinationMatch = normalized.match(/(?:去|到)([^，。,.]{2,14}?)(?:玩|看看|旅游|骑|，|。|$)/);
  const hourMatch = normalized.match(/单程[^\d一二两三四五六七八九十]{0,5}([\d.一二两三四五六七八九十]+)\s*小时/);
  const minuteMatch = normalized.match(/单程[^\d一二两三四五六七八九十]{0,5}([\d一二两三四五六七八九十]+)\s*分钟/);
  const transportModes: TransportMode[] = [];
  if (/自驾|开车/.test(normalized)) transportModes.push("driving");
  if (/高铁|火车|动车/.test(normalized)) transportModes.push("rail");
  if (/骑行|骑车|公路车/.test(normalized)) transportModes.push("cycling");
  const intensity: Intensity = /挑战|强度高|特种兵/.test(normalized) ? "challenging" : /不累|轻松|休闲/.test(normalized) ? "relaxed" : "moderate";
  return {
    query: normalized,
    origin: originMatch?.[1] || knownDestination?.origin || "上海",
    destination: knownDestination?.name || destinationMatch?.[1]?.trim() || "莫干山",
    dayLabel: /今天/.test(normalized) ? "今天" : /明天/.test(normalized) ? "明天" : /周日|星期日/.test(normalized) ? "周日" : "周六",
    startTime: normalized.match(/(\d{1,2}):?(\d{2})?\s*(?:出发|走)/)?.slice(1, 3).filter(Boolean).join(":") || "07:30",
    endTime: "19:00",
    maxOneWayMinutes: hourMatch ? Math.round(chineseNumber(hourMatch[1]) * 60) : minuteMatch ? chineseNumber(minuteMatch[1]) : 120,
    transportModes: transportModes.length ? transportModes : ["driving", "rail"],
    intensity,
  };
}

const stop = (order: number, type: ItineraryStop["type"], title: string, subtitle: string, arrival: number, stay: number, travel: number, distance: number, mapX: number, mapY: number, photo?: PlacePhoto): ItineraryStop => ({
  id: uuid(), order, type, title, subtitle, arrivalAt: toTime(arrival), departureAt: toTime(arrival + stay), stayMinutes: stay,
  travelMinutesFromPrevious: travel, distanceKmFromPrevious: distance, mapX, mapY, photo, locked: false,
});

export function generateItinerary(intent: TripIntent, requestedMode?: TransportMode): Itinerary {
  const template = resolveTemplate(intent.query, intent.destination);
  const mode = requestedMode && intent.transportModes.includes(requestedMode) ? requestedMode : intent.transportModes[0];
  const oneWay = mode === "driving" ? template.driveMinutes : mode === "rail" ? template.railMinutes : template.cycleMinutes;
  const start = toMinutes(intent.startTime);
  const totalWindow = Math.max(480, toMinutes(intent.endTime) - start);
  const availableAtDestination = Math.max(180, totalWindow - oneWay * 2 - 40);
  const activityStay = intent.intensity === "relaxed" ? 75 : intent.intensity === "challenging" ? 120 : 90;
  const secondStay = Math.min(90, Math.max(45, availableAtDestination - activityStay - 120));
  const arrivalDestination = start + oneWay;
  const activityStart = arrivalDestination + 20;
  const lunchStart = Math.max(activityStart + activityStay + 20, 12 * 60);
  const secondStart = lunchStart + 80;
  const restStart = secondStart + secondStay + 15;
  const returnStart = Math.max(restStart + 30, toMinutes(intent.endTime) - oneWay);
  const homeAt = returnStart + oneWay;
  const transportLabel = mode === "driving" ? "自驾" : mode === "rail" ? "高铁与接驳" : "骑行";
  const stops = [
    stop(1, "departure", `${intent.origin}出发`, transportLabel, start, 0, 0, 0, 88, 27),
    stop(2, mode === "rail" ? "station" : mode === "cycling" ? "departure" : "parking", mode === "rail" ? `${template.name}接驳点` : mode === "cycling" ? `${template.name}环线起点` : `${template.name}停车场`, "整理装备后进入行程", arrivalDestination, 20, oneWay, template.distanceKm, 27, 24),
    stop(3, "activity", template.activity, intent.intensity === "relaxed" ? "轻松游览" : "标准强度", activityStart, activityStay, 10, 3.2, 21, 43, template.photos[0]),
    stop(4, "meal", template.lunch, "预留点餐与休息时间", lunchStart, 65, 15, 4.8, 31, 68, template.photos[1]),
    stop(5, "activity", template.secondActivity, "下午主要游览节点", secondStart, secondStay, 15, 6.4, 49, 75, template.photos[2]),
    stop(6, "rest", template.rest, "补水、拍照并检查返程", restStart, Math.max(20, returnStart - restStart), 15, 4.1, 63, 68, template.photos[3]),
    stop(7, "return", "开始返程", `返回${intent.origin}`, returnStart, 0, 15, 4.1, 63, 68),
    stop(8, "return", `${intent.origin}到家`, "本次行程形成完整闭环", homeAt, 0, oneWay, template.distanceKm, 84, 35),
  ];
  const warnings = [];
  if (oneWay > intent.maxOneWayMinutes) warnings.push(`当前${transportLabel}单程约 ${oneWay} 分钟，超过设定上限 ${intent.maxOneWayMinutes} 分钟`);
  if (homeAt > toMinutes(intent.endTime)) warnings.push(`预计 ${toTime(homeAt)} 到家，晚于计划结束时间 ${intent.endTime}`);
  warnings.push("当前路线时间为可编辑估算，接入地图服务后将按实时道路与公共交通重新计算");
  const now = new Date().toISOString();
  return {
    id: uuid(), title: `${intent.origin} → ${template.name}一日游`, createdAt: now, updatedAt: now, intent: { ...intent, destination: template.name }, transportMode: mode,
    totalDistanceKm: Math.round((template.distanceKm * 2 + 18) * 10) / 10,
    totalTravelMinutes: oneWay * 2 + 40,
    estimatedCost: mode === "driving" ? Math.round(template.distanceKm * 1.2) : mode === "rail" ? Math.round(template.distanceKm * 0.8) : 35,
    dataQuality: "estimated", stops, photos: template.photos, warnings, saved: false,
  };
}
