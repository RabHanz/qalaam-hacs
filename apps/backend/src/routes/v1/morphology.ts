/**
 * GET /v1/morphology/:verseKey  → per-word grammatical morphology.
 * GET /v1/morphology/root/:root → all words sharing a triliteral root.
 *
 * Source: Quranic Arabic Corpus (Kais Dukes, 2011) — 128k+ tokens
 * across 6,236 ayahs with POS / lemma / root / Buckwalter form +
 * Arabic-script form. Ingested via scripts/data/ingest-morphology.py.
 *
 * Word grouping: each verse word may have multiple TOKENS (prefix +
 * stem + suffix), so the response groups them.
 *
 *   {
 *     "verseKey": "2:255",
 *     "words": [
 *       {
 *         "wordIndex": 1,
 *         "tokens": [
 *           { "tokenIndex": 1, "tag": "DET",  "form": "ٱل",     "lemma": null, "root": null, "isPrefix": true },
 *           { "tokenIndex": 2, "tag": "PN",   "form": "ٱللَّه", "lemma": "{ll~ah", "root": "Alh", "isStem": true },
 *           ...
 *         ]
 *       },
 *       ...
 *     ]
 *   }
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

let cachedDb: DB | undefined;
function morphDb(): DB | undefined {
  if (cachedDb) return cachedDb;
  const path = process.env.QUL_SQLITE_PATH ?? join(process.cwd(), 'data', 'qul.sqlite');
  if (!existsSync(path)) return undefined;
  try {
    cachedDb = new Database(path, { readonly: true, fileMustExist: true });
    return cachedDb;
  } catch {
    return undefined;
  }
}

interface TokenRow {
  word_index: number;
  token_index: number;
  pos_tag: string;
  form_buck: string;
  form_arabic: string;
  lemma: string | null;
  root: string | null;
  is_prefix: number;
  is_stem: number;
  is_suffix: number;
  features_json: string;
}

interface ApiToken {
  readonly tokenIndex: number;
  readonly tag: string;
  readonly form: string;
  readonly formBuckwalter: string;
  readonly lemma: string | null;
  readonly root: string | null;
  readonly isPrefix: boolean;
  readonly isStem: boolean;
  readonly isSuffix: boolean;
  readonly features: Record<string, unknown>;
}

interface ApiWord {
  readonly wordIndex: number;
  readonly tokens: readonly ApiToken[];
}

export async function morphologyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { verseKey: string } }>(
    '/v1/morphology/:verseKey',
    {
      schema: {
        description: 'Word-by-word morphology (POS / lemma / root) for a verse.',
        tags: ['morphology'],
        params: {
          type: 'object',
          properties: { verseKey: { type: 'string', pattern: '^[0-9]+:[0-9]+$' } },
          required: ['verseKey'],
        },
      },
    },
    async (req, reply) => {
      const { verseKey } = req.params;
      const db = morphDb();
      if (!db) {
        return reply
          .code(503)
          .send({ error: 'qalaam.data.not-loaded', message: 'qul.sqlite not present' });
      }
      void reply.header('cache-control', 'public, max-age=604800');

      const rows = db
        .prepare<[string], TokenRow>(
          `SELECT word_index, token_index, pos_tag, form_buck, form_arabic,
                  lemma, root, is_prefix, is_stem, is_suffix, features_json
           FROM qalaam_v1_qul_morphology
           WHERE verse_key = ?
           ORDER BY word_index, token_index`,
        )
        .all(verseKey);

      const wordsMap = new Map<number, ApiToken[]>();
      for (const r of rows) {
        const list = wordsMap.get(r.word_index) ?? [];
        let parsedFeatures: Record<string, unknown> = {};
        try {
          parsedFeatures = JSON.parse(r.features_json) as Record<string, unknown>;
        } catch {
          /* ignore malformed feature blobs */
        }
        // The QUL morphology dump leaks Buckwalter "@" markers into
        // form_arabic for tokens that have an unwritten/silent letter
        // (e.g. أُو@لَٰٓئِكَ, وا@). The raw character isn't valid for
        // user display — strip it on the way out so consumers always
        // get a clean Arabic glyph string.
        const cleanForm = r.form_arabic.replace(/@/g, '');
        list.push({
          tokenIndex: r.token_index,
          tag: r.pos_tag,
          form: cleanForm,
          formBuckwalter: r.form_buck,
          lemma: r.lemma,
          root: r.root,
          isPrefix: r.is_prefix === 1,
          isStem: r.is_stem === 1,
          isSuffix: r.is_suffix === 1,
          features: parsedFeatures,
        });
        wordsMap.set(r.word_index, list);
      }
      const words: ApiWord[] = Array.from(wordsMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([wordIndex, tokens]) => ({ wordIndex, tokens }));

      return reply.send({
        verseKey,
        words,
        source: 'Quranic Arabic Corpus v0.4 (Kais Dukes, 2011)',
        sourceUrl: 'https://corpus.quran.com/',
        license: 'GPL',
      });
    },
  );

  fastify.get<{ Params: { root: string } }>(
    '/v1/morphology/root/:root',
    {
      schema: {
        description: 'List every verse-word sharing a Buckwalter root (concordance lookup).',
        tags: ['morphology'],
      },
    },
    async (req, reply) => {
      // Frontend callers (concordance + grammar pages, MorphologyPane)
      // historically send hyphenated Buckwalter (`k-t-b`, `r-H-m`) for
      // readability. The DB stores contiguous Buckwalter (`ktb`, `rHm`).
      // Strip any non-Buckwalter character so both forms lookup-equal.
      // Buckwalter alphabet is ASCII-only (Latin letters, apostrophe,
      // a few caps for emphatics); any other byte is a separator.
      const rawRoot = req.params.root;
      const root = rawRoot.replace(/[^A-Za-z']/g, '');
      const db = morphDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      void reply.header('cache-control', 'public, max-age=604800');

      const rows = db
        .prepare<
          [string],
          {
            verse_key: string;
            word_index: number;
            form_arabic: string;
            lemma: string | null;
            pos_tag: string;
          }
        >(
          `SELECT verse_key, word_index, form_arabic, lemma, pos_tag
           FROM qalaam_v1_qul_morphology
           WHERE root = ? AND is_stem = 1
           ORDER BY surah, ayah, word_index
           LIMIT 500`,
        )
        .all(root);
      return reply.send({
        root,
        count: rows.length,
        occurrences: rows.map((r) => ({
          verseKey: r.verse_key,
          wordIndex: r.word_index,
          // Strip the Buckwalter "@" silent-letter marker (see GET handler).
          form: r.form_arabic.replace(/@/g, ''),
          lemma: r.lemma,
          tag: r.pos_tag,
        })),
        source: 'Quranic Arabic Corpus v0.4',
        license: 'GPL',
      });
    },
  );

  // GET /v1/morphology/roots → catalog every Quranic root with its
  // occurrence count, the most-frequent surface form (helps the
  // browser preview the root before tapping in), and a representative
  // lemma for translation lookup. Powers the /roots editorial page.
  fastify.get(
    '/v1/morphology/roots',
    {
      schema: {
        description:
          'Every Quranic triliteral root with occurrence count + canonical form. ' +
          'Sourced from Quranic Arabic Corpus v0.4 (GPL). Cached one week.',
        tags: ['morphology'],
      },
    },
    async (_req, reply) => {
      const db = morphDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      void reply.header('cache-control', 'public, max-age=604800');

      // Two-step: count + most-common form per root in one pass. SQLite's
      // window functions give us the top form without a correlated subquery.
      const rows = db
        .prepare<
          [],
          {
            root: string;
            count: number;
            top_form: string;
            top_lemma: string | null;
          }
        >(
          `WITH stems AS (
           SELECT root, form_arabic, lemma
           FROM qalaam_v1_qul_morphology
           WHERE is_stem = 1 AND root IS NOT NULL AND root != ''
         ),
         per_root AS (
           SELECT root, COUNT(*) AS root_count
           FROM stems
           GROUP BY root
         ),
         per_root_form AS (
           SELECT
             root,
             form_arabic,
             lemma,
             COUNT(*) AS form_count,
             ROW_NUMBER() OVER (PARTITION BY root ORDER BY COUNT(*) DESC, form_arabic) AS rn
           FROM stems
           GROUP BY root, form_arabic, lemma
         )
         SELECT pr.root AS root,
                pr.root_count AS count,
                prf.form_arabic AS top_form,
                prf.lemma AS top_lemma
         FROM per_root pr
         JOIN per_root_form prf ON prf.root = pr.root AND prf.rn = 1
         ORDER BY pr.root_count DESC, pr.root`,
        )
        .all();

      return reply.send({
        total: rows.length,
        roots: rows.map((r) => ({
          root: r.root,
          count: r.count,
          topForm: r.top_form.replace(/@/g, ''),
          lemma: r.top_lemma,
        })),
        source: 'Quranic Arabic Corpus v0.4',
        license: 'GPL',
      });
    },
  );
}
