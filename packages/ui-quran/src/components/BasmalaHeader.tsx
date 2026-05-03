/**
 * Basmala header — shown above every surah except Surah 9 (At-Tawbah).
 */
import type { ReactNode } from 'react';

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

export interface BasmalaHeaderProps {
  readonly surahNumber: number;
}

export function BasmalaHeader({ surahNumber }: BasmalaHeaderProps): ReactNode | null {
  if (surahNumber === 9) return null;
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '1.5rem 0',
        fontFamily: "'KFGQPC HAFS Uthmanic Script V2', 'Amiri Quran', serif",
        fontSize: '2rem',
        direction: 'rtl',
        unicodeBidi: 'plaintext',
      }}
      aria-label="Bismillah"
    >
      {BASMALA}
    </div>
  );
}
