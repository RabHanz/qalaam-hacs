/**
 * /recite/[verseKey] — verse-pause Hifdh drill.
 *
 * Editorial layout: hero card with verse-key in display, full Arabic
 * text in centered Quranic typography, then the FeedbackSession panel.
 * Privacy framing rendered inline so the user sees adab-respecting
 * "audio stays on device" copy before they even tap the mic.
 *
 * Per strategy §8.7. Privacy posture per ADR-0005: realtime-feedback
 * lives on-device or on the family LAN. WS default is localhost.
 */

import { QalaamError, parseVerseKey } from '@qalaam/core';
import { FeedbackSession } from '@qalaam/ui-recite';

import { EmptyState } from '../../../components/EmptyState.js';
import { ErrorState } from '../../../components/ErrorState.js';
import { HairlineDivider, ThreadGlyph } from '../../../components/Glyph.js';
import { SiteNav } from '../../../components/SiteNav.js';
import { qalaamClient } from '../../../lib/qalaam-client.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ verseKey: string }>;
}

const DEFAULT_WS_URL =
  process.env.NEXT_PUBLIC_REALTIME_FEEDBACK_WS_URL ?? 'ws://localhost:5003/v1/feedback';

export default async function RecitePage({ params }: PageProps): Promise<ReactNode> {
  const { verseKey: rawKey } = await params;
  let key;
  try {
    key = parseVerseKey(rawKey);
  } catch {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState title="Invalid verse" hint={`Got "${rawKey}" — expected "surah:ayah".`} />
        </div>
      </>
    );
  }

  let arabic: string;
  try {
    arabic = (await qalaamClient.getVerseByKey(key)).textUthmani;
  } catch (err) {
    if (err instanceof QalaamError && err.code === 'qalaam.data.not-loaded') {
      return (
        <>
          <SiteNav />
          <div className="mx-auto max-w-3xl px-6 py-20">
            <EmptyState
              title="This verse is preparing"
              hint="We're getting things ready for you. Please check back in a moment."
            />
          </div>
        </>
      );
    }
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <ErrorState message={err instanceof Error ? err.message : String(err)} />
        </div>
      </>
    );
  }

  const [surah, ayah] = key.split(':');

  return (
    <>
      <SiteNav />

      <header className="border-hairline border-b">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex items-center gap-3">
            <ThreadGlyph size={20} className="text-leaf" />
            <span className="smallcaps text-leaf text-xs">Recite · تَرْتِيل</span>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-display text-ink-strong text-5xl font-light tracking-tight md:text-6xl">
              Verse-pause drill
            </h1>
            <p
              className="font-display text-ink-strong text-7xl font-light tabular-nums md:text-8xl"
              style={{ lineHeight: 0.9 }}
            >
              {surah}:{ayah}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl grid-cols-12 gap-10 px-6 py-12">
        <article className="reveal col-span-12 lg:col-span-8">
          <div className="paper-card-raised relative overflow-hidden p-10 md:p-14">
            <div
              className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-30"
              style={{
                background:
                  'radial-gradient(circle at 75% 30%, var(--color-leaf-300) 0%, transparent 60%)',
              }}
              aria-hidden
            />
            <div className="relative">
              <p className="smallcaps text-leaf mb-6 text-xs">Expected text · Uthmani</p>
              <p
                dir="rtl"
                className="font-arabic text-ink-strong text-center"
                style={{
                  fontSize: 'clamp(2rem, 1.5rem + 1.5vw, 3rem)',
                  lineHeight: 2.1,
                  unicodeBidi: 'plaintext',
                  fontWeight: 600,
                }}
                aria-label={`Verse ${key}`}
              >
                {arabic}
              </p>
            </div>
          </div>

          <div className="reveal reveal-2 mt-8">
            <FeedbackSession verseKey={key} expectedTextUthmani={arabic} wsUrl={DEFAULT_WS_URL} />
          </div>
        </article>

        <aside className="reveal reveal-3 col-span-12 lg:col-span-4">
          <div className="paper-card sticky top-24 p-8">
            <p className="smallcaps text-leaf text-xs">Privacy</p>
            <p className="text-ink mt-3 text-sm leading-relaxed">
              Audio stays on this device. Mistake feedback comes back only from your local
              realtime-feedback worker — nothing leaves your home.
            </p>
            <HairlineDivider />
            <p className="smallcaps text-leaf text-xs">Adab</p>
            <p className="text-ink mt-3 text-sm leading-relaxed">
              No score. No grade. The phrasing — "let's try once more" vs "perfect" — is the only
              signal you'll see. The mistakes you encounter become tomorrow's portion.
            </p>
            <HairlineDivider />
            <p className="smallcaps text-leaf text-xs">Mistake colors</p>
            <ul className="text-ink mt-3 space-y-2 text-sm">
              <li>
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: '#c75450' }}
                />
                Substitution
              </li>
              <li>
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: '#5a9c6a' }}
                />
                Insertion
              </li>
              <li>
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: '#d4a23a' }}
                />
                Deletion
              </li>
              <li>
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: '#8a6f3c' }}
                />
                Tajweed slip
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}
