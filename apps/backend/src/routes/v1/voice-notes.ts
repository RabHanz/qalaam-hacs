/**
 * /v1/voice-notes/* — family voice notes + praise stickers (E5).
 *
 * Endpoints:
 *   POST   /v1/voice-notes               — send (audio b64 + sticker, recipient)
 *   GET    /v1/voice-notes               — combined inbox + sent
 *   GET    /v1/voice-notes/:id/audio     — stream audio bytes (auth-gated)
 *   POST   /v1/voice-notes/:id/read      — mark read
 *   DELETE /v1/voice-notes/:id           — sender or recipient
 *
 * Uploads use base64 in JSON to avoid pulling in @fastify/multipart for
 * a single endpoint (audio clips are ≤2MB → base64 overhead negligible).
 * Audio bytes land in `data/voice-notes/<id>.<ext>`. Each clip is
 * capped at 4MB pre-base64 (≈3MB raw) to keep the SQLite row + disk
 * usage small.
 *
 * Adab note: stickers are explicit Islamic encouragement phrases —
 * Subhan-Allah / Masha-Allah / Alhamdulillah / Jazak-Allah / Ahsanta /
 * Baraka. NOT trophy/XP semantics — they are mutual du'a and praise.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { authDb } from '../../auth/db.js';
import { requireFeature } from '../../auth/features.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const VALID_STICKERS = new Set([
  'subhanallah',
  'mashaallah',
  'alhamdulillah',
  'jazakallah',
  'ahsanta',
  'baraka',
]);
const VALID_CONTEXTS = new Set(['progress', 'khatm', 'adhoc']);
// 4MB pre-base64 keeps the wire payload under ~5.4MB; raw audio that
// fits ≈90 seconds at 32kbps webm — plenty for voice notes.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Map<string, string>([
  ['audio/webm', '.webm'],
  ['audio/ogg', '.ogg'],
  ['audio/mpeg', '.mp3'],
  ['audio/mp3', '.mp3'],
  ['audio/m4a', '.m4a'],
  ['audio/mp4', '.m4a'],
  ['audio/aac', '.aac'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
]);

interface VoiceNoteRow {
  id: string;
  family_id: string;
  from_user_id: string;
  to_user_id: string;
  context_kind: string | null;
  context_id: string | null;
  audio_path: string | null;
  mime_type: string | null;
  duration_ms: number | null;
  transcript: string | null;
  sticker: string | null;
  created_at: string;
  read_at: string | null;
}

interface CreateBody {
  toUserId?: string;
  contextKind?: string;
  contextId?: string;
  audioBase64?: string;
  mimeType?: string;
  durationMs?: number;
  transcript?: string;
  sticker?: string;
}

function familyOf(userId: string): string | null {
  const r = authDb()
    .prepare(
      `SELECT family_id FROM family_members WHERE user_id = ?
       ORDER BY joined_at ASC LIMIT 1`,
    )
    .get(userId) as { family_id: string } | undefined;
  return r?.family_id ?? null;
}

function isInFamily(familyId: string, userId: string): boolean {
  const r = authDb()
    .prepare(`SELECT 1 AS x FROM family_members WHERE family_id = ? AND user_id = ?`)
    .get(familyId, userId) as { x: number } | undefined;
  return r !== undefined;
}

function notePath(audioRoot: string, audioPath: string | null): string | null {
  if (!audioPath) return null;
  // Audio path is stored relative; resolve against root and refuse any
  // attempt to escape (defense-in-depth — we control the input but a
  // future migration could break the assumption).
  const abs = path.resolve(audioRoot, audioPath);
  if (!abs.startsWith(path.resolve(audioRoot))) return null;
  return abs;
}

function rowToJson(r: VoiceNoteRow): Record<string, unknown> {
  return {
    id: r.id,
    familyId: r.family_id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    contextKind: r.context_kind,
    contextId: r.context_id,
    hasAudio: r.audio_path !== null,
    mimeType: r.mime_type,
    durationMs: r.duration_ms,
    transcript: r.transcript,
    sticker: r.sticker,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

function audioRoot(): string {
  const root =
    process.env.QALAAM_VOICE_NOTES_DIR ?? path.resolve(process.cwd(), 'data', 'voice-notes');
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

export async function voiceNotesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/v1/voice-notes',
    {
      schema: {
        description: 'Send a voice note + sticker to a family member.',
        tags: ['voice-notes'],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = requireFeature(req, reply, 'family.voice-notes');
      if (!user) return;
      const familyId = familyOf(user.id);
      if (!familyId) {
        void reply.code(404).send({ code: 'qalaam.family.not-found' });
        return;
      }
      const body = (req.body ?? {}) as CreateBody;
      const toUserId = body.toUserId;
      if (typeof toUserId !== 'string' || toUserId.length < 1) {
        void reply.code(400).send({ code: 'qalaam.voice-note.bad-recipient' });
        return;
      }
      if (!isInFamily(familyId, toUserId)) {
        void reply.code(400).send({ code: 'qalaam.voice-note.recipient-not-in-family' });
        return;
      }
      if (toUserId === user.id) {
        void reply.code(400).send({ code: 'qalaam.voice-note.cannot-self-send' });
        return;
      }
      const sticker = body.sticker ?? null;
      if (sticker !== null && !VALID_STICKERS.has(sticker)) {
        void reply.code(400).send({ code: 'qalaam.voice-note.bad-sticker' });
        return;
      }
      const contextKind = body.contextKind ?? null;
      if (contextKind !== null && !VALID_CONTEXTS.has(contextKind)) {
        void reply.code(400).send({ code: 'qalaam.voice-note.bad-context-kind' });
        return;
      }
      // At least one of audio + sticker required.
      if (
        sticker === null &&
        (typeof body.audioBase64 !== 'string' || body.audioBase64.length === 0)
      ) {
        void reply.code(400).send({ code: 'qalaam.voice-note.empty' });
        return;
      }
      let audioPath: string | null = null;
      let mimeType: string | null = null;
      let durationMs: number | null = null;
      if (typeof body.audioBase64 === 'string' && body.audioBase64.length > 0) {
        const mt = (body.mimeType ?? '').toLowerCase();
        const ext = ALLOWED_MIME.get(mt);
        if (!ext) {
          void reply.code(400).send({ code: 'qalaam.voice-note.bad-mime' });
          return;
        }
        const stripped = body.audioBase64.replace(/^data:[^,]+,/, '');
        let bytes: Buffer;
        try {
          bytes = Buffer.from(stripped, 'base64');
        } catch {
          void reply.code(400).send({ code: 'qalaam.voice-note.bad-audio' });
          return;
        }
        if (bytes.length === 0) {
          void reply.code(400).send({ code: 'qalaam.voice-note.bad-audio' });
          return;
        }
        if (bytes.length > MAX_AUDIO_BYTES) {
          void reply.code(413).send({ code: 'qalaam.voice-note.audio-too-large' });
          return;
        }
        const id = randomUUID();
        const root = audioRoot();
        const filename = `${id}${ext}`;
        const abs = path.resolve(root, filename);
        writeFileSync(abs, bytes);
        audioPath = filename;
        mimeType = mt;
        if (
          typeof body.durationMs === 'number' &&
          body.durationMs > 0 &&
          body.durationMs < 5 * 60_000
        ) {
          durationMs = Math.round(body.durationMs);
        }
        // Insert the row using the same id so the file and metadata are
        // tied 1:1.
        authDb()
          .prepare(
            `INSERT INTO family_voice_notes
               (id, family_id, from_user_id, to_user_id, context_kind, context_id,
                audio_path, mime_type, duration_ms, transcript, sticker)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            familyId,
            user.id,
            toUserId,
            contextKind,
            body.contextId ?? null,
            audioPath,
            mimeType,
            durationMs,
            body.transcript ?? null,
            sticker,
          );
        const row = authDb().prepare(`SELECT * FROM family_voice_notes WHERE id = ?`).get(id) as
          | VoiceNoteRow
          | undefined;
        if (!row) {
          void reply.code(500).send({ code: 'qalaam.voice-note.create-failed' });
          return;
        }
        void reply.code(201).send({ note: rowToJson(row) });
        return;
      }
      // Sticker-only path (no audio).
      const id = randomUUID();
      authDb()
        .prepare(
          `INSERT INTO family_voice_notes
             (id, family_id, from_user_id, to_user_id, context_kind, context_id,
              transcript, sticker)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          familyId,
          user.id,
          toUserId,
          contextKind,
          body.contextId ?? null,
          body.transcript ?? null,
          sticker,
        );
      const row = authDb().prepare(`SELECT * FROM family_voice_notes WHERE id = ?`).get(id) as
        | VoiceNoteRow
        | undefined;
      if (!row) {
        void reply.code(500).send({ code: 'qalaam.voice-note.create-failed' });
        return;
      }
      void reply.code(201).send({ note: rowToJson(row) });
    },
  );

  fastify.get<{ Querystring: { box?: string; limit?: string } }>(
    '/v1/voice-notes',
    { schema: { tags: ['voice-notes'] } },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'family.voice-notes');
      if (!user) return;
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit ?? '50', 10) || 50, 1), 200);
      const box = req.query.box ?? 'all';
      let where = '(to_user_id = ? OR from_user_id = ?)';
      const args: (string | number)[] = [user.id, user.id];
      if (box === 'inbox') {
        where = 'to_user_id = ?';
        args.length = 0;
        args.push(user.id);
      } else if (box === 'sent') {
        where = 'from_user_id = ?';
        args.length = 0;
        args.push(user.id);
      } else if (box === 'unread') {
        where = 'to_user_id = ? AND read_at IS NULL';
        args.length = 0;
        args.push(user.id);
      }
      args.push(limit);
      const rows = authDb()
        .prepare(
          `SELECT * FROM family_voice_notes
            WHERE ${where}
            ORDER BY created_at DESC
            LIMIT ?`,
        )
        .all(...args) as VoiceNoteRow[];
      void reply.send({ notes: rows.map(rowToJson) });
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/v1/voice-notes/:id/audio',
    { schema: { tags: ['voice-notes'] } },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'family.voice-notes');
      if (!user) return;
      const row = authDb()
        .prepare(`SELECT * FROM family_voice_notes WHERE id = ?`)
        .get(req.params.id) as VoiceNoteRow | undefined;
      if (!row) {
        void reply.code(404).send({ code: 'qalaam.voice-note.not-found' });
        return;
      }
      if (row.to_user_id !== user.id && row.from_user_id !== user.id) {
        void reply.code(403).send({ code: 'qalaam.voice-note.forbidden' });
        return;
      }
      const abs = notePath(audioRoot(), row.audio_path);
      if (!abs || !existsSync(abs)) {
        void reply.code(404).send({ code: 'qalaam.voice-note.audio-missing' });
        return;
      }
      const bytes = readFileSync(abs);
      void reply.header('content-type', row.mime_type ?? 'audio/webm');
      void reply.header('cache-control', 'private, max-age=31536000, immutable');
      void reply.send(bytes);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/v1/voice-notes/:id/read',
    { schema: { tags: ['voice-notes'] } },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'family.voice-notes');
      if (!user) return;
      const row = authDb()
        .prepare(`SELECT to_user_id FROM family_voice_notes WHERE id = ?`)
        .get(req.params.id) as { to_user_id: string } | undefined;
      if (!row) {
        void reply.code(404).send({ code: 'qalaam.voice-note.not-found' });
        return;
      }
      if (row.to_user_id !== user.id) {
        void reply.code(403).send({ code: 'qalaam.voice-note.forbidden' });
        return;
      }
      authDb()
        .prepare(`UPDATE family_voice_notes SET read_at = datetime('now') WHERE id = ?`)
        .run(req.params.id);
      void reply.code(204).send();
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/v1/voice-notes/:id',
    { schema: { tags: ['voice-notes'] } },
    async (req, reply) => {
      const user = requireFeature(req, reply, 'family.voice-notes');
      if (!user) return;
      const row = authDb()
        .prepare(`SELECT * FROM family_voice_notes WHERE id = ?`)
        .get(req.params.id) as VoiceNoteRow | undefined;
      if (!row) {
        void reply.code(404).send({ code: 'qalaam.voice-note.not-found' });
        return;
      }
      if (row.to_user_id !== user.id && row.from_user_id !== user.id) {
        void reply.code(403).send({ code: 'qalaam.voice-note.forbidden' });
        return;
      }
      const abs = notePath(audioRoot(), row.audio_path);
      authDb().prepare(`DELETE FROM family_voice_notes WHERE id = ?`).run(row.id);
      if (abs && existsSync(abs)) {
        try {
          unlinkSync(abs);
        } catch {
          /* file may already be gone — DB row deletion is the source of truth */
        }
      }
      void reply.code(204).send();
    },
  );
}
