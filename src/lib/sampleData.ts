/* One-click realistic demo dataset for management presentations.
   Writes straight to the active store (live Firestore when connected). Manager-only. */
import { store } from "../data";
import type { Invoice, Load, LoadStatus } from "../types";

const TEAMS: { team: string; name: string; id: string }[] = [
  { team: "Team A", name: "Aziz", id: "seed_aziz" },
  { team: "Team B", name: "Diana", id: "seed_diana" },
  { team: "Team C", name: "Bek", id: "seed_bek" },
  { team: "Team E", name: "Lola", id: "seed_lola" },
  { team: "Team X", name: "Otabek", id: "seed_otabek" },
];
const LANES: [string, string][] = [
  ["Dallas, TX", "Northlake, TX"], ["Atlanta, GA", "Miami, FL"], ["Chicago, IL", "Dallas, TX"],
  ["Los Angeles, CA", "Phoenix, AZ"], ["Newark, NJ", "Columbus, OH"], ["Houston, TX", "Denver, CO"],
  ["Seattle, WA", "Portland, OR"], ["Charlotte, NC", "Nashville, TN"], ["Tallahassee, FL", "Opa Locka, FL"],
  ["Chattanooga, TN", "Jackson, GA"], ["Fort Worth, TX", "Stockton, CA"], ["Concord, NC", "Claremont, NC"],
];
const BROKERS = ["Amazon Relay", "TQL", "CH Robinson", "Coyote", "RXO", "Landstar"];
const CARRIERS = ["Zemen Logistics LLC", "Silk Road Logistics", "Eagle Owner-Op", "Prime Star LLC", "BlueLine Trucking", "Nomad Freight"];
const DRIVERS = [
  { name: "Khurshed Amirdinov", phone: "+1 (412) 689-2705" },
  { name: "Doniyor Nuritdinov", phone: "+1 (407) 766-4240" },
  { name: "Zayniddin Mirzakabilov", phone: "+1 (312) 555-0142" },
  { name: "Abrorkhuja Imankhojaev", phone: "+1 (469) 555-0188" },
  { name: "Devin Gary", phone: "+1 (615) 555-0133" },
  { name: "Gregory Tapia", phone: "+1 (214) 555-0177" },
];
const EQUIP = ["van", "reefer", "van", "van", "flatbed"] as const;
const STATUSES: LoadStatus[] = ["available", "booked", "dispatched", "in_transit", "delivered", "invoiced"];

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export async function seedSampleData(): Promise<{ loads: number; drivers: number; invoices: number; errors: string[] }> {
  const errors: string[] = [];
  let driverCount = 0, loadCount = 0, invoiceCount = 0;

  // Drivers
  for (let i = 0; i < DRIVERS.length; i++) {
    try {
      await store.createDriver({
        name: DRIVERS[i].name, phone: DRIVERS[i].phone, carrier: CARRIERS[(i % (CARRIERS.length - 1)) + 1],
        truck: "TRK-" + (1000 + i * 7), active: true,
      });
      driverCount++;
    } catch (e) {
      errors.push("driver: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Loads — spread across teams, statuses, and the last 5 days
  const loads: Omit<Load, "id">[] = [];
  let n = 0;
  for (let d = 0; d <= 4; d++) {
    const count = d === 0 ? 9 : 4;
    for (let k = 0; k < count; k++) {
      const t = TEAMS[n % TEAMS.length];
      const [origin, destination] = LANES[n % LANES.length];
      const drv = DRIVERS[n % DRIVERS.length];
      const status = d === 0 ? STATUSES[k % 4] : d >= 3 ? (["delivered", "invoiced"] as LoadStatus[])[k % 2] : STATUSES[2 + (k % 4)];
      const created = Date.now() - d * 86400000 - k * 1800000;
      const gross = 1500 + ((n * 211) % 4200);
      const docs: Load["docs"] = {};
      if (["booked", "dispatched", "in_transit", "delivered", "invoiced"].includes(status)) docs.rate_con = { received: true, at: created, by: "Sam" };
      if (["in_transit", "delivered", "invoiced"].includes(status)) docs.bol = { received: true, at: created, by: "Sam" };
      if (["delivered", "invoiced"].includes(status)) docs.pod = { received: true, at: created, by: "Sam" };
      loads.push({
        loadNumber: "S-" + (1000 + n),
        source: "manual", broker: BROKERS[n % BROKERS.length], carrier: CARRIERS[(n % (CARRIERS.length - 1)) + 1],
        driver: drv.name, driverPhone: drv.phone, origin, destination,
        pickupDate: day(-d), deliveryDate: day(-d + 1), equipment: EQUIP[n % EQUIP.length], miles: 300 + ((n * 67) % 1800),
        gross, dispatcherId: t.id, dispatcherName: t.name, team: t.team, status,
        checkCalls: [], docs, createdAt: created, updatedAt: created,
      });
      n++;
    }
  }

  // One real-shaped Amazon multi-leg trip for the Update Board route view
  const amzCreated = Date.now() - 5400000;
  loads.unshift({
    loadNumber: "115C6Z4F6", source: "amazon", broker: "Amazon Relay", carrier: "Zemen Logistics LLC",
    driver: "Khurshed Amirdinov", driverPhone: "+1 (412) 689-2705", origin: "Tallahassee, FL", destination: "Opa Locka, FL",
    pickupDate: day(0), deliveryDate: day(1), equipment: "van", miles: 502, gross: 1480,
    dispatcherId: TEAMS[0].id, dispatcherName: TEAMS[0].name, team: TEAMS[0].team, status: "in_transit",
    checkCalls: [{ ts: amzCreated, by: "Sam", note: "Loaded at TLH2, rolling", status: "in_transit" }],
    lastUpdate: "Loaded at TLH2, rolling", lastUpdateAt: amzCreated,
    docs: { rate_con: { received: true, at: amzCreated, by: "Sam" } },
    amazon: {
      tourId: "115C6Z4F6", version: 3, tourState: "active", workType: "SPOT", transitOperatorType: "SOLO",
      ratePerMile: 2.95, legs: 1, maxWeight: 42000, specialServices: ["RESTRICTED_ROAD"],
      stops: [
        { type: "PICKUP", label: "TLH2", city: "Tallahassee", state: "FL", scheduledArrival: new Date(amzCreated).toISOString(), loadingType: "PRELOADED", category: "SORTABLE" },
        { type: "DROPOFF", label: "MIA2", city: "Opa Locka", state: "FL", scheduledArrival: new Date(amzCreated + 36000000).toISOString(), loadingType: "DROP", specialServices: ["RESTRICTED_ROAD"], instructions: ["Restricted road — approved route only"], earlyCheckInNotAllowed: true },
      ],
    },
    createdAt: amzCreated, updatedAt: amzCreated,
  });

  for (const l of loads) {
    try {
      await store.createLoadRaw(l);
      loadCount++;
    } catch (e) {
      errors.push("load: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // A couple of invoices for the Invoices tab (one paid, one outstanding)
  const invoices: Omit<Invoice, "id">[] = [
    { number: "INV-1001", carrier: "Silk Road Logistics", loadIds: [], periodStart: day(-7), periodEnd: day(0), totalGross: 11800, commissionPct: 5, amountDue: 590, status: "paid", dueDate: day(-1), paidAt: Date.now() - 86400000, createdAt: Date.now() - 5 * 86400000 },
    { number: "INV-1002", carrier: "Eagle Owner-Op", loadIds: [], periodStart: day(-7), periodEnd: day(0), totalGross: 9460, commissionPct: 5, amountDue: 473, status: "sent", dueDate: day(7), createdAt: Date.now() - 2 * 86400000 },
  ];
  for (const inv of invoices) {
    try {
      await store.createInvoice(inv);
      invoiceCount++;
    } catch (e) {
      errors.push("invoice: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Surface the first distinct error so the caller can show why something didn't write.
  return { loads: loadCount, drivers: driverCount, invoices: invoiceCount, errors: [...new Set(errors)].slice(0, 2) };
}
