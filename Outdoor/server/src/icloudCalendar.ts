import { z } from "zod";
import { readVault, updateVault } from "./vault.js";
import { readJourneys } from "./journeyStorage.js";
import { calendarEvent, calendarUid } from "./calendarEvents.js";
import { calendarHash, connectApple, type AppleCalendar, type AppleCredentials, type CalendarRemote } from "./icloudClient.js";

export const appleCredentialsSchema = z.object({
  username: z.string().trim().min(3).max(254).regex(/^[^\s:\x00-\x1f]+$/, "请输入 Apple 账号邮箱或电话号码"),
  password: z.string().trim().regex(/^[a-z]{4}(?:-[a-z]{4}){3}$/, "请输入格式为 xxxx-xxxx-xxxx-xxxx 的 App 专用密码"),
});
export const calendarSelectionSchema = z.object({calendarId: z.string().regex(/^[a-f0-9]{64}$/), reminderMinutes: z.number().int().min(0).max(10080).nullable()});
type SyncRecord = { indexes: number[]; lastSyncedAt?: string; count?: number; pending: boolean };
type Settings = { credentials?: AppleCredentials; calendars?: AppleCalendar[]; calendarId?: string; reminderMinutes?: number | null; syncs?: Record<string, SyncRecord> };
type Section = { icloudCalendar?: Settings };
const readSettings = async (): Promise<Settings> => ((await readVault()).outdoor as Section | undefined)?.icloudCalendar || {};
async function updateSettings(action: (settings: Settings) => void) {
  await updateVault(data => {
    const section = (data.outdoor || {}) as Section;
    section.icloudCalendar ||= {};
    action(section.icloudCalendar);
    data.outdoor = section;
  });
}

// Serialize connection changes and syncs so credentials/calendar cannot change mid-write.
let running = false;
async function exclusive<T>(action: () => Promise<T>): Promise<T> {
  if (running) throw new Error("iCloud 操作正在进行，请等待完成后再试");
  running = true;
  try { return await action(); } finally { running = false; }
}
const requireCredentials = (settings: Settings) => {
  if (!settings.credentials) throw new Error("请先在账号与服务中连接 iCloud 日历");
  return settings.credentials;
};

export function createCalendarService(remoteFactory: (credentials: AppleCredentials) => Promise<CalendarRemote> = connectApple) {
  const status = async () => {
    const s = await readSettings();
    return {connected: Boolean(s.credentials), username: s.credentials?.username || "", calendarId: s.calendarId || "",
      reminderMinutes: s.reminderMinutes === undefined ? 15 : s.reminderMinutes,
      calendars: (s.calendars || []).map(({id, name}) => ({id, name}))};
  };
  return {
    status,
    connect: (credentials: AppleCredentials) => exclusive(async () => {
      await readSettings(); // Require an unlocked vault before contacting Apple.
      const calendars = await (await remoteFactory(credentials)).calendars();
      if (!calendars.length) throw new Error("没有找到 iCloud 日历，请先在苹果日历中创建一个日历");
      await updateSettings(s => {
        if (s.credentials?.username !== credentials.username || !calendars.some(c => c.id === s.calendarId)) delete s.calendarId;
        s.credentials = credentials; s.calendars = calendars;
      });
      return status();
    }),
    refresh: () => exclusive(async () => {
      const s = await readSettings();
      const calendars = await (await remoteFactory(requireCredentials(s))).calendars();
      await updateSettings(current => { current.calendars = calendars; if (!calendars.some(c => c.id === current.calendarId)) delete current.calendarId; });
      return status();
    }),
    select: (selection: z.infer<typeof calendarSelectionSchema>) => exclusive(async () => {
      await updateSettings(s => {
        requireCredentials(s);
        if (!s.calendars?.some(c => c.id === selection.calendarId)) throw new Error("请选择已连接账号的日历");
        s.calendarId = selection.calendarId; s.reminderMinutes = selection.reminderMinutes;
      });
      return status();
    }),
    disconnect: () => exclusive(async () => {
      await updateSettings(s => { delete s.credentials; delete s.calendars; delete s.calendarId; });
      return status();
    }),
    sync: (id: string) => exclusive(async () => {
      const s = await readSettings();
      const credentials = requireCredentials(s);
      const calendar = s.calendars?.find(c => c.id === s.calendarId);
      if (!calendar) throw new Error("请先在账号与服务中选择目标日历并保存");
      const journey = (await readJourneys()).find(item => item.id === id);
      if (!journey) throw new Error("请先保存此行程，再同步到苹果日历");
      const remote = await remoteFactory(credentials);
      if (!(await remote.calendars()).some(c => c.url === calendar.url)) throw new Error("目标日历已不存在，请在账号与服务中刷新并重新选择");
      const key = calendarHash(`${credentials.username}\n${calendar.url}\n${id}`);
      const previous = s.syncs?.[key];
      const current = journey.events.map((event, index) => ({index, data: calendarEvent(journey, event, index, s.reminderMinutes === undefined ? 15 : s.reminderMinutes)}));
      const indexes = [...new Set([...(previous?.indexes || []), ...current.map(e => e.index)])];
      // Record planned resources before touching iCloud so interrupted attempts are retryable.
      await updateSettings(settings => { settings.syncs ||= {}; settings.syncs[key] = {...previous, indexes, pending: true}; });
      let completed = 0;
      const objectUrl = (index: number) => new URL(`what-${id}-${index}.ics`, calendar.url).href;
      const owned = (data: string, index: number) => data.replace(/\r?\n[ \t]/g, "").split(/\r?\n/).includes(`UID:${calendarUid(id, index)}`);
      try {
        for (const event of current) {
          const url = objectUrl(event.index);
          const existing = await remote.get(url);
          if (existing && !owned(existing.data, event.index)) throw new Error("日历中存在同名的其他日程，已停止同步");
          await remote.put(url, event.data, existing?.etag);
          completed++;
        }
        for (const index of indexes.filter(index => index >= current.length)) {
          const url = objectUrl(index);
          const existing = await remote.get(url);
          if (existing) {
            if (!owned(existing.data, index)) throw new Error("旧日程归属不匹配，已停止清理");
            await remote.remove(url, existing.etag);
          }
        }
        const lastSyncedAt = new Date().toISOString();
        await updateSettings(settings => { settings.syncs ||= {}; settings.syncs[key] = {indexes: current.map(e => e.index), lastSyncedAt, count: completed, pending: false}; });
        return {success: true, count: completed, calendarName: calendar.name, lastSyncedAt};
      } catch (error) {
        const reason = error instanceof Error ? error.message : "连接异常";
        throw new Error(`同步未完成（本次已写入 ${completed}/${current.length} 项）。${reason}。可再次点击同步，已写入日程不会重复创建。`);
      }
    }),
  };
}
export const calendarService = createCalendarService();
