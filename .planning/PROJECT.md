# Convoy Tracker

## What This Is

A mobile-first web app that lets small motorcycle friend groups (3–10 riders) coordinate a convoy ride without the chaos of group chats. One person creates a convoy with a meetup point and destination, shares a link, and the rest of the group joins under their name — everyone sees who's actually coming and where to meet.

## Core Value

**Knowing who's actually coming and where you're meeting.** If the app can't reliably show "here's the roster and meetup point for this ride," nothing else matters.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Creator can create a convoy with a title, meetup time, meetup place, and destination in under 30 seconds
- [ ] Each convoy has a shareable link/code that riders can open on their phone
- [ ] Riders can request to join a convoy with just a name (no account required)
- [ ] Creator can approve or deny join requests
- [ ] All members can see the approved roster (who's in)
- [ ] All members can see meetup point, destination, and ride time
- [ ] Convoy has a clear status (planned → active → closed)
- [ ] Creator can close/complete a convoy when the ride is done
- [ ] Works well on mobile browsers (the primary device riders will use)

### Out of Scope (for now — see Roadmap for future phases)

- **Live GPS / real-time rider locations** — Planned for a later phase (idea #2), not v1. Need the basics working first.
- **Route planning / fuel & rest stops** — Planned for a later phase (idea #3). v1 just has meetup + destination text, not a routed map.
- **Pre-ride check-in / emergency contacts** — Planned for a later phase (idea #4). Manual approval is the v1 substitute for "who's accounted for."
- **Full user accounts with profiles** — Not v1. Identity is "name + this convoy." No password, no history, no friend list.
- **Native iOS/Android apps** — Not v1. Mobile web only; share via link.
- **Push notifications** — Not v1 (requires PWA/native infrastructure that's out of scope).
- **Public discovery of convoys** — Not v1. Joining is link-only by design.
- **Large clubs / 20+ rider events** — Not the target user. Design for 3–10 person friend groups.

## Context

- **Target users:** Small groups of motorcycle riders who are already friends and ride together informally (weekend rides, day trips). They are not organized clubs and don't have existing tooling.
- **Today's status quo:** Nothing organized — verbal plans in group chats, people get lost, no one knows the actual roster, meetup gets messy.
- **Trust model:** Join links are shared in private group chats among friends, so trust is implicit. Creator approval exists as a light gate against accidental joins or strangers stumbling onto a link.
- **Distribution:** Riders share the convoy link in their existing group chat (Messenger / WhatsApp / iMessage). The app does not need its own invite system.
- **Solo build:** One developer shipping. Prefer fast-to-build, well-supported tech over impressive-but-heavy choices.

## Constraints

- **Platform:** Mobile-first web app (browser). No native apps in v1. Must work well on phone browsers (iOS Safari, Android Chrome).
- **Auth:** No accounts in v1. Identity is just a name typed when joining, scoped to a single convoy.
- **Scale:** Designed for groups of 3–10 riders per convoy. Not optimized for large clubs.
- **Lifecycle:** Convoys are manually closed by the creator and remain in history (not auto-archived).
- **Privacy:** Join links shared in trusted group chats; creator approves joiners as a soft gate.
- **Success bar:** Shipped and functional. No vanity metrics — the bar is "this is live and works on a real phone for a real ride."

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build all 4 original ideas as one phased product, not separate apps | They serve the same user and stack value on top of each other — roster first, then live location, then routing, then check-in | — Pending |
| MVP is idea #1 (Convoy Tracker basics) only | Core value is "who's coming + where to meet." Everything else is a layer once that proves out. | — Pending |
| Mobile-first web app (not native, not PWA in v1) | Fastest to build and ship; no app store friction; share via link fits the existing group-chat distribution | — Pending |
| No accounts — link/code based joining with name only | Friction kills adoption for one-off ride coordination; trust comes from the group chat the link is shared in | — Pending |
| Creator-approves joins (not open-by-link, not password) | Soft safety gate without adding password UX; small friend groups mean the creator knows who should be in | — Pending |
| Convoys close manually and stay in history (not auto-archive) | Lets groups reference past rides and (eventually) clone them; matches how friend groups actually plan | — Pending |
| Target small friend groups (3–10), not clubs | Different UX problem; designing for clubs would add roles, permissions, event scheduling, and dilute the MVP | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-11 after initialization*
