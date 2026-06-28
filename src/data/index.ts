import { firebaseConfigured } from "../firebase";
import { firebaseStore } from "./firebaseStore";
import { localStore } from "./localStore";
import type { DataStore } from "./types";

/** True when running without Firebase — the app uses seeded localStorage data. */
export const DEMO = !firebaseConfigured;

/** The active data backend for the whole app. */
export const store: DataStore = DEMO ? localStore : firebaseStore;

export type { DataStore };
