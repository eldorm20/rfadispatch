import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Load } from "../types";

const STALE_MS = 45 * 60000;

function markerColor(l: Load): string {
  const t = l.tracking;
  if (!t?.updatedAt || Date.now() - t.updatedAt > STALE_MS) return "#7fa599"; // stale
  return t.inMotion ? "#4ade80" : "#facc15"; // rolling / stopped
}

/** Live truck map — circle pins (no icon assets), popup with load info. */
export function TrackingMap({ loads }: { loads: Load[] }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // init once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true, attributionControl: false }).setView([37.8, -96.9], 4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 18 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // refresh pins whenever loads change
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    const pts: L.LatLngExpression[] = [];
    loads.forEach((l) => {
      const t = l.tracking;
      if (t?.lat == null || t?.lng == null) return;
      pts.push([t.lat, t.lng]);
      const color = markerColor(l);
      L.circleMarker([t.lat, t.lng], {
        radius: 9,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.45,
      })
        .bindPopup(
          `<div style="font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.5">
             <strong style="font-size:13px">${esc(l.loadNumber)}</strong><br/>
             ${esc(l.origin)} → ${esc(l.destination)}<br/>
             ${l.driver ? `🚛 ${esc(l.driver)}<br/>` : ""}
             ${t.inMotion ? "▶ Rolling" : "⏸ Stopped"}${t.eta ? ` · ETA ${new Date(t.eta).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
           </div>`
        )
        .addTo(layer);
    });

    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 7 });
  }, [loads]);

  return (
    <div
      ref={divRef}
      className="card"
      style={{ height: 380, padding: 0, overflow: "hidden", marginBottom: 16, background: "#0a1f1d" }}
    />
  );
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
