/**
 * /credits — every QUL resource credit/attribution surfaced on a single
 * dedicated page. Per CLAUDE.md adab + memory rule
 * `feedback_quranic_authenticity.md`: every data substrate Qalaam ships
 * is sourced from QUL (Quranic Universal Library — Tarteel AI), and
 * every contribution is attributed publicly.
 *
 * The page reads from `/v1/credits` (Fastify route at
 * apps/backend/src/routes/v1/credits.ts) which walks the sidecar
 * `.license.json` tree under `data/qul-source/raw/` and emits a
 * grouped + deduplicated list. License-tag review is a manual gate
 * per ADR-0020; rows still tagged `unverified`, `per-translator`,
 * or `per-reciter` are excluded from the public credits page until
 * the reviewer confirms the tag.
 *
 * Editorial direction: paper-card-raised list, restrained chrome,
 * each entry shows title + license badge + source link. Categories
 * sorted by user-visibility, license tags pill-coloured by category.
 *
 * Per task #200 + memory `feedback_quranic_authenticity.md`: NEVER
 * leak credits/attributions through error paths or in-product copy
 * — they belong here, on the dedicated credits page.
 */
import Link from 'next/link';

import { SiteNav } from '../../components/SiteNav.js';
import { SERVER_API_BASE } from '../../lib/api-base.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Credits & data sources · Qalaam',
  description:
    'Every Quranic resource Qalaam uses, with full attribution and source links. Built on the Quranic Universal Library by Tarteel AI.',
};

interface CreditEntry {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly sourceUrl: string;
  readonly licenseTag: string;
  readonly attributionText: string;
  readonly attributionRequired: boolean;
  readonly sha256: string | null;
}
interface CreditsResponse {
  readonly groups: Record<string, readonly CreditEntry[]>;
  readonly summary: {
    readonly totalEntries: number;
    readonly perCategory: Record<string, number>;
    readonly perLicense: Record<string, number>;
  };
}

const CATEGORY_LABEL: Record<string, string> = {
  font: 'Quranic typefaces',
  'mushaf-layout': 'Mushaf page layouts',
  'quran-script': 'Quran scripts (text encodings)',
  'quran-metadata': 'Surah / Juz / Hizb metadata',
  recitation: 'Recitations',
  translation: 'Translations',
  tafsir: 'Tafsirs (commentaries)',
  transliteration: 'Transliterations',
  'surah-info': 'Surah introductions',
  morphology: 'Quranic morphology (i‘rab)',
  mutashabihat: 'Mutashabihat — confusable phrase pairs',
  'similar-ayah': 'Similar ayah pairs',
  'ayah-theme': 'Ayah themes',
  'ayah-topics': 'Ayah topics',
};

const CATEGORY_ORDER = [
  'font',
  'mushaf-layout',
  'quran-script',
  'recitation',
  'translation',
  'tafsir',
  'transliteration',
  'surah-info',
  'morphology',
  'mutashabihat',
  'similar-ayah',
  'ayah-theme',
  'ayah-topics',
  'quran-metadata',
];

const LICENSE_LABEL: Record<string, string> = {
  'public-domain': 'Public domain',
  factual: 'Factual data',
  'permissive-with-credit': 'Permissive (CC-BY style)',
  'kfgqpc-terms': 'KFGQPC reuse terms',
  'digitalkhatt-anane': 'DigitalKhatt — Dr Amin Anane',
  'gpl-derivative': 'GPL-derivative (Quranic Arabic Corpus)',
  'per-translator': 'Per-translator review',
  'per-reciter': 'Per-reciter review',
};

const LICENSE_TONE: Record<string, string> = {
  'public-domain': 'bg-leaf/15 text-leaf border-leaf/30',
  factual: 'bg-ink-50 text-ink-700 border-ink-300/30',
  'permissive-with-credit': 'bg-leaf-300/15 text-leaf-700 border-leaf-300/30',
  'kfgqpc-terms': 'bg-amber-50 text-amber-900 border-amber-200',
  'digitalkhatt-anane': 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200',
  'gpl-derivative': 'bg-rose-50 text-rose-900 border-rose-200',
  'per-translator': 'bg-slate-100 text-slate-700 border-slate-300',
  'per-reciter': 'bg-slate-100 text-slate-700 border-slate-300',
};

