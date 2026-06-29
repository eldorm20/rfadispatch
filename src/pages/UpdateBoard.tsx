import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLoads, addCheckCall, setLoadStatus, toggleDoc } from "../hooks/useLoads";
import { useToast } from "../components/Toast";
import { DocsBadge } from "../components/DocsBadge";
import { can } from "../lib/permissions";
import { money, relativeTime, shortDate } from "../lib/format";
import { LOAD_STATUSES, STATUS_LABELS, type Load, type LoadStatus, type RelayStop } from "../types";

const SERVICE_LABELS: Record<string, string> = {
  SWING_DOOR: "Swing Door",
  TEAM_DRIVER: "Team Driver",
  HAZMAT: "Hazmat",
  TWIC: "TWIC",
  LIFTGATE: "Liftgate",
};
const svcLabel = (s: string) => SERVICE_LABELS[s] ?? s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function ServiceChips({ load }: { load: Load }) {
  const svc = load.amazon?.specialServices ?? [];
  if (!svc.length) return null;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
      {svc.map((s) => (
        <span key={s} style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", background: "rgba(250,204,21,0.14)", padding: "2px 6px", borderRadius: 6 }}>
          ⚠ {svcLabel(s)}
        </span>
      ))}
    </div>
  );
}

function fmtSched(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function RouteTimeline({ stops }: { stops: RelayStop[] }) {
  return (
    <div className="grid" style={{ gap: 0, marginTop: 8 }}>
      {stops.map((s, i) => {
        const isPickup = s.type === "PICKUP";
        return (
          <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 12, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: isPickup ? "var(--teal-2)" : "var(--green)", marginTop: 3 }} />
              {i < stops.length - 1 && <span style={{ flex: 1, width: 2, background: "var(--line)" }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div className="spread">
                <span style={{ fontSize: 13 }}>
                  <strong>{s.label || `${s.city ?? ""}`}</strong>{" "}
                  <span className="muted" style={{ fontSize: 11 }}>{isPickup ? "Pickup" : "Drop"}</span>
                </span>
                <span className="muted mono" style={{ fontSize: 11 }}>{fmtSched(s.scheduledArrival)}</span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {[s.city && `${s.city}, ${s.state ?? ""}`, s.loadingType].filter(Boolean).join(" · ")}
              </div>
              {(s.specialServices?.length || s.earlyCheckInNotAllowed) && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {s.specialServices?.map((sv) => (
                    <span key={sv} style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", background: "rgba(250,204,21,0.14)", padding: "1px 6px", borderRadius: 6 }}>⚠ {svcLabel(sv)}</span>
                  ))}
                  {s.earlyCheckInNotAllowed && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", background: "rgba(248,113,113,0.14)", padding: "1px 6px", borderRadius: 6 }}>No early check-in</span>
                  )}
                </div>
              )}
              {s.instructions?.map((ins, k) => (
                <div key={k} className="muted" style={{ fontSize: 11, marginTop: 3, fontStyle: "italic" }}>📋 {ins}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Columns shown on the update board (terminal states get their own lane at the end).
const LANES: LoadStatus[] = ["booked", "dispatched", "in_transit", "delivered"];

export function UpdateBoard() {
  const { user } = useAuth();
  const { loads, loading } = useLoads();
  const [active, setActive] = useState<Load | null>(null);
  const perms = user ? can(user.role) : null;

  const byStatus = useMemo(() => {
    const map = new Map<LoadStatus, Load[]>();
    LOAD_STATUSES.forEach((s) => map.set(s, []));
    loads.forEach((l) => map.get(l.status)?.push(l));
    return map;
  }, [loads]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Update Board</h2>
          <p>Track every active load through its lifecycle. Add check calls as you get updates.</p>
        </div>
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${LANES.length}, minmax(240px, 1fr))`, overflowX: "auto" }}>
          {LANES.map((lane) => {
            const items = byStatus.get(lane) ?? [];
            return (
              <div key={lane}>
                <div className="spread" style={{ marginBottom: 10 }}>
                  <span className={"status " + lane}>{STATUS_LABELS[lane]}</span>
                  <span className="muted mono" style={{ fontSize: 12 }}>{items.length}</span>
                </div>
                <div className="grid" style={{ gap: 10 }}>
                  {items.map((l) => (
                    <button key={l.id} className="card" style={{ padding: 14, textAlign: "left", cursor: "pointer" }} onClick={() => setActive(l)}>
                      <div className="spread">
                        <strong className="mono">{l.loadNumber}</strong>
                        <span className="mono muted" style={{ fontSize: 12 }}>{money(l.gross)}</span>
                      </div>
                      <div style={{ fontSize: 13, margin: "6px 0" }}>
                        {l.origin || "—"} <span className="muted">→</span> {l.destination || "—"}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {l.carrier}
                        {l.driver ? ` · ${l.driver}` : ""}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        🚚 PU {shortDate(l.pickupDate)} · DEL {shortDate(l.deliveryDate)}
                      </div>
                      <ServiceChips load={l} />
                      <div style={{ marginTop: 8 }}>
                        <DocsBadge docs={l.docs} />
                      </div>
                      {l.lastUpdate && (
                        <div style={{ fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                          <span className="muted">📍 {relativeTime(l.lastUpdateAt)}: </span>
                          {l.lastUpdate}
                        </div>
                      )}
                    </button>
                  ))}
                  {items.length === 0 && <div className="muted" style={{ fontSize: 12, padding: "8px 2px" }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {active && perms && (
        <CheckCallModal load={active} canUpdate={perms.addCheckCalls} byName={user?.name ?? "User"} onClose={() => setActive(null)} />
      )}
    </div>
  );
}

function CheckCallModal({
  load,
  canUpdate,
  byName,
  onClose,
}: {
  load: Load;
  canUpdate: boolean;
  byName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<LoadStatus>(load.status);
  const [busy, setBusy] = useState(false);

  const calls = [...(load.checkCalls ?? [])].sort((a, b) => b.ts - a.ts);

  async function submit() {
    if (!note.trim() && status === load.status) return;
    setBusy(true);
    try {
      if (note.trim()) {
        await addCheckCall(load.id, note.trim(), byName, status !== load.status ? status : undefined);
      } else if (status !== load.status) {
        await setLoadStatus(load.id, status);
      }
      toast("Update saved");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 className="mono">{load.loadNumber}</h2>
          <span className={"status " + load.status}>{STATUS_LABELS[load.status]}</span>
        </div>
        <p className="hint">
          {load.origin} → {load.destination} · {load.carrier}
          {load.driver ? ` · ${load.driver}` : ""}
          {load.driverPhone ? ` · ${load.driverPhone}` : ""}
        </p>

        {canUpdate && (
          <>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 3 }}>
                <label>Check call / update</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="At pickup, loaded, ETA 1400…" autoFocus />
              </div>
              <div className="field">
                <label>Move to</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as LoadStatus)}>
                  {LOAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={onClose}>Close</button>
              <button className="btn primary" onClick={() => void submit()} disabled={busy}>
                {busy ? "Saving…" : "Add update"}
              </button>
            </div>
          </>
        )}

        {load.amazon?.stops?.length ? (
          <div style={{ marginTop: 18 }}>
            <div className="spread">
              <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                Route · {load.amazon.stops.length} stops
              </label>
              <span className="muted" style={{ fontSize: 11 }}>
                {load.amazon.ratePerMile ? `$${load.amazon.ratePerMile}/mi` : ""}
                {load.amazon.maxWeight ? ` · ${load.amazon.maxWeight.toLocaleString()} lb` : ""}
                {load.amazon.legs && load.amazon.legs > 1 ? ` · ${load.amazon.legs} legs` : ""}
              </span>
            </div>
            <RouteTimeline stops={load.amazon.stops} />
          </div>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
            Documents
          </label>
          <div style={{ marginTop: 8 }}>
            <DocsBadge docs={load.docs} onToggle={canUpdate ? (k) => void toggleDoc(load, k, byName) : undefined} />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
            History
          </label>
          {calls.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No check calls yet.</p>
          ) : (
            <div className="grid" style={{ gap: 8, marginTop: 8 }}>
              {calls.map((c, i) => (
                <div key={i} className="card" style={{ padding: "10px 12px" }}>
                  <div className="spread">
                    <span style={{ fontSize: 13 }}>{c.note}</span>
                    {c.status && <span className={"status " + c.status}>{STATUS_LABELS[c.status]}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {c.by} · {relativeTime(c.ts)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
