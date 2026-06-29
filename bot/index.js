/* RFA Dispatch — Telegram worker.
   1) Long-polls Telegram and auto-registers every group the bot is added to
      (so you never copy chat IDs — just add the bot to a unit's group).
   2) Watches Firestore loads; when a driver is assigned, sends the load info
      to that driver's unit group (template chosen by the driver's pay type).

   Run:  npm install  &&  npm start
   Env (.env):  TELEGRAM_BOT_TOKEN, GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_PROJECT_ID */

import admin from "firebase-admin";
import { formatLoadMessage } from "./templates.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN in bot/.env");
const TG = `https://api.telegram.org/bot${TOKEN}`;

admin.initializeApp({
  credential: admin.credential.applicationDefault(), // GOOGLE_APPLICATION_CREDENTIALS → service account json
  projectId: process.env.FIREBASE_PROJECT_ID,
});
const db = admin.firestore();

async function tg(method, body) {
  const r = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : Number(v) || 0);

/* ---------- 1) Auto-register groups via long-poll ---------- */
let offset = 0;
async function pollTelegram() {
  try {
    const res = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "my_chat_member", "channel_post"] });
    if (res.ok) {
      for (const u of res.result) {
        offset = u.update_id + 1;
        const chat = u.my_chat_member?.chat || u.message?.chat || u.channel_post?.chat;
        if (chat && (chat.type === "group" || chat.type === "supergroup")) {
          await db.collection("telegramGroups").doc(String(chat.id)).set(
            { chatId: chat.id, title: chat.title || "", type: chat.type, lastSeen: Date.now() },
            { merge: true }
          );
          console.log("• group:", chat.id, "·", chat.title);
        }
      }
    } else {
      console.error("getUpdates:", res.description);
    }
  } catch (e) {
    console.error("poll error:", e.message);
  }
  setTimeout(pollTelegram, 500);
}

/* ---------- resolve a driver's group ---------- */
async function getDriverByName(name) {
  if (!name) return null;
  const q = await db.collection("drivers").where("name", "==", name).limit(1).get();
  return q.empty ? null : q.docs[0].data();
}

async function resolveChatId(driver) {
  if (driver?.telegramChatId) return Number(driver.telegramChatId);
  const groups = (await db.collection("telegramGroups").get()).docs.map((d) => d.data());
  const unit = String(driver?.unit || "").toLowerCase().trim();
  const last = String(driver?.name || "").toLowerCase().split(/\s+/).filter(Boolean).pop();
  // match by unit number first, then by driver last name
  if (unit) {
    const byUnit = groups.find((g) => new RegExp(`(^|\\D)${unit}(\\D|$)`).test((g.title || "").toLowerCase()));
    if (byUnit) return byUnit.chatId;
  }
  if (last) {
    const byName = groups.find((g) => (g.title || "").toLowerCase().includes(last));
    if (byName) return byName.chatId;
  }
  return null;
}

/* ---------- 2) Send load info on driver assignment ---------- */
const RECENT_MS = 12 * 3600000; // on restart, only consider recently-updated loads (avoid backlog spam)

async function handleLoad(doc) {
  const load = { id: doc.id, ...doc.data() };
  if (load.deleted) return;
  const driverName = (load.driver || "").trim();
  if (!driverName) return;
  if (load.telegramSentFor === driverName) return; // already sent for this driver
  if (!["booked", "dispatched", "in_transit", "delivered"].includes(load.status)) return;
  if (Date.now() - ms(load.updatedAt) > RECENT_MS) return; // stale on startup

  const driver = await getDriverByName(driverName);
  const chatId = await resolveChatId(driver || { name: driverName });
  if (!chatId) {
    console.warn("no group matched for driver:", driverName, "— add the bot to their group");
    return;
  }
  const text = formatLoadMessage(load, driver || {});
  const res = await tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
  if (res.ok) {
    await doc.ref.update({ telegramSentFor: driverName, telegramSentAt: Date.now() });
    console.log("✓ sent", load.loadNumber, "→", chatId, `(${driverName})`);
  } else {
    console.error("send failed for", load.loadNumber, ":", res.description);
  }
}

db.collection("loads").onSnapshot(
  (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type === "removed") continue;
      handleLoad(change.doc).catch((e) => console.error("handle error:", e.message));
    }
  },
  (err) => console.error("loads watch error:", err.message)
);

pollTelegram();
console.log("RFA Telegram bot worker running — auto-registering groups + watching loads…");
