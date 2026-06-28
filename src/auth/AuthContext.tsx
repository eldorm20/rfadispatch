import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User as FbUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase";
import { DEMO } from "../data";
import { DEMO_USERS } from "../data/localStore";
import type { AppUser, Role } from "../types";

interface AuthState {
  user: AppUser | null; // app profile (with role)
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Demo-only: switch which seeded user you're acting as.
  demo: boolean;
  demoUsers: AppUser[];
  setActiveUser: (uid: string) => void;
}

const AuthCtx = createContext<AuthState | null>(null);
const DEMO_ACTIVE_KEY = "tms.demo.activeUid";

/**
 * Load (or lazily create) the user's profile doc at `users/{uid}`.
 * First user to ever sign in becomes admin so the org can be set up.
 */
async function loadProfile(fb: FbUser): Promise<AppUser> {
  const ref = doc(db, "users", fb.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data() as Partial<AppUser>;
    return {
      uid: fb.uid,
      email: fb.email ?? "",
      name: d.name || fb.displayName || fb.email?.split("@")[0] || "User",
      role: (d.role as Role) || "dispatcher",
      active: d.active !== false,
    };
  }
  const profile: AppUser = {
    uid: fb.uid,
    email: fb.email ?? "",
    name: fb.displayName || fb.email?.split("@")[0] || "User",
    role: "dispatcher",
    active: true,
  };
  await setDoc(ref, { ...profile, createdAt: Date.now() });
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- Demo mode: auto-authed, switch identity locally ----
  useEffect(() => {
    if (!DEMO) return;
    const savedUid = localStorage.getItem(DEMO_ACTIVE_KEY);
    const initial = DEMO_USERS.find((u) => u.uid === savedUid) ?? DEMO_USERS[0];
    setUser(initial);
    setLoading(false);
  }, []);

  // ---- Firebase mode ----
  useEffect(() => {
    if (DEMO || !firebaseConfigured) return;
    const unsub = onAuthStateChanged(auth, async (fb) => {
      if (fb) {
        try {
          setUser(await loadProfile(fb));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value: AuthState = {
    user,
    loading,
    demo: DEMO,
    demoUsers: DEMO ? DEMO_USERS : [],
    setActiveUser: (uid) => {
      const u = DEMO_USERS.find((x) => x.uid === uid);
      if (u) {
        localStorage.setItem(DEMO_ACTIVE_KEY, uid);
        setUser(u);
      }
    },
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    signOut: async () => {
      if (DEMO) return; // nothing to sign out of in demo
      await fbSignOut(auth);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
