/* Always-on Telegram worker (EasyRelay-style bot):
   1) Auto-registers every group the bot joins (long-poll getUpdates).
   2) Real-time load dispatch: sends load info to the driver's unit group on assignment.
   3) Proactive ALERTS to the unit group: cancellations, new check-call notes,
      stopped/late-past-ETA, and lost tracking signal (app-usage proxy). */
import { formatLoadMessage } from "../shared/telegramTemplate.mjs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;
const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : Number(v) || 0);
const RECENT_MS = 12 * 3600000;
const NO_SIGNAL_MS = 2 * 3600000; // 2h without a ping → "app usage" / lost-signal alert

async function tg(method, body) {
  const r = await fetch(`${TG}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

async function resolveChatId(db, driverName, driverCache) {
  let driver = driverCache.get(driverName);
  if (driver === undefined) {
    const q = await db.collection("drivers").where("name", "==", driverName).limit(1).get();
    driver = q.empty ? { name: driverName } : q.docs[0].data();
    driverCache.set(driverName, driver);
  }
  if (driver?.telegramChatId) return { chatId: Number(driver.telegramChatId), driver };
  const groups = (await db.collection("telegramGroups").get()).docs.map((d) => d.data());
  const unit = String(driver?.unit || "").toLowerCase().trim();
  const last = String(driverName || "").toLowerCase().split(/\s+/).filter(Boolean).pop();
  let g = unit && groups.find((x) => new RegExp(`(^|\\D)${unit}(\\D|$)`).test((x.title || "").toLowerCase()));
  if (!g && last) g = groups.find((x) => (x.title || "").toLowerCase().includes(last));
  return { chatId: g ? g.chatId : null, driver };
}

export function startTelegramWorker(db) {
  if (!TG) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — worker disabled");
    return;
  }

  const driverCache = new Map();
  const loads = new Map(); // id -> load (live cache from the snapshot)
  const prevStatus = new Map();
  const prevNoteAt = new Map();
  const alerted = new Set(); // dedupe keys
  let primed = false;

  async function send(driverName, text, parseMode) {
    const { chatId } = await resolveChatId(db, driverName, driverCache);
    if (!chatId) return false;
    const r = await tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...(parseMode ? { parse_mode: parseMode } : {}) });
    return !!r.ok;
  }

  // ---- group auto-registration (long-poll; webhook cleared first) ----
  let offset = 0;
  (async () => {
    try { await tg("deleteWebhook", { drop_pending_updates: false }); } catch (e) { console.warn("[telegram] deleteWebhook:", e.message); }
    const poll = async () => {
      try {
        const res = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "my_chat_member", "channel_post"] });
        if (res.ok) for (const u of res.result) {
          offset = u.update_id + 1;
          const chat = u.my_chat_member?.chat || u.message?.chat || u.channel_post?.chat;
          if (chat && (chat.type === "group" || chat.type === "supergroup")) {
            await db.collection("telegramGroups").doc(String(chat.id)).set({ chatId: chat.id, title: chat.title || "", type: chat.type, lastSeen: Date.now() }, { merge: true });
            console.log("[telegram] group:", chat.id, "·", chat.title);
          }
        }
      } catch (e) { console.error("[telegram] poll:", e.message); }
      setTimeout(poll, 500);
    };
    poll();
  })();

  // ---- real-time loads: dispatch on assignment + cancellation/note alerts ----
  db.collection("loads").onSnapshot(
    async (snap) => {
      for (const change of snap.docChanges()) {
        const load = { id: change.doc.id, ...change.doc.data() };
        if (change.type === "removed") { loads.delete(load.id); continue; }
        loads.set(load.id, load);
        if (!primed) { prevStatus.set(load.id, load.status); prevNoteAt.set(load.id, ms(load.lastUpdateAt)); continue; }

        const driverName = (load.driver || "").trim();

        // dispatch load info on (re)assignment
        if (driverName && load.telegramSentFor !== driverName && ["booked", "dispatched", "in_transit", "delivered"].includes(load.status) && Date.now() - ms(load.updatedAt) < RECENT_MS) {
          try {
            if (await send(driverName, formatLoadMessage(load, driverCache.get(driverName) || {}))) {
              await change.doc.ref.update({ telegramSentFor: driverName, telegramSentAt: Date.now() });
            }
          } catch (e) { console.error("[telegram] dispatch:", e.message); }
        }

        // cancellation alert
        if (load.status === "cancelled" && prevStatus.get(load.id) !== "cancelled" && driverName) {
          const k = load.id + ":cancelled";
          if (!alerted.has(k)) { alerted.add(k); send(driverName, `❌ CANCELLED · ${load.loadNumber}\n${load.origin} → ${load.destination}`).catch(() => {}); }
        }
        // new check-call note → forward it
        const noteAt = ms(load.lastUpdateAt);
        if (driverName && noteAt && noteAt !== prevNoteAt.get(load.id) && load.lastUpdate) {
          send(driverName, `📝 Update · ${load.loadNumber}\n${load.lastUpdate}`).catch(() => {});
        }
        prevStatus.set(load.id, load.status);
        prevNoteAt.set(load.id, noteAt);
      }
      primed = true;
    },
    (err) => console.error("[telegram] loads watch:", err.message)
  );

  // ---- periodic tracking alerts: late-past-ETA + lost signal (app usage) ----
  setInterval(() => {
    if (!primed) return;
    const now = Date.now();
    for (const load of loads.values()) {
      const driverName = (load.driver || "").trim();
      const t = load.tracking;
      if (!driverName || load.deleted || !["dispatched", "in_transit"].includes(load.status) || !t) continue;

      // lost signal (re-arms when a fresh ping returns)
      const sig = load.id + ":nosignal";
      if (t.updatedAt && now - t.updatedAt > NO_SIGNAL_MS) {
        if (!alerted.has(sig)) { alerted.add(sig); send(driverName, `⚠️ No tracking signal · ${load.loadNumber}\nLast update ${Math.round((now - t.updatedAt) / 3600000)}h ago — check the Relay app is open.`).catch(() => {}); }
      } else alerted.delete(sig);

      // stopped past ETA
      const late = load.id + ":late";
      if (t.eta && now > Date.parse(t.eta) && t.inMotion === false && !alerted.has(late)) {
        alerted.add(late);
        send(driverName, `⏰ Running late · ${load.loadNumber}\nStopped and past ETA — please update.`).catch(() => {});
      }
    }
  }, 5 * 60000);

  console.log("[telegram] worker running (dispatch + cancellation/note/late/no-signal alerts)");
}
