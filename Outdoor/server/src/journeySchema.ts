import { z } from "zod";

const text = z.string().trim().min(1).max(200);
export const placeSchema = z.object({
  id: text, name: text, address: z.string().max(500),
  location: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  citycode: z.string().max(12), adcode: z.string().max(12),
  photos: z.array(z.object({ url: z.string().url().startsWith("https://"), title: z.string().max(300) })).max(5),
});
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "日期无效");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const draftSchema = z.object({
  origin: placeSchema.nullable(), startDate: date, endDate: date,
  startTime: time, endTime: time,
  maxMinutes: z.number().int().min(1).max(1440).nullable(),
  travelers: z.object({
    adults: z.number().int().min(0).max(30), seniors: z.number().int().min(0).max(30),
    children: z.number().int().min(0).max(30), women: z.number().int().min(0).max(30),
  }).optional(),
  maxKm: z.number().min(1).max(3000).nullable(), people: z.number().int().min(1).max(30),
  mode: z.enum(["driving", "cycling", "transit", "rail"]),
  activity: z.enum(["hiking", "cycling", "touring", "leisure"]),
  activityMinutes: z.number().int().min(30).max(480), activityKm: z.number().min(1).max(200),
  destination: placeSchema.nullable(), dailyPlaces: z.array(placeSchema).max(7), activityEnd: placeSchema.nullable(),
  lodging: z.enum(["recommend", "booked", "later"]), hotel: placeSchema.nullable(),
  rooms: z.number().int().min(1).max(20), hotelBudget: z.number().min(50).max(20000),
  hotelPreference: z.string().trim().max(60),
}).superRefine((draft, ctx) => {
  if (draft.maxMinutes === null && draft.maxKm === null)
    ctx.addIssue({code: "custom", message: "单程交通时间和单程距离至少填写一项"});
  if (draft.travelers) {
    const total = draft.travelers.adults + draft.travelers.seniors + draft.travelers.children;
    if (total !== draft.people || draft.travelers.women > total)
      ctx.addIssue({code: "custom", message: "同行总人数应等于成年人、老人和儿童之和，女性人数不能超过总人数"});
  }
  const days = (Date.parse(draft.endDate) - Date.parse(draft.startDate)) / 86400000;
  if (days < 0 || days > 6) ctx.addIssue({code: "custom", message: "行程支持 1 至 7 天，请检查起止日期"});
  if (draft.startDate === draft.endDate && draft.startTime >= draft.endTime)
    ctx.addIssue({code: "custom", message: "返程截止时间必须晚于出发时间"});
});
export const credentialSchema = z.object({
  jsKey: z.string().trim().regex(/^[a-fA-F0-9]{32}$/, "Web 端 Key 应为 32 位英文数字"),
  securityCode: z.string().trim().regex(/^[a-fA-F0-9]{32}$/, "安全密钥应为 32 位英文数字"),
  serviceKey: z.string().trim().regex(/^[a-fA-F0-9]{32}$/, "Web 服务 Key 应为 32 位英文数字"),
});
const legSchema = z.object({
  from: placeSchema, to: placeSchema, mode: z.enum(["driving", "cycling", "walking", "transit", "rail"]),
  minutes: z.number().min(0).max(10000), km: z.number().min(0).max(10000),
  paths: z.array(z.array(placeSchema.shape.location).max(30000)).max(500),
  instructions: z.array(z.string().max(1000)).max(120),
  queriedAt: z.string().datetime(), source: z.literal("amap"), warning: z.string().max(500).optional(),
});
export const journeySchema = z.object({
  version: z.literal(2), id: z.string().uuid(), title: text, draft: draftSchema,
  events: z.array(z.object({
    id: z.string().uuid(), day: date, title: text, start: time, end: time, place: placeSchema,
    kind: z.enum(["departure", "activity", "meal", "hotel", "return"]), note: z.string().max(1000),
    leg: legSchema.optional(),
  })).min(2).max(150),
  warnings: z.array(z.string().max(1000)).max(30), createdAt: z.string().datetime(), saved: z.boolean(),
});
