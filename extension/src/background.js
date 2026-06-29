/* Service worker: maps captured Relay data and upserts it into the same
   Firestore the TMS web app reads. Auth via Firebase Email/Password (a
   dedicated sync account). Two paths:
     - PASSIVE: content.js forwards raw entitiesV2 whenever Relay is open
     - POLLING: we replay the captured Trips request on a timer (chrome.alarms)
       so trips keep syncing even when nobody is looking at the Relay tab.
   If Firebase isn't configured, it records a capture count for the popup. */
import { mapRelayResponse } from "./relayMap.mjs";

const POLL_ALARM = "rfa-poll";
const DEFAULT_POLL_MIN = 5;

const FS_FIELDS_NEW = [
  "loadNumber", "source", "broker", "carrier", "driver", "driverPhone", "origin",
  "destination", "pickupDate", "deliveryDate", "equipment", "miles", "gross",
  "status", "amazon", "dispatcherId", "dispatcherName", "createdAt", "updatedAt",
];
// On an existing doc, only refresh Amazon-sourced fields — never clobber the
// dispatcher attribution, documents, or invoice links the team set in the app.
const FS_FIELDS_UPDATE = [
  "status", "gross", "driver", "driverPhone", "origin", "destination",
  "pickupDate", "deliveryDate", "miles", "equipment", "amazon", "updatedAt",
];

async function getConfig() {
  return await chrome.storage.local.get([
    "projectId", "apiKey", "syncEmail", "syncPassword", "dispatcherName", "stats",
  ]);
}
async function setStats(patch) {
  const { stats = {} } = await chrome.storage.local.get("stats");
  await chrome.storage.local.set({ stats: { ...stats, ...patch } });
}

/* ---- Firebase Auth (cached ID token) ---- */
let tokenCache = { idToken: null, exp: 0 };
async function getIdToken(cfg) {
  const now = Date.now();
  if (tokenCache.idToken && now < tokenCache.exp - 60000) return tokenCache.idToken;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cfg.syncEmail, password: cfg.syncPassword, returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error("Auth failed: " + (await res.text()).slice(0, 120));
  const j = await res.json();
  tokenCache = { idToken: j.idToken, exp: now + Number(j.expiresIn || 3600) * 1000 };
  return j.idToken;
}

/* ---- Firestore typed-value serialization ---- */
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
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) continue;
    f[k] = toValue(obj[k]);
  }
  return f;
}

const docId = (loadNumber) => encodeURIComponent(String(loadNumber).replace(/\//g, "_"));

async function upsertLoad(cfg, token, load) {
  const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/loads/${docId(load.loadNumber)}`;
  const auth = { Authorization: "Bearer " + token };

  // Does it already exist?
  const head = await fetch(base, { headers: auth });
  const exists = head.status === 200;

  const now = Date.now();
  const full = {
    ...load,
    dispatcherId: "amazon",
    dispatcherName: cfg.dispatcherName || "Amazon Sync",
    createdAt: now,
    updatedAt: now,
  };
  const fields = exists ? FS_FIELDS_UPDATE : FS_FIELDS_NEW;
  const body = { fields: toFields(Object.fromEntries(fields.map((k) => [k, k === "updatedAt" ? now : full[k]]))) };
  const mask = fields.map((k) => `updateMask.fieldPaths=${k}`).join("&");

  const res = await fetch(`${base}?${mask}`, {
    method: "PATCH",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return exists ? "updated" : "created";
}

async function syncLoads(loads) {
  const cfg = await getConfig();
  if (!cfg.projectId || !cfg.apiKey || !cfg.syncEmail) {
    await setStats({ lastCapture: Date.now(), lastCount: loads.length, configured: false });
    return { ok: false, reason: "not-configured", captured: loads.length };
  }
  const token = await getIdToken(cfg);
  let created = 0, updated = 0;
  for (const l of loads) {
    try {
      const r = await upsertLoad(cfg, token, l);
      r === "created" ? created++ : updated++;
    } catch (e) {
      await setStats({ lastError: String(e).slice(0, 160), lastErrorAt: Date.now() });
      throw e;
    }
  }
  await setStats({ lastSync: Date.now(), lastCount: loads.length, created, updated, configured: true, lastError: "" });
  return { ok: true, created, updated };
}

/* ---- Background polling: replay the captured Trips request on a timer ---- */
async function pollNow() {
  const { tripsRequest } = await chrome.storage.local.get("tripsRequest");
  if (!tripsRequest || !tripsRequest.url) return { ok: false, reason: "no-request-captured" };
  let res;
  try {
    res = await fetch(tripsRequest.url, {
      method: tripsRequest.method || "POST",
      headers: tripsRequest.headers || {},
      body: tripsRequest.body,
      credentials: "include",
    });
  } catch (e) {
    await setStats({ lastPollError: "network", lastPollAt: Date.now() });
    return { ok: false, error: String(e) };
  }
  if (!res.ok) {
    // 401/403 → token stale; wait for the next live page interaction to refresh it
    await setStats({ lastPollError: res.status, lastPollAt: Date.now() });
    return { ok: false, status: res.status };
  }
  const json = await res.json();
  const loads = mapRelayResponse(json);
  await setStats({ lastPollAt: Date.now() });
  return await syncLoads(loads);
}

async function ensureAlarm() {
  const { pollMinutes } = await chrome.storage.local.get("pollMinutes");
  const mins = Math.max(1, Number(pollMinutes) || DEFAULT_POLL_MIN);
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: mins });
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === POLL_ALARM) pollNow().catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => ensureAlarm());
chrome.runtime.onStartup.addListener(() => ensureAlarm());

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "RFA_TRIPS_RAW") {
    syncLoads(mapRelayResponse(msg.payload))
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "RFA_TRIPS_REQUEST") {
    // store the latest request so polling can replay it, and (re)arm the alarm
    chrome.storage.local.set({ tripsRequest: msg.request }).then(ensureAlarm);
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "RFA_POLL_NOW") {
    pollNow()
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});
