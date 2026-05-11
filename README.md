# Convoy Tracker 🏍️

A dead-simple, mobile-first web app for small motorcycle friend groups (3–10 riders) to coordinate convoy rides without the group-chat chaos.

**Core flow:**

1. A rider creates a convoy (title, meetup time/place, destination) and gets two links: a **public join link** and a **private creator link**.
2. They drop the join link into the group chat.
3. Other riders open the link, type their name, request to join.
4. The creator (using the creator link) sees pending requests and approves or denies each.
5. Everyone with the join link sees the live roster, meetup info, and status.
6. Creator marks the ride active when it starts, and closes it when it's done.

No accounts. No GPS. No app store. Just the basics done right.

## Run it

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Build it

```bash
npm run build
npm start
```

## Stack

- **Next.js 15** (App Router) — TypeScript, server components for SSR, client components for the live UI bits
- **SQLite** via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) — single-file DB at `data/convoy.db`, no setup
- **Tailwind CSS** — utility classes + a few small component classes (`.btn-primary`, `.input`, `.card`) in `app/globals.css`

## Project layout

```
app/
  page.tsx                            create-convoy form + result view
  layout.tsx                          shell, viewport meta, footer
  globals.css                         tailwind + .btn / .input / .card
  c/[code]/                           public convoy page (anyone with link)
    page.tsx                          server component (loads convoy + reads cookie)
    ConvoyClient.tsx                  client UI: join form, roster, polling
    not-found.tsx
  admin/[token]/                      creator dashboard (anyone with secret token)
    page.tsx
    AdminClient.tsx                   approve/deny, kick, edit, status, close
    not-found.tsx
  api/
    convoys/route.ts                  POST  create
    convoys/[code]/route.ts           GET   public view
    convoys/[code]/me/route.ts        GET   "am I in this convoy?" (cookie-scoped)
    convoys/[code]/join/route.ts      POST  request to join
    convoys/[code]/leave/route.ts     POST  leave / cancel request
    admin/[token]/route.ts            GET   admin view
    admin/[token]/approve/route.ts    POST  approve member
    admin/[token]/deny/route.ts       POST  deny pending request
    admin/[token]/kick/route.ts       POST  remove approved member
    admin/[token]/status/route.ts     POST  planned ↔ active → closed
    admin/[token]/convoy/route.ts     PATCH edit title/time/place/destination

lib/
  db.ts                               sqlite connection + schema
  queries.ts                          all DB operations
  ids.ts                              short convoy codes + secret tokens
  admin.ts                            withAdmin() wrapper for protected routes
  format.ts                           date + status label helpers
```

## Data model

Two tables, no migrations:

```sql
convoys(id, code, admin_token, title, meetup_at, meetup_place, destination, status, created_at, closed_at)
members(id, convoy_id → convoys, name, token, state, created_at)
```

- `code` — 6-char public join code (e.g. `J478EE`), used in `/c/[code]`
- `admin_token` — long random secret, used in `/admin/[token]`
- `members.token` — per-rider session token, set as an httpOnly cookie `convoy_<CODE>` so the rider sees their own pending/approved state when revisiting on the same device
- `members.state` — `pending` | `approved` | `denied` | `left`
- `convoys.status` — `planned` | `active` | `closed`

## Identity model

- **Riders** are identified by an httpOnly cookie scoped per convoy (`convoy_<CODE>`). Switching phones / clearing cookies loses access — by design for v1.
- **Creators** are identified by the secret in their creator URL. The URL is the only way back in. The creator UI warns about this and gives copy/share buttons.

## Deployment

Anywhere that runs Node 20+. Easiest:

- **Self-host** (VPS / Raspberry Pi): `npm run build && npm start` behind nginx/Caddy.
- **Vercel / Netlify**: works, but SQLite needs a persistent disk — switch the DB to Postgres (`@vercel/postgres`) or Turso for serverless deploys.

The SQLite DB lives at `data/convoy.db` relative to the working directory. Back this up if you care about it.

## Not in v1 (deliberate)

- Live GPS / map view
- Routes, fuel stops, rest stops
- Pre-ride check-in / emergency contacts
- Full accounts / profiles / history across convoys
- Push notifications
- Convoy templates / cloning
- Chat (the group chat the link is shared in already does this)

Each one is a clean next phase to add on top of this base when v1 proves out.
