import { useMemo, useState } from "react";
import { useDrivers, createDriver, updateDriver, deleteDriver } from "../hooks/useDrivers";
import { useLoads, updateLoad } from "../hooks/useLoads";
import { useToast } from "../components/Toast";
import { normalizePhone } from "../lib/format";
import type { Driver } from "../types";

// Statuses where the load still mirrors the roster (delivered/invoiced history stays frozen).
const ACTIVE_STATUSES = ["available", "booked", "dispatched", "in_transit"];

type Form = { name: string; phone: string; carrier: string; truck: string; unit: string; payType: "percent" | "cpm"; notes: string };
const EMPTY: Form = { name: "", phone: "", carrier: "", truck: "", unit: "", payType: "cpm", notes: "" };

export function Drivers() {
  const { drivers, loading } = useDrivers();
  const { loads } = useLoads();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { id?: string; form: Form }>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return drivers.filter((d) => !term || `${d.name} ${d.carrier ?? ""} ${d.truck ?? ""} ${d.phone ?? ""}`.toLowerCase().includes(term));
  }, [drivers, q]);

  function openNew() {
    setModal({ form: { ...EMPTY } });
  }
  function openEdit(d: Driver) {
    setModal({ id: d.id, form: { name: d.name, phone: d.phone ?? "", carrier: d.carrier ?? "", truck: d.truck ?? "", unit: d.unit ?? "", payType: d.payType ?? "cpm", notes: d.notes ?? "" } });
  }

  async function save() {
    if (!modal) return;
    const f = { ...modal.form, name: modal.form.name.trim(), phone: normalizePhone(modal.form.phone), truck: modal.form.truck.trim() };
    if (!f.name) return;

    // Roster governance: no two active drivers may share a phone or a truck.
    const clash = drivers.find(
      (d) =>
        d.id !== modal.id &&
        d.active !== false &&
        ((f.phone && normalizePhone(d.phone ?? "") === f.phone) || (f.truck && (d.truck ?? "").trim().toLowerCase() === f.truck.toLowerCase()))
    );
    if (clash) {
      toast(`Already assigned to ${clash.name} — check phone / truck.`);
      return;
    }

    if (modal.id) {
      const prev = drivers.find((d) => d.id === modal.id);
      await updateDriver(modal.id, f);
      // Propagate the edit to this driver's ACTIVE loads so boards don't go stale.
      if (prev) {
        const affected = loads.filter((l) => l.driver === prev.name && ACTIVE_STATUSES.includes(l.status));
        for (const l of affected) {
          await updateLoad(l.id, { driver: f.name, driverPhone: f.phone, truck: f.truck });
        }
        toast(affected.length ? `Driver updated · synced ${affected.length} active load${affected.length === 1 ? "" : "s"}` : "Driver updated");
      } else {
        toast("Driver updated");
      }
    } else {
      await createDriver({ ...f, active: true });
      toast("Driver added");
    }
    setModal(null);
  }

  async function remove(d: Driver) {
    if (!confirm(`Delete driver ${d.name}?`)) return;
    await deleteDriver(d.id);
    toast("Driver deleted");
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Drivers</h2>
          <p>{drivers.length} driver{drivers.length === 1 ? "" : "s"} in the roster. Added here, then picked when booking loads.</p>
        </div>
        <button className="btn primary" onClick={openNew}>＋ Add Driver</button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div className="field">
          <label>Search</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, carrier, truck, phone…" />
        </div>
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="big">🚛</div>
          <p>No drivers yet. Add your first one.</p>
        </div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Carrier</th>
                <th>Truck</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td>{d.carrier || "—"}</td>
                  <td className="mono">{d.truck || "—"}</td>
                  <td className="mono">{d.phone || "—"}</td>
                  <td>
                    <button
                      className="status"
                      style={{ background: "transparent", color: d.active !== false ? "var(--green)" : "var(--muted)", cursor: "pointer" }}
                      onClick={() => void updateDriver(d.id, { active: !(d.active !== false) })}
                      title="Toggle active"
                    >
                      {d.active !== false ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn ghost sm" onClick={() => openEdit(d)}>✎</button>{" "}
                    <button className="btn ghost sm danger" onClick={() => void remove(d)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2>{modal.id ? "Edit Driver" : "Add Driver"}</h2>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 6 }}>
              <div className="field">
                <label>Name *</label>
                <input value={modal.form.name} autoFocus onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={modal.form.phone} onChange={(e) => setModal({ ...modal, form: { ...modal.form, phone: e.target.value } })} />
              </div>
              <div className="field">
                <label>Carrier</label>
                <input value={modal.form.carrier} onChange={(e) => setModal({ ...modal, form: { ...modal.form, carrier: e.target.value } })} />
              </div>
              <div className="field">
                <label>Truck</label>
                <input value={modal.form.truck} onChange={(e) => setModal({ ...modal, form: { ...modal.form, truck: e.target.value } })} />
              </div>
              <div className="field">
                <label>Unit #</label>
                <input value={modal.form.unit} onChange={(e) => setModal({ ...modal, form: { ...modal.form, unit: e.target.value } })} placeholder="202" />
              </div>
              <div className="field">
                <label>Pay type</label>
                <select value={modal.form.payType} onChange={(e) => setModal({ ...modal, form: { ...modal.form, payType: e.target.value as "percent" | "cpm" } })}>
                  <option value="cpm">CPM company (no rate shown)</option>
                  <option value="percent">Percent / owner (shows rate)</option>
                </select>
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Notes</label>
              <input value={modal.form.notes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })} />
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary" onClick={() => void save()} disabled={!modal.form.name.trim()}>
                {modal.id ? "Save" : "Add driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
