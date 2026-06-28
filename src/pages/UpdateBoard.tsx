import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLoads, addCheckCall, setLoadStatus } from "../hooks/useLoads";
import { useToast } from "../components/Toast";
import { can } from "../lib/permissions";
import { money, relativeTime, shortDate } from "../lib/format";
import { LOAD_STATUSES, STATUS_LABELS, type Load, type LoadStatus } from "../types";

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