async function fetchCredits(): Promise<CreditsResponse | null> {
  try {
    const res = await fetch(`${SERVER_API_BASE}/v1/credits`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CreditsResponse;
  } catch {
    return null;
  }
}

export default async function CreditsPage(): Promise<ReactNode> {
  const data = await fetchCredits();

  return (
    <>
      <SiteNav />

      <header className="border-hairline border-b">
        <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
          <div className="flex items-center gap-3">
            <span className="smallcaps text-leaf text-xs">Credits & data sources</span>
          </div>
          <h1 className="font-display text-ink-strong mt-4 text-4xl font-light tracking-tight md:text-5xl">
            Built on the work of many.
          </h1>
          <p className="text-ink-muted mt-4 max-w-2xl text-base leading-relaxed sm:text-[17px]">
            Every Quranic substrate Qalaam ships — from the page-faithful KFGQPC mushaf layouts to
            the {data?.summary.totalEntries ?? '400+'} translations, tafsirs, recitations, scripts,
            and morphological datasets — comes from the{' '}
            <Link
              href="https://qul.tarteel.ai"
              className="text-leaf underline-offset-4 hover:underline"
            >
              Quranic Universal Library
            </Link>{' '}
            by{' '}
            <Link
              href="https://tarteel.ai"
              className="text-leaf underline-offset-4 hover:underline"
            >
              Tarteel AI
            </Link>
            . Each entry below carries its source link, licence badge, and attribution. We don’t
            hide attribution behind error paths or credits-app-bar copy; this page is the canonical
            place.
          </p>
          {data ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {Object.entries(data.summary.perLicense)
                .sort(([, a], [, b]) => b - a)
                .map(([tag, n]) => (
                  <span
                    key={tag}
                    className={`smallcaps inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tracking-widest ${LICENSE_TONE[tag] ?? 'border-slate-300 bg-slate-50 text-slate-700'}`}
                  >
                    {LICENSE_LABEL[tag] ?? tag}
                    <span className="font-mono text-[11px]">{n}</span>
                  </span>
                ))}
            </div>
          ) : null}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {!data ? (
          <p className="text-ink-muted text-sm italic">
            Credits list is preparing — please check back in a moment.
          </p>
        ) : (
          <div className="space-y-12">
            {CATEGORY_ORDER.flatMap((cat) => {
              const entries = data.groups[cat];
              if (!entries || entries.length === 0) return [];
              return [
                <article key={cat} className="space-y-4">
                  <header className="border-hairline flex items-baseline justify-between border-b pb-3">
                    <h2 className="font-display text-ink-strong text-2xl font-light tracking-tight sm:text-3xl">
                      {CATEGORY_LABEL[cat] ?? cat}
                    </h2>
                    <span className="smallcaps text-ink-muted text-[11px] tabular-nums tracking-widest">
                      {entries.length.toString()} entries
                    </span>
                  </header>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {entries.map((e) => (
                      <li
                        key={`${e.category}-${e.id}`}
                        className="paper-card-raised flex flex-col gap-2 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-ink-strong text-sm font-medium leading-snug">
                            {e.title}
                          </p>
                          <span
                            className={`smallcaps inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] tracking-widest ${LICENSE_TONE[e.licenseTag] ?? 'border-slate-300 bg-slate-50 text-slate-700'}`}
                            title={`License: ${e.licenseTag}`}
                          >
                            {LICENSE_LABEL[e.licenseTag] ?? e.licenseTag}
                          </span>
                        </div>
                        {e.attributionText && e.attributionText !== e.title ? (
                          <p className="text-ink-muted text-xs italic leading-snug">
                            {e.attributionText}
                          </p>
                        ) : null}
                        {e.sourceUrl ? (
                          <Link
                            href={e.sourceUrl}
                            className="smallcaps text-leaf hover:text-leaf-700 inline-flex w-fit items-center gap-1 text-[10px] tracking-widest"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Source on QUL →
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </article>,
              ];
            })}
          </div>
        )}
      </section>

      <footer className="border-hairline border-t">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-ink-muted text-xs leading-relaxed">
            License classifications are auto-tagged via{' '}
            <code className="text-ink-strong font-mono">scripts/data/license-auto-tag.py</code> and
            reviewed manually for per-translator + per-reciter rows before publication (per
            ADR-0020). Each downloaded resource carries a SHA-256 pin per ADR-0002. Re-run the
            pipeline:
          </p>
          <pre className="bg-paper-100 mt-3 overflow-x-auto rounded-md p-3 text-[11px] leading-snug">
            {`# 1. inventory: rebuild /tmp/qul-inventory.json
QUL_EMAIL=... QUL_PASSWORD=... \\
  python3 scripts/data/scrape-qul-full.py --resume

# 2. classify license tags
python3 scripts/data/license-auto-tag.py

# 3. ingest into qalaam_v1_*
tsx scripts/data/ingest-qul-from-scrape.ts`}
          </pre>
        </div>
      </footer>
    </>
  );
}
