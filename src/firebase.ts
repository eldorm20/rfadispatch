import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// The Firebase *web* config is public-safe (security is enforced by Auth + rules),
// so we ship it as a fallback. .env still overrides it for other environments.
const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY || "AIzaSyC05k--mNg815IP4SO0As5KRgQVFOlDlJg",
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN || "rfa-tms-42a31.firebaseapp.com",
  projectId: import.meta.env.VITE_FB_PROJECT_ID || "rfa-tms-42a31",
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET || "rfa-tms-42a31.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID || "314583778441",
  appId: import.meta.env.VITE_FB_APP_ID || "1:314583778441:web:3716c208a88a73437fb258",
};

/** True once a real .env has been filled in. Lets the UI show a friendly setup screen. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

if (firebaseConfigured) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  // Offline-first cache so the boards keep working through flaky connections.
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
