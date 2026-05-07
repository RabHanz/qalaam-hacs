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

  // Playback session — one row per user. The cross-device sync layer
  // (ADR-0025) is the source of truth for "what's playing right now"
  // for this user. Devices push state via /v1/playback/command and
  // subscribe via /v1/playback/subscribe (SSE). Updated_at is millis
  // since epoch — used by the heartbeat-prune logic that drops
  // stale device rows.
  db.exec(`
    CREATE TABLE IF NOT EXISTS playback_sessions (
      user_id           TEXT PRIMARY KEY,
      verse_key         TEXT NOT NULL DEFAULT '1:1',
      reciter_slug      TEXT NOT NULL DEFAULT 'sudais',
      position_seconds  REAL NOT NULL DEFAULT 0,
      is_paused         INTEGER NOT NULL DEFAULT 1,
      target            TEXT NOT NULL DEFAULT 'local',
      active_device_id  TEXT,
      updated_at        INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playback_devices (
      device_id     TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      name          TEXT NOT NULL,
      capabilities  TEXT NOT NULL DEFAULT '[]', -- JSON array
      last_seen     INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_playback_devices_user
      ON playback_devices(user_id, last_seen DESC);

    -- API keys for non-browser clients (HA integration, MCP clients,
    -- third-party automations). Issued from the user's account page
    -- (premium-tier feature). The plaintext key is shown ONCE at mint
    -- time; only the sha256 hash is persisted. Lookups happen via the
    -- index on key_hash. ADR-0024 (license + moat) makes API-key-gated
    -- HA the canonical bridge for premium features.
    CREATE TABLE IF NOT EXISTS api_keys (
      id           TEXT PRIMARY KEY,                  -- uuid v4
      user_id      TEXT NOT NULL,
      key_hash     TEXT NOT NULL UNIQUE,              -- sha256(plaintext)
      name         TEXT NOT NULL,                     -- user-friendly label
      scopes       TEXT NOT NULL DEFAULT '["all"]',   -- JSON array of feature keys, or ["all"]
      created_at   INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at   INTEGER,                           -- non-null = revoked, soft-delete
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id, revoked_at);
  `);

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

    -- ───────────────────── family-tier (E1/E2/E5/E6) ─────────────────────
    -- Hifdh per-child plan. owner=parent, assignee=child or self. Scope is
    -- a high-level area (juz/surah/range/full) plus daily quota in pages.
    CREATE TABLE IF NOT EXISTS hifdh_plans (
      id                TEXT PRIMARY KEY,
      family_id         TEXT NOT NULL,
      owner_user_id     TEXT NOT NULL,
      assignee_user_id  TEXT NOT NULL,
      title             TEXT NOT NULL,
      scope_kind        TEXT NOT NULL,          -- juz | surah | range | full
      scope_value       TEXT,                    -- "30" | "1" | "1:1-2:286" | NULL
      daily_pages       REAL NOT NULL DEFAULT 1,
      start_date        TEXT NOT NULL,
      target_date       TEXT,
      status            TEXT NOT NULL DEFAULT 'active', -- active|paused|done|abandoned
      notes             TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (family_id)        REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_user_id)    REFERENCES users(id)    ON DELETE CASCADE,
      FOREIGN KEY (assignee_user_id) REFERENCES users(id)    ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_plans_family   ON hifdh_plans(family_id);
    CREATE INDEX IF NOT EXISTS idx_plans_assignee ON hifdh_plans(assignee_user_id, status);

    -- One row per recorded portion (sabaq/sabqi/manzil). plan_id nullable
    -- so users can record progress without a formal plan ("just reviewed").
    CREATE TABLE IF NOT EXISTS hifdh_progress (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id           TEXT,
      user_id           TEXT NOT NULL,
      reviewer_user_id  TEXT,
      date              TEXT NOT NULL,           -- YYYY-MM-DD (local to family)
      kind              TEXT NOT NULL,           -- sabaq|sabqi|manzil|review
      page_number       INTEGER,                  -- 1..604 (madani_15)
      verses_completed  INTEGER,
      quality           INTEGER,                  -- 1..5 parent rating, optional
      notes             TEXT,
      ts                TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES hifdh_plans(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)       ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_progress_user_date ON hifdh_progress(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_progress_plan      ON hifdh_progress(plan_id);

    -- E1: per-page mistake heatmap source. ASR + parent-mark + self-mark
    -- all funnel here. resolved=1 when followed by clean recite of the
    -- same page within 7 days.
    CREATE TABLE IF NOT EXISTS mistakes (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           TEXT NOT NULL,
      ts                TEXT NOT NULL DEFAULT (datetime('now')),
      verse_key         TEXT NOT NULL,
      page_number       INTEGER,                  -- 1..604 (madani_15)
      word_index        INTEGER,
      kind              TEXT NOT NULL,           -- skipped|wrong-word|hesitation|repeat|tajweed|self-corrected
      source            TEXT NOT NULL,           -- asr|parent-mark|self-mark
      context           TEXT,
      resolved          INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_mistakes_user_page  ON mistakes(user_id, page_number);
    CREATE INDEX IF NOT EXISTS idx_mistakes_user_verse ON mistakes(user_id, verse_key);
    CREATE INDEX IF NOT EXISTS idx_mistakes_user_ts    ON mistakes(user_id, ts);

    -- E6: family khatm — multi-user. mode=sequential keeps strict order;
    -- mode=distributed lets anyone claim any open page; mode=by-juz binds
    -- one juz to one assignee.
    CREATE TABLE IF NOT EXISTS family_khatm (
      id              TEXT PRIMARY KEY,
      family_id       TEXT NOT NULL,
      title           TEXT NOT NULL,
      mode            TEXT NOT NULL,             -- sequential|distributed|by-juz
      start_date      TEXT NOT NULL,
      target_date     TEXT,
      status          TEXT NOT NULL DEFAULT 'active', -- active|done|abandoned
      created_by      TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at     TEXT,
      FOREIGN KEY (family_id)  REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_family_khatm_family ON family_khatm(family_id, status);

    -- One row per claimed page in a family khatm. UNIQUE keeps each page
    -- single-claimed across the entire khatm.
    CREATE TABLE IF NOT EXISTS family_khatm_pages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      khatm_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      page_number     INTEGER NOT NULL,
      juz             INTEGER,
      ts              TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (khatm_id) REFERENCES family_khatm(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)  REFERENCES users(id)        ON DELETE CASCADE,
      UNIQUE (khatm_id, page_number)
    );
    CREATE INDEX IF NOT EXISTS idx_khatm_pages_khatm ON family_khatm_pages(khatm_id);
    CREATE INDEX IF NOT EXISTS idx_khatm_pages_user  ON family_khatm_pages(user_id);

    -- E5: family voice notes + praise stickers. Audio file lives on disk
    -- under data/voice-notes/<id>.<ext>; this row is the metadata.
    CREATE TABLE IF NOT EXISTS family_voice_notes (
      id              TEXT PRIMARY KEY,
      family_id       TEXT NOT NULL,
      from_user_id    TEXT NOT NULL,
      to_user_id      TEXT NOT NULL,             -- specific recipient (NOT family-wide)
      context_kind    TEXT,                       -- progress|khatm|adhoc
      context_id      TEXT,
      audio_path      TEXT,                       -- relative to data/voice-notes/; null for sticker-only
      mime_type       TEXT,
      duration_ms     INTEGER,
      transcript      TEXT,
      sticker         TEXT,                       -- subhanallah|mashaallah|alhamdulillah|jazakallah|ahsanta|baraka
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      read_at         TEXT,
      FOREIGN KEY (family_id)    REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id)    ON DELETE CASCADE,
      FOREIGN KEY (to_user_id)   REFERENCES users(id)    ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_voice_notes_family ON family_voice_notes(family_id);
    CREATE INDEX IF NOT EXISTS idx_voice_notes_to     ON family_voice_notes(to_user_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_voice_notes_from   ON family_voice_notes(from_user_id);

    -- H2 — billing/support requests. Kept minimal until Stripe wiring lands.
    -- Captures "I can't afford it" submissions + "request upgrade" leads so
    -- support can reach back manually before the payment processor is live.
    CREATE TABLE IF NOT EXISTS support_requests (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      ts           TEXT NOT NULL DEFAULT (datetime('now')),
      user_id      TEXT,
      email        TEXT,
      kind         TEXT NOT NULL,    -- 'cant-afford' | 'upgrade' | 'feedback'
      target_tier  TEXT,             -- 'premium' | 'pro' | NULL
      message      TEXT,
      handled_at   TEXT,
      handled_by   TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_support_kind_ts ON support_requests(kind, ts);
    CREATE INDEX IF NOT EXISTS idx_support_user    ON support_requests(user_id);

    -- J2 — admin/dev panel audit trail. Every admin action (tier
    -- bump, minor flag toggle, support resolve, etc.) writes a row
    -- here so we have a tamper-evident log of who-did-what-when. The
    -- panel surfaces this as a tail-feed.
    CREATE TABLE IF NOT EXISTS admin_audit (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      ts              TEXT NOT NULL DEFAULT (datetime('now')),
      actor_user_id   TEXT NOT NULL,    -- admin who took the action
      action          TEXT NOT NULL,    -- 'user.tier' | 'user.minor' | 'support.resolve' | …
      target_user_id  TEXT,             -- user the action was on (NULL for system-wide)
      payload_json    TEXT,             -- before/after, free-form context
      FOREIGN KEY (actor_user_id)  REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_audit_ts          ON admin_audit(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_actor       ON admin_audit(actor_user_id, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_target_user ON admin_audit(target_user_id, ts DESC);
  `);

  // Soft migration: backfill is_shadow column on users so parents can
  // create child profiles without their own login. Only runs if the
  // column doesn't yet exist.
  const cols = (db.prepare("PRAGMA table_info('users')").all() as { name: string }[]).map(
    (r) => r.name,
  );
  if (!cols.includes('is_shadow')) {
    db.exec('ALTER TABLE users ADD COLUMN is_shadow INTEGER NOT NULL DEFAULT 0');
  }
  if (!cols.includes('avatar_color')) {
    // hex without leading # — used by avatar circles to differentiate
    // family members in the picker. Picked from a 6-color palette.
    db.exec('ALTER TABLE users ADD COLUMN avatar_color TEXT');
  }
  if (!cols.includes('ha_url')) {
    // User-set Home Assistant URL — surfaces in Cast/SendToPicker for
    // Premium+ tiers. Storing per-user lets households keep their HA
    // address private and lets us tier-gate the integration cleanly.
    db.exec('ALTER TABLE users ADD COLUMN ha_url TEXT');
  }
  // J5 Stripe — billing fields. Soft-migration so existing users
  // keep working without a backfill. NULL when the user has never
  // started a checkout flow; populated by the webhook handler on
  // checkout.session.completed and customer.subscription.updated.
  if (!cols.includes('stripe_customer_id')) {
    db.exec('ALTER TABLE users ADD COLUMN stripe_customer_id TEXT');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL',
    );
  }
  if (!cols.includes('stripe_subscription_id')) {
    db.exec('ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL',
    );
  }
  if (!cols.includes('billing_status')) {
    // 'active' | 'past_due' | 'canceled' | 'incomplete' | etc — mirrors
    // Stripe's subscription.status enum so we can render a small status
    // pill in /settings without re-deriving from event history.
    db.exec('ALTER TABLE users ADD COLUMN billing_status TEXT');
  }

  cached = db;
  return db;
}
