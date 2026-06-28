import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLoads, toggleDoc } from "../hooks/useLoads";
import { DocsBadge } from "../components/DocsBadge";
import { StatusPill } from "../components/StatusPill";
import { can } from "../lib/permissions";
import { shortDate } from "../lib/format";
import { DOC_KINDS, DOC_LABELS, type DocKind, type Load } from "../types";

/** True if a load is missing any document that's expected at its current stage. */
function expectedDocs(l: Load): DocKind[] {
  const out: DocKind[] = ["rate_con"];
  if (["in_transit", "delivered", "invoiced"].includes(l.status)) out.push("bol");
  if (["delivered", "invoiced"].includes(l.status)) out.push("pod");
  if (l.status === "invoiced") out.push("invoice");
  return out;
}
function missingCount(l: Load): number {
  return expectedDocs(l).filter((k) => !l.docs?.[k]?.received).length;
}

export function Documents() {
  const { user } = useAuth();
  const { loads, loading } = useLoads();
  const perms = user ? can(user.role) : null;
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [docFilter, setDocFilter] = useState<DocKind | "all">("all");

  const rows = useMemo(() => {
    return loads
      .filter((l) => l.status !== "cancelled")
      .filter((l) => (onlyMissing ? missingCount(l) > 0 : true))
      .filter((l) => (docFilter === "all" ? true : !l.docs?.[docFilter]?.received && expectedDocs(l).includes(docFilter)))
      .sort((a, b) => missingCount(b) - missingCount(a));
  }, [loads, onlyMissing, docFilter]);

  const outstanding = loads.filter((l) => l.status !== "cancelled" && missingCount(l) > 0).length;

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Documents</h2>
          <p>{outstanding} load{outstanding === 1 ? "" : "s"} with paperwork outstanding. Click a tag to mark it received.</p>
        </div>
        <div className="row" style={{ flex: "0 0 auto", alignItems: "flex-end" }}>
          <div className="field">
            <label>Needs</label>
            <select value={docFilter} onChange={(e) => setDocFilter(e.target.value as DocKind | "all")}>
              <option value="all">Any document</option>
              {DOC_KINDS.map((k) => (
                <option key={k} value={k}>
                  Missing {DOC_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <label className="chip" style={{ cursor: "pointer" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            Outstanding only
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="big">📄</div>
          <p>{onlyMissing ? "All caught up — no missing paperwork." : "No loads."}</p>
        </div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Load #</th>
                <th>Lane</th>
                <th>Carrier</th>
                <th>Status</th>
                <th>Delivered</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.loadNumber}</td>
                  <td>
                    {l.origin} <span className="muted">→</span> {l.destination}
                  </td>
                  <td>{l.carrier}</td>
                  <td>
                    <StatusPill status={l.status} />
                  </td>
                  <td className="mono">{shortDate(l.deliveryDate)}</td>
                  <td>
                    <DocsBadge
                      docs={l.docs}
                      onToggle={perms?.editDocs ? (k) => void toggleDoc(l, k, user?.name ?? "User") : undefined}
                    />
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
