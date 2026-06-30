/* Service worker. Maps captured Relay data and upserts it into the TMS Firestore.
   Auth = the dispatcher's own TMS login (one-time, in the popup); the token is
   refreshed automatically. No setup, no sync account, no config entry.

   Paths:
     - PASSIVE: content.js forwards raw entitiesV2 whenever Relay is open
     - POLLING: replays the captured Trips request on a timer (chrome.alarms) */
import { FIREBASE } from "./config.js";
import { mapRelayResponse, mapTransportViews } from "./relayMap.mjs";

const POLL_ALARM = "rfa-poll";
const DEFAULT_POLL_MIN = 5;
const FS = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;

const FS_FIELDS_NEW = [
  "loadNumber", "source", "broker", "carrier", "driver", "driverPhone", "origin",
  "destination", "pickupDate", "deliveryDate", "equipment", "miles", "gross",
  "status", "amazon", "team", "dispatcherId", "dispatcherName", "createdAt", "updatedAt",
];
const FS_FIELDS_UPDATE = [
  "status", "gross", "driver", "driverPhone", "origin", "destination",
  "pickupDate", "deliveryDate", "miles", "equipment", "amazon", "updatedAt",
];

async function setState(patch) {
  const { state = {} } = await chrome.storage.local.get("state");
  await chrome.storage.local.set({ state: { ...state, ...patch } });
}

/* ---------------- Auth (dispatcher's TMS login) ---------------- */
async function signIn(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || "Sign-in failed");
  const auth = { idToken: j.idToken, refreshToken: j.refreshToken, uid: j.localId, email: j.email, exp: Date.now() + Number(j.expiresIn) * 1000 };
  await chrome.storage.local.set({ auth });
  // pull the dispatcher's profile (name + team) for correct attribution
  try {
    const prof = await fetch(`${FS}/users/${j.localId}`, { headers: { Authorization: "Bearer " + j.idToken } });
    if (prof.ok) {
      const f = (await prof.json()).fields || {};
      await chrome.storage.local.set({ profile: { name: f.name?.stringValue || j.email, team: f.team?.stringValue || "" } });
    }
  } catch (e) {
    /* non-fatal */
  }
  return { email: j.email };
}

async function signOut() {
  await chrome.storage.local.remove(["auth", "profile"]);
}

