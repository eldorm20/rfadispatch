# RFA Dispatch — Amazon Relay Sync (Chrome extension)

Captures your Amazon Relay **Trips** in real time (in your own logged-in session,
the way LoadFetcher does) and syncs them into the RFA Dispatch TMS.

## How it works

```
relay.amazon.com (your session)
  └─ interceptor.js (MAIN world) ── wraps fetch/XHR; reads /api/tours/entitiesV2
       │                            responses AND captures the request (incl. csrf token)
       └─ content.js (isolated)   ── relays raw data to the background worker
            └─ background.js       ── maps (relayMap.mjs) → upserts to Firestore → TMS updates live
                 └─ chrome.alarms  ── replays the captured Trips request on a timer (polling)
```

Two sync paths:
- **Passive** — whenever a Relay tab loads/refreshes, trips sync automatically.
- **Polling** — the worker replays the captured Trips request every few minutes
  (configurable) so trips keep syncing even when nobody's looking at Relay. If the
  csrf token goes stale (401/403), it resumes on the next live page interaction.

It is **read-only** against Relay — it never books, accepts, or clicks anything.

## Install (unpacked)

1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Click the extension → **Settings** and fill in:
   - **Firebase Project ID** and **Web API Key** (same project the TMS uses)
   - a **sync account** email + password — a Firebase Auth (Email/Password) user you
     create in the Firebase console, allowed to write by your Firestore rules
   - a display name to attribute imported loads to (e.g. "Amazon Sync")
   - **background poll interval** in minutes (default 5)
4. Open `relay.amazon.com` → **Trips**. As the page loads/refreshes, trips sync.
   The toolbar popup shows last-sync time, batch size, and created/updated counts.

## Without Firebase yet

If Firebase isn't configured, the extension still **captures and maps** trips and
shows the count in the popup ("Waiting for Relay" → batch size), so you can confirm
capture works before wiring the database. To preview the data in the TMS today,
use the app's **Gross Board → ⬇ Import Amazon** (paste the `entitiesV2` JSON).

## Field mapping

Mirrors the app's `src/lib/relayMapping.ts` (kept in sync as `src/relayMap.mjs`):
`entity.id`→loadNumber, `payout.value`→gross, stops→origin/destination, drivers[0]→
driver/phone, `firstPickupTime`/`lastDeliveryTime`→dates, `equipmentType`→equipment,
`tourState`/`executionStatus`→status, plus `amazon` metadata (stops, contract, version,
rate/mi) for the Update Board.

## Notes / next

- Currently syncs the **Trips** (`entitiesV2`) feed. The Load Board search
  (`/api/loadboard/search`) interceptor is stubbed for a later phase.
- Versioned upserts: existing loads are refreshed only on Amazon-sourced fields,
  so dispatcher attribution, documents, and invoices set in the app are preserved.
