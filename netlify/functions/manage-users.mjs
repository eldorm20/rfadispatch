/* Admin user management. Creating/deleting login accounts and setting passwords
   needs the server-side Admin SDK, so the TMS calls this function. The caller
   must be a signed-in admin/manager (verified by their Firebase ID token). */
import { db, auth } from "./_lib.mjs";

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

async function requireManager(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  let decoded;
  try {
    decoded = await auth().verifyIdToken(token);
  } catch {
    return null;
  }
  const prof = await db().collection("users").doc(decoded.uid).get();
  const role = prof.exists ? prof.data().role : null;
  return role === "admin" || role === "manager" ? decoded : null;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method" });
  const caller = await requireManager(req);
  if (!caller) return json(403, { ok: false, error: "not-authorized" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "bad-body" });
  }

  try {
    if (body.action === "create") {
      const { email, password, name, role, team } = body;
      if (!email || !password) return json(400, { ok: false, error: "Email and password are required" });
      const u = await auth().createUser({ email: email.trim(), password, displayName: name || email });
      await db().collection("users").doc(u.uid).set({
        uid: u.uid,
        email: email.trim(),
        name: name || email.split("@")[0],
        role: role || "dispatcher",
        team: team || "",
        active: true,
        createdAt: Date.now(),
      });
      return json(200, { ok: true, uid: u.uid });
    }

    if (body.action === "delete") {
      const { uid } = body;
      if (!uid) return json(400, { ok: false, error: "uid required" });
      if (uid === caller.uid) return json(400, { ok: false, error: "You can't delete your own account" });
      await auth().deleteUser(uid).catch(() => {}); // tolerate an already-removed auth user
      await db().collection("users").doc(uid).delete();
      return json(200, { ok: true });
    }

    if (body.action === "reset") {
      const { uid, email, newPassword } = body;
      if (newPassword) {
        if (!uid) return json(400, { ok: false, error: "uid required" });
        await auth().updateUser(uid, { password: newPassword });
        return json(200, { ok: true, set: true });
      }
      if (!email) return json(400, { ok: false, error: "email required" });
      const link = await auth().generatePasswordResetLink(email);
      return json(200, { ok: true, link });
    }

    return json(400, { ok: false, error: "unknown action" });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};
