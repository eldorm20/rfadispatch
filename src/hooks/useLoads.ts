import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import type { AppUser, CheckCall, Load, LoadStatus, NewLoadInput } from "../types";

const COL = "loads";

/** Subscribe to all loads, newest first, in real time. */
export function useLoads() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Load[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            ...data,
            // serverTimestamp resolves to a Timestamp; normalise to ms for the UI.
            createdAt: tsToMs(data.createdAt),
            updatedAt: tsToMs(data.updatedAt),
          } as Load;
        });
        setLoads(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { loads, loading, error };
}

function tsToMs(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toMillis" in v) {
    return (v as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function createLoad(input: NewLoadInput, user: AppUser): Promise<void> {
  await addDoc(collection(db, COL), {
    ...input,
    gross: Number(input.gross) || 0,
    dispatcherId: user.uid,
    dispatcherName: user.name,
    checkCalls: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateLoad(id: string, patch: Partial<Load>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() });
}

export async function setLoadStatus(id: string, status: LoadStatus): Promise<void> {
  await updateLoad(id, { status });
}

export async function deleteLoad(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

/** Append a check call and (optionally) move the load's status. */
export async function addCheckCall(
  id: string,
  note: string,
  by: string,
  status?: LoadStatus
): Promise<void> {
  const call: CheckCall = { ts: Date.now(), by, note, ...(status ? { status } : {}) };
  const patch: Record<string, unknown> = {
    checkCalls: arrayUnion(call),
    lastUpdate: note,
    lastUpdateAt: Date.now(),
    updatedAt: serverTimestamp(),
  };
  if (status) patch.status = status;
  await updateDoc(doc(db, COL, id), patch);
}
