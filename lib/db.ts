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
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS members_convoy_idx ON members(convoy_id);
  `);
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
  status: ConvoyStatus;
  created_at: string;
  closed_at: string | null;
}

export interface MemberRow {
  id: number;
  convoy_id: number;
  name: string;
  token: string;
  state: MemberState;
  created_at: string;
}
