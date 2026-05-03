/**
 * Tier B (per-user) Quran.Foundation API placeholder.
 *
 * PKCE + OIDC for bookmarks, notes, reading sessions, streaks. Deferred to v2 per
 * ADR-0012 + strategy §15 roadmap. This file exists so callers can import the
 * type surface and lint clean — implementation lands when v2 begins.
 */
import { QalaamError } from '@qalaam/core';

export interface QfUserApiClient {
  listBookmarks(): Promise<never>;
  saveBookmark(verseKey: string): Promise<never>;
  // ...full API to be modeled when v2 begins.
}

export function createQfUserApiClient(): QfUserApiClient {
  const stub = (): never => {
    throw new QalaamError(
      'qalaam.data.not-loaded',
      'QF Tier B (user APIs) is deferred to v2 per ADR-0012. See Docs/STRATEGY_AND_ROADMAP.md §15.',
    );
  };
  return {
    listBookmarks: () => Promise.resolve(stub()),
    saveBookmark: () => Promise.resolve(stub()),
  };
}
