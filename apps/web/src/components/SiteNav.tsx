/**
 * Site navigation — restrained editorial header. Used on every route.
 *
 * Mobile-first: at <640px, brand collapses to just the Arabic glyph; nav
 * items show icons only (no labels); theme toggle stays compact. The whole
 * header fits 375px without horizontal overflow.
 */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { parseVerseKey, readPlaybackSnapshot } from '../lib/playback-store.js';

import { BookGlyph, CrescentGlyph, LanternGlyph, ThreadGlyph } from './Glyph.js';
import { ThemeToggle } from './ThemeToggle.js';
import { UserMenu } from './UserMenu.js';

import type { ReactNode } from 'react';

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: typeof BookGlyph;
}

const STATIC_NAV: readonly NavItem[] = [
  { href: '/listen', label: 'Listen', icon: CrescentGlyph },
  { href: '/hifdh', label: 'Hifdh', icon: ThreadGlyph },
  { href: '/learn', label: 'Learn', icon: LanternGlyph },
  { href: '/salah', label: 'Salah', icon: CrescentGlyph },
  { href: '/azkar', label: 'Azkar', icon: ThreadGlyph },
];

export function SiteNav(): ReactNode {
  // Read link routes to /read/<surah> based on the user's last
  // playback verse, so a user listening to surah 5:10 on /listen
  // gets dropped onto /read/5 (where the cross-page resume in
  // ContinuousReaderPlayer can then auto-start at 5:10) instead of
  // landing on /read/1 every time. Default to /read/1 on SSR + first
  // paint to avoid hydration mismatch; upgrade once mounted.
  const [readHref, setReadHref] = useState('/read/1');
  useEffect(() => {
    const snap = readPlaybackSnapshot();
    if (snap.verseKey) {
      const parsed = parseVerseKey(snap.verseKey);
      if (parsed) setReadHref(`/read/${parsed[0].toString()}`);
    }
  }, []);

  const NAV_ITEMS: readonly NavItem[] = [
    { href: readHref, label: 'Read', icon: BookGlyph },
    ...STATIC_NAV,
  ];
  return (
    <header className="border-hairline bg-paper-100/85 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          aria-label="Qalaam — home"
          className="group flex min-w-0 shrink-0 items-baseline gap-2 sm:gap-3"
        >
          <span
            className="font-arabic text-leaf text-2xl sm:text-3xl"
            dir="rtl"
            lang="ar"
            aria-label="كلام"
            style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
          >
            كَلَام
          </span>
          <span className="font-display text-ink-strong xs:inline hidden text-lg font-medium tracking-tight sm:inline sm:text-2xl">
            Qalaam
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <nav aria-label="Primary" className="mr-1 flex items-center gap-0 sm:mr-2 sm:gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className="text-ink hover:bg-paper-200/60 group inline-flex h-9 w-9 items-center justify-center gap-2 rounded-md text-sm transition-colors sm:h-auto sm:w-auto sm:px-3 sm:py-2"
                >
                  <Icon
                    size={16}
                    className="text-ink-muted group-hover:text-leaf transition-colors"
                  />
                  <span className="smallcaps hidden font-medium sm:inline">{item.label}</span>
                </Link>
              );
            })}
            <Link
              href="/search"
              aria-label="Search · ⌘K"
              title="Search · ⌘K"
              className="text-ink hover:bg-paper-200/60 group inline-flex h-9 w-9 items-center justify-center gap-2 rounded-md text-sm transition-colors sm:h-auto sm:w-auto sm:px-3 sm:py-2"
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
                className="text-ink-muted group-hover:text-leaf transition-colors"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" strokeLinecap="round" />
              </svg>
              <span className="smallcaps hidden font-medium sm:inline">Search</span>
            </Link>
          </nav>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
