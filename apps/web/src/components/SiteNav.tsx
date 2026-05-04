/**
 * Site navigation — restrained editorial header. Used on every route.
 *
 * Shows: brand mark with Arabic كلام (kalām = "speech / word") + the
 * four primary destinations + theme toggle. Brand text in Fraunces,
 * Arabic in KFGQPC HAFS Uthmanic Script. Links use small-caps + tracked
 * letterspacing rather than the usual sans-serif menu.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { BookGlyph, CrescentGlyph, LanternGlyph, ThreadGlyph } from './Glyph.js';
import { ThemeToggle } from './ThemeToggle.js';

const NAV_ITEMS = [
  { href: '/read/1', label: 'Read', icon: BookGlyph },
  { href: '/listen', label: 'Listen', icon: CrescentGlyph },
  { href: '/hifdh', label: 'Hifdh', icon: ThreadGlyph },
  { href: '/learn', label: 'Learn', icon: LanternGlyph },
] as const;

export function SiteNav(): ReactNode {
  return (
    <header className="border-b border-hairline bg-paper-100/85 backdrop-blur-md sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" aria-label="Qalaam — home" className="group flex items-baseline gap-3 shrink-0">
          <span
            className="font-arabic text-3xl text-leaf"
            dir="rtl"
            aria-label="كلام"
            style={{ lineHeight: 1 }}
          >
            كَلَام
          </span>
          <span className="font-display text-2xl font-medium tracking-tight text-ink-strong">
            Qalaam
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Primary" className="flex items-center gap-0.5 sm:gap-1 mr-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-paper-200/60 transition-colors"
                >
                  <Icon size={16} className="text-ink-muted group-hover:text-leaf transition-colors" />
                  <span className="smallcaps font-medium hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
