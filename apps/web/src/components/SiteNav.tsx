/**
 * Site navigation — restrained editorial header. Used on every route.
 *
 * Mobile-first: at <640px, brand collapses to just the Arabic glyph; nav
 * items show icons only (no labels); theme toggle stays compact. The whole
 * header fits 375px without horizontal overflow.
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4">
        <Link href="/" aria-label="Qalaam — home" className="group flex items-baseline gap-2 sm:gap-3 shrink-0 min-w-0">
          <span
            className="font-arabic text-2xl sm:text-3xl text-leaf"
            dir="rtl"
            lang="ar"
            aria-label="كلام"
            style={{ lineHeight: 1, unicodeBidi: 'plaintext' }}
          >
            كَلَام
          </span>
          <span className="font-display text-lg sm:text-2xl font-medium tracking-tight text-ink-strong hidden xs:inline sm:inline">
            Qalaam
          </span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          <nav aria-label="Primary" className="flex items-center gap-0 sm:gap-1 mr-1 sm:mr-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className="group inline-flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2 gap-2 rounded-md text-sm text-ink hover:bg-paper-200/60 transition-colors"
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
