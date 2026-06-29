/* ============================================================
   Amazon Relay → TMS mapping.

   Turns the JSON from `POST /api/tours/entitiesV2` (the Trips page)
   into TMS load records. Shared by the in-app "Import from Amazon"
   tool and the Chrome extension's capture pipeline, so both stay in
   sync. Pure + defensive — tolerates missing fields.
   ============================================================ */
import type { Equipment, LoadStatus, NewLoadInput, RelayStop } from "../types";

export type RelayImportedLoad = NewLoadInput & { amazon: NonNullable<NewLoadInput["amazon"]> };

interface RawStop {
  stopType?: string;
  stopSequenceNumber?: number;
  calculatedEstimateArrivalTime?: string | null;
  originalScheduledArrivalTime?: string | null;
  loadingType?: string | null;
  unloadingType?: string | null;
  isEarlyCheckInNotAllowed?: boolean;
  pickupInstructions?: string[];
  deliveryInstructions?: string[];
  specialServices?: string[];
  location?: {
    label?: string;
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    locationCategory?: string;
  } | null;
}
interface RawDriver {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}
interface RawEntity {
  id?: string;
  version?: number;
  entityType?: string;
  payout?: { value?: number; unit?: string } | null;
  totalDistance?: { value?: number } | null;
  firstPickupTime?: string;
  lastDeliveryTime?: string;
  tourState?: string;
  status?: string;
  executionStatus?: string;
  workType?: string;
  businessType?: string;
  transitOperatorType?: string;
  contractId?: string;
  domicileRoute?: string;
  drivers?: RawDriver[];
  loads?: Array<{
    equipmentType?: string;
    stops?: RawStop[];
    driverList?: RawDriver[];
    specialServices?: string[];
    weight?: { value?: number; unit?: string } | null;
  }>;
}

function mapEquipment(raw?: string): Equipment {
  const t = (raw || "").toUpperCase();
  if (t.includes("REEFER")) return "reefer";
  if (t.includes("FLATBED")) return "flatbed";
  if (t.includes("STEP")) return "stepdeck";
  if (t.includes("POWER")) return "power_only";
  return "van";
}

export function mapRelayStatus(e: RawEntity): LoadStatus {
  const ex = (e.executionStatus || "").toUpperCase();
  const ts = (e.tourState || "").toLowerCase();
  if (ex === "CANCELLED" || ts === "cancelled") return "cancelled";
  if (ex.includes("DELIVERED") || ex === "COMPLETED" || ts === "completed" || ts === "delivered") return "delivered";
  if (ex.includes("TRANSIT") || ex === "STARTED" || ["in_transit", "active", "started"].includes(ts)) return "in_transit";
  if (ex === "DISPATCHED" || ts === "dispatched") return "dispatched";
  // accepted/upcoming trips that haven't started yet
  return "booked";
}

function cityState(s?: RawStop): string {
  const loc = s?.location;
  if (!loc) return "";
  if (loc.city) return `${loc.city}, ${loc.state ?? ""}`.replace(/, $/, "");
  return loc.label || "";
}

function mapStop(s: RawStop): RelayStop {
  const instructions = [...(s.pickupInstructions ?? []), ...(s.deliveryInstructions ?? [])].filter(Boolean);
  return {
    type: s.stopType || "STOP",
    label: s.location?.label,
    line1: s.location?.line1 ?? undefined,
    city: s.location?.city,
    state: s.location?.state,
    postalCode: s.location?.postalCode,
    scheduledArrival: s.calculatedEstimateArrivalTime ?? s.originalScheduledArrivalTime ?? undefined,
    category: s.location?.locationCategory,
    loadingType: s.loadingType ?? s.unloadingType ?? undefined,
    instructions: instructions.length ? instructions : undefined,
    specialServices: s.specialServices?.length ? s.specialServices : undefined,
    earlyCheckInNotAllowed: s.isEarlyCheckInNotAllowed || undefined,
  };
}

