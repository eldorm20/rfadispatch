# RFA Dispatch — Telegram bot worker (local / self-host alternative)

> **For cloud hosting (recommended), use the Netlify Functions** in
> [`../netlify/functions`](../netlify/functions/README.md) instead — no always-on
> machine needed. This `bot/` worker is the local/self-host option. **Don't run both.**

Sends Amazon load info to each driver's Telegram **unit group** automatically when
a driver is assigned. Also **auto-discovers groups** so you never copy chat IDs.

## How it works
- **Long-polls Telegram** → whenever the bot is added to a group, it records that
  group's chat id + title in Firestore (`telegramGroups`). The only manual step per
  new group is **adding the bot to it** (Telegram requires bot membership to post).
- **Watches Firestore `loads`** → when a load has a driver assigned (and hasn't been
  sent for that driver yet), it formats the message and posts it to the driver's group.
- **Group matching**: by the driver's **unit number** in the group title (e.g. "Unit 202"),
  then by the driver's last name. You can also set an explicit `telegramChatId` on a driver.
- **Template**: drivers with pay type **percent/owner** get the rate + $/mi version;
  **cpm company** drivers get the no-rate version.

## Setup
1. **Service account**: Firebase Console → Project settings → **Service accounts** →
   *Generate new private key* → save the JSON as `bot/service-account.json`.
2. **Env**: copy `.env.example` → `.env` and set `TELEGRAM_BOT_TOKEN`,
   `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`.
   (Your bot token is already filled in `.env`.)
3. **Bot group privacy**: in @BotFather → your bot → Group Privacy → **Disable**
   (or just add the bot as admin) so it reliably receives the membership update.
4. **Add the bot to each unit's Telegram group.** Name groups with the unit number
   (e.g. "Team A / Unit 202 … ZEMEN") so matching works automatically.
5. Install + run:
   ```bash
   cd bot
   npm install
   npm start          # node --env-file=.env index.js
   ```
   Keep it running on an always-on machine (office Mac for beta; a small VM later).
   For resilience use pm2: `npx pm2 start "npm start" --name rfa-bot`.

## Notes
- In the TMS, set each driver's **Unit #** and **pay type** (Drivers page).
- Re-sends automatically if a load is reassigned to a different driver.
- On startup it only considers loads updated in the last 12h, to avoid back-spamming
  historical loads.
- For production/SaaS this can move to a Cloud Function (Firestore trigger + webhook);
  the worker is the deploy-light path for the beta.
