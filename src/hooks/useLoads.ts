import { useEffect, useState } from "react";
import { store } from "../data";
import type { Load } from "../types";

/** Subscribe to all loads, newest first, in real time (Firestore or demo store). */
export function useLoads() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    try {
      const unsub = store.subscribeLoads((rows) => {
        if (!alive) return;
        setLoads(rows);
        setLoading(false);
      });
      return () => {
        alive = false;
        unsub();
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setLoading(false);
    }
  }, []);

  return { loads, loading, error };
}

// Re-export store mutations so existing call sites keep working unchanged.
export const createLoad = store.createLoad.bind(store);
export const updateLoad = store.updateLoad.bind(store);
export const setLoadStatus = store.setLoadStatus.bind(store);
export const deleteLoad = store.deleteLoad.bind(store);
export const addCheckCall = store.addCheckCall.bind(store);
