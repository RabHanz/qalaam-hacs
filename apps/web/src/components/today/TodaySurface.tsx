/**
 * TodaySurface — server component that composes the authenticated
 * homepage. Layout:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                         GREETING                            │
 *   ├─────────────────────────────────────────┬───────────────────┤
 *   │                                          │  Next prayer      │
 *   │  Verse of the day                        │                   │
 *   │  (large Arabic, italic translation,      │  Continue         │
 *   │   restrained ref + study link)           │                   │
 *   │                                          │  Today's hifdh    │
 *   │  (7 cols, the visual anchor)             │                   │
 *   │                                          │  (5 cols)         │
 *   └─────────────────────────────────────────┴───────────────────┘
 *
 * The right rail's order is intentional: prayer first (time-sensitive),
 * then continue (immediate-action), then hifdh (longer-form practice).
 *
 * Server-rendered VotD: the verse text + translation come from the
 * backend during SSR so first paint shows real Quranic content with
 * no skeleton, no JS dependency, no flicker.
 */
import { pickVerseOfDay } from '../../lib/verse-of-day.js';

import { ContinueCard } from './ContinueCard.js';
import { NextPrayerCard } from './NextPrayerCard.js';
import { ReviewCard } from './ReviewCard.js';
import { TodayGreeting } from './TodayGreeting.js';
import { VerseOfDayCard } from './VerseOfDayCard.js';

import type { ReactNode } from 'react';

interface Surah {
  surah: number;
  nameArabic: string;
  nameEnglish: string;
  verseCount: number;
  revelationPlace: 'makkah' | 'madinah';
}

interface Props {
  readonly displayName: string | null;
  readonly apiBase: string;
  readonly surahs: readonly Surah[];
}

interface VerseRow {
  textUthmani?: string;
  text_uthmani?: string;
}

interface TranslationRow {
  text?: string;
  translator?: string;
  name?: string;
}

async function fetchVotdContent(
  apiBase: string,
  verseKey: string,
): Promise<{ arabic: string; translation: string | null; translatorLabel: string | null }> {
  const fallback = { arabic: '', translation: null, translatorLabel: null };
  try {
    const [verseRes, translationRes] = await Promise.all([
      fetch(`${apiBase}/v1/verses/by_key/${encodeURIComponent(verseKey)}`, {
        next: { revalidate: 86400 },
      }),
      fetch(`${apiBase}/v1/translations/pickthall/by_verse/${encodeURIComponent(verseKey)}`, {
        next: { revalidate: 86400 },
      }),
    ]);
    let arabic = '';
    if (verseRes.ok) {
      const body = (await verseRes.json()) as VerseRow;
      arabic = body.textUthmani ?? body.text_uthmani ?? '';
    }
    let translation: string | null = null;
    let translatorLabel: string | null = null;
    if (translationRes.ok) {
      const body = (await translationRes.json()) as TranslationRow;
      translation = body.text ?? null;
      translatorLabel = body.translator ?? body.name ?? 'Pickthall';
    }
    return { arabic, translation, translatorLabel };
  } catch {
    return fallback;
  }
}

export async function TodaySurface({ displayName, apiBase, surahs }: Props): Promise<ReactNode> {
  const pick = pickVerseOfDay();
  const { arabic, translation, translatorLabel } = await fetchVotdContent(apiBase, pick.verseKey);

  return (
    <section className="border-hairline border-b">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:space-y-10 sm:px-6 sm:py-16 md:py-20">
        <TodayGreeting displayName={displayName} />

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-12">
          <div className="reveal reveal-2 lg:col-span-7">
            {arabic ? (
              <VerseOfDayCard
                verseKey={pick.verseKey}
                title={pick.title}
                arabic={arabic}
                translation={translation}
                translatorLabel={translatorLabel}
              />
            ) : (
              // Backend unreachable — fall back to a quiet card that
              // still gives the user something to do.
              <article className="paper-card-raised p-8 sm:p-10">
                <p className="smallcaps text-leaf text-[11px] tracking-widest">
                  Verse of the day · آيَة اليَوْم
                </p>
                <p className="text-ink-muted mt-4 text-sm italic leading-relaxed">
                  We couldn’t reach the mushaf right now. Try opening Sūrat al-Fātiḥa to start.
                </p>
              </article>
            )}
          </div>

          <aside className="reveal reveal-3 space-y-4 sm:space-y-5 lg:col-span-5">
            <NextPrayerCard />
            <ContinueCard surahs={surahs} />
            <ReviewCard />
          </aside>
        </div>
      </div>
    </section>
  );
}
