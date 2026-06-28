import { useMemo } from "react";
import { useLoads } from "../hooks/useLoads";
import { money } from "../lib/format";
import { todayISO } from "../lib/format";
import type { Load } from "../types";

export function Dashboard() {
  const { loads, loading } = useLoads();

  const stats = useMemo(() => computeStats(loads), [loads]);

  if (loading) return <div className="empty">Loading dashboard…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>Live overview across the whole team.</p>
        </div>
        <span className="chip">
          <span className="dot live" /> Real-time
        </span>
      </div>

      {/* Hero gross */}
      <div className="card" style={{ textAlign: "center", padding: "34px 20px", marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase" }}>
          Total Gross · Today
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, margin: "8px 0", color: "var(--green)" }}>{money(stats.todayGross)}</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {stats.todayCount} load{stats.todayCount === 1 ? "" : "s"} booked today · {money(stats.allGross)} all-time
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 20 }}>
        <Kpi label="Active Loads" value={String(stats.activeCount)} />
        <Kpi label="In Transit" value={String(stats.inTransit)} cls="accent" />
        <Kpi label="Delivered (today)" value={String(stats.deliveredToday)} cls="good" />
        <Kpi label="Avg / Load" value={money(stats.avg)} />
        <Kpi label="Best Load" value={money(stats.best)} cls="good" />
        <Kpi label="Top Dispatcher" value={stats.topDispatcher || "—"} cls="gold" />
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Dispatcher Leaderboard · Today</h3>
        {stats.leaderboard.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>No loads booked today yet.</p>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {stats.leaderboard.map((d, i) => {
              const pct = stats.todayGross ? (d.gross / stats.todayGross) * 100 : 0;
              return (
                <div key={d.name}>
                  <div className="spread" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>
                      <span className="muted mono">{i + 1}.</span> {d.name}{" "}
                      <span className="muted">· {d.count} loads</span>
                    </span>
                    <strong className="mono">{money(d.gross)}</strong>
                  </div>
                  <div style={{ height: 8, background: "rgba(127,165,153,0.14)", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, var(--teal-2), var(--green))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

function isToday(ms: number): boolean {
  return new Date(ms).toISOString().slice(0, 10) === todayISO();
}

function computeStats(loads: Load[]) {
  const active = loads.filter((l) => l.status !== "cancelled" && l.status !== "invoiced");
  const today = loads.filter((l) => isToday(l.createdAt) && l.status !== "cancelled");
  const todayGross = today.reduce((s, l) => s + (l.gross || 0), 0);
  const allGross = loads.filter((l) => l.status !== "cancelled").reduce((s, l) => s + (l.gross || 0), 0);

  const board = new Map<string, { name: string; gross: number; count: number }>();
  today.forEach((l) => {
    const cur = board.get(l.dispatcherName) ?? { name: l.dispatcherName, gross: 0, count: 0 };
    cur.gross += l.gross || 0;
    cur.count += 1;
    board.set(l.dispatcherName, cur);
  });
  const leaderboard = [...board.values()].sort((a, b) => b.gross - a.gross);

  return {
    todayGross,
    allGross,
    todayCount: today.length,
    activeCount: active.length,
    inTransit: loads.filter((l) => l.status === "in_transit").length,
    deliveredToday: loads.filter((l) => l.status === "delivered" && isToday(l.updatedAt)).length,
    avg: today.length ? todayGross / today.length : 0,
    best: today.reduce((m, l) => Math.max(m, l.gross || 0), 0),
    topDispatcher: leaderboard[0]?.name ?? "",
    leaderboard,
  };
}
