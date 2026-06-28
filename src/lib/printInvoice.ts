import type { Invoice, Load } from "../types";
import { money } from "./format";

/** Open a clean, printable invoice in a new window and trigger the print dialog (Save as PDF). */
export function printInvoice(inv: Invoice, loads: Load[], orgName = "RFA Dispatch") {
  const lines = loads
    .map(
      (l) => `<tr>
        <td>${esc(l.loadNumber)}</td>
        <td>${esc(l.origin)} → ${esc(l.destination)}</td>
        <td>${esc(l.deliveryDate ?? "")}</td>
        <td style="text-align:right">${money(l.gross)}</td>
        <td style="text-align:right">${money(l.gross * (inv.commissionPct / 100), 2)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.number)}</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#0a1f1d;margin:40px;}
    h1{margin:0;font-size:22px;letter-spacing:1px}
    .muted{color:#667}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0a1f1d;padding-bottom:16px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
    th,td{padding:9px 8px;border-bottom:1px solid #ddd;text-align:left}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#667}
    .totals{margin-top:20px;margin-left:auto;width:280px;font-size:14px}
    .totals .row{display:flex;justify-content:space-between;padding:6px 0}
    .totals .grand{border-top:2px solid #0a1f1d;font-weight:800;font-size:18px;margin-top:6px;padding-top:10px}
    .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;background:#e6f7f0;color:#0a7d55}
  </style></head><body>
    <div class="head">
      <div>
        <h1>${esc(orgName)}</h1>
        <div class="muted" style="font-size:12px">Dispatch commission invoice</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:700">${esc(inv.number)}</div>
        <div class="muted" style="font-size:12px">Issued ${new Date(inv.createdAt).toLocaleDateString()}</div>
        ${inv.dueDate ? `<div class="muted" style="font-size:12px">Due ${esc(inv.dueDate)}</div>` : ""}
        <div style="margin-top:6px"><span class="pill">${esc(inv.status)}</span></div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:18px">
      <div>
        <div class="muted" style="font-size:11px;text-transform:uppercase">Bill to</div>
        <div style="font-size:16px;font-weight:700">${esc(inv.carrier)}</div>
      </div>
      <div style="text-align:right">
        <div class="muted" style="font-size:11px;text-transform:uppercase">Period</div>
        <div>${esc(inv.periodStart)} — ${esc(inv.periodEnd)}</div>
        <div class="muted" style="font-size:12px">${loads.length} load${loads.length === 1 ? "" : "s"} · commission ${inv.commissionPct}%</div>
      </div>
    </div>

    <table>
      <thead><tr><th>Load #</th><th>Lane</th><th>Delivered</th><th style="text-align:right">Gross</th><th style="text-align:right">Commission</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span class="muted">Total gross</span><span>${money(inv.totalGross)}</span></div>
      <div class="row"><span class="muted">Commission (${inv.commissionPct}%)</span><span>${money(inv.amountDue, 2)}</span></div>
      <div class="row grand"><span>Amount due</span><span>${money(inv.amountDue, 2)}</span></div>
    </div>

    ${inv.notes ? `<p class="muted" style="margin-top:24px;font-size:12px">${esc(inv.notes)}</p>` : ""}
    <script>window.onload=()=>{window.print();}</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) {
    alert("Allow pop-ups to print the invoice.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
