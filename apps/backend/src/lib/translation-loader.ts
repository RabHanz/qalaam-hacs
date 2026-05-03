/**
 * Translation + tafsir fixture loader.
 *
 * v0.1: reads bundled JSON fixtures so the backend serves Al-Fatiha translations
 * and tafsirs without QUL. v0.5: swaps to `@qalaam/data-loader/qul` once the
 * SQLite store is downloaded. Per ADR-0002.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function listTranslations(): readonly TranslationMeta[] {
  return loadTranslations().meta;
}

export function getTranslationVerse(slug: string, key: VerseKey): string | undefined {
  return loadTranslations().bySlug.get(slug)?.verses[key];
}

export function listTafsirs(): readonly TafsirMeta[] {
  return loadTafsirs().meta;
}

export function getTafsirVerse(slug: string, key: VerseKey): string | undefined {
  return loadTafsirs().bySlug.get(slug)?.verses[key];
}

export { parseVerseKey };
