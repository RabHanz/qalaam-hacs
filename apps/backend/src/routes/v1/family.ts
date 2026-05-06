/**
 * /v1/family/* — family membership + dashboard.
 *
 * Endpoints:
 *   GET    /v1/family                  — current user's family + members + my role
 *   POST   /v1/family/members          — add a child profile (parent only)
 *   PATCH  /v1/family/members/:id      — rename / change avatar (parent or self)
 *   DELETE /v1/family/members/:id      — remove a member (parent only)
 *   GET    /v1/family/dashboard        — per-member 7-day stats (parent view)
 *
 * Child profiles are "shadow users" — `users.is_shadow = 1`. They have
 * NULL email + password and can only sign in via parent device profile-
 * picker (a future "claim account" flow promotes them to real users).
 *
 * The auto-Family that signup created has the user as `role = guardian`.
 */
import { randomUUID } from 'node:crypto';

import { authDb } from '../../auth/db.js';
import { requireUser } from '../../auth/require-user.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface FamilyMemberRow {
  id: string;
  family_id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  joined_at: string;
  consent_share_stats: number;
}

interface UserMiniRow {
  id: string;
  email: string | null;
  display_name: string | null;
  is_shadow: number;
  is_minor: number;
  avatar_color: string | null;
}

const AVATAR_PALETTE = ['c8a04a', '6b8e8a', 'a35a3b', '4a6b8a', '8a6b4a', '6b4a8a'] as const;
const VALID_ROLES = new Set(['guardian', 'member', 'child']);

function pickAvatarColor(takenColors: readonly string[]): string {
  const set = new Set(takenColors);
  for (const c of AVATAR_PALETTE) {
    if (!set.has(c)) return c;
  }
  // All used — pick one deterministically by takenCount mod len.
  return AVATAR_PALETTE[takenColors.length % AVATAR_PALETTE.length] ?? 'c8a04a';
}

interface FamilyRow {
  id: string;
  name: string;
  created_by: string;
  max_seats: number;
}

function loadFamily(userId: string): FamilyRow | null {
  const db = authDb();
  return (
    (db
      .prepare(
        `SELECT f.id, f.name, f.created_by, f.max_seats
           FROM families f
           JOIN family_members fm ON fm.family_id = f.id
          WHERE fm.user_id = ?
          ORDER BY fm.joined_at ASC
          LIMIT 1`,
      )
      .get(userId) as FamilyRow | undefined) ?? null
  );
}

function loadMembers(familyId: string): {
  member: FamilyMemberRow;
  user: UserMiniRow;
}[] {
  return authDb()
    .prepare(
      `SELECT fm.id              AS m_id,
              fm.family_id       AS m_family_id,
              fm.user_id         AS m_user_id,
              fm.role            AS m_role,
              fm.display_name    AS m_display_name,
              fm.joined_at       AS m_joined_at,
              fm.consent_share_stats AS m_consent,
              u.id               AS u_id,
              u.email            AS u_email,
              u.display_name     AS u_display_name,
              u.is_shadow        AS u_is_shadow,
              u.is_minor         AS u_is_minor,
              u.avatar_color     AS u_avatar_color
         FROM family_members fm
         JOIN users u ON u.id = fm.user_id
        WHERE fm.family_id = ?
          AND u.deleted_at IS NULL
        ORDER BY fm.joined_at ASC`,
    )
    .all(familyId)
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        member: {
          id: row.m_id as string,
          family_id: row.m_family_id as string,
          user_id: row.m_user_id as string,
          role: row.m_role as string,
          display_name: (row.m_display_name as string | null) ?? null,
          joined_at: row.m_joined_at as string,
          consent_share_stats: row.m_consent as number,
        },
        user: {
          id: row.u_id as string,
          email: (row.u_email as string | null) ?? null,
          display_name: (row.u_display_name as string | null) ?? null,
          is_shadow: row.u_is_shadow as number,
          is_minor: row.u_is_minor as number,
          avatar_color: (row.u_avatar_color as string | null) ?? null,
        },
      };
    });
}

function isGuardian(familyId: string, userId: string): boolean {
  const r = authDb()
    .prepare(`SELECT role FROM family_members WHERE family_id = ? AND user_id = ?`)
    .get(familyId, userId) as { role: string } | undefined;
  return r?.role === 'guardian';
}

function memberJson(m: { member: FamilyMemberRow; user: UserMiniRow }): {
  memberId: string;
  userId: string;
  role: string;
  displayName: string;
  email: string | null;
  isShadow: boolean;
  isMinor: boolean;
  avatarColor: string | null;
  joinedAt: string;
} {
  return {
    memberId: m.member.id,
    userId: m.user.id,
    role: m.member.role,
    displayName: m.member.display_name ?? m.user.display_name ?? m.user.email ?? 'Member',
    email: m.user.email,
    isShadow: m.user.is_shadow === 1,
    isMinor: m.user.is_minor === 1,
    avatarColor: m.user.avatar_color,
    joinedAt: m.member.joined_at,
  };
}

