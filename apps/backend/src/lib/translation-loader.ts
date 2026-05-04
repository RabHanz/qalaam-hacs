/**
 * Translation + tafsir loader.
 *
 * Two backends, queried in order:
 *
 * 1. **`qalaam_v1_translations` SQLite table** (canonical) — populated by
 *    `scripts/data/ingest-translations.py`. Holds full 6,236-verse packs
 *    keyed by `(slug, verse_key)`. Catalog comes from
 *    `qalaam_v1_translation_meta`.
 *
 * 2. **JSON fixtures in `apps/backend/fixtures/`** (legacy fallback) —
 *    Al-Fatiha-only seed used before the SQLite table existed. Falls back
 *    here if a slug isn't in the DB or the DB itself is missing.
 *
 * Tafsirs still read fixtures only — proper QUL ingest pending in v0.5.
 *
 * Per ADR-0002.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';

import { type VerseKey, parseVerseKey } from '@qalaam/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(HERE, '..', '..', 'fixtures');

export interface TranslationMeta {
  readonly id: string;
  readonly slug: string;
  readonly language: string;
  readonly name: string;
  readonly translator: string;
  readonly license: string;
  readonly yearPublished?: number;
}

export interface TafsirMeta {
  readonly id: string;
  readonly slug: string;
  readonly language: string;
  readonly name: string;
  readonly scholar: string;
  readonly license: string;
  readonly delivery: string;
}

interface VerseTextMap { readonly [verseKey: string]: string }

interface TranslationFile { slug: string; language: string; verses: VerseTextMap }
interface TafsirFile     { slug: string; language: string; verses: VerseTextMap }

let cachedTranslations: { meta: readonly TranslationMeta[]; bySlug: Map<string, TranslationFile> } | undefined;
let cachedTafsirs: { meta: readonly TafsirMeta[]; bySlug: Map<string, TafsirFile> } | undefined;

function loadTranslations(): NonNullable<typeof cachedTranslations> {
  if (cachedTranslations) return cachedTranslations;
  const dir = join(FIXTURES_ROOT, 'translations');
  const meta = (JSON.parse(readFileSync(join(dir, 'index.json'), 'utf-8')) as { translations: TranslationMeta[] }).translations;
  const bySlug = new Map<string, TranslationFile>();
  for (const f of readdirSync(dir)) {
    if (f === 'index.json' || !f.endsWith('.json')) continue;
    const data = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as TranslationFile;
    bySlug.set(data.slug, data);
  }
  cachedTranslations = { meta, bySlug };
  return cachedTranslations;
}

function loadTafsirs(): NonNullable<typeof cachedTafsirs> {
  if (cachedTafsirs) return cachedTafsirs;
  const dir = join(FIXTURES_ROOT, 'tafsirs');
  const meta = (JSON.parse(readFileSync(join(dir, 'index.json'), 'utf-8')) as { tafsirs: TafsirMeta[] }).tafsirs;
  const bySlug = new Map<string, TafsirFile>();
  for (const f of readdirSync(dir)) {
    if (f === 'index.json' || !f.endsWith('.json')) continue;
    const data = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as TafsirFile;
    bySlug.set(data.slug, data);
  }
  cachedTafsirs = { meta, bySlug };
  return cachedTafsirs;
}

// SQLite-backed translation read path (preferred over fixtures when the DB
// has rows for the slug). The DB path comes from QUL_SQLITE_PATH at first call.
let cachedDb: DB | undefined;
let cachedDbMeta: readonly TranslationMeta[] | undefined;

function getDb(): DB | undefined {
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

function listFromDb(): readonly TranslationMeta[] {
  if (cachedDbMeta) return cachedDbMeta;
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare<
        [],
        {
          slug: string;
          name: string;
          translator: string;
          language: string;
          license_tag: string;
          verse_count: number;
        }
      >(
        `SELECT slug, name, translator, language, license_tag, verse_count
         FROM qalaam_v1_translation_meta ORDER BY language, name`,
      )
      .all();
    cachedDbMeta = rows.map((r): TranslationMeta => ({
      id: `qul-${r.slug}`,
      slug: r.slug,
      language: r.language,
      name: r.name,
      translator: r.translator,
      license: r.license_tag,
    }));
    return cachedDbMeta;
  } catch {
    return [];
  }
}

export function listTranslations(): readonly TranslationMeta[] {
  // Only surface translations with full ingested data. The Al-Fatiha-only
  // fixture catalog is intentionally hidden — picking a fixture-only slug
  // would render correct for /1/* and 503 for everything else, which is
  // misleading. v0.5 will re-expand the catalog as more translations are
  // ingested into qalaam_v1_translations.
  const fromDb = listFromDb();
  if (fromDb.length > 0) return fromDb;
  // Fallback to fixtures only if DB is unavailable (early dev, no SQLite).
  return loadTranslations().meta;
}

export function getTranslationVerse(slug: string, key: VerseKey): string | undefined {
  const db = getDb();
  if (db) {
    try {
      const row = db
        .prepare<[string, string], { text: string }>(
          'SELECT text FROM qalaam_v1_translations WHERE slug = ? AND verse_key = ?',
        )
        .get(slug, key);
      if (row?.text) return row.text;
    } catch {
      // fall through to fixture
    }
  }
  return loadTranslations().bySlug.get(slug)?.verses[key];
}

// SQLite-backed tafsir read path
let cachedTafsirMeta: readonly TafsirMeta[] | undefined;

function listTafsirsFromDb(): readonly TafsirMeta[] {
  if (cachedTafsirMeta) return cachedTafsirMeta;
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare<
        [],
        {
          slug: string;
          name: string;
          scholar: string;
          language: string;
          license_tag: string;
          verse_count: number;
        }
      >(
        `SELECT slug, name, scholar, language, license_tag, verse_count
         FROM qalaam_v1_tafsir_meta ORDER BY language, name`,
      )
      .all();
    cachedTafsirMeta = rows.map((r): TafsirMeta => ({
      id: `qul-tafsir-${r.slug}`,
      slug: r.slug,
      language: r.language,
      name: r.name,
      scholar: r.scholar,
      license: r.license_tag,
      delivery: 'sqlite',
    }));
    return cachedTafsirMeta;
  } catch {
    return [];
  }
}

export function listTafsirs(): readonly TafsirMeta[] {
  const fromDb = listTafsirsFromDb();
  if (fromDb.length > 0) return fromDb;
  return loadTafsirs().meta;
}

export function getTafsirVerse(slug: string, key: VerseKey): string | undefined {
  const db = getDb();
  if (db) {
    try {
      const row = db
        .prepare<[string, string], { text: string }>(
          'SELECT text FROM qalaam_v1_tafsirs WHERE slug = ? AND verse_key = ?',
        )
        .get(slug, key);
      if (row?.text) return row.text;
    } catch {
      /* fall through */
    }
  }
  return loadTafsirs().bySlug.get(slug)?.verses[key];
}

export { parseVerseKey };
