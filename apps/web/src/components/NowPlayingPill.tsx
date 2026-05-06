'use client';

/**
 * NowPlayingPill — floating session-continuity affordance.
 *
 * Where it appears: every page EXCEPT /listen and /read (those have
 * the player chrome already, and an extra pill there would be noise).
 * When it appears: the canonical playback store says the user is
 * currently playing audio.
 *
 * Why this exists: a returning visitor on /family, /azkar, /salah,
 * etc. might not realise the recitation that started ten minutes ago
 * is still rolling. The pill is a quiet "yes, that surah is still
 * playing — tap to return" without dragging player chrome onto every
 * surface.
 *
 * Aesthetic: a single small paper card in the top-right corner with
 * a three-bar equalizer animation as the only motion. Reduced-motion
 * shows static bars. ESC dismisses for the session (not persisted).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { parseVerseKey, readPlaybackSnapshot } from '../lib/playback-store.js';

import type { ReactNode } from 'react';

const HIDDEN_PREFIXES: readonly string[] = ['/listen', '/read', '/admin', '/signin', '/signup'];

interface Snapshot {
  reciterSlug: string | null;
  verseKey: string | null;
  isPlaying: boolean;
}

export function NowPlayingPill(): ReactNode {
  const pathname = usePathname();
  const [snap, setSnap] = useState<Snapshot>({
    reciterSlug: null,
    verseKey: null,
    isPlaying: false,
  });
  const [dismissed, setDismissed] = useState(false);

  // Sync from the canonical store on mount + listen for cross-tab
  // localStorage events + poll every 4 s as a backstop (the store
  // doesn't currently emit a custom event when MiniPlayer toggles
  // play locally).
  useEffect(() => {
    function pull(): void {
      const s = readPlaybackSnapshot();
      setSnap({
        reciterSlug: s.reciterSlug,
        verseKey: s.verseKey,
        isPlaying: s.isPlaying,
      });
    }
    pull();
    const id = window.setInterval(pull, 4000);
    function onStorage(e: StorageEvent): void {
      if (e.key?.startsWith('qalaam-')) pull();
    }
    window.addEventListener('storage', onStorage);
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setDismissed(true);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Reset the dismiss state when the verse changes — a new track is
  // a new session, the user may want the pill back.
  const verseKey = snap.verseKey;
  useEffect(() => {
    setDismissed(false);
  }, [verseKey]);

  if (dismissed) return null;
  if (!snap.isPlaying || !snap.verseKey) return null;
  // Suppress on surfaces that already have rich player chrome.
  for (const p of HIDDEN_PREFIXES) {
    if (pathname.startsWith(p)) return null;
  }
  const parsed = parseVerseKey(snap.verseKey);
  if (!parsed) return null;
  const [s, a] = parsed;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[68px] z-30 flex justify-end px-3 sm:top-[80px] sm:px-6"
      role="status"
      aria-live="polite"
    >
      <Link
        href={`/listen#${snap.verseKey}`}
        className="paper-card hover:border-leaf/40 group pointer-events-auto flex items-center gap-3 px-4 py-2 shadow-md transition-colors"
        style={{ animation: 'q-fade-in 240ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <span aria-hidden className="q-eq inline-flex items-end gap-[2px]">
          <span className="bg-leaf q-eq-bar block w-[3px]" />
          <span className="bg-leaf q-eq-bar q-eq-bar-2 block w-[3px]" />
          <span className="bg-leaf q-eq-bar q-eq-bar-3 block w-[3px]" />
        </span>
        <div className="min-w-0">
          <p className="smallcaps text-leaf text-[10px] tracking-widest">Now playing</p>
          <p className="text-ink truncate text-xs leading-tight">
            <span className="font-mono tabular-nums">
              {s.toString()}:{a.toString()}
            </span>
            {snap.reciterSlug ? (
              <span className="text-ink-muted ml-1.5">· {snap.reciterSlug}</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDismissed(true);
          }}
          className="text-ink-muted hover:text-ink shrink-0 text-xs"
        >
          ×
        </button>
      </Link>
    </div>
  );
}
