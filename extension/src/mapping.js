/* Plain-JS port of the app's src/lib/relayMapping.ts — keep the two in sync.
   Exposes globalThis.__rfaMapRelayResponse(json) -> array of TMS load objects. */
(() => {
  function mapEquipment(raw) {
    const t = (raw || "").toUpperCase();
    if (t.includes("REEFER")) return "reefer";
    if (t.includes("FLATBED")) return "flatbed";
    if (t.includes("STEP")) return "stepdeck";
    if (t.includes("POWER")) return "power_only";
    return "van";
  }

  function mapStatus(e) {
    const ex = (e.executionStatus || "").toUpperCase();
    const ts = (e.tourState || "").toLowerCase();
    if (ex === "CANCELLED" || ts === "cancelled") return "cancelled";
    if (ex.includes("DELIVERED") || ex === "COMPLETED" || ts === "completed" || ts === "delivered") return "delivered";
    if (ex.includes("TRANSIT") || ex === "STARTED" || ["in_transit", "active", "started"].includes(ts)) return "in_transit";
    if (ex === "DISPATCHED" || ts === "dispatched") return "dispatched";
    return "booked";
  }

  function cityState(s) {
    const loc = s && s.location;
    if (!loc) return "";
    if (loc.city) return (loc.city + ", " + (loc.state || "")).replace(/, $/, "");
    return loc.label || "";
  }

  function mapStop(s) {
    const loc = s.location || {};
    const instr = [].concat(s.pickupInstructions || [], s.deliveryInstructions || []).filter(Boolean);
    return {
      type: s.stopType || "STOP",
      label: loc.label,
      line1: loc.line1 || undefined,
      city: loc.city,
      state: loc.state,
      postalCode: loc.postalCode,
      scheduledArrival: s.calculatedEstimateArrivalTime || s.originalScheduledArrivalTime || undefined,
      category: loc.locationCategory,
      loadingType: s.loadingType || s.unloadingType || undefined,
      instructions: instr.length ? instr : undefined,
      specialServices: s.specialServices && s.specialServices.length ? s.specialServices : undefined,
      earlyCheckInNotAllowed: s.isEarlyCheckInNotAllowed || undefined,
    };
  }

  function buildRoute(loads) {
    const stops = [];
    const services = new Set();
    let maxWeight = 0;
    (loads || []).forEach((leg) => {
      (leg.specialServices || []).forEach((s) => services.add(s));
      maxWeight = Math.max(maxWeight, (leg.weight && leg.weight.value) || 0);
      (leg.stops || []).forEach((rs) => {
        const m = mapStop(rs);
        (m.specialServices || []).forEach((s) => services.add(s));
        const prev = stops[stops.length - 1];
        if (prev && prev.label && prev.label === m.label && prev.type !== "PICKUP") {
          if (m.instructions) prev.instructions = m.instructions;
          return;
        }
        stops.push(m);
      });
    });
    return { stops, specialServices: Array.from(services), maxWeight };
  }

  const isoDate = (iso) => (iso ? iso.slice(0, 10) : "");

  function mapEntity(e) {
    if (!e || !e.id) return null;
    const legs = e.loads || [];
    const loaded = legs.find((l) => ((l.weight && l.weight.value) || 0) > 0) || legs[0] || {};
    const driver = (e.drivers && e.drivers[0]) || (legs[0] && legs[0].driverList && legs[0].driverList[0]);
    const driverName = driver ? ((driver.firstName || "") + " " + (driver.lastName || "")).trim() : "";
    const miles = Math.round((e.totalDistance && e.totalDistance.value) || 0) || undefined;
    const gross = (e.payout && e.payout.value) || 0;
    const route = buildRoute(legs);
    const first = route.stops[0] || {};
    const last = route.stops[route.stops.length - 1] || {};
    const cs = (s) => (s.city ? (s.city + ", " + (s.state || "")).replace(/, $/, "") : s.label || "");
    return {
      loadNumber: e.id,
      source: "amazon",
      broker: "Amazon Relay",
      carrier: "",
      driver: driverName,
      driverPhone: (driver && driver.phoneNumber) || "",
      origin: cs(first),
      destination: cs(last),
      pickupDate: isoDate(e.firstPickupTime),
      deliveryDate: isoDate(e.lastDeliveryTime),
      equipment: mapEquipment(loaded.equipmentType),
      miles,
      gross,
      status: mapStatus(e),
      amazon: {
        tourId: e.id,
        version: e.version || 0,
        tourState: e.tourState,
        executionStatus: e.executionStatus,
        workType: e.workType,
        businessType: e.businessType,
        transitOperatorType: e.transitOperatorType,
        contractId: e.contractId,
        domicileRoute: e.domicileRoute,
        ratePerMile: miles ? Math.round((gross / miles) * 100) / 100 : undefined,
        legs: legs.length,
        maxWeight: route.maxWeight || undefined,
        specialServices: route.specialServices.length ? route.specialServices : undefined,
        stops: route.stops,
      },
    };
  }

  globalThis.__rfaMapRelayResponse = function (input) {
    let entities = [];
    if (Array.isArray(input)) entities = input;
    else if (input && typeof input === "object") {
      if (Array.isArray(input.entities)) entities = input.entities;
      else if (input.id) entities = [input];
    }
    return entities.map(mapEntity).filter(Boolean);
  };
})();
