import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export interface SyncHealth {
  lastSyncAt: number | null; // newest heartbeat across all extension users
  lastCount?: number;
  byName?: string;
}

/** Newest Amazon-sync heartbeat (written by the extension after each successful sync). */
export function useSyncHealth(): SyncHealth {
  const [health, setHealth] = useState<SyncHealth>({ lastSyncAt: null });

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onSnapshot(
      collection(db, "syncHealth"),
      (snap) => {
        let best: SyncHealth = { lastSyncAt: null };
        snap.forEach((d) => {
          const v = d.data() as { lastSyncAt?: number; lastCount?: number; byName?: string };
          if ((v.lastSyncAt ?? 0) > (best.lastSyncAt ?? 0)) {
            best = { lastSyncAt: v.lastSyncAt ?? null, lastCount: v.lastCount, byName: v.byName };
          }
        });
        setHealth(best);
      },
      () => setHealth({ lastSyncAt: null }) // rules not deployed yet → just show "not connected"
    );
  }, []);

  return health;
}
