import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  DEFAULT_SETTINGS,
  type AppUser,
  type CheckCall,
  type Driver,
  type Invoice,
  type Load,
  type NewLoadInput,
  type OrgSettings,
  type Role,
} from "../types";
import { writeBatch } from "firebase/firestore";
import type { DataStore } from "./types";

const COL = "loads";

function tsToMs(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toMillis" in v) {
    return (v as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export const firebaseStore: DataStore = {
  subscribeLoads(cb) {
    const q = query(collection(db, COL), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            ...data,
            createdAt: tsToMs(data.createdAt),
            updatedAt: tsToMs(data.updatedAt),
          } as Load;
        })
      );
    });
  },

  async createLoad(input: NewLoadInput, user: AppUser) {
    await addDoc(collection(db, COL), {
      ...input,
      gross: Number(input.gross) || 0,
      dispatcherId: user.uid,
      dispatcherName: user.name,
      team: input.team ?? user.team ?? "",
      checkCalls: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async createLoadRaw(load) {
    await addDoc(collection(db, COL), {
      ...load,
      createdAt: load.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateLoad(id, patch) {
    await updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() });
  },

  async setLoadStatus(id, status) {
    await updateDoc(doc(db, COL, id), { status, updatedAt: serverTimestamp() });
  },

  async deleteLoad(id) {
    await updateDoc(doc(db, COL, id), { deleted: true, deletedAt: Date.now(), updatedAt: serverTimestamp() });
  },

  async restoreLoad(id) {
    await updateDoc(doc(db, COL, id), { deleted: false, deletedAt: null, updatedAt: serverTimestamp() });
  },

  async purgeLoad(id) {
    await deleteDoc(doc(db, COL, id));
  },

  async addCheckCall(id, note, by, status) {
    const call: CheckCall = { ts: Date.now(), by, note, ...(status ? { status } : {}) };
    const patch: Record<string, unknown> = {
      checkCalls: arrayUnion(call),
      lastUpdate: note,
      lastUpdateAt: Date.now(),
      updatedAt: serverTimestamp(),
    };
    if (status) patch.status = status;
    await updateDoc(doc(db, COL, id), patch);
  },

  subscribeInvoices(cb) {
    const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return { id: d.id, ...data, createdAt: tsToMs(data.createdAt) } as Invoice;
        })
      );
    });
  },

  async createInvoice(invoice) {
    const batch = writeBatch(db);
    const ref = doc(collection(db, "invoices"));
    batch.set(ref, { ...invoice, createdAt: serverTimestamp() });
    invoice.loadIds.forEach((lid) => batch.update(doc(db, COL, lid), { invoiceId: ref.id, status: "invoiced", updatedAt: serverTimestamp() }));
    await batch.commit();
  },

  async updateInvoice(id, patch) {
    await updateDoc(doc(db, "invoices", id), { ...patch });
  },

  async getSettings() {
    const s = await getDoc(doc(db, "org", "settings"));
    return s.exists() ? { ...DEFAULT_SETTINGS, ...(s.data() as Partial<OrgSettings>) } : DEFAULT_SETTINGS;
  },

  async saveSettings(patch) {
    await setDoc(doc(db, "org", "settings"), patch, { merge: true });
  },

  subscribeUsers(cb) {
    return onSnapshot(collection(db, "users"), (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data() as Partial<AppUser>;
          return {
            uid: d.id,
            email: data.email ?? "",
            name: data.name ?? "—",
            role: (data.role as Role) ?? "dispatcher",
            active: data.active !== false,
          };
        })
      );
    });
  },

  async updateUserRole(uid, role) {
    await updateDoc(doc(db, "users", uid), { role });
  },

  async updateUser(uid, patch) {
    await updateDoc(doc(db, "users", uid), { ...patch });
  },

  subscribeDrivers(cb) {
    const q = query(collection(db, "drivers"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Driver));
    });
  },

  async createDriver(driver) {
    await addDoc(collection(db, "drivers"), { ...driver, active: driver.active !== false, createdAt: Date.now() });
  },

  async updateDriver(id, patch) {
    await updateDoc(doc(db, "drivers", id), { ...patch });
  },

  async deleteDriver(id) {
    await deleteDoc(doc(db, "drivers", id));
  },
};
