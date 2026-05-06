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

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';

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
    const cancel = { v: false };
    void (async () => {
      try {
        const res = await fetch(
          `${resolveApiBase()}/v1/topics/by-verse/${encodeURIComponent(verseKey)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status.toString()}`);
        const body = (await res.json()) as { topics: readonly TopicTag[] };
        if (!cancel.v) setTopics(body.topics);
      } catch (err) {
        if (!cancel.v) {
          setError(err instanceof Error ? err.message : 'Could not load topics right now.');
        }
      }
    })();
    return () => {
      cancel.v = true;
    };
  }, [verseKey]);

  if (error) return null; // graceful — sidebar marginalia, don't yell
  if (topics === null) {
    return (
      <div className="paper-card p-5">
        <p className="smallcaps text-leaf text-xs">Topics</p>
        <p className="text-ink-muted mt-2 text-xs italic">Loading…</p>
      </div>
    );
  }
  if (topics.length === 0) {
    return null; // No topics → don't render an empty card
  }

  return (
    <div className="paper-card p-5">
      <p className="smallcaps text-leaf text-xs">Topics · مَوَاضِيع</p>
      <div className="rule-hairline mb-3 mt-2" />
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {topics.map((t) => (
          <li key={t.slug}>
            <a
              href={`/topics/${t.slug}`}
              title={t.summary ?? t.nameEn}
              className="smallcaps border-hairline text-ink hover:bg-paper-100 hover:border-leaf/40 hover:text-leaf inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-wider transition-colors"
            >
              {t.nameEn.replace(/ · .*$/, '')}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-ink-muted mt-3 text-[10px] italic">
        Tap any topic to read every verse on that subject.
      </p>
    </div>
  );
}
