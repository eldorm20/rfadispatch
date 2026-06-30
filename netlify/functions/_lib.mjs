/* Shared helpers for the Netlify Functions: Firebase Admin init, Telegram API,
   and driver→group resolution. Secrets come from Netlify environment variables:
     TELEGRAM_BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT (the service-account JSON), FIREBASE_PROJECT_ID */
import admin from "firebase-admin";

let app;
export function db() {
  if (!app) {
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    app = admin.apps.length
      ? admin.apps[0]
      : admin.initializeApp({ credential: admin.credential.cert(svc), projectId: process.env.FIREBASE_PROJECT_ID });
  }
  return admin.firestore();
}

export function auth() {
  db(); // ensure the app is initialized
  return admin.auth();
}

export async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

/** Find the Telegram group chat id for a driver: explicit override, then by unit #, then last name. */
export async function resolveChatId(driver) {
  if (driver?.telegramChatId) return Number(driver.telegramChatId);
  const groups = (await db().collection("telegramGroups").get()).docs.map((d) => d.data());
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
