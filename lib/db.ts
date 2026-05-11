import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "convoy.db");

declare global {
  // eslint-disable-next-line no-var
  var __convoyDb: Database.Database | undefined;
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS convoys (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT NOT NULL UNIQUE,
      admin_token   TEXT NOT NULL UNIQUE,
      title         TEXT NOT NULL,
      meetup_at     TEXT NOT NULL,
      meetup_place  TEXT NOT NULL,
      destination   TEXT NOT NULL,
      meetup_lat    REAL,
      meetup_lng    REAL,
      dest_lat      REAL,
      dest_lng      REAL,
      status        TEXT NOT NULL DEFAULT 'planned',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS members (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      convoy_id   INTEGER NOT NULL REFERENCES convoys(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      token       TEXT NOT NULL UNIQUE,
      state       TEXT NOT NULL DEFAULT 'pending',
      is_leader   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS members_convoy_idx ON members(convoy_id);

    CREATE TABLE IF NOT EXISTS locations (
      member_id  INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      lat        REAL NOT NULL,
      lng        REAL NOT NULL,
      accuracy   REAL,
      heading    REAL,
      speed      REAL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Idempotent migration: add is_leader column on pre-existing members tables.
  const memberCols = db.prepare("PRAGMA table_info(members)").all() as Array<{ name: string }>;
  if (!memberCols.some((c) => c.name === "is_leader")) {
    db.exec("ALTER TABLE members ADD COLUMN is_leader INTEGER NOT NULL DEFAULT 0");
  }

  // Idempotent migration: add geographic pin columns to convoys.
  const convoyCols = db.prepare("PRAGMA table_info(convoys)").all() as Array<{ name: string }>;
  const have = new Set(convoyCols.map((c) => c.name));
  for (const col of ["meetup_lat", "meetup_lng", "dest_lat", "dest_lng"]) {
    if (!have.has(col)) db.exec(`ALTER TABLE convoys ADD COLUMN ${col} REAL`);
  }
}

export function db(): Database.Database {
  if (!globalThis.__convoyDb) {
    const instance = new Database(dbPath);
    init(instance);
    globalThis.__convoyDb = instance;
  }
  return globalThis.__convoyDb;
}

export type ConvoyStatus = "planned" | "active" | "closed";
export type MemberState = "pending" | "approved" | "denied" | "left";

export interface ConvoyRow {
  id: number;
  code: string;
  admin_token: string;
  title: string;
  meetup_at: string;
  meetup_place: string;
  destination: string;
  meetup_lat: number | null;
  meetup_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  status: ConvoyStatus;
  created_at: string;
  closed_at: string | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MemberRow {
  id: number;
  convoy_id: number;
  name: string;
  token: string;
  state: MemberState;
  is_leader: number;
  created_at: string;
}

export interface LocationRow {
  member_id: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}
