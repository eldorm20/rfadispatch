import { useEffect, useState } from "react";
import { store } from "../data";
import type { Driver } from "../types";

/** Real-time driver roster, sorted by name. */
export function useDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const unsub = store.subscribeDrivers((rows) => {
      if (!alive) return;
      setDrivers(rows);
      setLoading(false);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return { drivers, loading };
}

export const createDriver = store.createDriver.bind(store);
export const updateDriver = store.updateDriver.bind(store);
export const deleteDriver = store.deleteDriver.bind(store);
