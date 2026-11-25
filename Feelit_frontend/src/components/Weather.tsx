import { useQuery } from "@tanstack/react-query";
import { Droplets, Wind } from "lucide-react";
import { api } from "@/lib/api";
import { aqiLabel, cx, weatherIcon } from "@/lib/format";
import { RAINY } from "@/lib/tripStyle";
import type { Place, Weather } from "@/lib/types";


/** Live forecast for a place, refreshed every 30 minutes. */
export function useWeather(place?: Place) {
  return useQuery({
    queryKey: ["weather", place?.lat.toFixed(2), place?.lon.toFixed(2)],
    queryFn: () => api.weather(place!.lat, place!.lon),
    enabled: Boolean(place),
    staleTime: 30 * 60_000,
    retry: 1,
  });
}

export function WeatherNow({ weather, className }: { weather: Weather; className?: string }) {
  const { temp, code, label, aqi } = weather.current;
  const Icon = weatherIcon(code);
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <span className="inline-flex items-center gap-1.5 font-semibold"><Icon className="h-5 w-5 text-gold" />{temp}°C · {label}</span>
      {aqi != null && <span className="inline-flex items-center gap-1 text-sm opacity-80"><Wind className="h-4 w-4" />AQI {aqi} · {aqiLabel(aqi)}</span>}
    </span>
  );
}

/** Forecast for one trip day; says so when the date is still too far away to forecast. */
export function DayWeather({ weather, date }: { weather?: Weather; date: string }) {
  const day = weather?.daily.find((row) => row.date === date);
  if (!day) return <span className="font-mono text-[10px] opacity-60">{weather ? "forecast soon" : "…"}</span>;
  const Icon = weatherIcon(day.code);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
      <Icon className="h-3.5 w-3.5" />{day.max}°/{day.min}°
      <span className={cx("inline-flex items-center gap-0.5", day.rain >= RAINY && "text-sky")}><Droplets className="h-3 w-3" />{day.rain}%</span>
    </span>
  );
}
