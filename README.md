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
8. The **leader** (and creator) can pin the real meetup point and destination on a map. The leader can preview two routes — *get me to the meetup* (from their current location) and *the convoy ride itself* (meetup → destination) — drawn as real road-following polylines.

No accounts. No app store. Just the basics done right.

## Run it

```bash
npm install
npm run db:migrate:local
npm run dev
# → http://localhost:3000
```

Local development uses Wrangler's local D1 database under `.wrangler/`.

## Build it

```bash
npm run build
npm run preview
# → http://localhost:8787
```

## Stack

- **Next.js 15** (App Router) — TypeScript, server components for SSR, client components for the live UI bits
- **Cloudflare D1** — serverless SQLite accessed through a Worker binding, with versioned SQL migrations
- **OpenNext for Cloudflare** — packages the dynamic Next.js application as a Cloudflare Worker
- **Tailwind CSS** — utility classes + a few small component classes (`.btn-primary`, `.input`, `.card`) in `app/globals.css`
- **Leaflet + OpenStreetMap** — live map (no API key, free tiles, dynamic-imported so it doesn't bloat the create page)
- **OSRM public router** ([router.project-osrm.org](https://router.project-osrm.org)) — driving routes from GeoJSON, no API key. Straight-line haversine fallback if it's unreachable.

## Live location model

- Only **approved members** can ping or read locations. The public page exposes the roster but never the map.
- Sharing is **opt-in per rider** — they tap "Share my location", browser prompts for permission, location is sent every ~8s via `watchPosition` + an 8s safety interval.
- Server keeps only the **latest** position per member (single row, upserted). No history table.
- A location is considered "live" if updated in the last **5 minutes** — anything older is filtered out server-side, so stale pins disappear.
- Sharing stops automatically when the convoy is closed or when the rider taps "Stop".
- One member can be designated **leader** by the creator. The leader marker is highlighted on the map.

## Map pins + route preview

- The convoy's free-text **meetup place** and **destination** can be paired with optional **map pins** (real lat/lng).
- **Who can pin:** the **leader** (via cookie + `is_leader=1` check) and the **creator** (via admin token). Both routes funnel into the same `setPins` query. Closed convoys are locked.
- **Pin picker:** a tap-to-drop Leaflet mini-map in a modal. Tries to center on the user's current location (with permission), falls back to Manila. Pins are draggable for fine-tuning. Saving sends just `{ meetup }` or `{ destination }` as a partial patch — passing `null` clears a pin.
- **Live map:** when pins exist, meetup (🚩) and destination (🏁) markers show on everyone's map alongside live rider locations.
- **Leader-only route previews** (drawn as polylines on the live map):
  - **🧭 Get to meetup** — your current location → meetup pin (dashed blue line)
  - **🛣️ Preview convoy route** — meetup → destination (solid orange line, the actual ride path)
- Routes are fetched from OSRM's public driving profile. The component shows distance and ETA when OSRM responds, falls back to a straight line + haversine distance otherwise.

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
    convoys/[code]/pins/route.ts           POST  leader-only: set/clear meetup or destination pin
    admin/[token]/route.ts                 GET   admin view
    admin/[token]/approve/route.ts         POST  approve member
    admin/[token]/deny/route.ts            POST  deny pending request
    admin/[token]/kick/route.ts            POST  remove approved member
    admin/[token]/leader/route.ts          POST  set/clear leader
    admin/[token]/locations/route.ts       GET   live locations (creator view)
    admin/[token]/pins/route.ts            POST  creator: set/clear meetup or destination pin
    admin/[token]/status/route.ts          POST  planned ↔ active → closed
    admin/[token]/convoy/route.ts          PATCH edit title/time/place/destination

components/
  ConvoyMap.tsx                       Leaflet map: rider markers, meetup/dest pins, route polylines
  LocationSharePanel.tsx              opt-in geolocation share with permission flow
  PinPicker.tsx                       modal tap-to-drop mini-map for picking a single LatLng
  LeaderControls.tsx                  leader UI: pin meetup/dest + route previews
  QRCard.tsx                          QR + share/copy/PNG controls for the join URL

lib/
  db.ts                               Cloudflare D1 binding + row types
  queries.ts                          all DB operations
  ids.ts                              short convoy codes + secret tokens
  admin.ts                            withAdmin() wrapper for protected routes
  format.ts                           date + status label helpers
```

## Data model

Three D1 tables are created by `migrations/0001_initial.sql`:

```sql
convoys(id, code, admin_token, title, meetup_at, meetup_place, destination,
        meetup_lat, meetup_lng, dest_lat, dest_lng,
        status, created_at, closed_at)
members(id, convoy_id → convoys, name, token, state, is_leader, created_at)
locations(member_id → members [PRIMARY KEY], lat, lng, accuracy, heading, speed, updated_at)
```

- `code` — 6-char public join code (e.g. `J478EE`), used in `/c/[code]`
- `admin_token` — long random secret, used in `/admin/[token]`
- `members.token` — per-rider session token, set as an httpOnly cookie `convoy_<CODE>` so the rider sees their own pending/approved state when revisiting on the same device
- `members.state` — `pending` | `approved` | `denied` | `left`
- `members.is_leader` — 0/1, at most one per convoy (set in a transaction)
- `convoys.status` — `planned` | `active` | `closed`
- `convoys.{meetup,dest}_{lat,lng}` — nullable real-world map pins paired with the free-text fields
- `locations` — one row per member, upserted on each ping; rows are kept forever in the table but filtered out client-server after 5 minutes of staleness

## Identity model

- **Riders** are identified by an httpOnly cookie scoped per convoy (`convoy_<CODE>`). Switching phones / clearing cookies loses access — by design for v1.
- **Creators** are identified by the secret in their creator URL. The URL is the only way back in. The creator UI warns about this and gives copy/share buttons.

## Deploy to Cloudflare Workers

Prerequisites: a Cloudflare account and Node.js 20 or newer.

1. Install dependencies and authenticate:

   ```bash
   npm install
   npx wrangler login
   ```

2. Create the production D1 database:

   ```bash
   npx wrangler d1 create convoy-tracker
   ```

3. Copy the returned `database_id` into the `DB` entry in `wrangler.jsonc`, replacing the all-zero local placeholder.

4. Apply the production schema and deploy:

   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

Use `npm run preview` before deployment to build and run the application in the Workers runtime with a local D1 database.

Existing data from the former `data/convoy.db` is not uploaded automatically. Export it as SQL and import it into D1 separately if it needs to be preserved.

## Shipped so far

- ✓ **v0.1** — convoy CRUD, link-based join, creator-approves, roster, status, manual close
- ✓ **v0.2** — live location sharing, live map (Leaflet/OSM), leader designation
- ✓ **v0.3** — QR-code invite share
- ✓ **v0.4** — leader-pinned meetup + destination, route preview (rider → meetup, meetup → destination) via OSRM

## Not yet (deliberate)

- Multi-stop routes (fuel stops, rest stops) — natural extension of pinning
- Per-rider "way to meetup" for non-leaders
- Pre-ride check-in / emergency contacts
- Full accounts / profiles / history across convoys
- Push notifications
- Convoy templates / cloning
- Chat (the group chat the link is shared in already does this)

Each one is a clean next phase to add on top.
