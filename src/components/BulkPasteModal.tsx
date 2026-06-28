import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { createLoad, isDuplicateLoadNumber } from "../hooks/useLoads";
import { useToast } from "./Toast";
import { money } from "../lib/format";
import type { Load, NewLoadInput } from "../types";

type Row =
  | { status: "new"; input: NewLoadInput }
  | { status: "dup"; loadNumber: string; gross: number; reason: string }
  | { status: "bad"; raw: string; reason: string };

/**
 * Paste rows from a spreadsheet to book many loads at once.
 * Columns (tab- or comma-separated): Load# · Carrier · Gross [· Origin · Destination · Broker]
 */
function parseRows(text: string, existing: Load[]): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Row[] = [];
  const seen = new Set<string>();
  lines.forEach((line, i) => {
    // skip a header row
    if (i === 0 && /load/i.test(line) && /(carrier|gross|rate|price|amount)/i.test(line)) return;
    const parts = line.includes("\t") ? line.split("\t") : line.split(/\s*,\s*/);
    if (parts.length < 3) {
      out.push({ status: "bad", raw: line, reason: "Need at least 3 columns" });
      return;
    }
    const loadNumber = parts[0].trim();
    const carrier = parts[1].trim();
    const gross = parseFloat(String(parts[2]).replace(/[$,\s]/g, ""));
    if (!loadNumber || !carrier || isNaN(gross) || gross <= 0) {
      out.push({ status: "bad", raw: line, reason: "Empty or invalid field" });
      return;
    }
    const norm = loadNumber.toLowerCase();
    if (isDuplicateLoadNumber(existing, loadNumber) || seen.has(norm)) {
      out.push({ status: "dup", loadNumber, gross, reason: "Load number already exists" });
      return;
    }
    seen.add(norm);
    out.push({
      status: "new",
      input: {
        loadNumber,
        carrier,
        gross,
        origin: (parts[3] ?? "").trim(),
        destination: (parts[4] ?? "").trim(),
        broker: (parts[5] ?? "").trim(),
        brokerContact: "",
        driver: "",
        driverPhone: "",
        truck: "",
        pickupDate: "",
        deliveryDate: "",
        equipment: "van",
        miles: undefined,
        status: "available",
        notes: "",
      },
    });
  });
  return out;
}

export function BulkPasteModal({ existing, onClose }: { existing: Load[]; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => (text.trim() ? parseRows(text, existing) : []), [text, existing]);
  const newRows = rows.filter((r) => r.status === "new") as Extract<Row, { status: "new" }>[];
  const dupCount = rows.filter((r) => r.status === "dup").length;
  const badCount = rows.filter((r) => r.status === "bad").length;
  const total = newRows.reduce((s, r) => s + r.input.gross, 0);

  async function add() {
    if (!user || !newRows.length) return;
    setBusy(true);
    try {
      for (const r of newRows) await createLoad(r.input, user);
      toast(`Added ${newRows.length} load${newRows.length === 1 ? "" : "s"}`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <h2>Paste rows</h2>
        <p className="hint">
          Paste from Google Sheets / Excel — tab or comma separated. Columns:{" "}
          <strong>Load # · Carrier · Gross</strong> (optionally · Origin · Destination · Broker). Header row optional; duplicates are skipped.
        </p>

        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"1127BSJ\tSilk Road\t2450\tChicago, IL\tDallas, TX\nL-9981\tEagle Owner-Op\t1980"}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />

        {rows.length > 0 && (
          <>
            <div className="table-wrap" style={{ marginTop: 14, maxHeight: 240, overflowY: "auto" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Load</th>
                    <th>Carrier</th>
                    <th style={{ textAlign: "right" }}>Gross</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="muted">{i + 1}</td>
                      <td className="mono">{r.status === "bad" ? "—" : r.status === "new" ? r.input.loadNumber : r.loadNumber}</td>
                      <td>{r.status === "new" ? r.input.carrier : r.status === "bad" ? r.raw.slice(0, 24) : "—"}</td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {r.status === "bad" ? "—" : money(r.status === "new" ? r.input.gross : r.gross)}
                      </td>
                      <td>
                        <span
                          className="status"
                          style={{
                            color: r.status === "new" ? "var(--green)" : r.status === "dup" ? "var(--gold)" : "var(--red)",
                            background: "transparent",
                          }}
                          title={r.status !== "new" ? r.reason : ""}
                        >
                          {r.status === "new" ? "✓ New" : r.status === "dup" ? "⚠ Duplicate" : "✗ Invalid"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="spread" style={{ marginTop: 10, fontSize: 13 }}>
              <span>
                <strong style={{ color: "var(--green)" }}>{newRows.length}</strong> new ·{" "}
                <strong style={{ color: "var(--gold)" }}>{dupCount}</strong> dup ·{" "}
                <strong style={{ color: "var(--red)" }}>{badCount}</strong> invalid
              </span>
              <span>Total: <strong>{money(total)}</strong></span>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => void add()} disabled={!newRows.length || busy}>
            {busy ? "Adding…" : `＋ Add ${newRows.length} load${newRows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
