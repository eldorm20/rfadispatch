import type { AppUser, Driver, Invoice, Load, LoadStatus, NewLoadInput, OrgSettings, Role } from "../types";

/**
 * Backend-agnostic data layer. Two implementations exist:
 *   - firebaseStore  → Firestore real-time (production)
 *   - localStore     → localStorage + in-memory pub/sub (demo mode, no setup)
 * The app picks one in data/index.ts based on whether Firebase is configured.
 */
export interface DataStore {
  /** Real-time subscription to all loads (newest first). Returns an unsubscribe fn. */
  subscribeLoads(cb: (loads: Load[]) => void): () => void;
  createLoad(input: NewLoadInput, user: AppUser): Promise<void>;
  /** Write a fully-formed load (explicit dispatcher/team/createdAt) — used by the sample-data seeder. */
  createLoadRaw(load: Omit<Load, "id">): Promise<void>;
  updateLoad(id: string, patch: Partial<Load>): Promise<void>;
  setLoadStatus(id: string, status: LoadStatus): Promise<void>;
  /** Soft delete — sets deleted+deletedAt so it can be restored from Trash within 24h. */
  deleteLoad(id: string): Promise<void>;
  restoreLoad(id: string): Promise<void>;
  /** Permanently remove a load (from Trash). */
  purgeLoad(id: string): Promise<void>;
  addCheckCall(id: string, note: string, by: string, status?: LoadStatus): Promise<void>;

  subscribeInvoices(cb: (invoices: Invoice[]) => void): () => void;
  /** Create an invoice and stamp its loads with the invoice id (so they aren't billed twice). */
  createInvoice(invoice: Omit<Invoice, "id">): Promise<void>;
  updateInvoice(id: string, patch: Partial<Invoice>): Promise<void>;

  getSettings(): Promise<OrgSettings>;
  saveSettings(patch: Partial<OrgSettings>): Promise<void>;

  subscribeUsers(cb: (users: AppUser[]) => void): () => void;
  updateUserRole(uid: string, role: Role): Promise<void>;
  updateUser(uid: string, patch: Partial<AppUser>): Promise<void>;

  subscribeDrivers(cb: (drivers: Driver[]) => void): () => void;
  createDriver(driver: Omit<Driver, "id" | "createdAt">): Promise<void>;
  updateDriver(id: string, patch: Partial<Driver>): Promise<void>;
  deleteDriver(id: string): Promise<void>;
}
