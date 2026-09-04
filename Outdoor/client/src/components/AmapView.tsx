import { useEffect, useRef, useState } from "react";
import { Map, RotateCcw } from "lucide-react";
import { journeyApi } from "../journeyApi";
import type { Place, RouteLeg } from "../journeyTypes";
type Coordinate = [number, number];
interface Overlay { on(event: string, callback: () => void): void }
interface MapInstance {
  add(overlays: Overlay[]): void; destroy(): void; setFitView(): void; setCenter(point: Coordinate): void;
  on(event: string, callback: () => void): void;
}
interface AmapSdk {
  Map: new (container: HTMLElement, options: object) => MapInstance;
  Marker: new (options: object) => Overlay;
  Polyline: new (options: object) => Overlay;
}
declare global { interface Window { AMap?: AmapSdk; _AMapSecurityConfig?: { securityJsCode: string } } }
let sdkPromise: Promise<AmapSdk> | undefined;
function loadSdk(): Promise<AmapSdk> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (!sdkPromise) sdkPromise = journeyApi.sdk().then(config => new Promise<AmapSdk>((resolve, reject) => {
    window._AMapSecurityConfig = { securityJsCode: config.securityCode };
    const script = document.createElement("script");
    const timer = window.setTimeout(() => { script.remove(); reject(new Error("高德地图加载超时，请检查网络、Key 与域名白名单")); }, 20000);
    script.src = "https://webapi.amap.com/maps?v=2.0&key=" + encodeURIComponent(config.key);
    script.onload = () => { clearTimeout(timer); window.AMap ? resolve(window.AMap) : reject(new Error("高德地图初始化失败")); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error("无法加载高德地图，请检查网络")); };
    document.head.appendChild(script);
  })).catch(error => { sdkPromise = undefined; throw error; });
  return sdkPromise;
}
export default function AmapView({ ready, places, legs, selected, onSelect }: {
  ready: boolean; places: Place[]; legs: RouteLeg[]; selected?: string; onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<MapInstance | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const selectRef = useRef(onSelect); selectRef.current = onSelect;
  const dataRef = useRef({ places, legs }); dataRef.current = {places, legs};
  const fingerprint = JSON.stringify({places, legs});
  useEffect(() => {
    if (!ready || !container.current) return;
    let disposed = false;
    let completionTimer: number | undefined;
    setLoading(true); setError("");
    void loadSdk().then(sdk => {
      if (disposed || !container.current) return;
      const data = dataRef.current;
      const map = new sdk.Map(container.current, { zoom: data.places.length ? 11 : 4, ...(data.places[0] ? {center: data.places[0].location} : {}), mapStyle: "amap://styles/normal" });
      instance.current = map;
      completionTimer = window.setTimeout(() => {
        if (!disposed) { setLoading(false); setError("底图未完成加载，请检查高德 Key 权限、白名单及网络后重试"); }
      }, 20000);
      map.on("complete", () => {
        if (!disposed) { clearTimeout(completionTimer); setLoading(false); setError(""); }
      });
      const overlays: Overlay[] = data.places.map((place, i) => {
        const marker = new sdk.Marker({ position: place.location, title: place.name, label: {content: String(i + 1), direction: "top"} });
        marker.on("click", () => selectRef.current(place.id)); return marker;
      });
      for (const leg of data.legs) for (const path of leg.paths) {
        overlays.push(new sdk.Polyline({path, strokeColor: leg.mode === "walking" || leg.mode === "cycling" ? "#169b69" : "#477aba", strokeWeight: 5, showDir: true}));
      }
      map.add(overlays); if (overlays.length) map.setFitView();
    }).catch(e => { if (!disposed) { setError((e as Error).message); setLoading(false); } });
    return () => { disposed = true; clearTimeout(completionTimer); instance.current?.destroy(); instance.current = null; };
  }, [ready, fingerprint, retry]);
  useEffect(() => { const place = places.find(p => p.id === selected); if (place) instance.current?.setCenter(place.location); }, [selected, places]);
  return <section className="ow-map">
    <div ref={container} className="ow-map-canvas" />
    {(!ready || error || loading) && <div className="ow-map-state"><Map size={36}/><h3>{!ready ? "连接高德，展开你的路线" : loading ? "正在加载高德地图" : "地图暂不可用"}</h3>
      <p>{!ready ? "请在工作台「账号与服务」设置中填写高德 Key。配置前不会展示模拟地图或虚构路线。" : error || "地图数据由高德提供，行程时间仍需出发前核实。"}</p>
      {error && <button className="ow-button" onClick={() => setRetry(n => n + 1)}><RotateCcw size={14}/>重试地图</button>}
    </div>}
  </section>;
}
