'use client';

/**
 * SearchInput — search box that lives at the top of /search and (later)
 * in the SiteNav as a Cmd-K trigger. Submits to /search?q=…&lang=… so
 * the result page is server-rendered + bookmarkable.
 *
 * UX:
 *   - Big tap target on mobile, leaf-gold focus ring.
 *   - Optional language filter (en/ur/fr/etc.) as a small chevron pill.
 *   - Native form submission so it works without JS too.
 *   - Cmd-K / Ctrl-K focuses the input from anywhere on the page.
 */
import { useEffect, useRef, useState } from 'react';

import type { ReactNode } from 'react';

interface Props {
  readonly defaultValue?: string;
  readonly defaultLang?: string;
}

const LANG_CHIPS: readonly { code: string; label: string }[] = [
  { code: '', label: 'Any language' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'ur', label: 'اردو' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'id', label: 'Indonesia' },
];

export function SearchInput({ defaultValue = '', defaultLang = '' }: Props): ReactNode {
  const [lang, setLang] = useState(defaultLang);
  const [showLang, setShowLang] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cmd-K / Ctrl-K from anywhere → focus the input.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <form action="/search" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          className="text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          defaultValue={defaultValue}
          placeholder="Search verses, translations, topics…"
          className="border-hairline bg-paper-100 text-ink placeholder:text-ink-muted focus:border-leaf focus:ring-leaf/30 w-full touch-manipulation rounded-full border py-3 pl-11 pr-4 text-[15px] focus:outline-none focus:ring-2 sm:py-2.5 sm:text-base"
        />
      </div>
      <div className="flex items-baseline gap-2">
        <button
          type="button"
          onClick={() => {
            setShowLang((s) => !s);
          }}
          className="smallcaps border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 shrink-0 touch-manipulation rounded-full border px-3 py-2 text-[11px] tracking-widest"
        >
          {LANG_CHIPS.find((c) => c.code === lang)?.label ?? 'Any language'}
        </button>
        <button
          type="submit"
          className="bg-leaf text-paper smallcaps touch-manipulation rounded-full px-4 py-2 text-[11px] tracking-widest hover:opacity-95"
        >
          Search
        </button>
      </div>
      <input type="hidden" name="lang" value={lang} />
      {showLang ? (
        <ul className="sm:bg-paper sm:border-hairline m-0 mt-1 flex list-none flex-wrap gap-1 p-0 sm:absolute sm:right-0 sm:top-full sm:z-30 sm:mt-2 sm:min-w-[200px] sm:flex-col sm:gap-0 sm:rounded-md sm:border sm:shadow-md">
          {LANG_CHIPS.map((c) => (
            <li key={c.code || 'any'}>
              <button
                type="button"
                onClick={() => {
                  setLang(c.code);
                  setShowLang(false);
                }}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors sm:rounded-none ${
                  lang === c.code
                    ? 'bg-leaf/15 text-leaf'
                    : 'border-hairline text-ink hover:bg-paper-100 border sm:border-0'
                }`}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
