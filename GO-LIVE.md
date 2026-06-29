# Go-Live Checklist

Path: **demo → beta (your company) → production**. Single-tenant for now;
multi-tenant SaaS + billing is a later phase (see Roadmap).

## 1. Connect Firebase (turns off demo mode → real, real-time, multi-device)
- [ ] Firebase Console → create/choose project.
- [ ] **Authentication** → enable **Email/Password**. Add your team's users.
- [ ] **Firestore Database** → create (Production mode), pick a **US region**
      (lowest latency for US trucking).
- [ ] Firestore → **Rules** → paste [`firestore.rules`](firestore.rules).
- [ ] Project settings → Web app → copy the config into `.env`
      (see [`.env.example`](.env.example)). Restart `npm run dev`.
- [ ] First sign-in, then in Firestore set your `users/{uid}.role = "admin"` once
      (bootstrap — rules forbid self-promotion).

## 2. Beta demo to management
- [ ] `npm run build`, deploy (host TBD — Firebase Hosting / Netlify / Vercel).
- [ ] Create a user per role; set each person's **team** (A/B/C/E/X) on the Team page.
- [ ] Set commission %, goal, baseline in Settings.
- [ ] Install the Chrome extension (see [`extension/README.md`](extension/README.md)),
      add the Firebase config + a sync account → open Relay Trips → confirm sync.

## 3. Production hardening
- [ ] Verify Firestore rules deny cross-role actions (test as each role).
- [ ] Schedule Firestore backups (Firebase → automated backups / export).
- [ ] Add error monitoring (e.g. Sentry) + basic analytics.
- [ ] Code-split Firebase to shrink first load (optional; perf polish).
- [ ] Custom domain + SSL on the chosen host.

## Roadmap → SaaS (after beta sign-off)
- [ ] Multi-tenancy: `orgs/{orgId}/…` scoping on every collection + isolation rules.
- [ ] Sign-up / org onboarding / teammate invites.
- [ ] Stripe subscriptions (Checkout + Customer Portal + webhooks via Cloud Functions),
      plan tiers, trials, feature-gating.
- [ ] Per-org extension config (shared project, per-org sync account).
