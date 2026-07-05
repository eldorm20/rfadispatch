import { useState } from "react";
import { updateLoad } from "../hooks/useLoads";
import { useToast } from "./Toast";
import { StatusPill } from "./StatusPill";
import { DocsBadge } from "./DocsBadge";
import { printLoadStatement } from "../lib/printLoadStatement";
import { money, shortDate } from "../lib/format";
import { EQUIPMENT_LABELS, type Load } from "../types";

const num = (v: string) => (v === "" ? undefined : Number(v) || 0);

/** Full load view for accounting: details, paperwork, and editable accessorial charges. */
export function LoadDetailModal({ load, canEdit, onClose }: { load: Load; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    lumperFee: load.lumperFee ?? undefined as number | undefined,
    layoverFee: load.layoverFee ?? undefined as number | undefined,
    detentionFee: load.detentionFee ?? undefined as number | undefined,
    tonu: load.tonu ?? undefined as number | undefined,
    otherCharges: load.otherCharges ?? undefined as number | undefined,
    accountingNotes: load.accountingNotes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const accessorials = (f.lumperFee ?? 0) + (f.layoverFee ?? 0) + (f.detentionFee ?? 0) + (f.tonu ?? 0) + (f.otherCharges ?? 0);
  const total = (load.gross || 0) + accessorials;

  async function save() {
    setSaving(true);
    try {
      // Persist the computed total so reports/exports read one verified number.
      await updateLoad(load.id, { ...f, totalPayable: total });
      toast("Saved");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="spread" style={{ padding: "5px 0", fontSize: 13, borderBottom: "1px solid var(--line)" }}>
      <span className="muted">{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );

  const charge = (label: string, key: keyof typeof f) => (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step="0.01"
        disabled={!canEdit}
        value={(f[key] as number | undefined) ?? ""}
        onChange={(e) => setF((s) => ({ ...s, [key]: num(e.target.value) }))}
        placeholder="0.00"
      />
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="spread">
          <h2 className="mono">{load.loadNumber}</h2>
          <StatusPill status={load.status} />
        </div>
        <p className="hint">{load.origin} → {load.destination}</p>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          <div>
            <Row label="Carrier" value={load.carrier || "—"} />
            <Row label="Driver" value={load.driver || "—"} />
            <Row label="Broker" value={load.broker || "—"} />
            <Row label="Equipment" value={EQUIPMENT_LABELS[load.equipment] ?? load.equipment} />
          </div>
          <div>
            <Row label="Pickup" value={shortDate(load.pickupDate)} />
            <Row label="Delivery" value={shortDate(load.deliveryDate)} />
            <Row label="Miles" value={load.miles ?? "—"} />
            <Row label="Dispatcher" value={`${load.dispatcherName}${load.team ? ` · ${load.team}` : ""}`} />
          </div>
        </div>

        <div style={{ margin: "14px 0 6px" }}>
          <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Documents</span>
          <div style={{ marginTop: 6 }}><DocsBadge docs={load.docs} /></div>
        </div>

        <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Charges</label>
        <div className="spread" style={{ padding: "6px 0", fontSize: 14, borderBottom: "1px solid var(--line)" }}>
          <span>Line haul (gross)</span>
          <strong className="mono">{money(load.gross)}</strong>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 10 }}>
          {charge("Lumper", "lumperFee")}
          {charge("Layover", "layoverFee")}
          {charge("Detention", "detentionFee")}
          {charge(load.status === "cancelled" ? "TONU" : "TONU (if cancelled)", "tonu")}
          {charge("Other", "otherCharges")}
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Accounting notes</label>
          <input disabled={!canEdit} value={f.accountingNotes} onChange={(e) => setF((s) => ({ ...s, accountingNotes: e.target.value }))} placeholder="lumper paid cash, etc." />
        </div>

        <div className="spread" style={{ marginTop: 14, paddingTop: 12, borderTop: "2px solid var(--line-strong)", fontSize: 16 }}>
          <strong>Total payable</strong>
          <strong className="mono" style={{ color: "var(--green)" }}>{money(total, 2)}</strong>
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={() => printLoadStatement(load, { ...f, total })}>🖨 Print statement</button>
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose}>Close</button>
          {canEdit && (
            <button className="btn primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
