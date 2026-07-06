import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useLoads, createLoad, isDuplicateLoadNumber } from "../hooks/useLoads";
import { useSettings, saveSettings } from "../hooks/useSettings";
import { useToast } from "../components/Toast";
import { exportLoadsCSV, exportLoadsJSON, parseImportedLoads } from "../lib/exportImport";
import { seedSampleData } from "../lib/sampleData";
import { money } from "../lib/format";
import { DEFAULT_SETTINGS, type OrgSettings } from "../types";

export function Settings() {
  const { user } = useAuth();
  const live = useSettings();
  const { loads } = useLoads();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OrgSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(live), [live]);

  const set = <K extends keyof OrgSettings>(k: K, v: OrgSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await saveSettings(form);
      toast("Settings saved");
    } finally {
      setSaving(false);
    }
  }

  async function seedDemo() {
    if (!confirm("Add ~25 sample loads + drivers to the database for a demo? You can delete them later.")) return;
    try {
      const r = await seedSampleData();
      if (r.errors.length) {
        toast(`Seeded ${r.loads} loads / ${r.drivers} drivers. Issue: ${r.errors[0]}`);
      } else {
        toast(`✓ Seeded ${r.loads} loads, ${r.drivers} drivers`);
      }
    } catch (e) {
      toast("Seed failed: " + (e instanceof Error ? e.message : "error"));
    }
  }

  async function onImport(file: File) {
    try {
      const text = await file.text();
      const parsed = parseImportedLoads(text);
      if (!user) return;
      let added = 0;
      let skipped = 0;
      for (const l of parsed) {
        if (isDuplicateLoadNumber(loads, l.loadNumber)) {
          skipped++;
          continue;
        }
        await createLoad(l, user);
        added++;
      }
      toast(`Imported ${added} load${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} duplicate(s)` : ""}`);
    } catch (e) {
      toast("Import failed: " + (e instanceof Error ? e.message : "bad file"));
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Settings</h2>
          <p>Org-wide goal, commission and data tools.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", maxWidth: 900 }}>
        <div className="card">
          <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>Targets</h3>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Daily gross goal ($)</label>
            <input type="number" step="1000" value={form.dailyGoal || ""} onChange={(e) => set("dailyGoal", Number(e.target.value))} placeholder="100000" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Baseline to compare against ($)</label>
            <input type="number" step="1000" value={form.baseline || ""} onChange={(e) => set("baseline", Number(e.target.value))} placeholder="e.g. yesterday's gross" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Commission rate (%)</label>
            <input type="number" step="0.1" value={form.commissionPct} onChange={(e) => set("commissionPct", Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Confirm loads at/above ($)</label>
            <input type="number" step="500" value={form.confirmThreshold} onChange={(e) => set("confirmThreshold", Number(e.target.value))} placeholder="5000" />
            <span className="muted" style={{ fontSize: 11 }}>Asks for confirmation when booking/deleting a load this big — catches typos.</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>Data</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            {loads.length} active load{loads.length === 1 ? "" : "s"} · {money(loads.reduce((s, l) => s + l.gross, 0))} gross
          </p>
          <div className="grid" style={{ gap: 10 }}>
            <button className="btn" onClick={() => exportLoadsJSON(loads)}>⤓ Export JSON (backup)</button>
            <button className="btn" onClick={() => exportLoadsCSV(loads)}>⤓ Export CSV</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>⤒ Import JSON</button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
          </div>
          <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>
            Import adds loads from a previously exported JSON file. Duplicate load numbers are skipped.
          </p>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <button className="btn" style={{ width: "100%" }} onClick={() => void seedDemo()}>
              ✨ Seed sample data (demo)
            </button>
            <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>
              Adds ~25 realistic loads across teams A–X, drivers, and invoices — for showing the system to management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
