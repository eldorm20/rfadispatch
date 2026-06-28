import {
  DEFAULT_SETTINGS,
  type AppUser,
  type CheckCall,
  type Invoice,
  type Load,
  type LoadDocs,
  type LoadStatus,
  type OrgSettings,
  type Role,
} from "../types";
import type { DataStore } from "./types";

/**
 * Demo backend — runs the whole app with no Firebase. Data lives in localStorage
 * and changes are broadcast to subscribers in-tab (and across tabs via `storage`).
 * Seeded on first run so every board has something to show.
 */

const LOADS_KEY = "tms.demo.loads";
const SETTINGS_KEY = "tms.demo.settings";
const USERS_KEY = "tms.demo.users";
const INVOICES_KEY = "tms.demo.invoices";

type Listener<T> = (val: T) => void;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function uid() {
  return "L" + Math.random().toString(36).slice(2, 10);
}

/* ---------------- seed ---------------- */

export const DEMO_USERS: AppUser[] = [
  { uid: "u_admin", email: "you@rfa.com", name: "You (Admin)", role: "admin", active: true },
  { uid: "u_disp1", email: "aziz@rfa.com", name: "Aziz", role: "dispatcher", active: true },
  { uid: "u_disp2", email: "diana@rfa.com", name: "Diana", role: "dispatcher", active: true },
  { uid: "u_upd", email: "sam@rfa.com", name: "Sam", role: "update_specialist", active: true },
  { uid: "u_acct", email: "lena@rfa.com", name: "Lena", role: "accounting", active: true },
  { uid: "u_mgr", email: "boss@rfa.com", name: "Marco", role: "manager", active: true },
];

const LANES: [string, string][] = [
  ["Chicago, IL", "Dallas, TX"],
  ["Atlanta, GA", "Miami, FL"],
  ["Los Angeles, CA", "Phoenix, AZ"],
  ["Newark, NJ", "Columbus, OH"],
  ["Houston, TX", "Denver, CO"],
  ["Seattle, WA", "Portland, OR"],
  ["Charlotte, NC", "Nashville, TN"],
];
const BROKERS = ["TQL", "CH Robinson", "Coyote", "Echo", "RXO", "Landstar"];
const CARRIERS = ["Silk Road Logistics", "Eagle Owner-Op", "Prime Star LLC", "BlueLine Trucking", "Nomad Freight"];
const DRIVERS = ["Rustam K.", "Mike D.", "Javohir T.", "Carlos M.", "Bek A.", "Tony R."];

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function seedLoads(): Load[] {
  const statuses: LoadStatus[] = ["available", "booked", "dispatched", "in_transit", "delivered", "invoiced"];
  const dispatchers = [DEMO_USERS[1], DEMO_USERS[2]];
  const out: Load[] = [];
  let n = 0;
  // Spread loads over the last 6 days so reports/history have data.
  for (let day = 0; day <= 5; day++) {
    const count = day === 0 ? 5 : 3;
    for (let k = 0; k < count; k++) {
      const [origin, destination] = pick(LANES, n);
      const disp = pick(dispatchers, n);
      const created = Date.now() - day * 86400000 - k * 3600000;
      // older loads tend to be further along the lifecycle
      const status = day === 0 ? pick(statuses.slice(0, 4), k) : day >= 3 ? pick(["delivered", "invoiced"] as LoadStatus[], k) : pick(statuses.slice(2), k);
      const gross = 1500 + ((n * 137) % 2200);
      // Seed paperwork roughly matching how far the load has progressed.
      const rcv = (at: number): { received: true; at: number; by: string } => ({ received: true, at, by: "Sam" });
      const docs: LoadDocs = {};
      if (["booked", "dispatched", "in_transit", "delivered", "invoiced"].includes(status)) docs.rate_con = rcv(created);
      if (["in_transit", "delivered", "invoiced"].includes(status)) docs.bol = rcv(created + 3600000);
      if (["delivered", "invoiced"].includes(status) && n % 4 !== 0) docs.pod = rcv(created + 7200000);
      if (status === "invoiced") docs.invoice = rcv(created + 10800000);
      const checkCalls: CheckCall[] =
        status === "in_transit" || status === "delivered" || status === "invoiced"
          ? [
              { ts: created + 3600000, by: "Sam", note: "Picked up, on time", status: "in_transit" },
              ...(status !== "in_transit" ? [{ ts: created + 7200000, by: "Sam", note: "Delivered, POD received", status: "delivered" as LoadStatus }] : []),
            ]
          : [];
      out.push({
        id: uid(),
        loadNumber: (1000 + n).toString() + "BSJ",
        broker: pick(BROKERS, n),
        carrier: pick(CARRIERS, n),
        driver: pick(DRIVERS, n),
        driverPhone: "(312) 555-0" + (100 + n),
        origin,
        destination,
        pickupDate: daysAgoISO(day),
        deliveryDate: daysAgoISO(Math.max(0, day - 2)),
        equipment: n % 3 === 0 ? "reefer" : "van",
        miles: 400 + ((n * 53) % 1400),
        gross,
        dispatcherId: disp.uid,
        dispatcherName: disp.name,
        status,
        lastUpdate: checkCalls.at(-1)?.note,
        lastUpdateAt: checkCalls.at(-1)?.ts,
        checkCalls,
        docs,
        createdAt: created,
        updatedAt: created,
      });
      n++;
    }
  }
  return out;
}

