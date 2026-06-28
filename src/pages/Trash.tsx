import { useLoads, restoreLoad, purgeLoad } from "../hooks/useLoads";
import { useToast } from "../components/Toast";
import { money, relativeTime } from "../lib/format";
import type { Load } from "../types";

export function Trash() {
  const { trash, loading } = useLoads();
  const toast = useToast();

  async function restore(l: Load) {
    await restoreLoad(l.id);
    toast(`Restored ${l.loadNumber}`);
  }
  async function purge(l: Load) {
    if (!confirm(`Permanently delete ${l.loadNumber}? This cannot be undone.`)) return;
    await purgeLoad(l.id);
    toast("Permanently deleted");
  }
  async function emptyTrash() {
    if (!confirm(`Permanently delete all ${trash.length} load(s) in Trash?`)) return;
    for (const l of trash) await purgeLoad(l.id);
    toast("Trash emptied");
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Trash</h2>
          <p>Deleted loads are kept for 24 hours, then auto-purged.</p>
        </div>
        {trash.length > 0 && (
          <button className="btn danger" onClick={() => void emptyTrash()}>
            ⌫ Empty Trash
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : trash.length === 0 ? (
        <div className="empty">
          <div className="big">🗑</div>
          <p>No deleted loads in the last 24 hours.</p>
        </div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Load #</th>
                <th>Lane</th>
                <th>Carrier</th>
                <th>Deleted</th>
                <th style={{ textAlign: "right" }}>Gross</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trash.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.loadNumber}</td>
                  <td>
                    {l.origin} <span className="muted">→</span> {l.destination}
                  </td>
                  <td>{l.carrier}</td>
                  <td className="muted">{relativeTime(l.deletedAt ?? undefined)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(l.gross)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn sm" onClick={() => void restore(l)}>↶ Restore</button>{" "}
                    <button className="btn ghost sm danger" onClick={() => void purge(l)}>⌫</button>
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
