/* Dev tool: add demo GPS tracking to in-transit loads (until the live extension feed runs).
   Run: node scripts/seed-tracking.mjs */
import admin from "firebase-admin";
import fs from "fs";
const keyPath = fs.existsSync("./service-account.json") ? "./service-account.json" : "./bot/service-account.json";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });
const db = admin.firestore();
const COORDS = [
  { lat: 35.2076, lng: -101.3337 }, { lat: 32.7767, lng: -96.797 },
  { lat: 33.749, lng: -84.388 }, { lat: 39.7392, lng: -104.9903 },
  { lat: 36.1627, lng: -86.7816 }, { lat: 30.4383, lng: -84.2807 },
];
const snap = await db.collection("loads").where("status", "==", "in_transit").get();
let i = 0;
for (const doc of snap.docs) {
  const c = COORDS[i % COORDS.length];
  await doc.ref.update({
    tracking: {
      lat: c.lat, lng: c.lng, inMotion: i % 3 !== 0, status: "IN_TRANSIT",
      eta: new Date(Date.now() + (6 + (i % 10)) * 3600000).toISOString(),
      updatedAt: Date.now() - (i % 20) * 60000,
    },
  });
  i++;
}
console.log(`✓ added tracking to ${i} in-transit loads`);
process.exit(0);
