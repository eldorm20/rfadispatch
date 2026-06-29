/* Promote a TMS user to a role (default: admin) by email.
   Solves the bootstrap chicken-and-egg (the app + rules won't let anyone make
   themselves admin). Run once for the first admin.

   Setup:
     - Download a service account key: Firebase Console → Project settings →
       Service accounts → Generate new private key → save as service-account.json
       (you may already have one at bot/service-account.json).

   Run:
     node scripts/set-admin.mjs you@yourcompany.com
     node scripts/set-admin.mjs you@yourcompany.com manager
   Optionally point at the key:
     GOOGLE_APPLICATION_CREDENTIALS=./bot/service-account.json node scripts/set-admin.mjs you@you.com
*/
import admin from "firebase-admin";
import fs from "fs";

const email = process.argv[2];
const role = process.argv[3] || "admin";
if (!email) {
  console.error("Usage: node scripts/set-admin.mjs <email> [role]");
  process.exit(1);
}

// Find a service account key.
const candidates = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  "./service-account.json",
  "./bot/service-account.json",
].filter(Boolean);
const keyPath = candidates.find((p) => fs.existsSync(p));
if (!keyPath) {
  console.error("No service account key found. Save it as service-account.json (or bot/service-account.json),\nor set GOOGLE_APPLICATION_CREDENTIALS to its path. See the comment at the top of this file.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });
const db = admin.firestore();

const snap = await db.collection("users").where("email", "==", email).get();
if (snap.empty) {
  console.error(`No user profile found for ${email}. Make sure they have signed into the app at least once.`);
  const all = await db.collection("users").get();
  console.error("Known users:");
  all.forEach((d) => console.error("  -", d.data().email, "·", d.data().role));
  process.exit(1);
}

for (const doc of snap.docs) {
  await doc.ref.update({ role });
  console.log(`✓ ${email} is now "${role}". Reload the app.`);
}
process.exit(0);
