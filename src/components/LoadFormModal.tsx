import { useState } from "react";
import { DriverPicker } from "./DriverPicker";
import {
  EQUIPMENT_LABELS,
  LOAD_STATUSES,
  STATUS_LABELS,
  type Equipment,
  type Load,
  type LoadStatus,
  type NewLoadInput,
} from "../types";

type Props = {
  initial?: Load | null;
  onSave: (data: NewLoadInput) => Promise<void> | void;
  onClose: () => void;
  /** Returns true if this load number collides with an existing one (excluding the one being edited). */
  isDuplicate?: (loadNumber: string) => boolean;
};

const EMPTY: NewLoadInput = {
  loadNumber: "",
  broker: "",
  brokerContact: "",
  carrier: "",
  driver: "",
  driverPhone: "",
  truck: "",
  origin: "",
  destination: "",
  pickupDate: "",
  deliveryDate: "",
  equipment: "van",
  miles: undefined,
  gross: 0,
  status: "available",
  notes: "",
};

export function LoadFormModal({ initial, onSave, onClose, isDuplicate }: Props) {
  const [form, setForm] = useState<NewLoadInput>(
    initial
      ? {
          loadNumber: initial.loadNumber,
          broker: initial.broker,
          brokerContact: initial.brokerContact ?? "",
          carrier: initial.carrier,
          driver: initial.driver,
          driverPhone: initial.driverPhone ?? "",
          truck: initial.truck ?? "",
          origin: initial.origin,
          destination: initial.destination,
          pickupDate: initial.pickupDate ?? "",
          deliveryDate: initial.deliveryDate ?? "",
          equipment: initial.equipment,
          miles: initial.miles,
          gross: initial.gross,
          status: initial.status,
          notes: initial.notes ?? "",
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof NewLoadInput>(key: K, val: NewLoadInput[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const dup = !!form.loadNumber.trim() && !!isDuplicate?.(form.loadNumber.trim());
  const valid = form.loadNumber.trim() && form.carrier.trim() && form.gross >= 0 && !dup;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        loadNumber: form.loadNumber.trim(),
        carrier: form.carrier.trim(),
        gross: Number(form.gross) || 0,
        miles: form.miles ? Number(form.miles) : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? "Edit Load" : "Book a Load"}</h2>
        <p className="hint">
          {initial ? "Update the load details." : "Enter the load you just booked. It appears on every board instantly."}
        </p>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field">
            <label>Load / VRID *</label>
            <input
              value={form.loadNumber}
              onChange={(e) => set("loadNumber", e.target.value)}
              placeholder="1127BSJCY"
              autoFocus
              style={dup ? { borderColor: "var(--red)" } : undefined}
            />
            {dup && <span style={{ color: "var(--red)", fontSize: 11 }}>This load number already exists.</span>}
          </div>
          <div className="field">
            <label>Gross rate *</label>
            <input type="number" step="0.01" value={form.gross || ""} onChange={(e) => set("gross", Number(e.target.value))} placeholder="2450" />
          </div>

          <div className="field">
            <label>Broker / Customer</label>
            <input value={form.broker} onChange={(e) => set("broker", e.target.value)} placeholder="TQL" />
          </div>
          <div className="field">
            <label>Broker contact</label>
            <input value={form.brokerContact} onChange={(e) => set("brokerContact", e.target.value)} placeholder="name / phone" />
          </div>

          <div className="field">
            <label>Carrier *</label>
            <input value={form.carrier} onChange={(e) => set("carrier", e.target.value)} placeholder="Owner-op / carrier co." />
          </div>
          <div className="field">
            <label>Equipment</label>
            <select value={form.equipment} onChange={(e) => set("equipment", e.target.value as Equipment)}>
              {Object.entries(EQUIPMENT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Driver</label>
            <DriverPicker
              value={form.driver}
              onText={(name) => set("driver", name)}
              onPick={(d) =>
                setForm((f) => ({
                  ...f,
                  driver: d.name,
                  driverPhone: d.phone || f.driverPhone,
                  truck: d.truck || f.truck,
                  carrier: f.carrier || d.carrier || "",
                }))
              }
            />
          </div>
          <div className="field">
            <label>Driver phone</label>
            <input value={form.driverPhone} onChange={(e) => set("driverPhone", e.target.value)} placeholder="(555) 555-5555" />
          </div>

          <div className="field">
            <label>Origin</label>
            <input value={form.origin} onChange={(e) => set("origin", e.target.value)} placeholder="Chicago, IL" />
          </div>
          <div className="field">
            <label>Destination</label>
            <input value={form.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Dallas, TX" />
          </div>

          <div className="field">
            <label>Pickup date</label>
            <input type="date" value={form.pickupDate} onChange={(e) => set("pickupDate", e.target.value)} />
          </div>
          <div className="field">
            <label>Delivery date</label>
            <input type="date" value={form.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} />
          </div>

          <div className="field">
            <label>Miles</label>
            <input type="number" value={form.miles ?? ""} onChange={(e) => set("miles", e.target.value ? Number(e.target.value) : undefined)} placeholder="920" />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value as LoadStatus)}>
              {LOAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything the team should know…" />
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void submit()} disabled={!valid || saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Book load"}
          </button>
        </div>
      </div>
    </div>
  );
}
