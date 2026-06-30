import { useMemo, useState } from "react";
import { useLoads } from "../hooks/useLoads";
import { StatusPill } from "../components/StatusPill";
import { money, shortDate, todayISO } from "../lib/format";
import { printDailyReport } from "../lib/printReport";
import type { Load } from "../types";

function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function Reports() {
  const { loads, loading } = useLoads();
  const [date, setDate] = useState<string>(todayISO());

  // Group all loads by the day they were booked.
  const byDay = useMemo(() => {
    const map = new Map<string, Load[]>();
    loads.forEach((l) => {
      if (l.status === "cancelled") return;
      const d = dayOf(l.createdAt);
      (map.get(d) ?? map.set(d, []).get(d)!).push(l);
    });
    return map;
  }, [loads]);

  // Recent days, newest first, with totals — the "history" rail.
  const history = useMemo(() => {
    return [...byDay.entries()]
      .map(([d, items]) => ({
        date: d,
        count: items.length,
        gross: items.reduce((s, l) => s + (l.gross || 0), 0),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [byDay]);

  const dayLoads = byDay.get(date) ?? [];
  const dayGross = dayLoads.reduce((s, l) => s + (l.gross || 0), 0);
  const best = dayLoads.reduce((m, l) => Math.max(m, l.gross || 0), 0);

  const perDispatcher = useMemo(() => {
    const m = new Map<string, { name: string; gross: number; count: number }>();
    dayLoads.forEach((l) => {
      const cur = m.get(l.dispatcherName) ?? { name: l.dispatcherName, gross: 0, count: 0 };
      cur.gross += l.gross || 0;
      cur.count += 1;
      m.set(l.dispatcherName, cur);
    });
    return [...m.values()].sort((a, b) => b.gross - a.gross);
  }, [dayLoads]);

  function downloadPdf() {
    printDailyReport({ date, loads: dayLoads, perDispatcher, gross: dayGross, best });
  }

  const isToday = date === todayISO();

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Reports</h2>
          <p>Daily history — gross and loads for any past day.</p>
        </div>
        <div className="row" style={{ flex: "0 0 auto", alignItems: "flex-end" }}>
          <div className="field" style={{ width: 170 }}>
            <label>Day</label>
            <input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {!isToday && (
            <button className="btn ghost" onClick={() => setDate(todayISO())}>
              ↩ Today
            </button>
          )}
          <button className="btn" onClick={downloadPdf} disabled={dayLoads.length === 0}>
            ⤓ PDF
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "260px 1fr", alignItems: "start" }}>
        {/* History rail */}
        <div className="card" style={{ padding: 10 }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, padding: "6px 8px" }}>
            History
          </div>
          {history.length === 0 && <div className="muted" style={{ padding: 8, fontSize: 13 }}>No data yet.</div>}
          {history.map((h) => (
            <button
              key={h.date}
              onClick={() => setDate(h.date)}
              className="spread"
              style={{
                width: "100%",
                textAlign: "left",
                background: h.date === date ? "rgba(45,212,191,0.1)" : "transparent",
                border: "1px solid " + (h.date === date ? "var(--line-strong)" : "transparent"),
                color: "var(--text)",
                borderRadius: 10,
                padding: "9px 10px",
                cursor: "pointer",
                marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 13 }}>
                {shortDate(h.date)}
                {h.date === todayISO() && <span className="muted"> · today</span>}
                <div className="muted" style={{ fontSize: 11 }}>{h.count} loads</div>
              </span>
              <strong className="mono" style={{ fontSize: 13 }}>{money(h.gross)}</strong>
            </button>
          ))}
        </div>

        {/* Selected day */}
        <div>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <Kpi label="Gross" value={money(dayGross)} cls="good" />
            <Kpi label="Loads" value={String(dayLoads.length)} />
            <Kpi label="Avg / Load" value={money(dayLoads.length ? dayGross / dayLoads.length : 0)} />
            <Kpi label="Best Load" value={money(best)} cls="gold" />
          </div>

          {perDispatcher.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>By dispatcher</h3>
              <div className="grid" style={{ gap: 8 }}>
                {perDispatcher.map((d) => (
                  <div key={d.name} className="spread">
                    <span style={{ fontSize: 13 }}>
                      {d.name} <span className="muted">· {d.count} loads</span>
                    </span>
                    <strong className="mono">{money(d.gross)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dayLoads.length === 0 ? (
            <div className="empty">
              <div className="big">📅</div>
              <p>No loads booked on {shortDate(date)}.</p>
            </div>
          ) : (
            <div className="card table-wrap" style={{ padding: 0 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Load #</th>
                    <th>Lane</th>
                    <th>Carrier</th>
                    <th>Dispatcher</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {dayLoads.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">{l.loadNumber}</td>
                      <td>
                        {l.origin} <span className="muted">→</span> {l.destination}
                      </td>
                      <td>{l.carrier}</td>
                      <td className="muted">{l.dispatcherName}</td>
                      <td>
                        <StatusPill status={l.status} />
                      </td>
                      <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{money(l.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="kpi">
      <div className="k-label">{label}</div>
      <div className={"k-value " + (cls ?? "")}>{value}</div>
    </div>
  );
}
