import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLoads } from "../hooks/useLoads";
import { useInvoices, createInvoice, updateInvoice } from "../hooks/useInvoices";
import { useSettings, saveSettings } from "../hooks/useSettings";
import { useToast } from "../components/Toast";
import { can } from "../lib/permissions";
import { money, shortDate, todayISO } from "../lib/format";
import { printInvoice } from "../lib/printInvoice";
import { INVOICE_STATUS_LABELS, type Invoice, type InvoiceStatus, type Load } from "../types";

type Tab = "settlements" | "invoices" | "commission";

function nDaysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
/** Date a load counts toward — delivery date if set, else booked date. */
function loadDay(l: Load): string {
  return l.deliveryDate || new Date(l.createdAt).toISOString().slice(0, 10);
}

export function Accounting() {
  const { user } = useAuth();
  const { loads, loading } = useLoads();
  const { invoices } = useInvoices();
  const settings = useSettings();
  const toast = useToast();
  const perms = user ? can(user.role) : null;

  const [tab, setTab] = useState<Tab>("settlements");
  const [from, setFrom] = useState(nDaysAgoISO(30));
  const [to, setTo] = useState(todayISO());

  const pct = settings.commissionPct / 100;

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Accounting</h2>
          <p>Settlements, carrier invoices, payments and commission.</p>
        </div>
        {perms?.editSettings && (
          <div className="field" style={{ width: 130, flex: "0 0 auto" }}>
            <label>Commission %</label>
            <input
              type="number"
              step="0.1"
              value={settings.commissionPct}
              onChange={(e) => void saveSettings({ commissionPct: Number(e.target.value) }).then(() => toast("Commission saved"))}
            />
          </div>
        )}
      </div>

      <div className="nav" style={{ marginBottom: 18 }}>
        {(["settlements", "invoices", "commission"] as Tab[]).map((t) => (
          <a key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""} style={{ cursor: "pointer", textTransform: "capitalize" }}>
            {t}
          </a>
        ))}
      </div>

      {tab !== "invoices" && (
        <div className="card" style={{ marginBottom: 16, padding: 14 }}>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ maxWidth: 180 }}>
              <label>From</label>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field" style={{ maxWidth: 180 }}>
              <label>To</label>
              <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {tab === "settlements" && (
        <Settlements loads={loads} from={from} to={to} pct={pct} commissionPct={settings.commissionPct} invoices={invoices} canBill={!!perms?.markInvoiced} userName={user?.name ?? "User"} toast={toast} />
      )}
      {tab === "invoices" && <Invoices invoices={invoices} loads={loads} canPay={!!perms?.markInvoiced} toast={toast} />}
      {tab === "commission" && <Commission loads={loads} from={from} to={to} pct={pct} commissionPct={settings.commissionPct} />}
    </div>
  );
}

