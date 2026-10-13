import { AI_TIMEOUT_MS, createModuleClient } from "./moduleFetch.js";
import { formatLocalDateTime } from "./dates.js";
import type { ModuleToolPlugin } from "./types.js";

interface Place { name: string }
interface RouteLeg { mode: string; minutes: number; km: number }
interface TripEvent {
  day: string; title: string; start: string; end: string; place: Place;
  kind: "departure" | "activity" | "meal" | "hotel" | "return"; leg?: RouteLeg;
}
interface Journey {
  id: string; title: string; events: TripEvent[]; warnings: string[]; createdAt: string;
  draft: { startDate: string; endDate: string; people: number; mode: string; activity: string; destination: Place | null };
}
interface CalendarStatus { connected: boolean; calendarId: string; calendars: { id: string; name: string }[] }

const ACTIVITY_NAMES: Record<string, string> = { hiking: "徒步爬山", cycling: "骑车探索", touring: "风景游览", leisure: "轻松旅游" };
const MODE_NAMES: Record<string, string> = { driving: "自驾", cycling: "公路车骑行", transit: "公共交通", rail: "高铁 / 铁路", walking: "步行" };
const KIND_NAMES: Record<TripEvent["kind"], string> = { departure: "出发", activity: "活动", meal: "用餐", hotel: "住宿", return: "返程" };
const JOURNEY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateRange = (journey: Journey) => (journey.draft.startDate === journey.draft.endDate
  ? journey.draft.startDate
  : `${journey.draft.startDate} ~ ${journey.draft.endDate}`);

export function createOutdoorPlugin({ baseUrl }: { baseUrl: string }): ModuleToolPlugin {
  const request = createModuleClient({ baseUrl, label: "户外" });

  const findJourney = async (journeyId: unknown) => {
    const id = String(journeyId ?? "");
    if (!JOURNEY_ID.test(id)) return { error: "行程 id 不正确" } as const;
    const result = await request<Journey[]>("GET", "/api/outdoor/journeys");
    if (!result.ok) return { error: result.error } as const;
    const journey = result.data.find((item) => item.id === id);
    return journey ? { journey } as const : { error: "行程不存在或尚未保存" } as const;
  };

  return {
    name: "outdoor",
    label: "户外",
    summary: "查看已保存的户外行程和日程，把行程同步到苹果日历（不能生成新行程或搜索地点）",
    intent: /户外|行程|旅行|旅游|出行|骑行|徒步|露营|爬山|路线|日历|出游/,
    prompt: `户外模块使用提示：
- 行程 id 来自 outdoor_list_journeys；用户提到某个行程时先列出行程找到对应 id。
- 出发地和返程地点统一显示为“出发地”，不要追问具体地址。
- 生成新行程或搜索地点需要用户到户外页面操作。`,
    tools: [
      {
        name: "outdoor_list_journeys",
        label: "行程列表",
        risk: "read",
        description: "列出已保存的户外行程：标题、日期、活动类型、出行方式、目的地。",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "outdoor_get_journey",
        label: "行程详情",
        risk: "read",
        description: "查看某个已保存行程的逐项日程安排和交通耗时。",
        input_schema: {
          type: "object",
          properties: { journeyId: { type: "string", description: "行程 id" } },
          required: ["journeyId"],
        },
      },
      {
        name: "outdoor_sync_calendar",
        label: "同步到苹果日历",
        risk: "confirm",
        description: "把已保存的行程同步到 iCloud 苹果日历，会覆盖该行程之前同步过的日程。",
        input_schema: {
          type: "object",
          properties: { journeyId: { type: "string", description: "行程 id" } },
          required: ["journeyId"],
        },
      },
    ],

    async prepare(name, args) {
      if (name !== "outdoor_sync_calendar") return { result: { error: `未知工具：${name}` } };
      const status = await request<CalendarStatus>("GET", "/api/outdoor/calendar/status");
      if (!status.ok) return { result: { error: status.error } };
      if (!status.data.connected) return { result: { error: "请先在户外的账号与服务中连接 iCloud 日历" } };
      const calendar = status.data.calendars.find((item) => item.id === status.data.calendarId);
      if (!calendar) return { result: { error: "请先在户外的账号与服务中选择目标日历并保存" } };
      const found = await findJourney(args.journeyId);
      if ("error" in found) return { result: { error: found.error } };
      return {
        summary: `把行程「${found.journey.title}」（${dateRange(found.journey)}，${found.journey.events.length} 项日程）同步到苹果日历「${calendar.name}」，会覆盖这个行程之前同步过的日程，包括在手机上做的修改`,
      };
    },

    async execute(name, args) {
      switch (name) {
        case "outdoor_list_journeys": {
          const result = await request<Journey[]>("GET", "/api/outdoor/journeys");
          if (!result.ok) return { error: result.error };
          return {
            journeys: result.data.map((journey) => ({
              id: journey.id, title: journey.title, dates: dateRange(journey),
              activity: ACTIVITY_NAMES[journey.draft.activity] ?? journey.draft.activity,
              mode: MODE_NAMES[journey.draft.mode] ?? journey.draft.mode,
              destination: journey.draft.destination?.name, people: journey.draft.people || undefined,
              events: journey.events.length, savedAt: formatLocalDateTime(journey.createdAt),
            })),
          };
        }

        case "outdoor_get_journey": {
          const found = await findJourney(args.journeyId);
          if ("error" in found) return { error: found.error };
          const { journey } = found;
          return {
            id: journey.id, title: journey.title, dates: dateRange(journey),
            activity: ACTIVITY_NAMES[journey.draft.activity] ?? journey.draft.activity,
            mode: MODE_NAMES[journey.draft.mode] ?? journey.draft.mode,
            destination: journey.draft.destination?.name, people: journey.draft.people || undefined,
            warnings: journey.warnings.length > 0 ? journey.warnings : undefined,
            events: journey.events.map((event) => ({
              day: event.day, start: event.start, end: event.end, title: event.title,
              kind: KIND_NAMES[event.kind] ?? event.kind,
              // Departure and return points are usually home; never expose them.
              place: event.kind === "departure" || event.kind === "return" ? "出发地" : event.place.name,
              travel: event.leg
                ? { mode: MODE_NAMES[event.leg.mode] ?? event.leg.mode, minutes: Math.round(event.leg.minutes), km: Math.round(event.leg.km * 10) / 10 }
                : undefined,
            })),
          };
        }

        case "outdoor_sync_calendar": {
          const id = String(args.journeyId ?? "");
          if (!JOURNEY_ID.test(id)) return { error: "行程 id 不正确" };
          const result = await request<{ count: number; calendarName: string }>("POST", `/api/outdoor/journeys/${id}/calendar`, {
            timeoutMs: AI_TIMEOUT_MS,
          });
          if (!result.ok) return { error: result.error };
          return {
            synced: true, count: result.data.count, calendarName: result.data.calendarName,
            message: `已同步 ${result.data.count} 项日程到苹果日历「${result.data.calendarName}」`,
          };
        }

        default:
          return { error: `未知工具：${name}` };
      }
    },
  };
}
