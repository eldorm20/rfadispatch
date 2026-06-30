import type { Load } from "../types";
import { money } from "./format";

interface DispatcherRow {
  name: string;
  gross: number;
  count: number;
}

/** Open a clean, RFA-branded daily report in a new window and trigger print (Save as PDF). */
export function printDailyReport(opts: {
  date: string;
  loads: Load[];
  perDispatcher: DispatcherRow[];
  gross: number;
  best: number;
  orgName?: string;
}) {
  const { date, loads, perDispatcher, gross, best, orgName = "RFA Dispatch" } = opts;
  const prettyDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const avg = loads.length ? gross / loads.length : 0;

  const loadRows = loads
    .map(
      (l) => `<tr>
        <td class="mono">${esc(l.loadNumber)}</td>
        <td>${esc(l.origin)} → ${esc(l.destination)}</td>
        <td>${esc(l.carrier)}</td>
        <td>${esc(l.dispatcherName)}${l.team ? ` · ${esc(l.team)}` : ""}</td>
        <td><span class="pill ${l.status}">${esc(l.status.replace(/_/g, " "))}</span></td>
        <td class="r mono">${money(l.gross)}</td>
      </tr>`
    )
    .join("");

  const dispRows = perDispatcher
    .map((d) => `<tr><td>${esc(d.name)}</td><td class="r">${d.count}</td><td class="r mono">${money(d.gross)}</td></tr>`)
    .join("");

  const wave = `<svg width="34" height="34" viewBox="0 0 56 56"><rect width="56" height="56" rx="12" fill="#02110f"/><g stroke="#22c55e" stroke-width="2" fill="none" stroke-linecap="round"><path d="M 6 30 Q 16 22 26 30 T 50 28"/><path d="M 6 38 Q 16 30 26 38 T 50 36"/><path d="M 6 46 Q 16 38 26 46 T 50 44"/></g></svg>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>RFA Daily Report — ${esc(date)}</title>
  <style>
    :root{ --ink:#0a1f1d; --teal:#0f766e; --green:#16a34a; --muted:#5b7a72; --line:#e2e8e5; }
    *{box-sizing:border-box}
    body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:var(--ink);margin:0;padding:40px;}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--ink);padding-bottom:18px;}
    .brand{display:flex;gap:12px;align-items:center}
    .brand h1{margin:0;font-size:20px;letter-spacing:2px}
    .brand .sub{color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase}
    .doc-title{text-align:right}
    .doc-title .t{font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:1px}
    .doc-title .d{color:var(--muted);font-size:12px;margin-top:2px}
    .kpis{display:flex;gap:14px;margin:24px 0}
    .kpi{flex:1;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
    .kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}
    .kpi .v{font-size:22px;font-weight:800;margin-top:4px}
    .kpi .v.green{color:var(--green)}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:26px 0 8px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);padding:8px;border-bottom:2px solid var(--ink)}
    td{padding:8px;border-bottom:1px solid var(--line)}
    .r{text-align:right}.mono{font-variant-numeric:tabular-nums}
    .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;background:#eef6f2;color:var(--teal)}
    .pill.delivered,.pill.invoiced{background:#e7f7ec;color:var(--green)}
    .pill.cancelled{background:#fdecec;color:#c0392b}
    .foot{margin-top:30px;color:var(--muted);font-size:11px;border-top:1px solid var(--line);padding-top:10px;display:flex;justify-content:space-between}
    @media print{ body{padding:24px} .kpi{break-inside:avoid} tr{break-inside:avoid} }
  </style></head><body>
    <div class="head">
      <div class="brand">${wave}<div><h1>${esc(orgName.toUpperCase())}</h1><div class="sub">Transportation Management</div></div></div>
      <div class="doc-title"><div class="t">Daily Gross Report</div><div class="d">${esc(prettyDate)}</div></div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="l">Total Gross</div><div class="v green">${money(gross)}</div></div>
      <div class="kpi"><div class="l">Loads</div><div class="v">${loads.length}</div></div>
      <div class="kpi"><div class="l">Avg / Load</div><div class="v">${money(avg)}</div></div>
      <div class="kpi"><div class="l">Best Load</div><div class="v">${money(best)}</div></div>
    </div>

    ${dispRows ? `<h2>By Dispatcher</h2>
    <table><thead><tr><th>Dispatcher</th><th class="r">Loads</th><th class="r">Gross</th></tr></thead><tbody>${dispRows}</tbody></table>` : ""}

    <h2>Loads</h2>
    <table>
      <thead><tr><th>Load #</th><th>Lane</th><th>Carrier</th><th>Dispatcher</th><th>Status</th><th class="r">Gross</th></tr></thead>
      <tbody>${loadRows || `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No loads booked on this day.</td></tr>`}</tbody>
    </table>

    <div class="foot"><span>${esc(orgName)} · Generated ${new Date().toLocaleString()}</span><span>Confidential</span></div>
    <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Allow pop-ups to download the PDF report.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
