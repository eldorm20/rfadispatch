import { useEffect, useMemo, useState } from "react";
import { store } from "../data";
import type { DocKind, Load, LoadDocs } from "../types";

const TRASH_WINDOW = 24 * 60 * 60 * 1000; // keep deleted loads visible for 24h

/** Subscribe to all loads in real time, split into active and recently-trashed. */
export function useLoads() {
  const [all, setAll] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    try {
      const unsub = store.subscribeLoads((rows) => {
        if (!alive) return;
        setAll(rows);
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

  const loads = useMemo(() => all.filter((l) => !l.deleted), [all]);
  const trash = useMemo(
    () =>
      all
        .filter((l) => l.deleted && l.deletedAt && Date.now() - l.deletedAt < TRASH_WINDOW)
        .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [all]
  );

  return { loads, trash, loading, error };
}

/** True if a load number already exists (case-insensitive), ignoring one load id (for edits). */
export function isDuplicateLoadNumber(loads: Load[], loadNumber: string, ignoreId?: string): boolean {
  const norm = loadNumber.trim().toLowerCase();
  if (!norm) return false;
  return loads.some((l) => l.id !== ignoreId && !l.deleted && l.loadNumber.trim().toLowerCase() === norm);
}

/** Toggle a document's received state on a load, stamping who/when. */
export async function toggleDoc(load: Load, kind: DocKind, by: string): Promise<void> {
  const cur = load.docs?.[kind];
  const next: LoadDocs = {
    ...(load.docs ?? {}),
    [kind]: cur?.received ? { received: false } : { received: true, at: Date.now(), by },
  };
  await store.updateLoad(load.id, { docs: next });
}

// Re-export store mutations so existing call sites keep working unchanged.
export const createLoad = store.createLoad.bind(store);
export const updateLoad = store.updateLoad.bind(store);
export const setLoadStatus = store.setLoadStatus.bind(store);
export const deleteLoad = store.deleteLoad.bind(store);
export const restoreLoad = store.restoreLoad.bind(store);
export const purgeLoad = store.purgeLoad.bind(store);
export const addCheckCall = store.addCheckCall.bind(store);
