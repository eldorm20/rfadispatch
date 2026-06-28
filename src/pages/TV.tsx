import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoads } from "../hooks/useLoads";
import { useSettings } from "../hooks/useSettings";
import { useCountUp } from "../hooks/useCountUp";
import { fireConfetti, playFanfare, playCashRegister } from "../lib/celebrate";
import { money, todayISO } from "../lib/format";
import type { Load } from "../types";

interface Float {
  key: number;
  amount: number;
}

/** Fullscreen office-wall display. Real-time; updates as loads come in. */
export function TV() {
  const { loads } = useLoads();
  const settings = useSettings();
  const nav = useNavigate();
  const [clock, setClock] = useState(new Date());
  const [floats, setFloats] = useState<Float[]>([]);

  const s = useMemo(() => computeToday(loads), [loads]);
  const displayGross = Math.round(useCountUp(s.gross));
  const goal = settings.dailyGoal || 0;
  const goalPct = goal > 0 ? Math.min(100, (s.gross / goal) * 100) : 0;

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Detect newly-booked loads → "+$" float + cha-ching.
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(loads.map((l) => l.id));
    if (knownIds.current) {
      const added = loads.filter((l) => !knownIds.current!.has(l.id) && isToday(l.createdAt));
      if (added.length) {
        const amount = added.reduce((sum, l) => sum + (l.gross || 0), 0);
        const key = Date.now();
        setFloats((f) => [...f, { key, amount }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 2400);
        try {
          playCashRegister();
        } catch {
          /* audio not allowed yet */
        }
      }
    }
    knownIds.current = ids;
  }, [loads]);

  // Confetti + fanfare when the goal is hit.
  const firedFor = useRef<number | null>(null);
  useEffect(() => {
    if (goal > 0 && s.gross >= goal) {
      if (firedFor.current !== goal) {
        firedFor.current = goal;
        fireConfetti();
        try {
          playFanfare();
        } catch {
          /* ignore */
        }
      }
    } else {
      firedFor.current = null;
    }
  }, [s.gross, goal]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "var(--bg)", overflow: "auto", padding: "4vh 5vw" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4vh" }}>
        <div style={{ fontSize: "1.6vw", letterSpacing: 4, textTransform: "uppercase", color: "var(--muted)" }}>
          RFA Dispatch · Live Board
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <span className="chip" style={{ fontSize: "1.1vw" }}>
            <span className="dot live" /> Live
          </span>
          <span className="mono" style={{ fontSize: "1.4vw", color: "var(--muted)" }}>
            {clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button className="btn ghost" onClick={() => nav("/")}>
            ✕ Exit
          </button>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "4vh", position: "relative" }}>
        <div style={{ fontSize: "1.4vw", letterSpacing: 6, textTransform: "uppercase", color: "var(--muted)" }}>
          Total Gross · Today
        </div>
        <div style={{ fontSize: "10vw", fontWeight: 800, lineHeight: 1.05, color: "var(--green)", textShadow: "0 0 60px rgba(74,222,128,0.35)" }}>
          {money(displayGross)}
        </div>
        <div style={{ fontSize: "1.6vw", color: "var(--muted)" }}>
          {s.count} loads · avg {money(s.avg)} · {s.inTransit} in transit
        </div>

        {/* floating +$ pops */}
        {floats.map((f) => (
          <div
            key={f.key}
            style={{
              position: "absolute",
              left: "50%",
              top: "30%",
              transform: "translateX(-50%)",
              fontSize: "2.4vw",
              fontWeight: 800,
              color: "var(--gold)",
              pointerEvents: "none",
              animation: "tvfloat 2.2s ease-out forwards",
            }}
          >
            +{money(f.amount)}
          </div>
        ))}

        {goal > 0 && (
          <div style={{ maxWidth: 900, margin: "2.4vh auto 0" }}>
            <div style={{ height: "1.6vh", background: "rgba(127,165,153,0.14)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${goalPct}%`, height: "100%", background: "linear-gradient(90deg, var(--teal-2), var(--green))", transition: "width .6s ease" }} />
            </div>
            <div style={{ fontSize: "1.2vw", color: "var(--muted)", marginTop: 8 }}>
              🎯 Goal {money(goal)} · {((s.gross / goal) * 100).toFixed(1)}% reached
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ fontSize: "1.4vw", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 3, marginBottom: "2vh" }}>
          Dispatcher Leaderboard
        </div>
        {s.board.length === 0 ? (
          <div className="muted" style={{ fontSize: "1.6vw" }}>No loads booked yet today.</div>
        ) : (
          s.board.map((d, i) => {
            const pct = s.gross ? (d.gross / s.gross) * 100 : 0;
            return (
              <div key={d.name} style={{ marginBottom: "2.4vh" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "2vw", marginBottom: 8 }}>
                  <span>
                    <span style={{ color: "var(--muted)" }}>{i + 1}. </span>
                    {d.name} <span style={{ color: "var(--muted)", fontSize: "1.3vw" }}>· {d.count} loads</span>
                  </span>
                  <strong className="mono">{money(d.gross)}</strong>
                </div>
                <div style={{ height: "1.8vh", background: "rgba(127,165,153,0.14)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--teal-2), var(--green))", transition: "width .6s ease" }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`@keyframes tvfloat { 0% { opacity: 0; transform: translateX(-50%) translateY(0) scale(.8);} 15%{opacity:1;} 100% { opacity: 0; transform: translateX(-50%) translateY(-90px) scale(1.1);} }`}</style>
    </div>
  );
}

function isToday(ms: number): boolean {
  return new Date(ms).toISOString().slice(0, 10) === todayISO();
}

function computeToday(loads: Load[]) {
  const today = loads.filter((l) => isToday(l.createdAt) && l.status !== "cancelled");
  const gross = today.reduce((sum, l) => sum + (l.gross || 0), 0);
  const board = new Map<string, { name: string; gross: number; count: number }>();
  today.forEach((l) => {
    const cur = board.get(l.dispatcherName) ?? { name: l.dispatcherName, gross: 0, count: 0 };
    cur.gross += l.gross || 0;
    cur.count += 1;
    board.set(l.dispatcherName, cur);
  });
  return {
    gross,
    count: today.length,
    avg: today.length ? gross / today.length : 0,
    inTransit: loads.filter((l) => l.status === "in_transit").length,
    board: [...board.values()].sort((a, b) => b.gross - a.gross),
  };
}