interface CreateMemberBody {
  displayName?: string;
  isMinor?: boolean;
  role?: string;
}

interface PatchMemberBody {
  displayName?: string | null;
  avatarColor?: string | null;
  consentShareStats?: boolean;
}

export async function familyRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /v1/family
  fastify.get(
    '/v1/family',
    { schema: { description: "Current user's family + members.", tags: ['family'] } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const family = loadFamily(user.id);
      if (!family) {
        void reply.code(404).send({ code: 'qalaam.family.not-found' });
        return;
      }
      const members = loadMembers(family.id);
      const myRow = members.find((m) => m.user.id === user.id);
      void reply.send({
        family: {
          id: family.id,
          name: family.name,
          maxSeats: family.max_seats,
        },
        myRole: myRow?.member.role ?? 'member',
        members: members.map(memberJson),
      });
    },
  );

  // POST /v1/family/members — guardian creates a child shadow profile.
  fastify.post(
    '/v1/family/members',
    {
      schema: {
        description: 'Create a child profile (shadow user) in the family.',
        tags: ['family'],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const family = loadFamily(user.id);
      if (!family) {
        void reply.code(404).send({ code: 'qalaam.family.not-found' });
        return;
      }
      if (!isGuardian(family.id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.family.not-guardian' });
        return;
      }
      const body = (req.body ?? {}) as CreateMemberBody;
      const displayName = (body.displayName ?? '').trim();
      if (displayName.length < 1 || displayName.length > 80) {
        void reply.code(400).send({ code: 'qalaam.family.bad-name' });
        return;
      }
      const role = body.role ?? 'child';
      if (!VALID_ROLES.has(role)) {
        void reply.code(400).send({ code: 'qalaam.family.bad-role' });
        return;
      }
      const isMinor = body.isMinor !== false;
      const db = authDb();
      const existing = loadMembers(family.id);
      if (existing.length >= family.max_seats) {
        void reply.code(403).send({ code: 'qalaam.family.seat-limit' });
        return;
      }
      const takenColors = existing
        .map((m) => m.user.avatar_color)
        .filter((c): c is string => typeof c === 'string');
      const avatarColor = pickAvatarColor(takenColors);
      const newUserId = randomUUID();
      const newMemberId = randomUUID();
      // Shadow user — no email/password. is_shadow=1 marks them.
      // Email is nullable on shadow rows; we use a synthetic placeholder
      // to satisfy the UNIQUE NOT NULL constraint without colliding.
      const placeholderEmail = `shadow+${newUserId}@qalaam.local`;
      db.prepare(
        `INSERT INTO users (id, email, password_hash, display_name, tier, is_minor, is_shadow, avatar_color)
         VALUES (?, ?, '', ?, 'free', ?, 1, ?)`,
      ).run(newUserId, placeholderEmail, displayName, isMinor ? 1 : 0, avatarColor);
      db.prepare(
        `INSERT INTO family_members (id, family_id, user_id, role, display_name)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(newMemberId, family.id, newUserId, role, displayName);
      void reply.code(201).send({
        member: memberJson({
          member: {
            id: newMemberId,
            family_id: family.id,
            user_id: newUserId,
            role,
            display_name: displayName,
            joined_at: new Date().toISOString(),
            consent_share_stats: 1,
          },
          user: {
            id: newUserId,
            email: null,
            display_name: displayName,
            is_shadow: 1,
            is_minor: isMinor ? 1 : 0,
            avatar_color: avatarColor,
          },
        }),
      });
    },
  );

  // PATCH /v1/family/members/:id
  fastify.patch<{ Params: { id: string } }>(
    '/v1/family/members/:id',
    { schema: { tags: ['family'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const family = loadFamily(user.id);
      if (!family) {
        void reply.code(404).send({ code: 'qalaam.family.not-found' });
        return;
      }
      const memberId = req.params.id;
      const db = authDb();
      const target = db
        .prepare(
          `SELECT id, family_id, user_id, role
             FROM family_members
            WHERE id = ?`,
        )
        .get(memberId) as
        | { id: string; family_id: string; user_id: string; role: string }
        | undefined;
      if (target?.family_id !== family.id) {
        void reply.code(404).send({ code: 'qalaam.family.member-not-found' });
        return;
      }
      const guardian = isGuardian(family.id, user.id);
      if (!guardian && target.user_id !== user.id) {
        void reply.code(403).send({ code: 'qalaam.family.forbidden' });
        return;
      }
      const body = (req.body ?? {}) as PatchMemberBody;
      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      if (body.displayName !== undefined) {
        const trimmed = body.displayName === null ? null : body.displayName.trim();
        if (trimmed !== null && (trimmed.length < 1 || trimmed.length > 80)) {
          void reply.code(400).send({ code: 'qalaam.family.bad-name' });
          return;
        }
        sets.push('display_name = ?');
        args.push(trimmed);
      }
      if (body.consentShareStats !== undefined) {
        sets.push('consent_share_stats = ?');
        args.push(body.consentShareStats ? 1 : 0);
      }
      if (sets.length > 0) {
        args.push(memberId);
        db.prepare(`UPDATE family_members SET ${sets.join(', ')} WHERE id = ?`).run(...args);
      }
      if (body.avatarColor !== undefined) {
        db.prepare(`UPDATE users SET avatar_color = ? WHERE id = ?`).run(
          body.avatarColor === null ? null : body.avatarColor.replace(/^#/, ''),
          target.user_id,
        );
      }
      if (body.displayName !== undefined && body.displayName !== null) {
        // Mirror onto users.display_name for shadow users so dashboards
        // pick up the name change without a join.
        db.prepare(`UPDATE users SET display_name = ? WHERE id = ?`).run(
          body.displayName.trim(),
          target.user_id,
        );
      }
      const refreshed = loadMembers(family.id).find((m) => m.member.id === memberId);
      if (!refreshed) {
        void reply.code(404).send({ code: 'qalaam.family.member-not-found' });
        return;
      }
      void reply.send({ member: memberJson(refreshed) });
    },
  );

  // DELETE /v1/family/members/:id
  fastify.delete<{ Params: { id: string } }>(
    '/v1/family/members/:id',
    { schema: { tags: ['family'] } },
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;
      const family = loadFamily(user.id);
      if (!family) {
        void reply.code(404).send({ code: 'qalaam.family.not-found' });
        return;
      }
      if (!isGuardian(family.id, user.id)) {
        void reply.code(403).send({ code: 'qalaam.family.not-guardian' });
        return;
      }
      const memberId = req.params.id;
      const db = authDb();
      const target = db
        .prepare(`SELECT user_id, role FROM family_members WHERE id = ? AND family_id = ?`)
        .get(memberId, family.id) as { user_id: string; role: string } | undefined;
      if (!target) {
        void reply.code(404).send({ code: 'qalaam.family.member-not-found' });
        return;
      }
      if (target.user_id === user.id) {
        // Guardians can't remove themselves — they'd orphan the family.
        void reply.code(409).send({ code: 'qalaam.family.cannot-remove-self' });
        return;
      }
      // Hard-delete the family_members row + (if shadow) the underlying user.
      const isShadow = (
        db.prepare(`SELECT is_shadow FROM users WHERE id = ?`).get(target.user_id) as
          | { is_shadow: number }
          | undefined
      )?.is_shadow;
      db.prepare(`DELETE FROM family_members WHERE id = ?`).run(memberId);
      if (isShadow === 1) {
        db.prepare(`DELETE FROM users WHERE id = ? AND is_shadow = 1`).run(target.user_id);
      }
      void reply.code(204).send();
    },
  );

  // GET /v1/family/dashboard — 7-day per-member stats (parent overview).
  fastify.get('/v1/family/dashboard', { schema: { tags: ['family'] } }, async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const family = loadFamily(user.id);
    if (!family) {
      void reply.code(404).send({ code: 'qalaam.family.not-found' });
      return;
    }
    const db = authDb();
    const members = loadMembers(family.id);
    const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const rows = members.map((m) => {
      const portionsRow = db
        .prepare(
          `SELECT COUNT(*) AS c
               FROM hifdh_progress
              WHERE user_id = ?
                AND date >= ?`,
        )
        .get(m.user.id, sinceIso) as { c: number };
      const lastRow = db
        .prepare(
          `SELECT date AS d FROM hifdh_progress
              WHERE user_id = ?
              ORDER BY ts DESC LIMIT 1`,
        )
        .get(m.user.id) as { d: string } | undefined;
      const planRow = db
        .prepare(
          `SELECT id, title, daily_pages, scope_kind, scope_value
               FROM hifdh_plans
              WHERE assignee_user_id = ? AND status = 'active'
              ORDER BY updated_at DESC
              LIMIT 1`,
        )
        .get(m.user.id) as
        | {
            id: string;
            title: string;
            daily_pages: number;
            scope_kind: string;
            scope_value: string | null;
          }
        | undefined;
      const mistakesRow = db
        .prepare(
          `SELECT COUNT(*) AS c
               FROM mistakes
              WHERE user_id = ?
                AND ts >= datetime('now', '-7 days')
                AND resolved = 0`,
        )
        .get(m.user.id) as { c: number };
      return {
        ...memberJson(m),
        portionsLast7: portionsRow.c,
        lastSessionDate: lastRow?.d ?? null,
        openMistakes: mistakesRow.c,
        activePlan: planRow
          ? {
              id: planRow.id,
              title: planRow.title,
              dailyPages: planRow.daily_pages,
              scopeKind: planRow.scope_kind,
              scopeValue: planRow.scope_value,
            }
          : null,
      };
    });
    void reply.send({
      family: { id: family.id, name: family.name },
      windowDays: 7,
      members: rows,
    });
  });
}
