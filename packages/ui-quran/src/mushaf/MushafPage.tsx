/**
 * MushafPage — page-faithful renderer.
 *
 * Per strategy §7.1 same-mushaf rule: layout is loaded from QUL via
 * `@qalaam/data-loader/qul#getMushafLayout`. This component knows nothing about
 * loading — it accepts an array of `AyahLine` props and renders them.
 */
import type { ReactNode } from 'react';

import { AyahLine, type AyahLineProps } from '../components/AyahLine.js';
import { BasmalaHeader } from '../components/BasmalaHeader.js';

export interface MushafPageProps {
  readonly pageNumber: number;
  readonly surahNumber: number;
  readonly showBasmala?: boolean;
  readonly ayahs: readonly AyahLineProps[];
}

export function MushafPage({
  pageNumber,
  surahNumber,
  showBasmala = false,
  ayahs,
}: MushafPageProps): ReactNode {
  return (
    <section
      aria-label={`Page ${String(pageNumber)} of the Madani 15-line mushaf`}
      style={{
        background: 'var(--color-surface-raised, #fff)',
        borderRadius: '1rem',
        padding: '2rem 1.5rem',
        boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
      }}
    >
      {showBasmala ? <BasmalaHeader surahNumber={surahNumber} /> : null}
      {ayahs.map((a) => (
        <AyahLine key={a.verseKey} {...a} />
      ))}
      <footer
        style={{
          textAlign: 'center',
          marginTop: '1rem',
          fontSize: '0.75rem',
          opacity: 0.6,
        }}
      >
        ﴾ {pageNumber} ﴿
      </footer>
    </section>
  );
}
