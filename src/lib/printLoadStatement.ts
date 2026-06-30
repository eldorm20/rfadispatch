import type { Load } from "../types";
import { money, shortDate } from "./format";

interface Charges {
  lumperFee?: number;
  layoverFee?: number;
  detentionFee?: number;
  tonu?: number;
  otherCharges?: number;
  accountingNotes?: string;
  total: number;
}

/** Open a branded per-load settlement statement and trigger print (Save as PDF). */
export function printLoadStatement(load: Load, c: Charges, orgName = "RFA Dispatch") {
  const line = (label: string, val?: number) =>
    val ? `<tr><td>${esc(label)}</td><td class="r mono">${money(val, 2)}</td></tr>` : "";

  const wave = `<svg width="34" height="34" viewBox="0 0 56 56"><rect width="56" height="56" rx="12" fill="#02110f"/><g stroke="#22c55e" stroke-width="2" fill="none" stroke-linecap="round"><path d="M 6 30 Q 16 22 26 30 T 50 28"/><path d="M 6 38 Q 16 30 26 38 T 50 36"/><path d="M 6 46 Q 16 38 26 46 T 50 44"/></g></svg>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Load ${esc(load.loadNumber)} — Statement</title>
  <style>
    :root{--ink:#0a1f1d;--green:#16a34a;--muted:#5b7a72;--line:#e2e8e5}
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:var(--ink);margin:0;padding:40px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--ink);padding-bottom:16px}
    .brand{display:flex;gap:12px;align-items:center}.brand h1{margin:0;font-size:19px;letter-spacing:2px}
    .brand .sub{color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase}
    .doc-title{text-align:right}.doc-title .t{font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px}
    .doc-title .d{color:var(--muted);font-size:12px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:22px 0;font-size:13px}
    .meta .row{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:5px 0}
    .meta .row .k{color:var(--muted)}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
    td{padding:8px;border-bottom:1px solid var(--line)} .r{text-align:right}.mono{font-variant-numeric:tabular-nums}
    .total{display:flex;justify-content:space-between;margin-top:14px;padding-top:12px;border-top:2px solid var(--ink);font-size:18px;font-weight:800}
    .total .v{color:var(--green)}
    .foot{margin-top:30px;color:var(--muted);font-size:11px;border-top:1px solid var(--line);padding-top:10px;display:flex;justify-content:space-between}
    h2{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:20px 0 4px}
  </style></head><body>
    <div class="head">
      <div class="brand">${wave}<div><h1>${esc(orgName.toUpperCase())}</h1><div class="sub">Transportation Management</div></div></div>
      <div class="doc-title"><div class="t">Load Settlement</div><div class="d">Load ${esc(load.loadNumber)}</div></div>
    </div>

    <div class="meta">
      <div class="row"><span class="k">Lane</span><span>${esc(load.origin)} → ${esc(load.destination)}</span></div>
      <div class="row"><span class="k">Status</span><span>${esc(load.status.replace(/_/g, " "))}</span></div>
      <div class="row"><span class="k">Carrier</span><span>${esc(load.carrier || "—")}</span></div>
      <div class="row"><span class="k">Driver</span><span>${esc(load.driver || "—")}</span></div>
      <div class="row"><span class="k">Pickup</span><span>${esc(shortDate(load.pickupDate))}</span></div>
      <div class="row"><span class="k">Delivery</span><span>${esc(shortDate(load.deliveryDate))}</span></div>
      <div class="row"><span class="k">Broker</span><span>${esc(load.broker || "—")}</span></div>
      <div class="row"><span class="k">Miles</span><span>${load.miles ?? "—"}</span></div>
    </div>

    <h2>Charges</h2>
    <table><tbody>
      <tr><td>Line haul</td><td class="r mono">${money(load.gross, 2)}</td></tr>
      ${line("Lumper fee", c.lumperFee)}
      ${line("Layover", c.layoverFee)}
      ${line("Detention", c.detentionFee)}
      ${line("TONU", c.tonu)}
      ${line("Other charges", c.otherCharges)}
    </tbody></table>
    <div class="total"><span>Total Payable</span><span class="v mono">${money(c.total, 2)}</span></div>
    ${c.accountingNotes ? `<p style="color:var(--muted);font-size:12px;margin-top:18px">Notes: ${esc(c.accountingNotes)}</p>` : ""}

    <div class="foot"><span>${esc(orgName)} · Generated ${new Date().toLocaleString()}</span><span>Confidential</span></div>
    <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=820,height=950");
  if (!w) {
    alert("Allow pop-ups to print the statement.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}
