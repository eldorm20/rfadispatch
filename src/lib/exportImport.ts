import type { Load, NewLoadInput, Equipment, LoadStatus } from "../types";
import { LOAD_STATUSES, EQUIPMENT_LABELS } from "../types";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportLoadsJSON(loads: Load[]) {
  download(`dispatch-loads-${stamp()}.json`, JSON.stringify(loads, null, 2), "application/json");
}

export function exportLoadsCSV(loads: Load[]) {
  const rows = [
    ["Load #", "Status", "Carrier", "Driver", "Broker", "Origin", "Destination", "Pickup", "Delivery", "Equipment", "Dispatcher", "Gross"],
    ...loads.map((l) => [
      l.loadNumber,
      l.status,
      l.carrier,
      l.driver,
      l.broker,
      l.origin,
      l.destination,
      l.pickupDate ?? "",
      l.deliveryDate ?? "",
      l.equipment,
      l.dispatcherName,
      String(l.gross),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  download(`dispatch-loads-${stamp()}.csv`, csv, "text/csv");
}

const EQUIP = new Set(Object.keys(EQUIPMENT_LABELS) as Equipment[]);
const STATUS = new Set(LOAD_STATUSES);

/** Parse a previously-exported JSON file into bookable load inputs (validated/coerced). */
export function parseImportedLoads(text: string): NewLoadInput[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("Expected a JSON array of loads");
  return data
    .filter((d) => d && (d.loadNumber || d.carrier))
    .map((d): NewLoadInput => ({
      loadNumber: String(d.loadNumber ?? "").trim(),
      broker: String(d.broker ?? ""),
      brokerContact: d.brokerContact ? String(d.brokerContact) : "",
      carrier: String(d.carrier ?? ""),
      driver: String(d.driver ?? ""),
      driverPhone: d.driverPhone ? String(d.driverPhone) : "",
      truck: d.truck ? String(d.truck) : "",
      origin: String(d.origin ?? ""),
      destination: String(d.destination ?? ""),
      pickupDate: d.pickupDate ? String(d.pickupDate) : "",
      deliveryDate: d.deliveryDate ? String(d.deliveryDate) : "",
      equipment: EQUIP.has(d.equipment) ? (d.equipment as Equipment) : "van",
      miles: d.miles ? Number(d.miles) : undefined,
      gross: Number(d.gross) || 0,
      status: STATUS.has(d.status) ? (d.status as LoadStatus) : "available",
      notes: d.notes ? String(d.notes) : "",
    }));
}
