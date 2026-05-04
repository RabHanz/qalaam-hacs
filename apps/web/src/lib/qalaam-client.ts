/**
 * Server-side Qalaam backend client.
 *
 * Used from React Server Components. Inherits the Next.js `fetch` cache.
 *
 * Per CLAUDE.md §11.2: typed at the boundary; no `any`. Errors surface as
 * `QalaamError`s for consistent handling.
 */
import { QalaamError, type VerseKey } from '@qalaam/core';

const DEFAULT_BASE = process.env['PUBLIC_API_URL'] ?? 'http://localhost:4111';

export interface VerseResponse {
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

export interface SurahVersesResponse {
  readonly verses: readonly VerseResponse[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${DEFAULT_BASE}${path}`, {
    ...init,
    next: { revalidate: 86400 }, // align with backend cache-control
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { code?: string; detail?: string };
      detail = body.detail ?? '';
      throw new QalaamError(
        (body.code as never) ?? 'qalaam.data.not-loaded',
        `${path} → ${res.status.toString()}: ${detail}`,
      );
    } catch (err) {
      if (err instanceof QalaamError) throw err;
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `${path} → ${res.status.toString()}: ${detail}`,
      );
    }
  }
  return (await res.json()) as T;
}

export interface TranslationListItem {
  readonly id: string;
  readonly slug: string;
  readonly language: string;
  readonly name: string;
  readonly translator: string;
  readonly license: string;
}

export interface TafsirListItem {
  readonly id: string;
  readonly slug: string;
  readonly language: string;
  readonly name: string;
  readonly scholar: string;
  readonly license: string;
  readonly delivery: string;
}

export interface VerseTextResult {
  readonly verseKey: VerseKey;
  readonly slug: string;
  readonly text: string;
}

export const qalaamClient = {
  getVerseByKey(key: VerseKey): Promise<VerseResponse> {
    return call<VerseResponse>(`/v1/verses/by_key/${encodeURIComponent(key)}`);
  },
  getSurahVerses(surah: number): Promise<SurahVersesResponse> {
    return call<SurahVersesResponse>(`/v1/chapters/${surah.toString()}/verses`);
  },
  listTranslations(): Promise<{ translations: readonly TranslationListItem[] }> {
    return call(`/v1/translations`);
  },
  getTranslationVerse(slug: string, key: VerseKey): Promise<VerseTextResult> {
    return call(`/v1/translations/${encodeURIComponent(slug)}/by_verse/${encodeURIComponent(key)}`);
  },
  listTafsirs(): Promise<{ tafsirs: readonly TafsirListItem[] }> {
    return call(`/v1/tafsirs`);
  },
  getTafsirVerse(slug: string, key: VerseKey): Promise<VerseTextResult> {
    return call(`/v1/tafsirs/${encodeURIComponent(slug)}/by_verse/${encodeURIComponent(key)}`);
  },
};
