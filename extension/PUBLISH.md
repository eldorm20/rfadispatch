# Publishing the extension (so dispatchers don't need Developer mode)

Dispatchers should **never** load unpacked or toggle Developer mode. Publish it to
the **Chrome Web Store as Unlisted**, then share the install link — they just click
**Add to Chrome**.

## One-time: package
`extension/rfa-dispatch-extension.zip` is already built. To rebuild after changes:
```bash
cd extension
rm -f rfa-dispatch-extension.zip
zip -r rfa-dispatch-extension.zip manifest.json src icons/icon16.png icons/icon48.png icons/icon128.png
```
(Bump `"version"` in `manifest.json` before each new upload.)

## Publish (Unlisted)
1. Go to the **Chrome Web Store Developer Dashboard**:
   https://chrome.google.com/webstore/devconsole — sign in with the company Google
   account and pay the **one-time $5** registration fee if prompted.
2. **Add new item** → upload `rfa-dispatch-extension.zip`.
3. Fill the listing:
   - **Name / description**: "RFA Dispatch — Amazon Relay Sync. Syncs your Amazon
     Relay trips into the RFA Dispatch TMS."
   - **Icon**: `icons/icon128.png`. Add 1–2 screenshots (e.g. the popup, the TMS board).
   - **Single purpose**: "Read the carrier's own Amazon Relay trips and sync them to
     the RFA Dispatch TMS."
   - **Permission justifications**: `relay.amazon.com` = read the user's trips;
     `firestore.googleapis.com` / `identitytoolkit.googleapis.com` = sign in and save
     trips to the TMS database. (Read-only against Amazon; no data sold.)
   - Add a privacy policy URL (a short page stating data stays within the company TMS).
4. **Visibility → Unlisted** → **Submit for review**. (Review is usually 1–3 days.)
5. After approval, share the listing URL with the team.

## What each dispatcher does (zero setup)
1. Open the store link → **Add to Chrome**.
2. Click the extension icon → **sign in** once with their RFA Dispatch email/password.
3. Open `relay.amazon.com` → **Trips**. Trips sync automatically (and every few minutes).

That's it — no config, no sync account, no Developer mode.

## Faster rollout option (if you use Google Workspace)
Admins can **force-install** the extension org-wide from the Google Admin console
(Devices → Chrome → Apps & extensions) using the item ID — it appears automatically
for all staff, no clicks. Use this if waiting on store review isn't acceptable.

## Updating later
Bump `manifest.json` version → re-zip → upload a new version in the dashboard. Installed
users auto-update within hours.