/** Flatten all legs into one deduped route (a leg's dropoff == next leg's pickup). */
function buildRoute(loads: RawEntity["loads"]): { stops: RelayStop[]; specialServices: string[]; maxWeight: number } {
  const stops: RelayStop[] = [];
  const services = new Set<string>();
  let maxWeight = 0;
  (loads ?? []).forEach((leg) => {
    (leg.specialServices ?? []).forEach((s) => services.add(s));
    maxWeight = Math.max(maxWeight, leg.weight?.value ?? 0);
    (leg.stops ?? []).forEach((rs) => {
      const m = mapStop(rs);
      m.specialServices?.forEach((s) => services.add(s));
      const prev = stops[stops.length - 1];
      // skip the duplicate handoff stop shared between consecutive legs
      if (prev && prev.label && prev.label === m.label && prev.type !== "PICKUP") {
        if (m.instructions) prev.instructions = m.instructions;
        return;
      }
      stops.push(m);
    });
  });
  return { stops, specialServices: [...services], maxWeight };
}

function isoDate(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

/** Map a single Relay entity (tour/trip) to a TMS load input. */
export function mapEntity(e: RawEntity): RelayImportedLoad | null {
  if (!e?.id) return null;
  const legs = e.loads ?? [];
  // equipment from the first loaded leg if possible, else the first leg
  const loaded = legs.find((l) => (l.weight?.value ?? 0) > 0) || legs[0];
  const driver = e.drivers?.[0] || legs[0]?.driverList?.[0];
  const driverName = driver ? `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() : "";
  const miles = Math.round(e.totalDistance?.value ?? 0) || undefined;
  const gross = e.payout?.value ?? 0;
  const { stops, specialServices, maxWeight } = buildRoute(legs);

  return {
    loadNumber: e.id,
    source: "amazon",
    broker: "Amazon Relay",
    brokerContact: "",
    carrier: "",
    driver: driverName,
    driverPhone: driver?.phoneNumber ?? "",
    truck: "",
    origin: cityState({ location: { city: stops[0]?.city, state: stops[0]?.state, label: stops[0]?.label } } as RawStop),
    destination: cityState({ location: { city: stops[stops.length - 1]?.city, state: stops[stops.length - 1]?.state, label: stops[stops.length - 1]?.label } } as RawStop),
    pickupDate: isoDate(e.firstPickupTime),
    deliveryDate: isoDate(e.lastDeliveryTime),
    equipment: mapEquipment(loaded?.equipmentType),
    miles,
    gross,
    status: mapRelayStatus(e),
    notes: "",
    amazon: {
      tourId: e.id,
      version: e.version ?? 0,
      tourState: e.tourState,
      executionStatus: e.executionStatus,
      workType: e.workType,
      businessType: e.businessType,
      transitOperatorType: e.transitOperatorType,
      contractId: e.contractId,
      domicileRoute: e.domicileRoute,
      ratePerMile: miles ? Math.round((gross / miles) * 100) / 100 : undefined,
      legs: legs.length,
      maxWeight: maxWeight || undefined,
      specialServices: specialServices.length ? specialServices : undefined,
      stops,
    },
  };
}

/**
 * Map a full entitiesV2 response (or a bare entities array, or a single entity)
 * to TMS loads. Cancelled trips are included so they can be filtered downstream.
 */
export function mapRelayResponse(input: unknown): RelayImportedLoad[] {
  let entities: RawEntity[] = [];
  if (Array.isArray(input)) entities = input as RawEntity[];
  else if (input && typeof input === "object") {
    const obj = input as { entities?: RawEntity[] };
    if (Array.isArray(obj.entities)) entities = obj.entities;
    else if ((obj as RawEntity).id) entities = [obj as RawEntity];
  }
  return entities.map(mapEntity).filter((x): x is RelayImportedLoad => x !== null);
}
