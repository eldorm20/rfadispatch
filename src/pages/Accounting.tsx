import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { useLoads, setLoadStatus } from "../hooks/useLoads";
import { StatusPill } from "../components/StatusPill";
import { useToast } from "../components/Toast";
import { can } from "../lib/permissions";
import { money, shortDate } from "../lib/format";
import { DEFAULT_SETTINGS, type Load, type OrgSettings } from "../types";

export function Accounting() {
  const { user } = useAuth();
  const { loads, loading } = useLoads();
  const toast = useToast();
  const perms = user ? can(user.role) : null;

  const [settings, setSettings] = useState<OrgSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void getDoc(doc(db, "org", "settings")).then((s) => {
      if (s.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<OrgSettings>) });
    });
  }, []);

  async function saveCommission(pct: number) {
    const next = { ...settings, commissionPct: pct };
    setSettings(next);
    await setDoc(doc(db, "org", "settings"), next, { merge: true });
    toast("Commission rate saved");
  }

  // Billable = delivered or invoiced (commission is earned once delivered).
  const billable = useMemo(
    () => loads.filter((l) => l.status === "delivered" || l.status === "invoiced"),
    [loads]
  );
  const pct = settings.commissionPct / 100;
  const totalGross = billable.reduce((s, l) => s + (l.gross || 0), 0);
  const totalCommission = totalGross * pct;
  const pending = billable.filter((l) => l.status === "delivered");
  const pendingCommission = pending.reduce((s, l) => s + (l.gross || 0), 0) * pct;

  function exportCsv() {
    const rows = [
      ["Load #", "Carrier", "Broker", "Lane", "Delivered", "Status", "Gross", `Commission ${settings.commissionPct}%`],
      ...billable.map((l) => [
        l.loadNumber,
        l.carrier,
        l.broker,
        `${l.origin} -> ${l.destination}`,
        l.deliveryDate ?? "",
        l.status,
        String(l.gross),
        (l.gross * pct).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commission-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function markInvoiced(l: Load) {
    await setLoadStatus(l.id, "invoiced");
    toast(`${l.loadNumber} marked invoiced`);
  }

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Accounting</h2>
          <p>Commission earned off delivered loads.</p>
        </div>
        <div className="row" style={{ flex: "0 0 auto", alignItems: "flex-end" }}>
          {perms?.editSettings && (
            <div className="field" style={{ width: 120 }}>
              <label>Commission %</label>
              <input
                type="number"
                step="0.1"
                value={settings.commissionPct}
                onChange={(e) => void saveCommission(Number(e.target.value))}
              />
            </div>
          )}
          <button className="btn" onClick={exportCsv}>
            ⤓ Export CSV
          </button>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 20 }}>
        <Kpi label="Billable Gross" value={money(totalGross)} />
        <Kpi label={`Commission @ ${settings.commissionPct}%`} value={money(totalCommission)} cls="good" />
        <Kpi label="Pending (not invoiced)" value={money(pendingCommission)} cls="gold" />
        <Kpi label="Loads" value={String(billable.length)} />
      </div>

      {billable.length === 0 ? (
        <div className="empty">
          <div className="big">🧾</div>
          <p>No delivered loads to bill yet.</p>
        </div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Load #</th>
                <th>Carrier</th>
                <th>Lane</th>
                <th>Delivered</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Gross</th>
                <th style={{ textAlign: "right" }}>Commission</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {billable.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.loadNumber}</td>
                  <td>{l.carrier}</td>
                  <td>
                    {l.origin} <span className="muted">→</span> {l.destination}
                  </td>
                  <td className="mono">{shortDate(l.deliveryDate)}</td>
                  <td>
                    <StatusPill status={l.status} />
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(l.gross)}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>
                    {money(l.gross * pct, 2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {perms?.markInvoiced && l.status === "delivered" && (
                      <button className="btn sm" onClick={() => void markInvoiced(l)}>
                        Mark invoiced
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
