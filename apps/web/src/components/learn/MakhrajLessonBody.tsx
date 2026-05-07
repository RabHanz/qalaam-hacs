/**
 * MakhrajLessonBody — body for /learn/2/makhraj-{throat,tongue,lips,nasal}.
 *
 * The lesson page already renders the MakhrajDiagram component above
 * the body via the `isMakhraj` branch. This body adds:
 *   1. The Arabic name + zone label
 *   2. Anatomical description (factual)
 *   3. The canonical letter list for the zone — large Naskh, RTL,
 *      tap to open that letter's lesson.
 */
import Link from 'next/link';

import { LETTERS } from '../../lib/letter-data.js';
import { HairlineDivider } from '../Glyph.js';

import type { MakhrajZoneEntry } from '../../lib/letter-data.js';
import type { ReactNode } from 'react';

interface Props {
  readonly entry: MakhrajZoneEntry;
}

/**
 * Resolve a glyph back to its lesson slug so the chip can deep-link
 * to /learn/1/letter-<slug>. Letters without a Level 1 lesson (the
 * hamzah ء shows up in the throat zone but not in the 28-letter
 * curriculum) get rendered as plain glyphs without a link.
 */
function letterSlugFor(glyph: string): string | null {
  const entry = LETTERS.find((l) => l.glyph === glyph);
  return entry ? entry.slug : null;
}

export function MakhrajLessonBody({ entry }: Props): ReactNode {
  return (
    <div className="space-y-10">
      <div>
        <p className="smallcaps text-leaf text-[10px] tracking-widest">Makhraj · مَخْرَج</p>
        <p
          className="text-ink-strong mt-2 font-light"
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
            letterSpacing: '-0.012em',
          }}
        >
          {entry.nameEn}
        </p>
      </div>

      <HairlineDivider />

      <section aria-label="Anatomical reference">
        <p className="smallcaps text-leaf mb-3 text-[10px] tracking-widest">
          Where in the mouth · الموضع
        </p>
        <p className="text-ink/85 max-w-prose text-base leading-relaxed">{entry.anatomical}</p>
      </section>

      <section aria-label="Letters in this zone">
        <p className="smallcaps text-leaf mb-4 text-[10px] tracking-widest">Letters · الحُرُوف</p>
        <ul className="flex flex-wrap gap-2" role="list" dir="rtl">
          {entry.letters.map((g, idx) => {
            const slug = letterSlugFor(g);
            const className =
              'font-arabic border-hairline hover:border-leaf/40 hover:text-leaf-700 inline-flex h-12 w-12 items-center justify-center rounded-md border text-2xl transition-colors';
            if (slug) {
              return (
                <li key={`${g}-${idx.toString()}`}>
                  <Link href={`/learn/1/letter-${slug}`} className={className}>
                    <span style={{ unicodeBidi: 'plaintext', lineHeight: 1 }}>{g}</span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={`${g}-${idx.toString()}`}>
                <span className={className.replace('hover:border-leaf/40 hover:text-leaf-700', '')}>
                  <span style={{ unicodeBidi: 'plaintext', lineHeight: 1 }}>{g}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
