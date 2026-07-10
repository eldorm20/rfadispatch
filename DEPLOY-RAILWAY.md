# Deploy on Railway (full app + API + Telegram bot in one service)

Railway runs an always-on Node process, so **one service** hosts everything:
the web app, the admin user-management API, and the real-time Telegram bot.
**Firebase (Firestore + Auth) stays as the database/auth** — it is not hosted on Railway.

```
Railway service (server/index.mjs)
  ├─ serves the built SPA (dist/) + client-side routing
  ├─ POST /api/manage-users  (admin: create / delete / reset password)
  └─ Telegram worker         (auto-registers groups + real-time load dispatch)
Firebase  ── Firestore (data) + Auth (logins)   [managed by Google]
Chrome extension ── still writes loads/tracking straight to Firestore
```

## Deploy (one-time)

1. **railway.app → New Project → Deploy from GitHub repo** → pick
   `eldorm20/rfadispatch`. Railway auto-detects Nixpacks and runs
   `npm ci → npm run build → npm start` (config in `railway.json` / `nixpacks.toml`).

2. **Variables** (Railway → your service → Variables) — add:
   - `FIREBASE_PROJECT_ID` = `rfa-tms-42a31`
   - `FIREBASE_SERVICE_ACCOUNT` = the **entire** service-account JSON, one value
     (Firebase → Project settings → Service accounts → Generate new private key)
   - `TELEGRAM_BOT_TOKEN` = your BotFather token
   - `PORT` is provided by Railway automatically — do not set it.

3. **Domain** — Railway → Settings → **Generate Domain** (`xxx.up.railway.app`),
   or add a custom domain.

4. **Firebase authorized domain** — Firebase → Authentication → Settings →
   **Authorized domains** → add your Railway domain (so logins work there).

5. Deploy. On boot the server **clears the old Telegram webhook automatically**
   and switches to real-time long-poll + Firestore dispatch. Check
   `https://<your-domain>/api/health` → `{"ok":true,"db":true}`.

## Notes
- **VITE_FB_*** are baked into the build (public web config fallback in
  `src/firebase.ts`), so the app connects to Firebase without extra build vars.
- Redeploys happen automatically on every `git push` to `main`.
- The old **Netlify** deploy + its functions are now superseded — the bot uses a
  live Firestore listener instead of the scheduled function, and it deletes the
  Netlify webhook on startup. You can delete the Netlify site once Railway is live.
- The `Amazon sync` health chip and extension keep working unchanged (they talk to
  Firestore directly, not to this server).
