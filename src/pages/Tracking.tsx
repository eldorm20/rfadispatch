import { useMemo } from "react";
import { useLoads } from "../hooks/useLoads";
import { StatusPill } from "../components/StatusPill";
import { relativeTime } from "../lib/format";
import type { Load } from "../types";

function etaText(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Motion({ load }: { load: Load }) {
  const t = load.tracking;
  const stale = !t?.updatedAt || Date.now() - t.updatedAt > 45 * 60000; // no ping in 45m
  if (!t || (t.lat == null && !t.updatedAt)) {
    return <span className="status" style={{ background: "transparent", color: "var(--muted)" }}>No signal</span>;
  }
  if (stale) return <span className="status" style={{ background: "rgba(127,165,153,.14)", color: "var(--muted)" }}>● Stale</span>;
  return t.inMotion ? (
    <span className="status" style={{ background: "rgba(74,222,128,.14)", color: "var(--green)" }}>▶ Rolling</span>
  ) : (
    <span className="status" style={{ background: "rgba(250,204,21,.14)", color: "var(--gold)" }}>⏸ Stopped</span>
  );
}

export function Tracking() {
  const { loads, loading } = useLoads();

  const rows = useMemo(
    () =>
      loads
        .filter((l) => l.status === "in_transit" || l.status === "dispatched" || l.tracking?.updatedAt)
        .sort((a, b) => (b.tracking?.updatedAt ?? 0) - (a.tracking?.updatedAt ?? 0)),
    [loads]
  );

  const rolling = rows.filter((l) => l.tracking?.inMotion && Date.now() - (l.tracking?.updatedAt ?? 0) < 45 * 60000).length;

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Tracking</h2>
          <p>Live GPS, ETA and motion from Amazon — {rolling} rolling now.</p>
        </div>
        <span className="chip"><span className="dot live" /> Real-time</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="big">📡</div>
          <p>No active loads to track. Locations appear here once trips are in transit (synced by the extension).</p>
        </div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Load #</th>
                <th>Lane</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Motion</th>
                <th>ETA</th>
                <th>Last ping</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const t = l.tracking;
                return (
                  <tr key={l.id}>
                    <td className="mono">{l.loadNumber}</td>
                    <td>{l.origin} <span className="muted">→</span> {l.destination}</td>
                    <td className="muted">{l.driver || "—"}</td>
                    <td><StatusPill status={l.status} /></td>
                    <td><Motion load={l} /></td>
                    <td className="mono">{etaText(t?.eta ?? l.amazon?.stops?.find((s) => s.scheduledArrival)?.scheduledArrival)}</td>
                    <td className="muted">{relativeTime(t?.updatedAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      {t?.lat != null && t?.lng != null && (
                        <a className="btn ghost sm" href={`https://maps.google.com/?q=${t.lat},${t.lng}`} target="_blank" rel="noreferrer">📍 Map</a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
