# Convoy Tracker 🏍️

A dead-simple, mobile-first web app for small motorcycle friend groups (3–10 riders) to coordinate convoy rides without the group-chat chaos.

**Core flow:**

1. A rider creates a convoy (title, meetup time/place, destination) and gets two links: a **public join link** and a **private creator link**.
2. They drop the join link into the group chat.
3. Other riders open the link, type their name, request to join.
4. The creator (using the creator link) sees pending requests and approves or denies each.
5. Everyone with the join link sees the live roster, meetup info, and status.
6. Creator marks the ride active when it starts, and closes it when it's done.
7. **While the ride is active**, approved riders can opt-in to share their live location. Everyone in the convoy sees the others on a live map. Creator can designate one rider as the **leader** (highlighted on the map).

No accounts. No app store. Just the basics done right.

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
- **Leaflet + OpenStreetMap** — live map (no API key, free tiles, dynamic-imported so it doesn't bloat the create page)

## Live location model

- Only **approved members** can ping or read locations. The public page exposes the roster but never the map.
- Sharing is **opt-in per rider** — they tap "Share my location", browser prompts for permission, location is sent every ~8s via `watchPosition` + an 8s safety interval.
- Server keeps only the **latest** position per member (single row, upserted). No history table.
- A location is considered "live" if updated in the last **5 minutes** — anything older is filtered out server-side, so stale pins disappear.
- Sharing stops automatically when the convoy is closed or when the rider taps "Stop".
- One member can be designated **leader** by the creator. The leader marker is highlighted on the map.

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
    convoys/route.ts                       POST  create
    convoys/[code]/route.ts                GET   public view
    convoys/[code]/me/route.ts             GET   "am I in this convoy?" (cookie-scoped)
    convoys/[code]/join/route.ts           POST  request to join
    convoys/[code]/leave/route.ts          POST  leave / cancel request
    convoys/[code]/location/route.ts       POST  ping location · GET live locations (members)
    admin/[token]/route.ts                 GET   admin view
    admin/[token]/approve/route.ts         POST  approve member
    admin/[token]/deny/route.ts            POST  deny pending request
    admin/[token]/kick/route.ts            POST  remove approved member
    admin/[token]/leader/route.ts          POST  set/clear leader
    admin/[token]/locations/route.ts       GET   live locations (creator view)
    admin/[token]/status/route.ts          POST  planned ↔ active → closed
    admin/[token]/convoy/route.ts          PATCH edit title/time/place/destination

components/
  ConvoyMap.tsx                       Leaflet map (client-only, dynamic-imported)
  LocationSharePanel.tsx              opt-in geolocation share with permission flow

lib/
  db.ts                               sqlite connection + schema
  queries.ts                          all DB operations
  ids.ts                              short convoy codes + secret tokens
  admin.ts                            withAdmin() wrapper for protected routes
  format.ts                           date + status label helpers
```

## Data model

Three tables, schema is idempotent (auto-creates on first request, adds `is_leader` column if upgrading from v0.1):

```sql
convoys(id, code, admin_token, title, meetup_at, meetup_place, destination, status, created_at, closed_at)
members(id, convoy_id → convoys, name, token, state, is_leader, created_at)
locations(member_id → members [PRIMARY KEY], lat, lng, accuracy, heading, speed, updated_at)
```

- `code` — 6-char public join code (e.g. `J478EE`), used in `/c/[code]`
- `admin_token` — long random secret, used in `/admin/[token]`
- `members.token` — per-rider session token, set as an httpOnly cookie `convoy_<CODE>` so the rider sees their own pending/approved state when revisiting on the same device
- `members.state` — `pending` | `approved` | `denied` | `left`
- `members.is_leader` — 0/1, at most one per convoy (set in a transaction)
- `convoys.status` — `planned` | `active` | `closed`
- `locations` — one row per member, upserted on each ping; rows are kept forever in the table but filtered out client-server after 5 minutes of staleness

## Identity model

- **Riders** are identified by an httpOnly cookie scoped per convoy (`convoy_<CODE>`). Switching phones / clearing cookies loses access — by design for v1.
- **Creators** are identified by the secret in their creator URL. The URL is the only way back in. The creator UI warns about this and gives copy/share buttons.

## Deployment

Anywhere that runs Node 20+. Easiest:

- **Self-host** (VPS / Raspberry Pi): `npm run build && npm start` behind nginx/Caddy.
- **Vercel / Netlify**: works, but SQLite needs a persistent disk — switch the DB to Postgres (`@vercel/postgres`) or Turso for serverless deploys.

The SQLite DB lives at `data/convoy.db` relative to the working directory. Back this up if you care about it.

## Shipped so far

- ✓ **v0.1** — convoy CRUD, link-based join, creator-approves, roster, status, manual close
- ✓ **v0.2** — live location sharing, live map (Leaflet/OSM), leader designation

## Not yet (deliberate)

- Routes, fuel stops, rest stops, ETA
- Pre-ride check-in / emergency contacts
- Full accounts / profiles / history across convoys
- Push notifications
- Convoy templates / cloning
- Chat (the group chat the link is shared in already does this)

Each one is a clean next phase to add on top.