function ensureSeed() {
  if (localStorage.getItem(LOADS_KEY) == null) write(LOADS_KEY, seedLoads());
  if (localStorage.getItem(USERS_KEY) == null) write(USERS_KEY, DEMO_USERS);
  if (localStorage.getItem(SETTINGS_KEY) == null) write(SETTINGS_KEY, DEFAULT_SETTINGS);
  if (localStorage.getItem(INVOICES_KEY) == null) write(INVOICES_KEY, []);
}

/* ---------------- pub/sub ---------------- */

const loadListeners = new Set<Listener<Load[]>>();
const userListeners = new Set<Listener<AppUser[]>>();
const invoiceListeners = new Set<Listener<Invoice[]>>();

function getLoads(): Load[] {
  return read<Load[]>(LOADS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}
function setLoads(loads: Load[]) {
  write(LOADS_KEY, loads);
  loadListeners.forEach((l) => l(getLoads()));
}
function getUsers(): AppUser[] {
  return read<AppUser[]>(USERS_KEY, DEMO_USERS);
}
function getInvoices(): Invoice[] {
  return read<Invoice[]>(INVOICES_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}
function setInvoices(invs: Invoice[]) {
  write(INVOICES_KEY, invs);
  invoiceListeners.forEach((l) => l(getInvoices()));
}

// keep tabs in sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === LOADS_KEY) loadListeners.forEach((l) => l(getLoads()));
    if (e.key === USERS_KEY) userListeners.forEach((l) => l(getUsers()));
    if (e.key === INVOICES_KEY) invoiceListeners.forEach((l) => l(getInvoices()));
  });
}

export const localStore: DataStore = {
  subscribeLoads(cb) {
    ensureSeed();
    loadListeners.add(cb);
    cb(getLoads());
    return () => loadListeners.delete(cb);
  },

  async createLoad(input, user) {
    const now = Date.now();
    const load: Load = {
      ...input,
      id: uid(),
      gross: Number(input.gross) || 0,
      dispatcherId: user.uid,
      dispatcherName: user.name,
      checkCalls: [],
      createdAt: now,
      updatedAt: now,
    };
    setLoads([load, ...getLoads()]);
  },

  async updateLoad(id, patch) {
    setLoads(getLoads().map((l) => (l.id === id ? { ...l, ...patch, updatedAt: Date.now() } : l)));
  },

  async setLoadStatus(id, status) {
    setLoads(getLoads().map((l) => (l.id === id ? { ...l, status, updatedAt: Date.now() } : l)));
  },

  async deleteLoad(id) {
    setLoads(getLoads().map((l) => (l.id === id ? { ...l, deleted: true, deletedAt: Date.now() } : l)));
  },

  async restoreLoad(id) {
    setLoads(getLoads().map((l) => (l.id === id ? { ...l, deleted: false, deletedAt: null } : l)));
  },

  async purgeLoad(id) {
    setLoads(getLoads().filter((l) => l.id !== id));
  },

  async addCheckCall(id, note, by, status) {
    const call: CheckCall = { ts: Date.now(), by, note, ...(status ? { status } : {}) };
    setLoads(
      getLoads().map((l) =>
        l.id === id
          ? {
              ...l,
              checkCalls: [...(l.checkCalls ?? []), call],
              lastUpdate: note,
              lastUpdateAt: call.ts,
              status: status ?? l.status,
              updatedAt: Date.now(),
            }
          : l
      )
    );
  },

  subscribeInvoices(cb) {
    ensureSeed();
    invoiceListeners.add(cb);
    cb(getInvoices());
    return () => invoiceListeners.delete(cb);
  },

  async createInvoice(invoice) {
    const inv: Invoice = { ...invoice, id: "INV" + Math.random().toString(36).slice(2, 9) };
    setInvoices([inv, ...getInvoices()]);
    // stamp the loads as invoiced
    const ids = new Set(invoice.loadIds);
    setLoads(getLoads().map((l) => (ids.has(l.id) ? { ...l, invoiceId: inv.id, status: "invoiced", updatedAt: Date.now() } : l)));
  },

  async updateInvoice(id, patch) {
    setInvoices(getInvoices().map((i) => (i.id === id ? { ...i, ...patch } : i)));
  },

  async getSettings() {
    ensureSeed();
    return { ...DEFAULT_SETTINGS, ...read<Partial<OrgSettings>>(SETTINGS_KEY, {}) };
  },

  async saveSettings(patch) {
    write(SETTINGS_KEY, { ...read<OrgSettings>(SETTINGS_KEY, DEFAULT_SETTINGS), ...patch });
  },

  subscribeUsers(cb) {
    ensureSeed();
    userListeners.add(cb);
    cb(getUsers());
    return () => userListeners.delete(cb);
  },

  async updateUserRole(uid: string, role: Role) {
    const users = getUsers().map((u) => (u.uid === uid ? { ...u, role } : u));
    write(USERS_KEY, users);
    userListeners.forEach((l) => l(users));
  },
};

/** Wipe demo data and re-seed (used by the demo banner's reset button). */
export function resetDemo() {
  localStorage.removeItem(LOADS_KEY);
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(INVOICES_KEY);
  ensureSeed();
  loadListeners.forEach((l) => l(getLoads()));
  userListeners.forEach((l) => l(getUsers()));
  invoiceListeners.forEach((l) => l(getInvoices()));
}
