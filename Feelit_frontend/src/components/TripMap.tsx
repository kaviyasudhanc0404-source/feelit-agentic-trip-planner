import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { clockText, cx } from "@/lib/format";
import type { Place, Stop } from "@/lib/types";

interface Props {
  stops: Stop[];
  centre: Place;
  /** "night" darkens the OpenStreetMap tiles; "paper" gives them a soft printed look. */
  tone?: "night" | "paper";
  /** The stop to highlight and fly to. */
  active?: string | null;
  onPick?: (id: string) => void;
  className?: string;
}

/** A day's stops as numbered pins joined by the route. Pins are clickable and one can be highlighted. */
export default function TripMap({ stops, centre, tone = "night", active, onPick, className }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const layer = useRef<L.LayerGroup>();
  const markers = useRef(new Map<string, L.Marker>());
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    map.current = L.map(holder.current!, { scrollWheelZoom: false, attributionControl: true, dragging: !L.Browser.mobile, tapHold: false });
    // Standard OpenStreetMap tiles (no key needed), restyled in CSS to match the layout.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      className: tone === "paper" ? "map-tiles-paper" : "map-tiles-dark",
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    // The holder can change size with the layout (sticky panels, tabs); keep the tiles filling it.
    const resize = new ResizeObserver(() => map.current?.invalidateSize());
    resize.observe(holder.current!);
    return () => {
      resize.disconnect();
      map.current?.remove();
    };
  }, [tone]);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    markers.current.clear();
    const points = stops.map((stop) => [stop.lat!, stop.lon!] as L.LatLngTuple);
    stops.forEach((stop, index) => {
      const marker = L.marker(points[index], { icon: L.divIcon({ className: "", html: `<div class="pin">${index + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) })
        .bindTooltip(`${clockText(stop.time)} · ${stop.name.replace(/[<>&]/g, "")}`)
        .on("click", () => pick.current?.(stop.id))
        .addTo(layer.current!);
      markers.current.set(stop.id, marker);
    });
    if (points.length > 1) L.polyline(points, { color: tone === "paper" ? "#7a5a3a" : "#FF9F45", weight: 3, dashArray: "2 9", lineCap: "round" }).addTo(layer.current);
    if (points.length) map.current.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 15 });
    else map.current.setView([centre.lat, centre.lon], 12);
  }, [stops, centre, tone]);

  useEffect(() => {
    markers.current.forEach((marker, id) => {
      marker.getElement()?.firstElementChild?.classList.toggle("pin-active", id === active);
      if (id === active) {
        marker.openTooltip();
        map.current?.panTo(marker.getLatLng(), { animate: true });
      } else marker.closeTooltip();
    });
  }, [active, stops]);

  return <div ref={holder} className={cx("w-full", className ?? "h-72 lg:h-80")} aria-label="Map of this day's stops" />;
}
