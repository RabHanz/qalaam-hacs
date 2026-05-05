/**
 * GET /v1/search?q=…&lang=&limit=
 *
 * Diacritics-insensitive search across:
 *   - Arabic verse text (Uthmani + Imlaei + IndoPak — surfaced as one hit)
 *   - Translations (every language ingested; lang= filter narrows to one)
 *   - Curated topics (8 categories × 53 topics)
 *
 * Backed by SQLite FTS5 with `unicode61 remove_diacritics 2` so harakat,
 * shadda, alif/ya variants, and Latin diacritics don't break matches.
 *
 * Result shape (single payload, three sections, ranked per section):
 *   {
 *     query, lang,
 *     verses:        [{verseKey, snippet, score}, ...]
 *     translations:  [{verseKey, slug, language, snippet, score}, ...]
 *     topics:        [{slug, nameEn, nameAr, snippet, score}, ...]
 *     totalMatches: <int>
 *   }
 *
 * The frontend /search page renders three editorial sections with the
 * topics ribbon at the top (highest signal).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { Database as DB } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

let cachedDb: DB | undefined;
function searchDb(): DB | undefined {
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

interface VerseHit {
  verse_key: string;
  surah: number;
  ayah: number;
  text_uthmani: string;
  snippet: string;
  rank: number;
}
interface TranslationHit {
  slug: string;
  verse_key: string;
  language: string | null;
  text: string;
  snippet: string;
  rank: number;
}
interface TopicHit {
  slug: string;
  name_en: string;
  name_ar: string | null;
  summary: string | null;
  snippet: string;
  rank: number;
}

/**
 * Sanitize the user's query for FTS5 — escape double-quotes + wrap each
 * non-trivial token in quotes so FTS5 treats them as phrase fragments.
 * Strip control characters that would crash the tokenizer. Add `*` suffix
 * to enable prefix matching on the last token.
 */
function buildFtsQuery(q: string): string {
  // Strip ASCII control chars and double-quotes that would crash FTS5's
  // MATCH parser. Anything else (Arabic, Latin diacritics, punctuation) flows
  // through to the unicode61 tokenizer.
  // eslint-disable-next-line no-control-regex
  const cleaned = q.replace(/[\x00-\x1F\x7F"]/g, '').trim();
  if (!cleaned) return '';
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return '';
  // Quote each token + add prefix '*' to the last so partials ("ibrah*") match.
  const last = tokens.length - 1;
  return tokens.map((t, i) => (i === last ? `"${t}"*` : `"${t}"`)).join(' ');
}

// eslint-disable-next-line @typescript-eslint/require-await -- fastify register signature requires Promise<void>; body does not await.
export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { q?: string; lang?: string; limit?: string } }>(
    '/v1/search',
    {
      schema: {
        description:
          'Search across Arabic verse text + 59 translations + 53 topics. ' +
          'FTS5-powered, diacritics-insensitive. Use lang= to narrow translations to one language.',
        tags: ['search'],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 200 },
            lang: { type: 'string', pattern: '^[a-z]{2}$' },
            limit: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['q'],
        },
      },
    },
    async (req, reply) => {
      const db = searchDb();
      if (!db) return reply.code(503).send({ error: 'qalaam.data.not-loaded' });
      const q = (req.query.q ?? '').trim();
      const ftsQ = buildFtsQuery(q);
      if (!ftsQ) {
        return reply.send({
          query: q,
          lang: req.query.lang ?? null,
          verses: [],
          translations: [],
          topics: [],
          totalMatches: 0,
        });
      }
      const limit = Math.min(50, Math.max(5, Number.parseInt(req.query.limit ?? '20', 10)));
      const lang = req.query.lang;

      // Verses — search across all three Arabic columns; surface text_uthmani
      // as the canonical text. snippet() bookmarks the matched run so the UI
      // can highlight without our own tokenizer.
      const verseHits = db
        .prepare<[string, number], VerseHit>(
          `SELECT
             vf.verse_key, vf.surah, vf.ayah,
             vf.text_uthmani,
             snippet(qalaam_v1_search_verses_fts, 3, '<mark>', '</mark>', '…', 16) AS snippet,
             bm25(qalaam_v1_search_verses_fts) AS rank
           FROM qalaam_v1_search_verses_fts vf
           WHERE qalaam_v1_search_verses_fts MATCH ?
           ORDER BY rank LIMIT ?`,
        )
        .all(ftsQ, limit);

      // Translations — optionally filtered by language.
      const translationHits = lang
        ? db
            .prepare<[string, string, number], TranslationHit>(
              `SELECT
                 slug, verse_key, language, text,
                 snippet(qalaam_v1_search_translations_fts, 3, '<mark>', '</mark>', '…', 18) AS snippet,
                 bm25(qalaam_v1_search_translations_fts) AS rank
               FROM qalaam_v1_search_translations_fts
               WHERE qalaam_v1_search_translations_fts MATCH ?
                 AND language = ?
               ORDER BY rank LIMIT ?`,
            )
            .all(ftsQ, lang, limit)
        : db
            .prepare<[string, number], TranslationHit>(
              `SELECT
                 slug, verse_key, language, text,
                 snippet(qalaam_v1_search_translations_fts, 3, '<mark>', '</mark>', '…', 18) AS snippet,
                 bm25(qalaam_v1_search_translations_fts) AS rank
               FROM qalaam_v1_search_translations_fts
               WHERE qalaam_v1_search_translations_fts MATCH ?
               ORDER BY rank LIMIT ?`,
            )
            .all(ftsQ, limit);

      // Topics.
      const topicHits = db
        .prepare<[string, number], TopicHit>(
          `SELECT
             slug, name_en, name_ar, summary,
             snippet(qalaam_v1_search_topics_fts, 3, '<mark>', '</mark>', '…', 14) AS snippet,
             bm25(qalaam_v1_search_topics_fts) AS rank
           FROM qalaam_v1_search_topics_fts
           WHERE qalaam_v1_search_topics_fts MATCH ?
           ORDER BY rank LIMIT ?`,
        )
        .all(ftsQ, Math.min(15, limit));

      const total = verseHits.length + translationHits.length + topicHits.length;

      void reply.header('cache-control', 'public, max-age=300');
      return reply.send({
        query: q,
        lang: lang ?? null,
        verses: verseHits.map((v) => ({
          verseKey: v.verse_key,
          surah: v.surah,
          ayah: v.ayah,
          text: v.text_uthmani,
          snippet: v.snippet,
          score: -v.rank, // negate so higher = better
        })),
        translations: translationHits.map((t) => ({
          verseKey: t.verse_key,
          slug: t.slug,
          language: t.language,
          text: t.text,
          snippet: t.snippet,
          score: -t.rank,
        })),
        topics: topicHits.map((t) => ({
          slug: t.slug,
          nameEn: t.name_en,
          nameAr: t.name_ar,
          summary: t.summary,
          snippet: t.snippet,
          score: -t.rank,
        })),
        totalMatches: total,
      });
    },
  );
}
