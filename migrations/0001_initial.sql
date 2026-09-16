CREATE TABLE convoys (
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

CREATE TABLE members (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  convoy_id   INTEGER NOT NULL REFERENCES convoys(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  state       TEXT NOT NULL DEFAULT 'pending',
  is_leader   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX members_convoy_idx ON members(convoy_id);

CREATE TABLE locations (
  member_id  INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  lat        REAL NOT NULL,
  lng        REAL NOT NULL,
  accuracy   REAL,
  heading    REAL,
  speed      REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
