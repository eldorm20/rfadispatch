import type { AppUser, Load, LoadStatus, NewLoadInput, OrgSettings, Role } from "../types";

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
  updateLoad(id: string, patch: Partial<Load>): Promise<void>;
  setLoadStatus(id: string, status: LoadStatus): Promise<void>;
  deleteLoad(id: string): Promise<void>;
  addCheckCall(id: string, note: string, by: string, status?: LoadStatus): Promise<void>;

  getSettings(): Promise<OrgSettings>;
  saveSettings(patch: Partial<OrgSettings>): Promise<void>;

  subscribeUsers(cb: (users: AppUser[]) => void): () => void;
  updateUserRole(uid: string, role: Role): Promise<void>;
}