/* ---------------- Settlements ---------------- */
function Settlements({
  loads,
  from,
  to,
  pct,
  commissionPct,
  invoices,
  canBill,
  userName,
  toast,
}: {
  loads: Load[];
  from: string;
  to: string;
  pct: number;
  commissionPct: number;
  invoices: Invoice[];
  canBill: boolean;
  userName: string;
  toast: (m: string) => void;
}) {
  // Billable + not yet invoiced, within the period.
  const billable = useMemo(
    () => loads.filter((l) => l.status === "delivered" && !l.invoiceId && loadDay(l) >= from && loadDay(l) <= to),
    [loads, from, to]
  );

  const byCarrier = useMemo(() => {
    const m = new Map<string, Load[]>();
    billable.forEach((l) => (m.get(l.carrier) ?? m.set(l.carrier, []).get(l.carrier)!).push(l));
    return [...m.entries()]
      .map(([carrier, ls]) => ({
        carrier,
        loads: ls,
        gross: ls.reduce((s, l) => s + l.gross, 0),
      }))
      .sort((a, b) => b.gross - a.gross);
  }, [billable]);

  const totalCommission = byCarrier.reduce((s, c) => s + c.gross * pct, 0);

  async function generate(carrier: string, ls: Load[]) {
    const gross = ls.reduce((s, l) => s + l.gross, 0);
    if (!confirm(`Generate an invoice to ${carrier} for ${money(gross * pct, 2)} commission on ${ls.length} load(s)?`)) return;
    const due = new Date();
    due.setDate(due.getDate() + 15);
    await createInvoice({
      number: "INV-" + (1000 + invoices.length + 1),
      carrier,
      loadIds: ls.map((l) => l.id),
      periodStart: from,
      periodEnd: to,
      totalGross: gross,
      commissionPct,
      amountDue: gross * pct,
      status: "sent",
      dueDate: due.toISOString().slice(0, 10),
      createdBy: userName,
      createdAt: Date.now(),
    });
    toast(`Invoice created for ${carrier}`);
  }

  if (byCarrier.length === 0) {
    return (
      <div className="empty">
        <div className="big">🧾</div>
        <p>No un-invoiced delivered loads in this period.</p>
      </div>
    );
  }

  return (
    <>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Carriers to bill" value={String(byCarrier.length)} />
        <Kpi label="Billable gross" value={money(byCarrier.reduce((s, c) => s + c.gross, 0))} />
        <Kpi label={`Commission @ ${commissionPct}%`} value={money(totalCommission)} cls="good" />
      </div>
      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Carrier</th>
              <th>Loads</th>
              <th style={{ textAlign: "right" }}>Gross</th>
              <th style={{ textAlign: "right" }}>Commission</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {byCarrier.map((c) => (
              <tr key={c.carrier}>
                <td style={{ fontWeight: 600 }}>{c.carrier}</td>
                <td className="muted">{c.loads.length}</td>
                <td className="mono" style={{ textAlign: "right" }}>{money(c.gross)}</td>
                <td className="mono" style={{ textAlign: "right", color: "var(--green)", fontWeight: 700 }}>{money(c.gross * pct, 2)}</td>
                <td style={{ textAlign: "right" }}>
                  {canBill && (
                    <button className="btn sm primary" onClick={() => void generate(c.carrier, c.loads)}>
                      Generate invoice
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Invoices ---------------- */
function effectiveStatus(inv: Invoice): InvoiceStatus {
  if (inv.status === "paid") return "paid";
  if (inv.dueDate && inv.dueDate < todayISO()) return "overdue";
  return inv.status;
}

function Invoices({ invoices, loads, canPay, toast }: { invoices: Invoice[]; loads: Load[]; canPay: boolean; toast: (m: string) => void }) {
  const outstanding = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amountDue, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountDue, 0);

  async function markPaid(inv: Invoice) {
    await updateInvoice(inv.id, { status: "paid", paidAt: Date.now() });
    toast(`${inv.number} marked paid`);
  }
  function print(inv: Invoice) {
    const ls = loads.filter((l) => inv.loadIds.includes(l.id));
    printInvoice(inv, ls);
  }

  if (invoices.length === 0) {
    return (
      <div className="empty">
        <div className="big">🧾</div>
        <p>No invoices yet. Generate one from the Settlements tab.</p>
      </div>
    );
  }

  return (
    <>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Outstanding" value={money(outstanding)} cls="gold" />
        <Kpi label="Collected" value={money(paid)} cls="good" />
        <Kpi label="Invoices" value={String(invoices.length)} />
      </div>
      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Carrier</th>
              <th>Period</th>
              <th>Due</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const st = effectiveStatus(inv);
              const color = st === "paid" ? "var(--green)" : st === "overdue" ? "var(--red)" : "var(--gold)";
              return (
                <tr key={inv.id}>
                  <td className="mono">{inv.number}</td>
                  <td>{inv.carrier}</td>
                  <td className="muted mono">{shortDate(inv.periodStart)}–{shortDate(inv.periodEnd)}</td>
                  <td className="mono">{inv.dueDate ? shortDate(inv.dueDate) : "—"}</td>
                  <td>
                    <span className="status" style={{ color, background: "transparent" }}>{INVOICE_STATUS_LABELS[st]}</span>
                  </td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{money(inv.amountDue, 2)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn ghost sm" onClick={() => print(inv)} title="Print / Save PDF">🖨</button>{" "}
                    {canPay && inv.status !== "paid" && (
                      <button className="btn sm" onClick={() => void markPaid(inv)}>Mark paid</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- Commission report ---------------- */
function Commission({ loads, from, to, pct, commissionPct }: { loads: Load[]; from: string; to: string; pct: number; commissionPct: number }) {
  const inRange = useMemo(
    () => loads.filter((l) => l.status !== "cancelled" && loadDay(l) >= from && loadDay(l) <= to),
    [loads, from, to]
  );
  const byDispatcher = useMemo(() => {
    const m = new Map<string, { name: string; gross: number; count: number }>();
    inRange.forEach((l) => {
      const cur = m.get(l.dispatcherName) ?? { name: l.dispatcherName, gross: 0, count: 0 };
      cur.gross += l.gross;
      cur.count += 1;
      m.set(l.dispatcherName, cur);
    });
    return [...m.values()].sort((a, b) => b.gross - a.gross);
  }, [inRange]);

  const totalGross = inRange.reduce((s, l) => s + l.gross, 0);

  return (
    <>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Gross (period)" value={money(totalGross)} />
        <Kpi label={`Commission @ ${commissionPct}%`} value={money(totalGross * pct)} cls="good" />
        <Kpi label="Loads" value={String(inRange.length)} />
      </div>
      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Dispatcher</th>
              <th>Loads</th>
              <th style={{ textAlign: "right" }}>Gross</th>
              <th style={{ textAlign: "right" }}>Commission</th>
            </tr>
          </thead>
          <tbody>
            {byDispatcher.map((d) => (
              <tr key={d.name}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td className="muted">{d.count}</td>
                <td className="mono" style={{ textAlign: "right" }}>{money(d.gross)}</td>
                <td className="mono" style={{ textAlign: "right", color: "var(--green)" }}>{money(d.gross * pct, 2)}</td>
              </tr>
            ))}
            {byDispatcher.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 24 }}>No loads in this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
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
