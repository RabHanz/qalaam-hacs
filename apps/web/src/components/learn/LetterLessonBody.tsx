/**
 * LetterLessonBody — structurally-factual body for a single Arabic-
 * letter lesson.
 *
 * Composition:
 *   1. Big glyph at display size (centred, RTL plaintext bidi).
 *   2. Joining table — letter alone + initial + medial + final, each
 *      anchored to a tatweel so the OS shaper produces the contextual
 *      form. This is structural Arabic typography, not pedagogy.
 *   3. Makhraj zone — articulation-anatomy fact, links to the makhraj
 *      lesson if one exists.
 *   4. "In the Quran" — 2-3 real Quranic word examples, each linking
 *      to the verse where it occurs in /study.
 *
 * Editorial visual register matches the rest of /learn — paper card,
 * smallcaps tags, Naskh Arabic at scale, mono tabular-nums for refs.
 */
import Link from 'next/link';

import { HairlineDivider } from '../Glyph.js';

import type { LetterEntry } from '../../lib/letter-data.js';
import type { ReactNode } from 'react';

interface Props {
  readonly letter: LetterEntry;
}

const MAKHRAJ_HREF: Record<string, string> = {
  throat: '/learn/2/makhraj-throat',
  tongue: '/learn/2/makhraj-tongue',
  lips: '/learn/2/makhraj-lips',
  nasal: '/learn/2/makhraj-nasal',
  jawf: '/learn/2/makhraj-overview',
};

const MAKHRAJ_LABEL: Record<string, string> = {
  throat: 'Throat (al-ḥalq)',
  tongue: 'Tongue (al-lisān)',
  lips: 'Lips (ash-shafatān)',
  nasal: 'Nasal (al-khayshūm)',
  jawf: 'Hollow of the mouth (al-jawf)',
};

export function LetterLessonBody({ letter }: Props): ReactNode {
  // Tatweel-anchored joining variants. These are the four contextual
  // shapes Arabic shapers produce for any letter — we don't author
  // the glyph, the OS does, given the joining context.
  const joining: { label: string; render: string }[] = [
    { label: 'Isolated', render: letter.glyph },
    { label: 'Initial', render: `${letter.glyph}ـ` },
    { label: 'Medial', render: `ـ${letter.glyph}ـ` },
    { label: 'Final', render: `ـ${letter.glyph}` },
  ];

  return (
    <div className="space-y-10">
      {/* Big glyph — the visual anchor */}
      <div className="text-center">
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-ink-strong text-[120px] leading-none sm:text-[160px]"
          style={{ unicodeBidi: 'plaintext' }}
        >
          {letter.glyph}
        </p>
        <p className="smallcaps text-ink-muted mt-3 text-[10px] tracking-widest">
          {letter.nameEn}
          <span className="opacity-50"> · </span>
          <span dir="rtl" lang="ar" className="font-arabic">
            {letter.nameAr}
          </span>
        </p>
      </div>

      <HairlineDivider />

      {/* Joining table */}
      <section aria-label="Positional joining">
        <p className="smallcaps text-leaf mb-4 text-[10px] tracking-widest">
          How it joins · الاتصال
        </p>
        <ul
          className="bg-paper-200/40 grid grid-cols-2 gap-px overflow-hidden rounded-lg sm:grid-cols-4"
          role="list"
        >
          {joining.map((j) => (
            <li
              key={j.label}
              className="bg-paper flex flex-col items-center justify-center gap-2 px-4 py-6"
            >
              <span
                dir="rtl"
                lang="ar"
                className="font-arabic text-ink-strong text-4xl"
                style={{ unicodeBidi: 'plaintext', lineHeight: 1.4 }}
              >
                {j.render}
              </span>
              <span className="smallcaps text-ink-muted text-[10px] tracking-widest">
                {j.label}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-ink-muted mt-3 max-w-prose text-xs italic leading-relaxed">
          The shape rendered above each label is the same letter in four typographic positions.
          Modern Arabic fonts perform this contextual shaping automatically.
        </p>
      </section>

      {/* Makhraj zone */}
      <section aria-label="Articulation point">
        <p className="smallcaps text-leaf mb-2 text-[10px] tracking-widest">
          Articulated from · المَخْرَج
        </p>
        <Link
          href={MAKHRAJ_HREF[letter.makhraj] ?? '#'}
          className="paper-card hover:border-leaf/40 group block p-4 transition-colors"
        >
          <p className="text-ink font-display text-lg leading-tight">
            {MAKHRAJ_LABEL[letter.makhraj] ?? letter.makhraj}
          </p>
          <p className="smallcaps text-leaf mt-2 inline-flex items-center gap-1.5 text-[10px] tracking-widest">
            Open the makhraj lesson
            <span aria-hidden className="rtl-flip transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </p>
        </Link>
      </section>

      {/* Quran corpus examples */}
      {letter.examples.length > 0 ? (
        <section aria-label="Examples from the Quran">
          <p className="smallcaps text-leaf mb-4 text-[10px] tracking-widest">
            In the Qur’an · في القرآن
          </p>
          <ul className="divide-hairline divide-y" role="list">
            {letter.examples.map((ex) => {
              const [s, a] = ex.verseKey.split(':');
              return (
                <li
                  key={ex.verseKey + ex.word}
                  className="flex items-baseline justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-ink-strong text-2xl sm:text-3xl"
                      style={{ unicodeBidi: 'plaintext', lineHeight: 1.4 }}
                    >
                      {ex.word}
                    </p>
                    <p className="text-ink-muted mt-1 text-xs italic">
                      {ex.translit} <span className="opacity-50">·</span> {ex.gloss}
                    </p>
                  </div>
                  <Link
                    href={`/study/${s ?? '1'}/${a ?? '1'}`}
                    className="smallcaps text-ink-muted hover:text-leaf shrink-0 font-mono text-[11px] tabular-nums tracking-widest"
                  >
                    {ex.verseKey} →
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
