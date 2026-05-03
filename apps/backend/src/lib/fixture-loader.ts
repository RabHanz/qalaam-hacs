/**
 * Fixture loader — provides Al-Fatiha verses without QUL SQLite, so dev / test /
 * v0.1 alpha can run before `make data-fetch` succeeds.
 *
 * Per ADR-0002: QUL is canonical, but we ship a tiny fixture for the most-read
 * surah so the demo path is always available.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type VerseKey, parseVerseKey } from '@qalaam/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, '..', '..', 'fixtures', 'al-fatiha.json');

interface FixtureFile {
  verses: Record<string, FixtureVerse>;
}

export interface FixtureVerse {
  readonly verseKey: VerseKey;
  readonly surah: number;
  readonly ayah: number;
  readonly juz: number;
  readonly hizb: number;
  readonly rubElHizb: number;
  readonly ruku: number;
  readonly manzil: number;
  readonly pageMadani15: number;
  readonly textUthmani: string;
  readonly wordCount: number;
  readonly isSajdah: boolean;
}

let cached: Map<string, FixtureVerse> | undefined;

function load(): Map<string, FixtureVerse> {
  if (cached) return cached;
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as FixtureFile;
  cached = new Map<string, FixtureVerse>();
  for (const [k, v] of Object.entries(parsed.verses)) {
    cached.set(k, { ...v, verseKey: parseVerseKey(v.verseKey) });
  }
  return cached;
}

export function fixtureVerse(key: VerseKey): FixtureVerse | undefined {
  return load().get(key);
}

export function fixtureSurah(surahNumber: number): readonly FixtureVerse[] {
  const all = [...load().values()].filter((v) => v.surah === surahNumber);
  return all.sort((a, b) => a.ayah - b.ayah);
}
