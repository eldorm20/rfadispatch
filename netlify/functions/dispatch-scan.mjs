/* Scheduled every minute. Finds loads that have a driver assigned but haven't
   been sent to that driver's Telegram group yet, and sends them. Source-agnostic:
   catches assignments whether they came from the Amazon extension or the web app.
   Idempotent via load.telegramSentFor (re-sends only on reassignment). */
import { db, tg, resolveChatId } from "./_lib.mjs";
import { formatLoadMessage } from "../../shared/telegramTemplate.mjs";

const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : Number(v) || 0);
const RECENT_MS = 24 * 3600000; // ignore loads not touched in the last day

export default async () => {
  const snap = await db()
    .collection("loads")
    .where("status", "in", ["booked", "dispatched", "in_transit", "delivered"])
    .get();

  let sent = 0;
  const driverCache = new Map();

  for (const doc of snap.docs) {
    const load = { id: doc.id, ...doc.data() };
    const driverName = (load.driver || "").trim();
    if (load.deleted || !driverName) continue;
    if (load.telegramSentFor === driverName) continue;
    if (Date.now() - ms(load.updatedAt) > RECENT_MS) continue;

    let driver = driverCache.get(driverName);
    if (driver === undefined) {
      const q = await db().collection("drivers").where("name", "==", driverName).limit(1).get();
      driver = q.empty ? { name: driverName } : q.docs[0].data();
      driverCache.set(driverName, driver);
    }

    const chatId = await resolveChatId(driver);
    if (!chatId) continue; // bot not in that unit's group yet

    const res = await tg("sendMessage", { chat_id: chatId, text: formatLoadMessage(load, driver), disable_web_page_preview: true });
    if (res.ok) {
      await doc.ref.update({ telegramSentFor: driverName, telegramSentAt: Date.now() });
      sent++;
    } else {
      console.error("send failed", load.loadNumber, res.description);
    }
  }

  return new Response(JSON.stringify({ ok: true, scanned: snap.size, sent }), { headers: { "Content-Type": "application/json" } });
};

// Run every minute (near-real-time dispatch without an always-on server).
export const config = { schedule: "* * * * *" };
