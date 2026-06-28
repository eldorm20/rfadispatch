import { useMemo, useState } from "react";
import { useDrivers, createDriver, updateDriver, deleteDriver } from "../hooks/useDrivers";
import { useToast } from "../components/Toast";
import type { Driver } from "../types";

type Form = { name: string; phone: string; carrier: string; truck: string; notes: string };
const EMPTY: Form = { name: "", phone: "", carrier: "", truck: "", notes: "" };

export function Drivers() {
  const { drivers, loading } = useDrivers();
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
    setModal({ id: d.id, form: { name: d.name, phone: d.phone ?? "", carrier: d.carrier ?? "", truck: d.truck ?? "", notes: d.notes ?? "" } });
  }

  async function save() {
    if (!modal) return;
    const f = modal.form;
    if (!f.name.trim()) return;
    if (modal.id) {
      await updateDriver(modal.id, { ...f, name: f.name.trim() });
      toast("Driver updated");
    } else {
      await createDriver({ ...f, name: f.name.trim(), active: true });
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
