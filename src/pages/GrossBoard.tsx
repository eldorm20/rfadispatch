import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLoads, createLoad, updateLoad, purgeLoad, isDuplicateLoadNumber } from "../hooks/useLoads";
import { useSettings } from "../hooks/useSettings";
import { LoadFormModal } from "../components/LoadFormModal";
import { DocsBadge } from "../components/DocsBadge";
import { StatusPill } from "../components/StatusPill";
import { useToast } from "../components/Toast";
import { can } from "../lib/permissions";
import { money, shortDate } from "../lib/format";
import { LOAD_STATUSES, STATUS_LABELS, type Load, type LoadStatus, type NewLoadInput } from "../types";

export function GrossBoard() {
  const { user } = useAuth();
  const { loads, loading, error } = useLoads();
  const settings = useSettings();
  const toast = useToast();
  const perms = user ? can(user.role) : null;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Load | null>(null);
  const [statusFilter, setStatusFilter] = useState<LoadStatus | "all">("all");
  const [searchq, setSearchq] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const filtered = useMemo(() => {
    return loads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (mineOnly && l.dispatcherId !== user?.uid) return false;
      if (searchq) {
        const q = searchq.toLowerCase();
        const hay = `${l.loadNumber} ${l.carrier} ${l.driver} ${l.broker} ${l.origin} ${l.destination}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [loads, statusFilter, searchq, mineOnly, user?.uid]);

  const totalGross = filtered.reduce((s, l) => s + (l.gross || 0), 0);

  async function handleSave(data: NewLoadInput) {
    if (!user) return;
    const big = settings.confirmThreshold > 0 && data.gross >= settings.confirmThreshold;
    if (big && !confirm(`This load is ${money(data.gross)} — that's above your ${money(settings.confirmThreshold)} confirm threshold. Save it?`)) {
      return;
    }
    if (editing) {
      await updateLoad(editing.id, data);
      toast("Load updated");
    } else {
      await createLoad(data, user);
      toast("Load booked");
    }
    setEditing(null);
  }

  async function handleDelete(l: Load) {
    if (!confirm(`Delete ${l.loadNumber}${l.gross ? ` (${money(l.gross)})` : ""}? This can’t be undone.`)) return;
    await purgeLoad(l.id);
    toast("Load deleted");
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(l: Load) {
    setEditing(l);
    setModalOpen(true);
  }

  const canEdit = (l: Load) => perms?.editAnyLoad || l.dispatcherId === user?.uid;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Gross Board</h2>
          <p>
            {filtered.length} load{filtered.length === 1 ? "" : "s"} · {money(totalGross)} gross
          </p>
        </div>
        {perms?.bookLoads && (
          <button className="btn primary" onClick={openNew}>
            ＋ Book Load
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 2 }}>
            <label>Search</label>
            <input value={searchq} onChange={(e) => setSearchq(e.target.value)} placeholder="Load #, carrier, driver, lane…" />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LoadStatus | "all")}>
              <option value="all">All statuses</option>
              {LOAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <label className="chip" style={{ cursor: "pointer", flex: "0 0 auto" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            My loads only
          </label>
        </div>
      </div>

      {error && <div className="card" style={{ color: "var(--red)", marginBottom: 16 }}>⚠ {error}</div>}

      {loading ? (
        <div className="empty">Loading loads…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="big">📦</div>
          <p>No loads yet. {perms?.bookLoads ? "Book your first one." : "Loads will show up here as dispatchers add them."}</p>
        </div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Load #</th>
                <th>Lane</th>
                <th>Carrier / Driver</th>
                <th>Broker</th>
                <th>Pickup</th>
                <th>Status</th>
                <th>Docs</th>
                <th>Dispatcher</th>
                <th style={{ textAlign: "right" }}>Gross</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.loadNumber}</td>
                  <td>
                    {l.origin || "—"} <span className="muted">→</span> {l.destination || "—"}
                  </td>
                  <td>
                    {l.carrier || "—"}
                    {l.driver && <div className="muted" style={{ fontSize: 12 }}>{l.driver}</div>}
                  </td>
                  <td>{l.broker || "—"}</td>
                  <td className="mono">{shortDate(l.pickupDate)}</td>
                  <td>
                    <StatusPill status={l.status} />
                  </td>
                  <td>
                    <DocsBadge docs={l.docs} />
                  </td>
                  <td className="muted">{l.dispatcherName}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>
                    {money(l.gross)}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {canEdit(l) && (
                      <>
                        <button className="btn ghost sm" onClick={() => openEdit(l)} title="Edit">
                          ✎
                        </button>{" "}
                        <button className="btn ghost sm danger" onClick={() => void handleDelete(l)} title="Delete">
                          🗑
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <LoadFormModal
          initial={editing}
          isDuplicate={(ln) => isDuplicateLoadNumber(loads, ln, editing?.id)}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}

    </div>
  );
}
