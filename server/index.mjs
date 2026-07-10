/* Single Railway service: serves the built SPA, exposes the admin user-management
   API, and runs the always-on Telegram worker. Firebase (Firestore/Auth) remains
   the data layer. */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { startTelegramWorker } from "./telegramWorker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");

// ---- Firebase Admin (service account from env) ----
let db = null;
try {
  // Accept the service account as raw JSON or base64 (base64 avoids env-var quoting issues).
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT || "{}";
  const svc = JSON.parse(raw);
  if (svc.project_id) {
    admin.initializeApp({ credential: admin.credential.cert(svc), projectId: process.env.FIREBASE_PROJECT_ID || svc.project_id });
    db = admin.firestore();
  } else {
    console.warn("[server] FIREBASE_SERVICE_ACCOUNT not set — admin API + Telegram disabled");
  }
} catch (e) {
  console.error("[server] bad FIREBASE_SERVICE_ACCOUNT:", e.message);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, db: !!db }));

// ---- Admin user management (create / delete / reset password) ----
async function requireManager(req) {
  if (!db) return null;
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
  const prof = await db.collection("users").doc(decoded.uid).get();
  const role = prof.exists ? prof.data().role : null;
  return role === "admin" || role === "manager" ? decoded : null;
}

app.post("/api/manage-users", async (req, res) => {
  const caller = await requireManager(req);
  if (!caller) return res.status(403).json({ ok: false, error: "not-authorized" });
  const b = req.body || {};
  try {
    if (b.action === "create") {
      if (!b.email || !b.password) return res.status(400).json({ ok: false, error: "Email and password are required" });
      const u = await admin.auth().createUser({ email: String(b.email).trim(), password: b.password, displayName: b.name || b.email });
      await db.collection("users").doc(u.uid).set({
        uid: u.uid, email: String(b.email).trim(), name: b.name || String(b.email).split("@")[0],
        role: b.role || "dispatcher", team: b.team || "", active: true, createdAt: Date.now(),
      });
      return res.json({ ok: true, uid: u.uid });
    }
    if (b.action === "delete") {
      if (!b.uid) return res.status(400).json({ ok: false, error: "uid required" });
      if (b.uid === caller.uid) return res.status(400).json({ ok: false, error: "You can't delete your own account" });
      await admin.auth().deleteUser(b.uid).catch(() => {});
      await db.collection("users").doc(b.uid).delete();
      return res.json({ ok: true });
    }
    if (b.action === "reset") {
      if (b.newPassword) {
        if (!b.uid) return res.status(400).json({ ok: false, error: "uid required" });
        await admin.auth().updateUser(b.uid, { password: b.newPassword });
        return res.json({ ok: true, set: true });
      }
      if (!b.email) return res.status(400).json({ ok: false, error: "email required" });
      const link = await admin.auth().generatePasswordResetLink(b.email);
      return res.json({ ok: true, link });
    }
    return res.status(400).json({ ok: false, error: "unknown action" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---- Static SPA + client-side routing fallback ----
app.use(express.static(DIST, { maxAge: "1h", index: false }));
app.use((req, res) => {
  if (req.method !== "GET") return res.status(404).json({ ok: false, error: "not found" });
  res.sendFile(path.join(DIST, "index.html"));
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`[server] RFA Dispatch on :${port}`));

// ---- Always-on Telegram bot ----
if (db) startTelegramWorker(db);
