/**
 * Quran.Foundation Tier A (Content) HTTP client.
 *
 * Per ADR-0002 + strategy §6:
 *   - Base URL: https://apis.quran.foundation/content/api/v4
 *   - OAuth2 client_credentials (see ./auth.ts)
 *   - Required headers: x-auth-token, x-client-id
 *   - Cache TTL ≤ 7 days (enforced by LruCache).
 *
 * Tier B (per-user PKCE+OIDC) is intentionally NOT implemented here — see
 * `./tier-b.ts` for the deferred placeholder.
 */
import { QalaamError } from '@qalaam/core';

import { LruCache } from '../cache/lru.js';

import { createQfAuthClient, type QfAuthClient } from './auth.js';
import type {
  QfAudioFile,
  QfChapter,
  QfRecitation,
  QfVerse,
  QfVersesResponse,
} from './types.js';

export interface QfClientConfig {
  readonly baseUrl: string;
  readonly oauthUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetchImpl?: typeof fetch;
  /** TTL for cached responses, in ms. Default 24h; max 7 days per QF ToS. */
  readonly defaultCacheTtlMs?: number;
  /** Override token cache lifetime. */
  readonly tokenLifetimeMs?: number;
}

export interface VerseQuery {
  readonly translations?: readonly number[];
  readonly tafsirs?: readonly number[];
  readonly words?: boolean;
  readonly wordTranslationLanguage?: string;
  readonly fields?: readonly string[];
  readonly wordFields?: readonly string[];
  readonly audio?: number;
  readonly perPage?: number;
  readonly page?: number;
}

export interface QfClient {
  getChapters(language?: string): Promise<readonly QfChapter[]>;
  getChapter(id: number, language?: string): Promise<QfChapter>;
  getVersesByChapter(chapterId: number, q?: VerseQuery): Promise<QfVersesResponse>;
  getVersesByPage(pageNumber: number, q?: VerseQuery): Promise<QfVersesResponse>;
  getVerseByKey(verseKey: string, q?: VerseQuery): Promise<QfVerse>;
  getRecitations(language?: string): Promise<readonly QfRecitation[]>;
  /** Per-ayah segments with `segments=true` for word-level highlighting. */
  getReciterAudioFiles(
    reciterId: number,
    chapterNumber: number,
    opts?: { withSegments?: boolean },
  ): Promise<readonly QfAudioFile[]>;
  /** Force-clear the OAuth token after a 401 (rare, but signaled by the server). */
  invalidateToken(): void;
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000;
const MAX_PER_PAGE = 50;

export function createQfClient(config: QfClientConfig): QfClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const auth: QfAuthClient = createQfAuthClient({
    oauthUrl: config.oauthUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    fetchImpl,
    ...(config.tokenLifetimeMs !== undefined ? { tokenLifetimeMs: config.tokenLifetimeMs } : {}),
  });
  const cache = new LruCache<string, unknown>(2000);
  const ttl = config.defaultCacheTtlMs ?? DEFAULT_TTL;
  const base = `${config.baseUrl.replace(/\/+$/, '')}/content/api/v4`;

  async function call<T>(path: string, search?: URLSearchParams): Promise<T> {
    const url = search ? `${base}${path}?${search.toString()}` : `${base}${path}`;
    const cached = cache.get(url) as T | undefined;
    if (cached !== undefined) return cached;
    const token = await auth.getToken();
    const res = await fetchImpl(url, {
      headers: {
        'x-auth-token': token,
        'x-client-id': config.clientId,
        Accept: 'application/json',
      },
    });
    if (res.status === 401) {
      auth.invalidate();
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QF returned 401 for ${url} — token invalidated.`,
        { outcomeImpacted: 'O-11' },
      );
    }
    if (res.status === 429) {
      const retry = res.headers.get('retry-after');
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QF rate-limited for ${url}; retry-after=${retry ?? 'unset'}.`,
      );
    }
    if (!res.ok) {
      const body = await res.text();
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QF ${res.status.toString()} for ${url}: ${body}`,
      );
    }
    const json = (await res.json()) as T;
    cache.set(url, json, ttl);
    return json;
  }

  function buildVerseSearch(q?: VerseQuery): URLSearchParams {
    const s = new URLSearchParams();
    if (!q) return s;
    if (q.translations?.length) s.set('translations', q.translations.join(','));
    if (q.tafsirs?.length) s.set('tafsirs', q.tafsirs.join(','));
    if (q.words === true) s.set('words', 'true');
    if (q.wordTranslationLanguage) s.set('word_translation_language', q.wordTranslationLanguage);
    if (q.fields?.length) s.set('fields', q.fields.join(','));
    if (q.wordFields?.length) s.set('word_fields', q.wordFields.join(','));
    if (q.audio !== undefined) s.set('audio', String(q.audio));
    if (q.perPage !== undefined) {
      const cap = Math.min(q.perPage, MAX_PER_PAGE);
      s.set('per_page', String(cap));
    }
    if (q.page !== undefined) s.set('page', String(q.page));
    return s;
  }

  return {
    async getChapters(language) {
      const s = new URLSearchParams();
      if (language) s.set('language', language);
      const json = await call<{ chapters: QfChapter[] }>('/chapters', s);
      return json.chapters;
    },
    async getChapter(id, language) {
      const s = new URLSearchParams();
      if (language) s.set('language', language);
      const json = await call<{ chapter: QfChapter }>(`/chapters/${id.toString()}`, s);
      return json.chapter;
    },
    async getVersesByChapter(chapterId, q) {
      return call<QfVersesResponse>(`/verses/by_chapter/${chapterId.toString()}`, buildVerseSearch(q));
    },
    async getVersesByPage(pageNumber, q) {
      return call<QfVersesResponse>(`/verses/by_page/${pageNumber.toString()}`, buildVerseSearch(q));
    },
    async getVerseByKey(verseKey, q) {
      const json = await call<{ verse: QfVerse }>(
        `/verses/by_key/${encodeURIComponent(verseKey)}`,
        buildVerseSearch(q),
      );
      return json.verse;
    },
    async getRecitations(language) {
      const s = new URLSearchParams();
      if (language) s.set('language', language);
      const json = await call<{ recitations: QfRecitation[] }>('/resources/recitations', s);
      return json.recitations;
    },
    async getReciterAudioFiles(reciterId, chapterNumber, opts) {
      const s = new URLSearchParams({ chapter: String(chapterNumber) });
      if (opts?.withSegments) s.set('segments', 'true');
      const json = await call<{ audio_files: QfAudioFile[] }>(
        `/audio/reciters/${reciterId.toString()}/audio_files`,
        s,
      );
      return json.audio_files;
    },
    invalidateToken() {
      auth.invalidate();
    },
  };
}
