import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User as FbUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { AppUser, Role } from "../types";

interface AuthState {
  fbUser: FbUser | null;
  user: AppUser | null; // app profile (with role) from Firestore
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

/**
 * Load (or lazily create) the user's profile doc at `users/{uid}`.
 * First user to ever sign in becomes an admin so the org can be set up;
 * everyone after defaults to `dispatcher` until a manager changes it.
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
  const [fbUser, setFbUser] = useState<FbUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      setFbUser(fb);
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
    fbUser,
    user,
    loading,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    signOut: async () => {
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
