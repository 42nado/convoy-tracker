import { db, type ConvoyRow, type MemberRow, type ConvoyStatus, type MemberState } from "./db";
import { newConvoyCode, newSecretToken } from "./ids";

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
}

export interface PublicConvoyView {
  code: string;
  title: string;
  meetup_at: string;
  meetup_place: string;
  destination: string;
  status: ConvoyStatus;
  approved: PublicMember[];
  approvedCount: number;
}

export function publicViewForCode(code: string): PublicConvoyView | null {
  const convoy = getConvoyByCode(code);
  if (!convoy) return null;
  const approved = listMembers(convoy.id)
    .filter((m) => m.state === "approved")
    .map((m) => ({ id: m.id, name: m.name, state: m.state }));
  return {
    code: convoy.code,
    title: convoy.title,
    meetup_at: convoy.meetup_at,
    meetup_place: convoy.meetup_place,
    destination: convoy.destination,
    status: convoy.status,
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
    .map((m) => ({ id: m.id, name: m.name, state: m.state }));
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
    approved,
    approvedCount: approved.length,
    pending,
    adminToken: convoy.admin_token,
  };
}
