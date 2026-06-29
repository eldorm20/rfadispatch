import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { createLoad, updateLoad } from "../hooks/useLoads";
import { useToast } from "./Toast";
import { mapRelayResponse, type RelayImportedLoad } from "../lib/relayMapping";
import { money } from "../lib/format";
import type { Load } from "../types";

type Plan =
  | { kind: "new"; load: RelayImportedLoad }
  | { kind: "update"; load: RelayImportedLoad; existing: Load }
  | { kind: "skip"; load: RelayImportedLoad; existing: Load };

/**
 * Paste the JSON from Amazon Relay's Trips call (POST /api/tours/entitiesV2)
 * and import it as loads. New trips are created; existing ones are refreshed
 * when Amazon's version is newer; unchanged ones are skipped. This is the same
 * mapping the Chrome extension will run automatically.
 */
export function RelayImportModal({ existing, onClose }: { existing: Load[]; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const byLoadNo = useMemo(() => {
    const m = new Map<string, Load>();
    existing.forEach((l) => m.set(l.loadNumber.toLowerCase(), l));
    return m;
  }, [existing]);

  const plan: Plan[] = useMemo(() => {
    if (!text.trim()) return [];
    let mapped: RelayImportedLoad[] = [];
    try {
      mapped = mapRelayResponse(JSON.parse(text));
    } catch {
      return [];
    }
    return mapped.map((load) => {
      const ex = byLoadNo.get(load.loadNumber.toLowerCase());
      if (!ex) return { kind: "new", load } as Plan;
      const exVer = ex.amazon?.version ?? -1;
      if ((load.amazon.version ?? 0) > exVer || ex.status !== load.status || ex.gross !== load.gross) {
        return { kind: "update", load, existing: ex } as Plan;
      }
      return { kind: "skip", load, existing: ex } as Plan;
    });
  }, [text, byLoadNo]);

  const news = plan.filter((p) => p.kind === "new");
  const updates = plan.filter((p) => p.kind === "update");
  const skips = plan.filter((p) => p.kind === "skip");

  function onText(v: string) {
    setText(v);
    setErr(v.trim() && plan.length === 0 ? "" : "");
    if (v.trim()) {
      try {
        JSON.parse(v);
        setErr("");
      } catch {
        setErr("That doesn't look like valid JSON yet.");
      }
    } else setErr("");
  }

  async function run() {
    if (!user) return;
    setBusy(true);
    try {
      for (const p of plan) {
        if (p.kind === "new") {
          await createLoad(p.load, user);
        } else if (p.kind === "update") {
          // refresh Amazon-sourced fields only; keep dispatcher attribution + invoicing
          await updateLoad(p.existing.id, {
            status: p.load.status,
            gross: p.load.gross,
            driver: p.load.driver,
            driverPhone: p.load.driverPhone,
            origin: p.load.origin,
            destination: p.load.destination,
            pickupDate: p.load.pickupDate,
            deliveryDate: p.load.deliveryDate,
            miles: p.load.miles,
            equipment: p.load.equipment,
            amazon: p.load.amazon,
          });
        }
      }
      toast(`Imported ${news.length} new · updated ${updates.length}`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <h2>Import from Amazon Relay</h2>
        <p className="hint">
          On Relay’s <strong>Trips</strong> page open DevTools → Network → click the{" "}
          <code>entitiesV2</code> request → <strong>Response</strong> → copy all, and paste it here. (The Chrome extension will do
          this automatically once installed.)
        </p>

        <textarea
          rows={6}
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder='{"entities":[ ... ]}'
          style={{ fontFamily: "monospace", fontSize: 12 }}
        />
        {err && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>{err}</div>}

        {plan.length > 0 && (
          <>
            <div className="spread" style={{ margin: "12px 0", fontSize: 13 }}>
              <span>
                <strong style={{ color: "var(--green)" }}>{news.length}</strong> new ·{" "}
                <strong style={{ color: "var(--gold)" }}>{updates.length}</strong> to update ·{" "}
                <strong className="muted">{skips.length}</strong> unchanged
              </span>
              <span>
                Total gross: <strong>{money(plan.reduce((s, p) => s + p.load.gross, 0))}</strong>
              </span>
            </div>
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Load #</th>
                    <th>Lane</th>
                    <th>Driver</th>
                    <th style={{ textAlign: "right" }}>Gross</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((p, i) => (
                    <tr key={i}>
                      <td className="mono">{p.load.loadNumber}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{p.load.origin} → {p.load.destination}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{p.load.driver || "—"}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{money(p.load.gross)}</td>
                      <td>
                        <span
                          className="status"
                          style={{
                            background: "transparent",
                            color: p.kind === "new" ? "var(--green)" : p.kind === "update" ? "var(--gold)" : "var(--muted)",
                          }}
                        >
                          {p.kind === "new" ? "✓ New" : p.kind === "update" ? "↻ Update" : "= Unchanged"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => void run()} disabled={busy || news.length + updates.length === 0}>
            {busy ? "Importing…" : `Import ${news.length + updates.length} load${news.length + updates.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
