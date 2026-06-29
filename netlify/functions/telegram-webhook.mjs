/* Telegram webhook. Point your bot's webhook here (one-time setWebhook). Whenever
   the bot is added to a group or a group message arrives, we record that group's
   chat id + title — so you never copy chat IDs; just add the bot to a unit's group. */
import { db } from "./_lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  let update;
  try {
    update = await req.json();
  } catch {
    return new Response("bad", { status: 200 });
  }
  const chat = update.my_chat_member?.chat || update.message?.chat || update.channel_post?.chat;
  if (chat && (chat.type === "group" || chat.type === "supergroup")) {
    try {
      await db()
        .collection("telegramGroups")
        .doc(String(chat.id))
        .set({ chatId: chat.id, title: chat.title || "", type: chat.type, lastSeen: Date.now() }, { merge: true });
    } catch (e) {
      console.error("register group failed:", e.message);
    }
  }
  return new Response("ok", { status: 200 });
};
