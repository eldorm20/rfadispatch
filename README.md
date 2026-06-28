# RFA Dispatch TMS

Internal Transportation Management System for a truck **dispatch service** — one
shared, real-time app that replaces the separate Google Sheets the team uses today
(gross board, update board, accounting board).

A single **load** record flows through every role:

> dispatcher books it → update specialist tracks it → accounting bills commission off the gross.

## Roles & views

| Role | Can see | What they do |
|------|---------|--------------|
| **Dispatcher** | Dashboard, Gross Board, Update Board | Book loads, enter gross, manage their loads |
| **Update Specialist** | Dashboard, Update Board, Gross Board | Move loads through the lifecycle, log check calls |
| **Manager / Admin** | Everything + Team | Oversight, set commission %, manage user roles |
| **Accounting** | Dashboard, Accounting, Gross Board | Bill commission off delivered loads, export CSV |

## Tech

- **React + Vite + TypeScript**
- **Firebase** — Firestore (real-time sync) + Auth (email/password)
- No server to run; deploys as a static site (Firebase Hosting, Netlify, Vercel…)

## Setup

1. **Install**
   ```bash
   npm install
   ```
2. **Connect Firebase**
   - Copy `.env.example` → `.env` and paste your web app config
     (Firebase Console → Project settings → Your apps).
   - In Firebase, enable **Authentication → Email/Password**.
   - Create a **Firestore database** (production mode).
   - Paste `firestore.rules` into Firestore → Rules.
3. **Run**
   ```bash
   npm run dev
   ```
4. **First login** — create users in Firebase Auth (or let them sign in once);
   the first account to sign in becomes **admin** automatically. Use the **Team**
   page to set everyone's role.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — TypeScript check only

## Data model

See [`src/types.ts`](src/types.ts) — `Load`, `LoadStatus`, `Role`, `CheckCall`, `OrgSettings`.

## Roadmap

- [x] Auth + roles, real-time loads, Gross Board, Update Board, Dashboard, Accounting, Team
- [ ] Carriers / drivers / brokers directories (reusable entities)
- [ ] Documents (rate con, BOL, POD) via Firebase Storage
- [ ] Daily history / reports + TV mode (port from the original board)
- [ ] Per-field role enforcement in Firestore rules
