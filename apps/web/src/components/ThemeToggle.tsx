'use client';

/**
 * Theme toggle — three-state segmented control: light · system · dark.
 *
 * Persists choice to localStorage('qalaam-theme'). Applies via
 * `data-theme="light|dark"` on <html>; the `system` choice removes the
 * attribute so prefers-color-scheme handles it. Companion CSS in
 * globals.css uses `:root[data-theme="dark"]` selector to override the
 * media query.
 *
 * Per CLAUDE.md §11.3: respects reduced-motion (no animation when set).
 * Per design language: small caps, hairline borders, leaf accent on
 * the active option. Three glyph icons (sun / system-circle / crescent).
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { CrescentGlyph } from './Glyph.js';

type Theme = 'light' | 'system' | 'dark';

const STORAGE_KEY = 'qalaam-theme';

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    // Follow OS preference at this moment. We then re-apply on each
    // mediaquery change (wired below).
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  } else {
    root.setAttribute('data-theme', theme);
  }
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function SunGlyph({ size = 14, className }: { size?: number; className?: string }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="3"
          x2="12"
          y2="5.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          transform={`rotate(${deg.toString()} 12 12)`}
        />
      ))}
    </svg>
  );
}

function SystemGlyph({ size = 14, className }: { size?: number; className?: string }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3 A 9 9 0 0 1 12 21 Z" fill="currentColor" />
    </svg>
  );
}

export function ThemeToggle(): ReactNode {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);

    // If "system", react to OS preference changes live.
    if (stored === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = (): void => {
        applyTheme('system');
      };
      mql.addEventListener('change', onChange);
      return () => {
        mql.removeEventListener('change', onChange);
      };
    }
    return undefined;
  }, []);

  function pick(next: Theme): void {
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota / private-mode failures */
    }
  }

  const options: { value: Theme; label: string; icon: typeof SunGlyph }[] = [
    { value: 'light', label: 'Light', icon: SunGlyph },
    { value: 'system', label: 'System', icon: SystemGlyph },
    { value: 'dark', label: 'Dark', icon: CrescentGlyph as typeof SunGlyph },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-full border border-hairline bg-paper-100/70 p-0.5 shrink-0"
    >
      {options.map((opt) => {
        const active = theme === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => pick(opt.value)}
            className={`inline-flex items-center justify-center rounded-full p-1 sm:p-1.5 transition-colors ${
              active
                ? 'bg-surface text-leaf shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon size={12} className="sm:hidden" />
            <Icon size={14} className="hidden sm:inline" />
          </button>
        );
      })}
    </div>
  );
}
