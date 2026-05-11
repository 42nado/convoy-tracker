import {
  db,
  type ConvoyRow,
  type MemberRow,
  type ConvoyStatus,
  type MemberState,
  type LocationRow,
  type LatLng,
} from "./db";
import { newConvoyCode, newSecretToken } from "./ids";

export interface ConvoyPins {
  meetup: LatLng | null;
  destination: LatLng | null;
}

function pinsFromRow(row: ConvoyRow): ConvoyPins {
  const meetup =
    row.meetup_lat !== null && row.meetup_lng !== null
      ? { lat: row.meetup_lat, lng: row.meetup_lng }
      : null;
  const destination =
    row.dest_lat !== null && row.dest_lng !== null ? { lat: row.dest_lat, lng: row.dest_lng } : null;
  return { meetup, destination };
}

export function setPins(
  convoyId: number,
  patch: { meetup?: LatLng | null; destination?: LatLng | null },
): void {
  const sets: string[] = [];
  const values: (number | null)[] = [];
  if (patch.meetup !== undefined) {
    sets.push("meetup_lat = ?", "meetup_lng = ?");
    values.push(patch.meetup?.lat ?? null, patch.meetup?.lng ?? null);
  }
  if (patch.destination !== undefined) {
    sets.push("dest_lat = ?", "dest_lng = ?");
    values.push(patch.destination?.lat ?? null, patch.destination?.lng ?? null);
  }
  if (sets.length === 0) return;
  values.push(convoyId);
  db().prepare(`UPDATE convoys SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function createConvoy(input: {
  title: string;
  meetupAt: string;
  meetupPlace: string;
  destination: string;
}): ConvoyRow {
  const conn = db();
  let code = newConvoyCode();
  let attempts = 0;
  while (conn.prepare("SELECT 1 FROM convoys WHERE code = ?").get(code)) {
    code = newConvoyCode();
    if (++attempts > 5) throw new Error("failed to generate unique code");
  }
  const adminToken = newSecretToken();
  const info = conn
    .prepare(
      `INSERT INTO convoys (code, admin_token, title, meetup_at, meetup_place, destination)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(code, adminToken, input.title, input.meetupAt, input.meetupPlace, input.destination);

  return conn.prepare("SELECT * FROM convoys WHERE id = ?").get(info.lastInsertRowid) as ConvoyRow;
}

export function getConvoyByCode(code: string): ConvoyRow | null {
  const row = db().prepare("SELECT * FROM convoys WHERE code = ?").get(code) as ConvoyRow | undefined;
  return row ?? null;
}

export function getConvoyByAdminToken(token: string): ConvoyRow | null {
  const row = db()
    .prepare("SELECT * FROM convoys WHERE admin_token = ?")
    .get(token) as ConvoyRow | undefined;
  return row ?? null;
}

export function listMembers(convoyId: number): MemberRow[] {
  return db()
    .prepare("SELECT * FROM members WHERE convoy_id = ? ORDER BY created_at ASC")
    .all(convoyId) as MemberRow[];
}

export function getMemberByToken(convoyId: number, token: string): MemberRow | null {
  const row = db()
    .prepare("SELECT * FROM members WHERE convoy_id = ? AND token = ?")
    .get(convoyId, token) as MemberRow | undefined;
  return row ?? null;
}

export function requestJoin(convoyId: number, name: string): MemberRow {
  const token = newSecretToken();
  const info = db()
    .prepare(
      "INSERT INTO members (convoy_id, name, token, state) VALUES (?, ?, ?, 'pending')",
    )
    .run(convoyId, name, token);
  return db().prepare("SELECT * FROM members WHERE id = ?").get(info.lastInsertRowid) as MemberRow;
}

export function setMemberState(memberId: number, convoyId: number, state: MemberState): void {
  db()
    .prepare("UPDATE members SET state = ? WHERE id = ? AND convoy_id = ?")
    .run(state, memberId, convoyId);
}

export function setLeader(memberId: number | null, convoyId: number): void {
  const conn = db();
  const tx = conn.transaction(() => {
    conn.prepare("UPDATE members SET is_leader = 0 WHERE convoy_id = ?").run(convoyId);
    if (memberId !== null) {
      conn
        .prepare("UPDATE members SET is_leader = 1 WHERE id = ? AND convoy_id = ?")
        .run(memberId, convoyId);
    }
  });
  tx();
}

export function upsertLocation(
  memberId: number,
  loc: { lat: number; lng: number; accuracy: number | null; heading: number | null; speed: number | null },
): void {
  db()
    .prepare(
      `INSERT INTO locations (member_id, lat, lng, accuracy, heading, speed, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(member_id) DO UPDATE SET
         lat        = excluded.lat,
         lng        = excluded.lng,
         accuracy   = excluded.accuracy,
         heading    = excluded.heading,
         speed      = excluded.speed,
         updated_at = excluded.updated_at`,
    )
    .run(memberId, loc.lat, loc.lng, loc.accuracy, loc.heading, loc.speed);
}

export interface LiveLocation {
  memberId: number;
  name: string;
  isLeader: boolean;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
  ageSec: number;
}

const LOCATION_STALE_SEC = 5 * 60;

export function listLiveLocations(convoyId: number): LiveLocation[] {
  const rows = db()
    .prepare(
      `SELECT l.member_id, l.lat, l.lng, l.accuracy, l.heading, l.speed, l.updated_at,
              m.name, m.is_leader,
              CAST((julianday('now') - julianday(l.updated_at)) * 86400 AS INTEGER) AS age_sec
         FROM locations l
         JOIN members m ON m.id = l.member_id
        WHERE m.convoy_id = ? AND m.state = 'approved'`,
    )
    .all(convoyId) as Array<
    LocationRow & { name: string; is_leader: number; age_sec: number }
  >;

  return rows
    .filter((r) => r.age_sec <= LOCATION_STALE_SEC)
    .map((r) => ({
      memberId: r.member_id,
      name: r.name,
      isLeader: r.is_leader === 1,
      lat: r.lat,
      lng: r.lng,
      accuracy: r.accuracy,
      heading: r.heading,
      speed: r.speed,
      updatedAt: r.updated_at,
      ageSec: r.age_sec,
    }));
}

export function updateConvoy(
  convoyId: number,
  fields: { title?: string; meetupAt?: string; meetupPlace?: string; destination?: string },
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.title !== undefined) {
    sets.push("title = ?");
    values.push(fields.title);
  }
  if (fields.meetupAt !== undefined) {
    sets.push("meetup_at = ?");
    values.push(fields.meetupAt);
  }
  if (fields.meetupPlace !== undefined) {
    sets.push("meetup_place = ?");
    values.push(fields.meetupPlace);
  }
  if (fields.destination !== undefined) {
    sets.push("destination = ?");
    values.push(fields.destination);
  }
  if (sets.length === 0) return;
  values.push(convoyId);
  db().prepare(`UPDATE convoys SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function setConvoyStatus(convoyId: number, status: ConvoyStatus): void {
  if (status === "closed") {
    db()
      .prepare("UPDATE convoys SET status = ?, closed_at = datetime('now') WHERE id = ?")
      .run(status, convoyId);
  } else {
    db().prepare("UPDATE convoys SET status = ? WHERE id = ?").run(status, convoyId);
  }
}

export interface PublicMember {
  id: number;
  name: string;
  state: MemberState;
  isLeader?: boolean;
}

export interface PublicConvoyView {
  code: string;
  title: string;
  meetup_at: string;
  meetup_place: string;
  destination: string;
  status: ConvoyStatus;
  pins: ConvoyPins;
  approved: PublicMember[];
  approvedCount: number;
}

export function publicViewForCode(code: string): PublicConvoyView | null {
  const convoy = getConvoyByCode(code);
  if (!convoy) return null;
  const approved = listMembers(convoy.id)
    .filter((m) => m.state === "approved")
    .map((m) => ({
      id: m.id,
      name: m.name,
      state: m.state,
      isLeader: m.is_leader === 1,
    }));
  return {
    code: convoy.code,
    title: convoy.title,
    meetup_at: convoy.meetup_at,
    meetup_place: convoy.meetup_place,
    destination: convoy.destination,
    status: convoy.status,
    pins: pinsFromRow(convoy),
    approved,
    approvedCount: approved.length,
  };
}

export interface AdminConvoyView extends PublicConvoyView {
  pending: PublicMember[];
  adminToken: string;
}

export function adminViewForToken(token: string): AdminConvoyView | null {
  const convoy = getConvoyByAdminToken(token);
  if (!convoy) return null;
  const members = listMembers(convoy.id);
  const approved = members
    .filter((m) => m.state === "approved")
    .map((m) => ({ id: m.id, name: m.name, state: m.state, isLeader: m.is_leader === 1 }));
  const pending = members
    .filter((m) => m.state === "pending")
    .map((m) => ({ id: m.id, name: m.name, state: m.state }));
  return {
    code: convoy.code,
    title: convoy.title,
    meetup_at: convoy.meetup_at,
    meetup_place: convoy.meetup_place,
    destination: convoy.destination,
    status: convoy.status,
    pins: pinsFromRow(convoy),
    approved,
    approvedCount: approved.length,
    pending,
    adminToken: convoy.admin_token,
  };
}
