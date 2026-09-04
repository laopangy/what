import type { Place, RouteLeg, TravelMode } from "./journeyTypes.js";
import { createHash } from "node:crypto";
import { providerQueue } from "./providerQueue.js";

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const str = (value: unknown): string => typeof value === "string" ? value : "";
export class ProviderError extends Error {}
const inFlight = new Map<string, Promise<Json>>();
const rateCodes = new Set(["10014", "10019", "10020", "10021", "10022", "10023"]);
export function providerErrorMessage(code: string): string {
  if (rateCodes.has(code)) return "高德请求过于频繁（代码 " + code + "）：接口 QPS 超限，已限速并重试。请稍后再试；若持续发生，请在高德控制台检查该账号接口的并发配额及其他应用调用";
  const messages: Record<string, string> = {
    "10001": "Key 无效，请检查 Web 服务 Key",
    "10003": "当日调用额度已用完，请查看高德控制台配额",
    "10004": "权限不足，请检查所需服务是否已开通",
    "10005": "服务器 IP 不在高德白名单中",
    "10006": "域名不在高德白名单中",
    "10007": "签名验证失败，请检查签名配置",
    "10009": "Key 平台类型不匹配，后端需要 Web 服务类型 Key",
    "10012": "权限不足，请检查接口访问权限",
    "10013": "Key 已删除，请重新配置",
  };
  return "高德请求失败（代码 " + code + "）：" + (messages[code] || "请检查服务状态、配置和配额");
}
export function coordinates(value: unknown): [number, number] | null {
  if (typeof value !== "string" || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(value)) return null;
  const [lng, lat] = value.split(",").map(Number);
  return Math.abs(lng) <= 180 && Math.abs(lat) <= 90 ? [lng, lat] : null;
}
const coordString = (p: Place) => p.location.map(n => n.toFixed(6)).join(",");
function collectPaths(value: unknown): [number, number][][] {
  if (Array.isArray(value)) return value.flatMap(collectPaths);
  const record = obj(value);
  const paths: [number, number][][] = [];
  if (typeof record.polyline === "string") {
    const points = record.polyline.split(";").map(coordinates).filter((p): p is [number, number] => p !== null);
    if (points.length > 1) paths.push(points);
  }
  for (const [key, child] of Object.entries(record)) {
    if (key !== "polyline" && child && typeof child === "object") paths.push(...collectPaths(child));
  }
  return paths;
}
function collectInstructions(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectInstructions);
  const record = obj(value);
  const own = str(record.instruction) || str(record.name);
  return [...(own ? [own] : []), ...Object.values(record).filter(v => v && typeof v === "object").flatMap(collectInstructions)].slice(0, 120);
}
export class Amap {
  constructor(private key: string, private fetcher: typeof fetch = fetch) {}
  private async request(path: string, params: Record<string, string>): Promise<Json> {
    if (!this.key) throw new ProviderError("请先配置高德 Web 服务 Key");
    const identity = createHash("sha256").update(JSON.stringify([this.key, path, params])).digest("hex");
    const existing = inFlight.get(identity);
    if (existing) return existing;
    const pending = (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await providerQueue.run(() => this.fetchOnce(path, params)); }
        catch (error) {
          if (!(error instanceof RateLimitError) || attempt === 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      }
      throw new ProviderError("地图查询未完成，请重试");
    })();
    inFlight.set(identity, pending);
    try { return await pending; } finally { inFlight.delete(identity); }
  }
  private async fetchOnce(path: string, params: Record<string, string>): Promise<Json> {
    let response: Response;
    try {
      response = await this.fetcher("https://restapi.amap.com" + path + "?" + new URLSearchParams({ ...params, key: this.key }), {
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw new ProviderError("高德连接失败或超时，请检查网络后重试"); }
    if (response.status === 429) throw new RateLimitError(providerErrorMessage("10021"));
    if (!response.ok) throw new ProviderError("高德服务暂不可用，请稍后重试");
    const data = obj(await response.json().catch(() => null));
    if (data.status !== "1") {
      const code = /^\d{5}$/.test(str(data.infocode)) ? str(data.infocode) : "未知";
      if (rateCodes.has(code)) throw new RateLimitError(providerErrorMessage(code));
      throw new ProviderError(providerErrorMessage(code));
    }
    return data;
  }
  async search(query: string, options: { near?: Place; type?: string; region?: string; explore?: boolean } = {}): Promise<Place[]> {
    const data = await this.request(options.near ? "/v5/place/around" : "/v5/place/text", {
      ...(query ? { keywords: query } : {}),
      ...(options.type ? { types: options.type } : {}),
      ...(options.region ? { region: options.region } : {}),
      ...(options.near ? { location: coordString(options.near), radius: "50000", sortrule: options.explore ? "weight" : "distance" } : {}),
      page_size: options.explore ? "25" : "12", show_fields: "photos",
    });
    return list(data.pois).flatMap(item => {
      const p = obj(item); const location = coordinates(p.location);
      if (!location || !str(p.id) || !str(p.name)) return [];
      return [{
        id: str(p.id), name: str(p.name), address: [p.pname, p.cityname, p.adname, p.address].map(str).filter(Boolean).join(" "),
        location, citycode: str(p.citycode), adcode: str(p.adcode),
        photos: list(p.photos).flatMap(photo => {
          const url = str(obj(photo).url);
          if (!/^https?:\/\//.test(url)) return [];
          return [{ url: url.replace(/^http:/, "https:"), title: str(obj(photo).title) || str(p.name) }];
        }).slice(0, 5),
      }];
    });
  }
  async route(from: Place, to: Place, mode: TravelMode | "walking", date: string, time: string): Promise<RouteLeg> {
    if (from.location[0] === to.location[0] && from.location[1] === to.location[1]) {
      return { from, to, mode, minutes: 0, km: 0, paths: [], instructions: [], queriedAt: new Date().toISOString(), source: "amap" };
    }
    const transit = mode === "rail" || mode === "transit";
    if (transit && (!from.citycode || !to.citycode)) throw new ProviderError("该地点缺少城市编码，请换选具体地点后查询公共交通");
    const data = await this.request("/v5/direction/" + (transit ? "transit/integrated" : mode === "cycling" ? "bicycling" : mode), {
      origin: coordString(from), destination: coordString(to), show_fields: "cost,polyline",
      ...(transit ? { city1: from.citycode, city2: to.citycode, date, time: time.replace(":", "-"), AlternativeRoute: "5" } : {}),
    });
    const route = obj(data.route);
    const alternatives = list(transit ? route.transits : route.paths).map(obj);
    const selected = mode === "rail" ? alternatives.find(p => list(p.segments).some(s => {
      const railway = obj(obj(s).railway);
      return Boolean(str(railway.name) || str(railway.id) || list(railway.steps).length);
    })) : alternatives[0];
    if (!selected) throw new ProviderError(mode === "rail" ? "高德未返回含铁路的可用方案。请核实车次或改选公共交通/自驾，不会用驾车时间代替高铁" : "高德未找到可用路线，请更换地点或交通方式");
    const durationValue = obj(selected.cost).duration ?? selected.duration;
    const distanceValue = selected.distance;
    if ((typeof durationValue !== "string" && typeof durationValue !== "number") || String(durationValue).trim() === "" ||
        (typeof distanceValue !== "string" && typeof distanceValue !== "number") || String(distanceValue).trim() === "")
      throw new ProviderError("高德路线缺少时间或距离，无法校验行程");
    const minutes = Math.ceil(Number(durationValue) / 60); const km = Number(distanceValue) / 1000;
    if (!Number.isFinite(minutes) || !Number.isFinite(km) || minutes <= 0 || km < 0) throw new ProviderError("高德返回的路线数据不完整");
    return { from, to, mode, minutes, km, paths: collectPaths(selected), instructions: collectInstructions(selected),
      queriedAt: new Date().toISOString(), source: "amap",
      ...(transit ? { warning: "公共交通为高德换乘参考，车次、票价、余票和未来班次请向运营方核实" } : {}),
    };
  }
}
class RateLimitError extends ProviderError {}