async function getToken() {
  const { auth } = await chrome.storage.local.get("auth");
  if (!auth) throw new Error("not-signed-in");
  if (Date.now() < auth.exp - 60000) return auth.idToken;
  // refresh
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}`,
  });
  const j = await res.json();
  if (!res.ok) {
    await signOut();
    throw new Error("session-expired");
  }
  const next = { ...auth, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + Number(j.expires_in) * 1000 };
  await chrome.storage.local.set({ auth: next });
  return next.idToken;
}

/* ---------------- Firestore typed values ---------------- */
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) {
  const f = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) f[k] = toValue(obj[k]);
  return f;
}
const docId = (ln) => encodeURIComponent(String(ln).replace(/\//g, "_"));

async function upsertLoad(token, load) {
  const { profile = {} } = await chrome.storage.local.get("profile");
  const { auth } = await chrome.storage.local.get("auth");
  const base = `${FS}/loads/${docId(load.loadNumber)}`;
  const hdr = { Authorization: "Bearer " + token };
  const exists = (await fetch(base, { headers: hdr })).status === 200;

  const now = Date.now();
  const full = {
    ...load,
    dispatcherId: auth?.uid || "amazon",
    dispatcherName: profile.name || auth?.email || "Amazon Sync",
    team: profile.team || "",
    createdAt: now,
    updatedAt: now,
  };
  const fields = exists ? FS_FIELDS_UPDATE : FS_FIELDS_NEW;
  const body = { fields: toFields(Object.fromEntries(fields.map((k) => [k, k === "updatedAt" ? now : full[k]]))) };
  const mask = fields.map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${base}?${mask}`, { method: "PATCH", headers: { ...hdr, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  return exists ? "updated" : "created";
}

/** Patch live GPS/ETA onto existing load docs only (never create from a tracking ping). */
async function syncTracking(items) {
  const { auth } = await chrome.storage.local.get("auth");
  if (!auth) return { ok: false, reason: "not-signed-in" };
  let token;
  try {
    token = await getToken();
  } catch {
    return { ok: false, reason: "auth" };
  }
  let updated = 0;
  for (const it of items) {
    const base = `${FS}/loads/${docId(it.loadNumber)}`;
    // currentDocument.exists=true → only updates a load we already have; no junk docs.
    const url = `${base}?updateMask.fieldPaths=tracking&updateMask.fieldPaths=updatedAt&currentDocument.exists=true`;
    const body = { fields: toFields({ tracking: it.tracking, updatedAt: Date.now() }) };
    const res = await fetch(url, { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) updated++;
  }
  await setState({ lastTracking: Date.now(), trackingUpdated: updated });
  return { ok: true, updated };
}

async function syncLoads(loads) {
  const { auth } = await chrome.storage.local.get("auth");
  if (!auth) {
    await setState({ lastCapture: Date.now(), lastCount: loads.length, signedIn: false });
    return { ok: false, reason: "not-signed-in", captured: loads.length };
  }
  let token;
  try {
    token = await getToken();
  } catch (e) {
    await setState({ lastError: String(e.message), signedIn: false });
    return { ok: false, error: String(e.message) };
  }
  let created = 0, updated = 0;
  for (const l of loads) {
    try {
      (await upsertLoad(token, l)) === "created" ? created++ : updated++;
    } catch (e) {
      await setState({ lastError: String(e.message), lastErrorAt: Date.now() });
      throw e;
    }
  }
  await setState({ lastSync: Date.now(), lastCount: loads.length, created, updated, signedIn: true, lastError: "" });
  return { ok: true, created, updated };
}

/* ---------------- Polling ---------------- */
async function pollNow() {
  const { tripsRequest } = await chrome.storage.local.get("tripsRequest");
  if (!tripsRequest?.url) return { ok: false, reason: "no-request-captured" };
  let res;
  try {
    res = await fetch(tripsRequest.url, { method: tripsRequest.method || "POST", headers: tripsRequest.headers || {}, body: tripsRequest.body, credentials: "include" });
  } catch (e) {
    await setState({ lastPollError: "network", lastPollAt: Date.now() });
    return { ok: false, error: String(e) };
  }
  if (!res.ok) {
    await setState({ lastPollError: res.status, lastPollAt: Date.now() });
    return { ok: false, status: res.status };
  }
  await setState({ lastPollAt: Date.now() });
  return await syncLoads(mapRelayResponse(await res.json()));
}

async function ensureAlarm() {
  const { pollMinutes } = await chrome.storage.local.get("pollMinutes");
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: Math.max(1, Number(pollMinutes) || DEFAULT_POLL_MIN) });
}
chrome.alarms.onAlarm.addListener((a) => a.name === POLL_ALARM && pollNow().catch(() => {}));
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

/* ---------------- Messages ---------------- */
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  switch (msg?.type) {
    case "RFA_TRIPS_RAW":
      syncLoads(mapRelayResponse(msg.payload)).then(reply).catch((e) => reply({ ok: false, error: String(e) }));
      return true;
    case "RFA_TRIPS_REQUEST":
      chrome.storage.local.set({ tripsRequest: msg.request }).then(ensureAlarm);
      reply({ ok: true });
      return true;
    case "RFA_TRACKING_RAW":
      syncTracking(mapTransportViews(msg.payload)).then(reply).catch((e) => reply({ ok: false, error: String(e) }));
      return true;
    case "RFA_SIGN_IN":
      signIn(msg.email, msg.password).then((r) => reply({ ok: true, ...r })).catch((e) => reply({ ok: false, error: String(e.message) }));
      return true;
    case "RFA_SIGN_OUT":
      signOut().then(() => reply({ ok: true }));
      return true;
    case "RFA_POLL_NOW":
      pollNow().then(reply).catch((e) => reply({ ok: false, error: String(e) }));
      return true;
  }
});
