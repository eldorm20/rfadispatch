# Telegram dispatch — Netlify Functions (cloud, no always-on server)

Runs the Telegram bot entirely on **Netlify** — no Mac, no Blaze, no Firebase CLI.

- **`telegram-webhook`** — Telegram calls this whenever the bot is added to a group
  or a group message arrives → records the group's chat id + title in Firestore
  (`telegramGroups`). You never copy chat IDs; just add the bot to a unit's group.
- **`dispatch-scan`** — a **scheduled** function (every minute) that finds loads with
  a driver assigned but not yet sent, and posts the load info to the driver's unit
  group (template by pay type). Source-agnostic: works whether the driver was assigned
  in Amazon (extension sync) or in the TMS. Idempotent via `load.telegramSentFor`.

## Deploy (one-time)

### 1. Get the project on GitHub
```bash
cd ~/Documents/dispatch-tms
# create an EMPTY private repo at github.com/new (e.g. "dispatch-tms"), then:
git remote add origin https://github.com/<you>/dispatch-tms.git
git push -u origin main
```

### 2. Connect Netlify to the repo
Netlify → **Add new site → Import from Git** → pick the repo. Build settings come
from `netlify.toml` automatically (build `npm run build`, publish `dist`, functions
`netlify/functions`). This replaces the drag-and-drop site with auto-deploy on push.

### 3. Set environment variables (Netlify → Site settings → Environment variables)
- `TELEGRAM_BOT_TOKEN` — your BotFather token
- `FIREBASE_PROJECT_ID` — `rfa-tms-42a31`
- `FIREBASE_SERVICE_ACCOUNT` — the **entire** service-account JSON, pasted as one value
  (Firebase Console → Project settings → Service accounts → Generate new private key)

Trigger a redeploy after setting them.

### 4. Point Telegram at the webhook (one-time)
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-site>.netlify.app/.netlify/functions/telegram-webhook"
```
(Replace the token and your Netlify domain.)

### 5. Finish setup
- BotFather → your bot → **Group Privacy → Disable**.
- **Add the bot** to each unit's Telegram group (name groups with the unit #, e.g. "…Unit 202…").
- In the TMS **Drivers** page, set each driver's **Unit #** and **Pay type**.

That's it — assign a driver (in Amazon or the TMS), and within ~1 min the unit group
gets the load. The `bot/` folder is now only a local/self-host alternative; **don't run
it at the same time** as the Netlify functions.
