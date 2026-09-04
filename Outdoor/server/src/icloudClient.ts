import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { createDAVClient } from "tsdav";

// Provider debug output may include account URLs; suppress only its namespaces.
const debug = createRequire(import.meta.url)("debug") as {enable: (namespaces: string) => void; namespaces: string};
debug.enable([debug.namespaces, "-tsdav:*"].filter(Boolean).join(","));

export type AppleCredentials = { username: string; password: string };
export type AppleCalendar = { id: string; name: string; url: string };
export type RemoteEvent = { data: string; etag: string };
export interface CalendarRemote {
  calendars(): Promise<AppleCalendar[]>;
  get(url: string): Promise<RemoteEvent | null>;
  put(url: string, data: string, etag?: string): Promise<void>;
  remove(url: string, etag: string): Promise<void>;
}
export const calendarHash = (value: string) => createHash("sha256").update(value).digest("hex");

export function appleUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !(url.hostname === "caldav.icloud.com" || /^p\d+-caldav\.icloud\.com$/.test(url.hostname)) || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error("iCloud 返回了不支持的日历地址");
  }
  return url;
}

export function responseError(status: number): Error {
  if (status === 401) return new Error("iCloud 登录失败，请检查 Apple 账号和 App 专用密码；不能使用 Apple 账户登录密码");
  if (status === 403) return new Error("此 iCloud 日历不允许写入，请选择自己的可编辑日历");
  if (status === 409 || status === 412) return new Error("日历正在被其他设备修改，请稍后重新同步");
  if (status === 429) return new Error("iCloud 请求过于频繁，请稍后再试");
  return new Error(`iCloud 服务请求失败（${status}），请稍后重试`);
}

// Validate every redirect before forwarding credentials; never expose provider bodies/errors.
export function createAppleFetch(transport: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    let url = appleUrl(input instanceof Request ? input.url : String(input));
    const signal = AbortSignal.timeout(20_000);
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await transport(url, { ...init, redirect: "manual", signal });
        if ([301, 302, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          if (!location) throw new Error("redirect");
          url = appleUrl(new URL(location, url).href);
          if (init?.redirect === "manual") return response;
          await response.body?.cancel();
          continue;
        }
        if (!response.ok && response.status !== 404) { await response.body?.cancel(); throw responseError(response.status); }
        return response;
      }
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith("iCloud") || error.message.startsWith("此 iCloud") || error.message.startsWith("日历正在"))) throw error;
      throw new Error("无法连接 iCloud，请检查网络后重试");
    }
    throw new Error("iCloud 重定向次数过多，请稍后重试");
  };
}

export async function connectApple(credentials: AppleCredentials, transport: typeof fetch = fetch): Promise<CalendarRemote> {
  const safeFetch = createAppleFetch(transport);
  let client: Awaited<ReturnType<typeof createDAVClient>>;
  try {
    client = await createDAVClient({serverUrl: "https://caldav.icloud.com", credentials, authMethod: "Basic", defaultAccountType: "caldav", fetch: safeFetch});
  } catch {
    throw new Error("无法连接 iCloud，请检查网络、Apple 账号和 App 专用密码，并确认已启用 iCloud 日历");
  }
  const headers = { Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}` };
  return {
    async calendars() {
      try {
        const items = await client.fetchCalendars();
        return items.filter(item => !item.components?.length || item.components.includes("VEVENT")).map(item => {
          const url = appleUrl(item.url).href.replace(/\/?$/, "/");
          return {id: calendarHash(url), name: typeof item.displayName === "string" ? item.displayName : "未命名日历", url};
        });
      } catch { throw new Error("无法读取 iCloud 日历，请检查连接后重试"); }
    },
    async get(url) {
      const response = await safeFetch(url, {headers});
      if (response.status === 404) return null;
      const etag = response.headers.get("etag");
      if (!etag) throw new Error("iCloud 未返回版本标记，暂不覆盖日程，请稍后重试");
      return {data: await response.text(), etag};
    },
    async put(url, data, etag) {
      const response = await safeFetch(url, {method: "PUT", headers: {...headers, "Content-Type": "text/calendar; charset=utf-8", ...(etag ? {"If-Match": etag} : {"If-None-Match": "*"})}, body: data});
      if (!response.ok) throw responseError(response.status);
      await response.body?.cancel();
    },
    async remove(url, etag) {
      const response = await safeFetch(url, {method: "DELETE", headers: {...headers, "If-Match": etag}});
      if (!response.ok && response.status !== 404) throw responseError(response.status);
      await response.body?.cancel();
    },
  };
}
