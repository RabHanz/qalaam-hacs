/**
 * VowelLessonBody — structurally-factual body for fatḥah, kasrah,
 * ḍammah, and sukūn lessons.
 *
 * Composition:
 *   1. The mark itself, large, on a host letter (we use ب as the
 *      neutral host since it's the mushaf's first letter).
 *   2. What it does — short factual line on the sound + position.
 *   3. Quranic word examples that prominently feature the mark.
 */
import Link from 'next/link';

import { HairlineDivider } from '../Glyph.js';

import type { VowelEntry } from '../../lib/letter-data.js';
import type { ReactNode } from 'react';

interface Props {
  readonly vowel: VowelEntry;
}

const HOST_LETTER = 'ب';

export function VowelLessonBody({ vowel }: Props): ReactNode {
  return (
    <div className="space-y-10">
      <div className="text-center">
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-ink-strong text-[120px] leading-none sm:text-[160px]"
          style={{ unicodeBidi: 'plaintext' }}
        >
          {`${HOST_LETTER}${vowel.mark}`}
        </p>
        <p className="smallcaps text-ink-muted mt-3 text-[10px] tracking-widest">
          {vowel.nameEn}
          <span className="opacity-50"> · </span>
          <span dir="rtl" lang="ar" className="font-arabic">
            {vowel.nameAr}
          </span>
          <span className="text-leaf ml-3 font-mono">→ "{vowel.sound}"</span>
        </p>
      </div>

      <HairlineDivider />

      <section aria-label="What it does">
        <p className="smallcaps text-leaf mb-3 text-[10px] tracking-widest">
          What it does · أَثَر الحَرَكَة
        </p>
        <p className="text-ink/85 max-w-prose text-base leading-relaxed">{vowel.effect}</p>
      </section>

      {vowel.examples.length > 0 ? (
        <section aria-label="Examples from the Quran">
          <p className="smallcaps text-leaf mb-4 text-[10px] tracking-widest">
            In the Qur’an · في القرآن
          </p>
          <ul className="divide-hairline divide-y" role="list">
            {vowel.examples.map((ex) => {
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
