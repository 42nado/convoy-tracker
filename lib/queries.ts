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

export async function setPins(
  convoyId: number,
  patch: { meetup?: LatLng | null; destination?: LatLng | null },
): Promise<void> {
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
  await db().prepare(`UPDATE convoys SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}

export async function createConvoy(input: {
  title: string;
  meetupAt: string;
  meetupPlace: string;
  destination: string;
  pins?: Partial<ConvoyPins>;
}): Promise<ConvoyRow> {
  const conn = db();
  let code = newConvoyCode();
  let attempts = 0;
  while (await conn.prepare("SELECT 1 FROM convoys WHERE code = ?").bind(code).first()) {
    code = newConvoyCode();
    if (++attempts > 5) throw new Error("failed to generate unique code");
  }
  const adminToken = newSecretToken();
  const info = await conn
    .prepare(
      `INSERT INTO convoys (code, admin_token, title, meetup_at, meetup_place, destination,
                            meetup_lat, meetup_lng, dest_lat, dest_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      code, adminToken, input.title, input.meetupAt, input.meetupPlace, input.destination,
      input.pins?.meetup?.lat ?? null, input.pins?.meetup?.lng ?? null,
      input.pins?.destination?.lat ?? null, input.pins?.destination?.lng ?? null,
    )
    .run();

  const row = await conn
    .prepare("SELECT * FROM convoys WHERE id = ?")
    .bind(info.meta.last_row_id)
    .first<ConvoyRow>();
  if (!row) throw new Error("failed to read newly created convoy");
  return row;
}

export async function getConvoyByCode(code: string): Promise<ConvoyRow | null> {
  return (await db().prepare("SELECT * FROM convoys WHERE code = ?").bind(code).first<ConvoyRow>()) ?? null;
}

export async function getConvoyByAdminToken(token: string): Promise<ConvoyRow | null> {
  return (
    (await db()
      .prepare("SELECT * FROM convoys WHERE admin_token = ?")
      .bind(token)
      .first<ConvoyRow>()) ?? null
  );
}

export async function listMembers(convoyId: number): Promise<MemberRow[]> {
  const result = await db()
    .prepare("SELECT * FROM members WHERE convoy_id = ? ORDER BY created_at ASC")
    .bind(convoyId)
    .all<MemberRow>();
  return result.results;
}

export async function getMemberByToken(convoyId: number, token: string): Promise<MemberRow | null> {
  return (
    (await db()
      .prepare("SELECT * FROM members WHERE convoy_id = ? AND token = ?")
      .bind(convoyId, token)
      .first<MemberRow>()) ?? null
  );
}

export async function requestJoin(convoyId: number, name: string): Promise<MemberRow> {
  const conn = db();
  const token = newSecretToken();
  const info = await conn
    .prepare("INSERT INTO members (convoy_id, name, token, state) VALUES (?, ?, ?, 'pending')")
    .bind(convoyId, name, token)
    .run();
  const row = await conn
    .prepare("SELECT * FROM members WHERE id = ?")
    .bind(info.meta.last_row_id)
    .first<MemberRow>();
  if (!row) throw new Error("failed to read newly created member");
  return row;
}

export async function setMemberState(
  memberId: number,
  convoyId: number,
  state: MemberState,
): Promise<void> {
  await db()
    .prepare("UPDATE members SET state = ? WHERE id = ? AND convoy_id = ?")
    .bind(state, memberId, convoyId)
    .run();
}

export async function setLeader(memberId: number | null, convoyId: number): Promise<void> {
  const conn = db();
  const statements = [
    conn.prepare("UPDATE members SET is_leader = 0 WHERE convoy_id = ?").bind(convoyId),
  ];
  if (memberId !== null) {
    statements.push(
      conn
        .prepare("UPDATE members SET is_leader = 1 WHERE id = ? AND convoy_id = ?")
        .bind(memberId, convoyId),
    );
  }
  await conn.batch(statements);
}

export async function upsertLocation(
  memberId: number,
  loc: { lat: number; lng: number; accuracy: number | null; heading: number | null; speed: number | null },
): Promise<void> {
  await db()
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
    .bind(memberId, loc.lat, loc.lng, loc.accuracy, loc.heading, loc.speed)
    .run();
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

export async function listLiveLocations(convoyId: number): Promise<LiveLocation[]> {
  type LiveLocationRow = LocationRow & { name: string; is_leader: number; age_sec: number };
  const result = await db()
    .prepare(
      `SELECT l.member_id, l.lat, l.lng, l.accuracy, l.heading, l.speed, l.updated_at,
              m.name, m.is_leader,
              CAST((julianday('now') - julianday(l.updated_at)) * 86400 AS INTEGER) AS age_sec
         FROM locations l
         JOIN members m ON m.id = l.member_id
        WHERE m.convoy_id = ? AND m.state = 'approved'`,
    )
    .bind(convoyId)
    .all<LiveLocationRow>();

  return result.results
    .filter((row) => row.age_sec <= LOCATION_STALE_SEC)
    .map((row) => ({
      memberId: row.member_id,
      name: row.name,
      isLeader: row.is_leader === 1,
      lat: row.lat,
      lng: row.lng,
      accuracy: row.accuracy,
      heading: row.heading,
      speed: row.speed,
      updatedAt: row.updated_at,
      ageSec: row.age_sec,
    }));
}

export async function updateConvoy(
  convoyId: number,
  fields: { title?: string; meetupAt?: string; meetupPlace?: string; destination?: string },
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
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
  await db().prepare(`UPDATE convoys SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}

export async function setConvoyStatus(convoyId: number, status: ConvoyStatus): Promise<void> {
  if (status === "closed") {
    await db()
      .prepare("UPDATE convoys SET status = ?, closed_at = datetime('now') WHERE id = ?")
      .bind(status, convoyId)
      .run();
  } else {
    await db().prepare("UPDATE convoys SET status = ? WHERE id = ?").bind(status, convoyId).run();
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

export async function publicViewForCode(code: string): Promise<PublicConvoyView | null> {
  const convoy = await getConvoyByCode(code);
  if (!convoy) return null;
  const approved = (await listMembers(convoy.id))
    .filter((member) => member.state === "approved")
    .map((member) => ({
      id: member.id,
      name: member.name,
      state: member.state,
      isLeader: member.is_leader === 1,
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

export async function adminViewForToken(token: string): Promise<AdminConvoyView | null> {
  const convoy = await getConvoyByAdminToken(token);
  if (!convoy) return null;
  const members = await listMembers(convoy.id);
  const approved = members
    .filter((member) => member.state === "approved")
    .map((member) => ({
      id: member.id,
      name: member.name,
      state: member.state,
      isLeader: member.is_leader === 1,
    }));
  const pending = members
    .filter((member) => member.state === "pending")
    .map((member) => ({ id: member.id, name: member.name, state: member.state }));
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
