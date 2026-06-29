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
  arrivalTime?: string | null;
  departureTime?: string | null;
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
  return {
    type: s.stopType || "STOP",
    label: s.location?.label,
    line1: s.location?.line1 ?? undefined,
    city: s.location?.city,
    state: s.location?.state,
    postalCode: s.location?.postalCode,
    arrival: s.arrivalTime ?? undefined,
    departure: s.departureTime ?? undefined,
    category: s.location?.locationCategory,
  };
}

function isoDate(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

/** Map a single Relay entity (tour/trip) to a TMS load input. */
export function mapEntity(e: RawEntity): RelayImportedLoad | null {
  if (!e?.id) return null;
  const load = e.loads?.[0];
  const stops = load?.stops ?? [];
  const driver = e.drivers?.[0] || load?.driverList?.[0];
  const driverName = driver ? `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() : "";
  const miles = Math.round(e.totalDistance?.value ?? 0) || undefined;
  const gross = e.payout?.value ?? 0;

  return {
    loadNumber: e.id,
    source: "amazon",
    broker: "Amazon Relay",
    brokerContact: "",
    carrier: "",
    driver: driverName,
    driverPhone: driver?.phoneNumber ?? "",
    truck: "",
    origin: cityState(stops[0]),
    destination: cityState(stops[stops.length - 1]),
    pickupDate: isoDate(e.firstPickupTime),
    deliveryDate: isoDate(e.lastDeliveryTime),
    equipment: mapEquipment(load?.equipmentType),
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
      stops: stops.map(mapStop),
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
