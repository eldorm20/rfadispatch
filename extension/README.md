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

## For dispatchers (zero setup)

The TMS Firebase config is **baked in** — there's nothing to configure.
1. Install from the Chrome Web Store link (see [`PUBLISH.md`](PUBLISH.md)) → **Add to Chrome**.
2. Click the extension icon → **sign in once** with your RFA Dispatch email/password.
3. Open `relay.amazon.com` → **Trips**. Trips sync automatically (and every few minutes).
   The popup shows status, last sync, and a **Sync now** button.

Loads sync under the signed-in dispatcher's identity (correct attribution on the boards).

## For developers (testing unpacked)

`chrome://extensions` → Developer mode → **Load unpacked** → select `extension/`.
Sign in via the popup as any TMS user. (Dispatchers never do this — they use the store install.)

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
