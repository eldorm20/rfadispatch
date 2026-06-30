import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLoads } from "../hooks/useLoads";
import { LoadDetailModal } from "../components/LoadDetailModal";
import { StatusPill } from "../components/StatusPill";
import { can } from "../lib/permissions";
import { money, shortDate, todayISO } from "../lib/format";
import { LOAD_STATUSES, STATUS_LABELS, type Load, type LoadStatus } from "../types";

function nDaysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function loadDay(l: Load): string {
  return l.deliveryDate || new Date(l.createdAt).toISOString().slice(0, 10);
}
function accessorials(l: Load): number {
  return (l.lumperFee ?? 0) + (l.layoverFee ?? 0) + (l.detentionFee ?? 0) + (l.tonu ?? 0) + (l.otherCharges ?? 0);
}

export function Accounting() {
  const { user } = useAuth();
  const { loads, loading } = useLoads();
  const canEdit = user ? can(user.role).markInvoiced : false;

  const [from, setFrom] = useState(nDaysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState<LoadStatus | "all">("all");
  const [open, setOpen] = useState<Load | null>(null);

  const rows = useMemo(
    () =>
      loads
        .filter((l) => loadDay(l) >= from && loadDay(l) <= to)
        .filter((l) => statusFilter === "all" || l.status === statusFilter)
        .sort((a, b) => (loadDay(a) < loadDay(b) ? 1 : -1)),
    [loads, from, to, statusFilter]
  );

  const totGross = rows.reduce((s, l) => s + (l.gross || 0), 0);
  const totAcc = rows.reduce((s, l) => s + accessorials(l), 0);

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Accounting</h2>
          <p>Click a load to view full details and add charges (lumper, layover, detention, TONU…).</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ maxWidth: 170 }}>
            <label>From</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 170 }}>
            <label>To</label>
            <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LoadStatus | "all")}>
              <option value="all">All statuses</option>
              {LOAD_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Loads" value={String(rows.length)} />
        <Kpi label="Gross" value={money(totGross)} />
        <Kpi label="Accessorials" value={money(totAcc)} cls="gold" />
        <Kpi label="Total payable" value={money(totGross + totAcc)} cls="good" />
      </div>

      {rows.length === 0 ? (
        <div className="empty"><div className="big">🧾</div><p>No loads in this period.</p></div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Load #</th>
                <th>Lane</th>
                <th>Carrier</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Gross</th>
                <th style={{ textAlign: "right" }}>Accessorials</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const acc = accessorials(l);
                return (
                  <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => setOpen(l)}>
                    <td className="mono">{l.loadNumber}</td>
                    <td>{l.origin} <span className="muted">→</span> {l.destination}</td>
                    <td>{l.carrier}</td>
                    <td><StatusPill status={l.status} /></td>
                    <td className="mono">{shortDate(loadDay(l))}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{money(l.gross)}</td>
                    <td className="mono" style={{ textAlign: "right", color: acc ? "var(--gold)" : "var(--muted)" }}>{acc ? money(acc) : "—"}</td>
                    <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>{money((l.gross || 0) + acc)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <LoadDetailModal load={open} canEdit={canEdit} onClose={() => setOpen(null)} />}
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
