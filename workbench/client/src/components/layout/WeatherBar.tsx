import { useState, useEffect } from "react";
import { Cloud, CloudRain, Sun, Wind, CloudLightning, CloudSnow, CloudFog } from "lucide-react";

function getWeatherIcon(condition: string) {
  const c = condition;
  if (c.includes("雨")) return CloudRain;
  if (c.includes("雪")) return CloudSnow;
  if (c.includes("雾") || c.includes("霾")) return CloudFog;
  if (c.includes("雷")) return CloudLightning;
  if (c.includes("风")) return Wind;
  if (c.includes("晴")) return Sun;
  return Cloud;
}

export default function WeatherBar() {
  const [weather, setWeather] = useState<{
    condition: string; temp: string; humidity: string; location: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchWeather() {
      try {
        const res = await fetch(
          "https://wttr.in/Shanghai?format=j1&lang=zh",
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const c = data.current_condition?.[0];
        if (c) {
          setWeather({
            condition: c.weatherDesc?.[0]?.value || "",
            temp: c.temp_C || "",
            humidity: c.humidity || "",
            location: data.nearest_area?.[0]?.areaName?.[0]?.value || "上海",
          });
        }
      } catch { /* silent */ }
    }
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!weather) return null;

  const Icon = getWeatherIcon(weather.condition);

  return (
    <div className="mx-1 px-2.5 py-2 space-y-1 rounded-lg border border-border/45 bg-bg/25">
      <div className="flex items-center gap-2 text-[11px] text-text-dim/70">
        <Icon className="w-3.5 h-3.5 text-accent-dim/80 shrink-0" strokeWidth={1.7} />
        <span className="truncate">{weather.location}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-text font-semibold">{weather.temp}°C</span>
        <span className="text-text-dim/60 truncate">{weather.condition}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-text-dim/50">
        <span>💧 {weather.humidity}%</span>
      </div>
    </div>
  );
}
