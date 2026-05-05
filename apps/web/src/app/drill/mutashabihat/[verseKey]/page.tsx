/**
 * /drill/mutashabihat/[verseKey] — side-by-side mutashabihat drill.
 *
 * The Hifdh JTBD: "I keep confusing 2:122 with 2:47 — they sound nearly
 * identical. Show me both, side by side, with the differences
 * highlighted, so I can train my eye and ear to spot what makes each
 * unique." Tarteel and Quranly neither ship this.
 *
 * Data: /v1/mutashabihat/pairs/:verseKey (top similar partners) +
 * /v1/verses/by_key/:vk (Uthmani text per verse). Word-level diff is
 * computed client-side via a normalized-form Levenshtein-style match
 * (we strip diacritics + Arabic-presentation forms before comparing).
 */
import Link from 'next/link';

import { EmptyState } from '../../../../components/EmptyState.js';
import { MutashabihatDrillClient } from '../../../../components/MutashabihatDrillClient.js';
import { SiteNav } from '../../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ verseKey: string }>;
  readonly searchParams: Promise<{ partner?: string }>;
}

interface Verse {
  readonly verseKey: string;
  readonly textUthmani: string;
}

interface Pair {
  readonly leftVerseKey: string;
  readonly rightVerseKey: string;
  readonly score: number;
  readonly note: string | null;
}

async function fetchVerse(apiBase: string, vk: string): Promise<Verse | null> {
  try {
    const res = await fetch(`${apiBase}/v1/verses/by_key/${encodeURIComponent(vk)}`, {
      next: { revalidate: 604800 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Verse;
    return body;
  } catch {
    return null;
  }
}

async function fetchPairs(apiBase: string, vk: string): Promise<readonly Pair[]> {
  try {
    const res = await fetch(`${apiBase}/v1/mutashabihat/pairs/${encodeURIComponent(vk)}`, {
      next: { revalidate: 604800 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: Pair[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

export default async function MutashabihatDrillPage({
  params,
  searchParams,
}: PageProps): Promise<ReactNode> {
  const { verseKey: rawVk } = await params;
  const { partner: rawPartner } = await searchParams;

  let verseKey = rawVk;
  try {
    verseKey = decodeURIComponent(rawVk);
  } catch {
    /* ignore — fall through to validation */
  }
  if (!/^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/.test(verseKey)) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Bad verse key" hint={`Got "${verseKey}".`} />
        </div>
      </>
    );
  }

  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';

  const [primary, pairs] = await Promise.all([
    fetchVerse(apiBase, verseKey),
    fetchPairs(apiBase, verseKey),
  ]);

  if (!primary) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Verse not found" hint={verseKey} />
        </div>
      </>
    );
  }

  // Pick the partner — explicit search param wins, else the highest-
  // score match. The score column is 0–100 in the DB; treat ≥40 as
  // meaningfully similar.
  const partnerCandidates = pairs
    .map((p) => (p.leftVerseKey === verseKey ? p.rightVerseKey : p.leftVerseKey))
    .filter((vk, i, arr) => arr.indexOf(vk) === i);
  const partnerVk =
    rawPartner && /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/.test(rawPartner)
      ? rawPartner
      : (partnerCandidates[0] ?? null);

  const partner = partnerVk ? await fetchVerse(apiBase, partnerVk) : null;

  if (!partner) {
    return (
      <>
        <SiteNav />
        <header className="border-hairline border-b">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
            <p className="smallcaps text-leaf text-[11px] tracking-widest">
              Mutashabihat drill · مُتَشَابِهَات
            </p>
            <h1 className="font-display text-ink-strong mt-2 text-3xl font-light tracking-tight sm:text-5xl">
              {verseKey}
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <EmptyState
            title="No similar verses recorded"
            hint={`We have no flagged mutashabih partners for ${verseKey}. Try a verse that's commonly confused, like 2:122.`}
          />
          <p className="text-ink-muted mt-6 text-sm">
            <Link href="/study/2/122" className="text-leaf hover:underline">
              Browse 2:122 →
            </Link>
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">
            Mutashabihat drill · مُتَشَابِهَات
          </p>
          <h1 className="font-display text-ink-strong mt-2 text-3xl font-light tracking-tight sm:text-4xl">
            Spot the difference.
          </h1>
          <p className="text-ink-muted mt-2 max-w-prose text-sm leading-relaxed sm:text-base">
            Two verses that sound nearly identical. Words shared between them are dim;
            differences pop. Toggle <em>Cover</em> to drill from memory — recall the
            partner verse, then reveal it.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <MutashabihatDrillClient
          primary={primary}
          partner={partner}
          partnerCandidates={partnerCandidates.map((vk) => {
            const p = pairs.find(
              (x) =>
                (x.leftVerseKey === verseKey && x.rightVerseKey === vk) ||
                (x.rightVerseKey === verseKey && x.leftVerseKey === vk),
            );
            return { verseKey: vk, score: p?.score ?? 0 };
          })}
        />
      </main>
    </>
  );
}
