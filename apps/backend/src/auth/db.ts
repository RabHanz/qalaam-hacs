/**
 * Auth database — separate sqlite from `data/qul.sqlite`.
 *
 * `qul.sqlite` is read-only Quran data (verses, layouts, recitations,
 * tafsirs, etc.) — we open it `readonly: true` everywhere. Mixing
 * write-heavy auth tables there would invalidate that invariant and
 * complicate ingest scripts.
 *
 * Auth lives at `data/qalaam.sqlite` instead, with users + sessions +
 * families. Schema is created idempotently on first open.
 *
 * Self-host friendly: a single sqlite file means no external Postgres
 * + no ops burden for users self-hosting Qalaam at home (the dominant
 * deploy mode per ADR-0003 + the family-private design).
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';

let cached: DB | undefined;

export function authDb(): DB {
  if (cached) return cached;
  // Path defaults to data/qalaam.sqlite alongside the canonical
  // qul.sqlite. Override via env for unit-test isolation.
  const file =
    process.env.QALAAM_AUTH_SQLITE_PATH ?? path.resolve(process.cwd(), 'data', 'qalaam.sqlite');
  const dir = path.dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new Database(file);
  // Pragmas — safe defaults, write-heavy workload.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Schema. Created idempotently — safe to call on every boot.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,           -- uuid v4
      email         TEXT NOT NULL UNIQUE,        -- lowercased before insert
      password_hash TEXT NOT NULL,               -- scrypt N=16384 r=8 p=1
      display_name  TEXT,
      tier          TEXT NOT NULL DEFAULT 'free',
      is_minor      INTEGER NOT NULL DEFAULT 0,  -- 0/1
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email)
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,           -- 64-char hex (32 random bytes)
      user_id       TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at    TEXT NOT NULL,
      user_agent    TEXT,
      ip            TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS families (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      created_by      TEXT NOT NULL,
      max_seats       INTEGER NOT NULL DEFAULT 6,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id                    TEXT PRIMARY KEY,
      family_id             TEXT NOT NULL,
      user_id               TEXT NOT NULL,
      role                  TEXT NOT NULL,         -- guardian | member | child
      display_name          TEXT,
      joined_at             TEXT NOT NULL DEFAULT (datetime('now')),
      consent_share_stats   INTEGER NOT NULL DEFAULT 1,  -- 0/1
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)   REFERENCES users(id)    ON DELETE CASCADE,
      UNIQUE (family_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);

    -- A7 bookmarks/highlights/notes — auth-gated, server-side. Created
    -- here because they're per-user and want the same WAL/journal as
    -- the rest of the auth state.
    CREATE TABLE IF NOT EXISTS bookmarks (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      verse_key       TEXT NOT NULL,
      kind            TEXT NOT NULL,                 -- bookmark | highlight | note
      color           TEXT,                          -- highlight color slug
      note            TEXT,                          -- markdown for kind=note
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_user_verse
      ON bookmarks(user_id, verse_key);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user_kind
      ON bookmarks(user_id, kind);

    -- Auth audit log — records security-significant events (sign-in,
    -- failed sign-in, sign-up, password-change, lockout). Lets us
    -- detect brute-force + show the user their recent activity. Keep
    -- forever; volume is tiny relative to the QUL data.
    CREATE TABLE IF NOT EXISTS auth_audit (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ts          TEXT NOT NULL DEFAULT (datetime('now')),
      kind        TEXT NOT NULL,             -- signin_ok | signin_fail | signup | signout | locked
      email       TEXT,                       -- lowercased; nullable for anonymous events
      user_id     TEXT,                       -- nullable for failed signins
      ip          TEXT,
      user_agent  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_auth_audit_email_ts
      ON auth_audit(email, ts);
    CREATE INDEX IF NOT EXISTS idx_auth_audit_ip_ts
      ON auth_audit(ip, ts);
    CREATE INDEX IF NOT EXISTS idx_auth_audit_user_ts
      ON auth_audit(user_id, ts);
  `);

  cached = db;
  return db;
}
