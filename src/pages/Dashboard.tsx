import { useEffect, useMemo, useRef } from "react";
import { useLoads } from "../hooks/useLoads";
import { useSettings } from "../hooks/useSettings";
import { useUsers } from "../hooks/useUsers";
import { StatusPill } from "../components/StatusPill";
import { money, todayISO } from "../lib/format";
import { fireConfetti, playFanfare } from "../lib/celebrate";
import type { Load } from "../types";

export function Dashboard() {
  const { loads, loading } = useLoads();
  const settings = useSettings();
  const users = useUsers();

  const stats = useMemo(() => computeStats(loads), [loads]);

  // Map dispatcher name -> team for the audit board.
  const teamByName = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => m.set(u.name, u.team ?? ""));
    return m;
  }, [users]);

  // Today's loads grouped by TEAM, then by dispatcher within each team — the audit view.
  const audit = useMemo(() => {
    const today = loads.filter((l) => new Date(l.createdAt).toISOString().slice(0, 10) === todayISO() && l.status !== "cancelled");
    // team -> dispatcher -> loads
    const teams = new Map<string, Map<string, Load[]>>();
    today.forEach((l) => {
      const team = teamByName.get(l.dispatcherName) || "Unassigned";
      const byDisp = teams.get(team) ?? teams.set(team, new Map()).get(team)!;
      (byDisp.get(l.dispatcherName) ?? byDisp.set(l.dispatcherName, []).get(l.dispatcherName)!).push(l);
    });
    return [...teams.entries()]
      .map(([team, byDisp]) => {
        const dispatchers = [...byDisp.entries()]
          .map(([name, ls]) => ({ name, loads: ls, gross: ls.reduce((s, l) => s + l.gross, 0) }))
          .sort((a, b) => b.gross - a.gross);
        return {
          team,
          dispatchers,
          loadCount: dispatchers.reduce((s, d) => s + d.loads.length, 0),
          gross: dispatchers.reduce((s, d) => s + d.gross, 0),
        };
      })
      .sort((a, b) => b.gross - a.gross);
  }, [loads, teamByName]);

  const goal = settings.dailyGoal || 0;
  const goalPct = goal > 0 ? Math.min(100, (stats.todayGross / goal) * 100) : 0;
  const baseline = settings.baseline || 0;
  const baselinePct = baseline > 0 ? ((stats.todayGross - baseline) / baseline) * 100 : null;

  // Confetti when today's gross crosses the goal — fire once per goal value.
  const firedFor = useRef<number | null>(null);
  useEffect(() => {
    if (goal > 0 && stats.todayGross >= goal) {
      if (firedFor.current !== goal) {
        firedFor.current = goal;
        fireConfetti();
        try {
          playFanfare();
        } catch {
          /* audio not allowed yet */
        }
      }
    } else {
      firedFor.current = null; // re-arm if it drops back below
    }
  }, [stats.todayGross, goal]);

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "8px 0" }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: "var(--green)" }}>{money(stats.todayGross)}</div>
          {baselinePct !== null && (
            <span
              className="status"
              style={{
                fontSize: 13,
                color: baselinePct >= 0 ? "var(--green)" : "var(--red)",
                background: baselinePct >= 0 ? "rgba(74,222,128,0.16)" : "rgba(248,113,113,0.16)",
              }}
            >
              {baselinePct >= 0 ? "▲" : "▼"} {Math.abs(baselinePct).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {stats.todayCount} load{stats.todayCount === 1 ? "" : "s"} booked today · {money(stats.allGross)} all-time
        </div>

        {goal > 0 && (
          <div style={{ maxWidth: 520, margin: "18px auto 0" }}>
            <div style={{ height: 12, background: "rgba(127,165,153,0.14)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  width: `${goalPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--teal-2), var(--green))",
                  transition: "width .6s ease",
                }}
              />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              🎯 Goal {money(goal)} · <span style={{ color: "var(--teal-2)" }}>{((stats.todayGross / goal) * 100).toFixed(1)}%</span> reached
            </div>
          </div>
        )}

        {stats.yesterdayToDate > 0 && (
          <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            📊 Yesterday by now: <strong>{money(stats.yesterdayToDate)}</strong> · today: <strong>{money(stats.todayGross)}</strong>
          </div>
        )}
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

      {/* Audit board — one card per team, dispatchers (and their loads) nested inside */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Audit · Today’s loads by team</h3>
        {audit.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>No loads booked today yet.</p>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {audit.map((t) => (
              <div key={t.team} className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  className="spread"
                  style={{ padding: "12px 16px", background: "rgba(45,212,191,0.08)", borderBottom: "1px solid var(--line-strong)" }}
                >
                  <div>
                    <strong style={{ fontSize: 15, letterSpacing: 0.5 }}>{t.team}</strong>
                    <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
                      {t.dispatchers.length} dispatcher{t.dispatchers.length === 1 ? "" : "s"} · {t.loadCount} load{t.loadCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <strong className="mono" style={{ color: "var(--green)", fontSize: 16 }}>{money(t.gross)}</strong>
                </div>

                <div style={{ padding: "6px 16px 14px" }}>
                  {t.dispatchers.map((d) => (
                    <div key={d.name} style={{ marginTop: 10 }}>
                      <div className="spread" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {d.name} <span className="muted" style={{ fontWeight: 400 }}>· {d.loads.length} load{d.loads.length === 1 ? "" : "s"}</span>
                        </span>
                        <span className="mono" style={{ fontSize: 13 }}>{money(d.gross)}</span>
                      </div>
                      {d.loads.map((l) => (
                        <div key={l.id} className="spread" style={{ fontSize: 12, padding: "5px 0", borderTop: "1px solid var(--line)" }}>
                          <span className="mono">{l.loadNumber}</span>
                          <span className="muted" style={{ flex: 1, margin: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {l.origin} → {l.destination}
                          </span>
                          <StatusPill status={l.status} />
                          <span className="mono" style={{ marginLeft: 8, fontWeight: 700 }}>{money(l.gross)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

  // Yesterday's gross, but only counting up to the current time-of-day — a fair pace comparison.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msIntoDay = now.getTime() - todayStart;
  const yStart = todayStart - 86400000;
  const yesterdayToDate = loads
    .filter((l) => l.status !== "cancelled" && l.createdAt >= yStart && l.createdAt <= yStart + msIntoDay)
    .reduce((s, l) => s + (l.gross || 0), 0);

  return {
    todayGross,
    yesterdayToDate,
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
