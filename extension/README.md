# RFA Dispatch — Amazon Relay Sync (Chrome extension)

Captures your Amazon Relay **Trips** in real time (in your own logged-in session,
the way LoadFetcher does) and syncs them into the RFA Dispatch TMS.

## How it works

```
relay.amazon.com (your session)
  └─ interceptor.js  (MAIN world) ── wraps fetch/XHR, reads /api/tours/entitiesV2 responses
       └─ content.js (isolated)    ── maps each trip → TMS load (mapping.js)
            └─ background.js        ── upserts into Firestore  ── TMS web app updates live
```

It is **read-only** against Relay — it never modifies requests, books, or clicks
anything. It only reads the trip data your browser already downloaded, so there's
no extra load on Amazon and no CSRF/token handling.

## Install (unpacked)

1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Click the extension → **Settings** and fill in:
   - **Firebase Project ID** and **Web API Key** (same project the TMS uses)
   - a **sync account** email + password — a Firebase Auth (Email/Password) user you
     create in the Firebase console, allowed to write by your Firestore rules
   - a display name to attribute imported loads to (e.g. "Amazon Sync")
4. Open `relay.amazon.com` → **Trips**. As the page loads/refreshes, trips sync.
   The toolbar popup shows last-sync time, batch size, and created/updated counts.

## Without Firebase yet

If Firebase isn't configured, the extension still **captures and maps** trips and
shows the count in the popup ("Waiting for Relay" → batch size), so you can confirm
capture works before wiring the database. To preview the data in the TMS today,
use the app's **Gross Board → ⬇ Import Amazon** (paste the `entitiesV2` JSON).

## Field mapping

Mirrors the app's `src/lib/relayMapping.ts` (kept in sync as `src/mapping.js`):
`entity.id`→loadNumber, `payout.value`→gross, stops→origin/destination, drivers[0]→
driver/phone, `firstPickupTime`/`lastDeliveryTime`→dates, `equipmentType`→equipment,
`tourState`/`executionStatus`→status, plus `amazon` metadata (stops, contract, version,
rate/mi) for the Update Board.

## Notes / next

- Currently syncs the **Trips** (`entitiesV2`) feed. The Load Board search
  (`/api/loadboard/search`) interceptor is stubbed for a later phase.
- Versioned upserts: existing loads are refreshed only on Amazon-sourced fields,
  so dispatcher attribution, documents, and invoices set in the app are preserved.
