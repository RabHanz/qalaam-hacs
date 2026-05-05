'use client';

/**
 * TopicsByVersePane — sidebar marginalia on /study showing every
 * topic that includes the current verse. Each tag links to /topics/:slug
 * for cross-reference reading.
 *
 * Editorial design (per CLAUDE.md §11.3): paper-card with leaf-gold
 * smallcaps caption + hairline divider, topic chips inline-flow.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

interface TopicTag {
  readonly slug: string;
  readonly nameEn: string;
  readonly nameAr: string | null;
  readonly summary: string | null;
}

interface Props {
  readonly verseKey: string;
}

export function TopicsByVersePane({ verseKey }: Props): ReactNode {
  const [topics, setTopics] = useState<readonly TopicTag[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${resolveApiBase()}/v1/topics/by-verse/${encodeURIComponent(verseKey)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status.toString()}`);
        const body = (await res.json()) as { topics: readonly TopicTag[] };
        if (!cancelled) setTopics(body.topics);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verseKey]);

  if (error) return null; // graceful — sidebar marginalia, don't yell
  if (topics === null) {
    return (
      <div className="paper-card p-5">
        <p className="smallcaps text-leaf text-xs">Topics</p>
        <p className="text-xs text-ink-muted italic mt-2">Loading…</p>
      </div>
    );
  }
  if (topics.length === 0) {
    return null; // No topics → don't render an empty card
  }

  return (
    <div className="paper-card p-5">
      <p className="smallcaps text-leaf text-xs">Topics · مَوَاضِيع</p>
      <div className="rule-hairline mt-2 mb-3" />
      <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
        {topics.map((t) => (
          <li key={t.slug}>
            <a
              href={`/topics/${t.slug}`}
              title={t.summary ?? t.nameEn}
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] smallcaps tracking-wider border border-hairline text-ink hover:bg-paper-100 hover:border-leaf/40 hover:text-leaf transition-colors"
            >
              {t.nameEn.replace(/ · .*$/, '')}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-ink-muted italic">
        Tap any topic to read every verse on that subject.
      </p>
    </div>
  );
}
