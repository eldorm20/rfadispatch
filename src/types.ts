/* ============================================================
   Domain model for the dispatch-service TMS.

   A dispatch service books loads on behalf of carriers / owner-
   operators and earns a commission off the gross. A single Load
   record is the shared object that flows through every role:

     dispatcher books it (gross board)
       -> update specialist tracks it (update board)
         -> accounting bills commission off the gross
   ============================================================ */

export type Role = "dispatcher" | "update_specialist" | "manager" | "accounting" | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  dispatcher: "Dispatcher",
  update_specialist: "Update Specialist",
  manager: "Manager",
  accounting: "Accounting",
  admin: "Admin",
};

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: Role;
  team?: string; // dispatch team this person belongs to (for the audit board)
  active?: boolean;
}

/** A driver in the roster — added once, then picked when assigning/searching loads. */
export interface Driver {
  id: string;
  name: string;
  phone?: string;
  carrier?: string; // carrier / owner-operator they run under
  truck?: string;
  active?: boolean;
  notes?: string;
  createdAt: number;
}

/* Load lifecycle — the columns of the operation. */
export type LoadStatus =
  | "available" // booked by dispatcher, not yet assigned/dispatched
  | "booked" // confirmed with broker, rate con in
  | "dispatched" // driver has been dispatched / heading to pickup
  | "in_transit" // picked up, on the road
  | "delivered" // delivered, POD pending/received
  | "invoiced" // commission billed to carrier
  | "cancelled";

export const LOAD_STATUSES: LoadStatus[] = [
  "available",
  "booked",
  "dispatched",
  "in_transit",
  "delivered",
  "invoiced",
  "cancelled",
];

export const STATUS_LABELS: Record<LoadStatus, string> = {
  available: "Available",
  booked: "Booked",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  delivered: "Delivered",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

export type Equipment = "van" | "reefer" | "flatbed" | "power_only" | "stepdeck" | "other";

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  van: "Dry Van",
  reefer: "Reefer",
  flatbed: "Flatbed",
  power_only: "Power Only",
  stepdeck: "Step Deck",
  other: "Other",
};

/* Documents tracked per load (metadata only for now — no file upload).
   Each can be marked received with who/when, so the team can chase missing paperwork. */
export type DocKind = "rate_con" | "bol" | "pod" | "invoice";

export const DOC_KINDS: DocKind[] = ["rate_con", "bol", "pod", "invoice"];

export const DOC_LABELS: Record<DocKind, string> = {
  rate_con: "Rate Con",
  bol: "BOL",
  pod: "POD",
  invoice: "Invoice",
};

/** Short tag for compact badges. */
export const DOC_SHORT: Record<DocKind, string> = {
  rate_con: "RC",
  bol: "BOL",
  pod: "POD",
  invoice: "INV",
};

export interface DocEntry {
  received: boolean;
  at?: number;
  by?: string;
}

export type LoadDocs = Partial<Record<DocKind, DocEntry>>;

/* A check call / status note added by an update specialist. */
export interface CheckCall {
  ts: number;
  by: string; // dispatcher/specialist name
  note: string;
  status?: LoadStatus; // status it moved the load to, if any
}

/** Where a load came from. Amazon-only for now; structured so other boards can be added later. */
export type LoadSource = "manual" | "amazon";

export interface Load {
  id: string;

  // Identity
  loadNumber: string; // VRID / load / reference number
  source?: LoadSource; // defaults to "manual"; "amazon" = auto-imported from Relay
  broker: string; // broker or customer name
  brokerContact?: string;

  // Who's hauling it
  carrier: string; // carrier / owner-operator company
  driver: string; // driver name
  driverPhone?: string;
  truck?: string;

  // Lane
  origin: string; // "City, ST"
  destination: string; // "City, ST"
  pickupDate?: string; // ISO yyyy-mm-dd
  deliveryDate?: string; // ISO yyyy-mm-dd
  equipment: Equipment;
  miles?: number;

  // Money
  gross: number; // line-haul / total rate

  // Ownership + lifecycle
  dispatcherId: string; // uid of dispatcher who booked it
  dispatcherName: string;
  status: LoadStatus;

  // Update board
  lastUpdate?: string; // most recent check-call note
  lastUpdateAt?: number;
  checkCalls?: CheckCall[];

  // Paperwork tracking (metadata only — no file upload yet).
  docs?: LoadDocs;

  // Accounting: set once this load has been put on a carrier invoice.
  invoiceId?: string | null;

  notes?: string;

  // Soft delete — kept for 24h so deletes can be undone / restored from Trash.
  deleted?: boolean;
  deletedAt?: number | null;

  // Timestamps (ms epoch; serverTimestamp resolved client-side)
  createdAt: number;
  updatedAt: number;
}

/** Fields a dispatcher fills when booking — everything else is derived/defaulted. */
export type NewLoadInput = Omit<
  Load,
  "id" | "createdAt" | "updatedAt" | "dispatcherId" | "dispatcherName" | "checkCalls" | "lastUpdate" | "lastUpdateAt"
>;

/* ============================================================
   Accounting — the dispatch service bills each carrier a commission
   (its fee) on the carrier's loads. An Invoice groups a carrier's
   loads for a period and tracks whether that commission was paid.
   ============================================================ */
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

export interface Invoice {
  id: string;
  number: string; // human invoice number, e.g. INV-1042
  carrier: string;
  loadIds: string[];
  periodStart: string; // ISO yyyy-mm-dd
  periodEnd: string;
  totalGross: number; // sum of load gross on this invoice
  commissionPct: number;
  amountDue: number; // commission billed to the carrier (our revenue)
  status: InvoiceStatus;
  dueDate?: string;
  paidAt?: number | null;
  createdBy?: string;
  createdAt: number;
  notes?: string;
}

export interface OrgSettings {
  commissionPct: number; // dispatch service's cut of gross, e.g. 5 = 5%
  dailyGoal: number; // gross goal for the dashboard / TV board
  baseline: number; // compare today's gross against this number (% badge)
  confirmThreshold: number; // confirm before booking/deleting a load at/above this gross (typo guard)
}

export const DEFAULT_SETTINGS: OrgSettings = {
  commissionPct: 5,
  dailyGoal: 0,
  baseline: 0,
  confirmThreshold: 5000,
};
