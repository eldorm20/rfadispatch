/* Always-on Telegram worker for the Railway server.
   1) Auto-registers every group the bot joins (long-poll getUpdates).
   2) Watches Firestore loads in real time; when a driver is assigned, sends the
      load info to that driver's unit group (template by pay type). Idempotent. */
import { formatLoadMessage } from "../shared/telegramTemplate.mjs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;
const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : Number(v) || 0);
const RECENT_MS = 12 * 3600000;

async function tg(method, body) {
  const r = await fetch(`${TG}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

async function resolveChatId(db, driver) {
  if (driver?.telegramChatId) return Number(driver.telegramChatId);
  const groups = (await db.collection("telegramGroups").get()).docs.map((d) => d.data());
  const unit = String(driver?.unit || "").toLowerCase().trim();
  const last = String(driver?.name || "").toLowerCase().split(/\s+/).filter(Boolean).pop();
  if (unit) {
    const g = groups.find((x) => new RegExp(`(^|\\D)${unit}(\\D|$)`).test((x.title || "").toLowerCase()));
    if (g) return g.chatId;
  }
  if (last) {
    const g = groups.find((x) => (x.title || "").toLowerCase().includes(last));
    if (g) return g.chatId;
  }
  return null;
}

export function startTelegramWorker(db) {
  if (!TG) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — worker disabled");
    return;
  }

  // Long-poll needs the webhook cleared (they're mutually exclusive).
  let offset = 0;
  (async () => {
    try {
      await tg("deleteWebhook", { drop_pending_updates: false });
    } catch (e) {
      console.warn("[telegram] deleteWebhook:", e.message);
    }
    const poll = async () => {
      try {
        const res = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "my_chat_member", "channel_post"] });
        if (res.ok) {
          for (const u of res.result) {
            offset = u.update_id + 1;
            const chat = u.my_chat_member?.chat || u.message?.chat || u.channel_post?.chat;
            if (chat && (chat.type === "group" || chat.type === "supergroup")) {
              await db.collection("telegramGroups").doc(String(chat.id)).set({ chatId: chat.id, title: chat.title || "", type: chat.type, lastSeen: Date.now() }, { merge: true });
              console.log("[telegram] group:", chat.id, "·", chat.title);
            }
          }
        }
      } catch (e) {
        console.error("[telegram] poll:", e.message);
      }
      setTimeout(poll, 500);
    };
    poll();
  })();

  // Real-time load watcher → send on assignment.
  const driverCache = new Map();
  db.collection("loads").onSnapshot(
    (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type === "removed") continue;
        handleLoad(db, change.doc, driverCache).catch((e) => console.error("[telegram] handle:", e.message));
      }
    },
    (err) => console.error("[telegram] loads watch:", err.message)
  );

  console.log("[telegram] worker running (group auto-register + real-time dispatch)");
}

async function handleLoad(db, doc, driverCache) {
  const load = { id: doc.id, ...doc.data() };
  const driverName = (load.driver || "").trim();
  if (load.deleted || !driverName) return;
  if (load.telegramSentFor === driverName) return;
  if (!["booked", "dispatched", "in_transit", "delivered"].includes(load.status)) return;
  if (Date.now() - ms(load.updatedAt) > RECENT_MS) return;

  let driver = driverCache.get(driverName);
  if (driver === undefined) {
    const q = await db.collection("drivers").where("name", "==", driverName).limit(1).get();
    driver = q.empty ? { name: driverName } : q.docs[0].data();
    driverCache.set(driverName, driver);
  }
  const chatId = await resolveChatId(db, driver);
  if (!chatId) return;

  const res = await tg("sendMessage", { chat_id: chatId, text: formatLoadMessage(load, driver), disable_web_page_preview: true });
  if (res.ok) {
    await doc.ref.update({ telegramSentFor: driverName, telegramSentAt: Date.now() });
    console.log("[telegram] sent", load.loadNumber, "→", chatId);
  } else {
    console.error("[telegram] send failed", load.loadNumber, res.description);
  }
}
