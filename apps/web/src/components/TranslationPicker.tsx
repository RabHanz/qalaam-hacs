'use client';

/**
 * TranslationPicker — replaces the inline chip-row when the catalog
 * grows past ~6 entries. With 59 translations across 28 languages,
 * we group by language in a bottom sheet.
 *
 * Design language (per CLAUDE.md §11.3 + the editorial-scripture
 * direction): paper sheet rises from the bottom with a leaf-gold
 * search field on top and language groups stacked. Active translation
 * shows in the trigger chip with the language code as a smallcaps
 * caption — the user always knows what they're reading.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ReactNode } from 'react';

interface Translation {
  readonly slug: string;
  readonly name: string;
  readonly translator: string;
  readonly language: string;
}

interface Props {
  readonly translations: readonly Translation[];
  readonly value: string; // 'none' or translation slug
  readonly onChange: (next: string) => void;
}

/** ISO-639-1 code → English language name + native script flourish. */
const LANG_NAMES: Record<string, { en: string; native: string }> = {
  en: { en: 'English', native: 'English' },
  ar: { en: 'Arabic', native: 'العربية' },
  ur: { en: 'Urdu', native: 'اردو' },
  fr: { en: 'French', native: 'Français' },
  de: { en: 'German', native: 'Deutsch' },
  es: { en: 'Spanish', native: 'Español' },
  id: { en: 'Indonesian', native: 'Bahasa Indonesia' },
  ms: { en: 'Malay', native: 'Bahasa Melayu' },
  tr: { en: 'Turkish', native: 'Türkçe' },
  bn: { en: 'Bengali', native: 'বাংলা' },
  ru: { en: 'Russian', native: 'Русский' },
  zh: { en: 'Chinese', native: '中文' },
  fa: { en: 'Persian', native: 'فارسی' },
  ta: { en: 'Tamil', native: 'தமிழ்' },
  ml: { en: 'Malayalam', native: 'മലയാളം' },
  hi: { en: 'Hindi', native: 'हिन्दी' },
  ja: { en: 'Japanese', native: '日本語' },
  ko: { en: 'Korean', native: '한국어' },
  nl: { en: 'Dutch', native: 'Nederlands' },
  bs: { en: 'Bosnian', native: 'Bosanski' },
  sq: { en: 'Albanian', native: 'Shqip' },
  cs: { en: 'Czech', native: 'Čeština' },
  az: { en: 'Azerbaijani', native: 'Azərbaycanca' },
  ku: { en: 'Kurdish', native: 'Kurdî' },
  ha: { en: 'Hausa', native: 'Hausa' },
  so: { en: 'Somali', native: 'Soomaali' },
  pt: { en: 'Portuguese', native: 'Português' },
  it: { en: 'Italian', native: 'Italiano' },
  sv: { en: 'Swedish', native: 'Svenska' },
  no: { en: 'Norwegian', native: 'Norsk' },
};

export function TranslationPicker({ translations, value, onChange }: Props): ReactNode {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Esc closes; focus on open. While open, lock body scroll so the page
  // behind doesn't bleed through on touch (the iOS rubber-band /
  // overscroll behavior the user reported as "scroll locked"). The
  // scrollable list inside the sheet keeps its own touch-momentum scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // Defer focus to after the sheet animates in — focusing during the
    // CSS transition causes iOS Safari to re-layout, jumping the sheet.
    // Don't auto-focus the input on small screens — opening the keyboard
    // immediately covers half the picker. Desktop still gets the focus.
    const isMobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // Body scroll lock — preserve the current scroll position so we can
    // restore it on close (otherwise iOS jumps to the top).
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    // Compensate for the scrollbar so the page doesn't shift on desktop.
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (sbWidth > 0) document.body.style.paddingRight = `${sbWidth.toString()}px`;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Translation[]>();
    for (const t of translations) {
      const list = groups.get(t.language) ?? [];
      list.push(t);
      groups.set(t.language, list);
    }
    // Sort each group by name; sort languages by count (most common first).
    const out = Array.from(groups.entries())
      .map(([lang, items]) => ({
        lang,
        items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => b.items.length - a.items.length);
    return out;
  }, [translations]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map(({ lang, items }) => {
        const matchLang =
          lang.toLowerCase().includes(q) ||
          (LANG_NAMES[lang]?.en.toLowerCase().includes(q) ?? false) ||
          (LANG_NAMES[lang]?.native.toLowerCase().includes(q) ?? false);
        const items2 = matchLang
          ? items
          : items.filter(
              (t) => t.name.toLowerCase().includes(q) || t.translator.toLowerCase().includes(q),
            );
        return items2.length > 0 ? { lang, items: items2 } : null;
      })
      .filter((g): g is { lang: string; items: Translation[] } => g !== null);
  }, [grouped, filter]);

  const active = translations.find((t) => t.slug === value);
  const triggerLabel =
    value === 'none' ? 'Arabic only' : active ? active.name.replace(/^The /, '') : 'Translation…';
  const triggerLang = value === 'none' ? '' : active ? active.language.toUpperCase() : '';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        title={active?.translator ?? 'Pick a translation'}
        // Larger tap target on mobile (≥44px tall via py-2 + line-height),
        // touch-action: manipulation removes the 300ms tap delay.
        className={`smallcaps inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded-full border px-4 py-2 text-xs tracking-wider transition-colors sm:px-3 sm:py-1 sm:text-xs ${
          value !== 'none'
            ? 'bg-leaf text-paper border-leaf'
            : 'border-hairline text-ink hover:bg-paper-200/60'
        }`}
      >
        <span className="max-w-[10rem] truncate sm:max-w-none">{triggerLabel}</span>
        {triggerLang ? (
          <span
            className={`text-[9px] tracking-widest opacity-70 ${
              value !== 'none' ? 'text-paper' : 'text-ink-muted'
            }`}
          >
            {triggerLang}
          </span>
        ) : null}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          // touch-none on the wrapper would block scroll INSIDE the sheet
          // too; instead we only block touchmove on the backdrop below.
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setOpen(false);
            }}
            // touchmove on the backdrop scrolls nothing — keeps the iOS
            // rubber-band off when the user drags above the sheet.
            onTouchMove={(e) => {
              e.preventDefault();
            }}
            className="bg-ink-900/40 absolute inset-0 backdrop-blur-sm"
          />
          <div
            className="bg-paper border-hairline sheet-rise relative w-full rounded-t-2xl border-t shadow-2xl sm:max-w-md sm:rounded-2xl sm:border"
            style={{
              maxHeight: '92dvh',
              display: 'flex',
              flexDirection: 'column',
              // Honor iOS safe-area so the bottom of the sheet doesn't
              // sit under the home-indicator.
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex justify-center pb-1 pt-3 sm:hidden">
              {/* Drag handle — hint that the sheet is dismissible. */}
              <div className="bg-paper-300/80 h-1.5 w-12 rounded-full" aria-hidden />
            </div>

            <header className="flex items-baseline justify-between px-5 pb-3 pt-3 sm:px-6 sm:pt-6">
              <div>
                <p className="smallcaps text-leaf text-[11px] tracking-widest">Translation</p>
                <h2 className="font-display text-ink-strong text-xl sm:text-2xl">
                  {translations.length.toString()} renderings · {grouped.length.toString()}{' '}
                  languages
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setOpen(false);
                }}
                className="text-ink-muted hover:text-ink -mr-1 p-1"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="px-5 pb-3 sm:px-6">
              <input
                ref={inputRef}
                type="search"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                }}
                placeholder="Language or translator…"
                className="border-hairline bg-paper-100 text-ink placeholder:text-ink-muted focus:border-leaf w-full rounded-full border px-4 py-2 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onChange('none');
                  setOpen(false);
                }}
                className={`mt-3 w-full rounded-full border px-4 py-2 text-left text-sm transition-colors ${
                  value === 'none'
                    ? 'bg-leaf text-paper border-leaf'
                    : 'border-hairline text-ink hover:bg-paper-100'
                }`}
              >
                Arabic only
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto px-3 pb-6 sm:px-4"
              // Keep momentum scroll inside the sheet, prevent it from
              // bleeding into the body. -webkit-overflow-scrolling for
              // older iOS Safari; overscroll-contain for everything else.
              style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              }}
            >
              {filtered.map(({ lang, items }) => {
                const meta = LANG_NAMES[lang];
                return (
                  <div key={lang} className="mb-5">
                    <div className="mb-1.5 flex items-baseline justify-between px-2">
                      <p className="smallcaps text-leaf text-[10px] tracking-widest">
                        {meta?.en ?? lang.toUpperCase()}
                      </p>
                      {meta?.native && meta.native !== meta.en ? (
                        <p
                          className="text-ink-muted text-xs"
                          lang={lang}
                          dir={lang === 'ar' || lang === 'ur' || lang === 'fa' ? 'rtl' : 'ltr'}
                        >
                          {meta.native}
                        </p>
                      ) : null}
                    </div>
                    <ul className="space-y-1">
                      {items.map((t) => {
                        const active = t.slug === value;
                        const cleanName = t.name.replace(/^The /, '');
                        const showsTranslator =
                          t.translator && t.translator.toLowerCase() !== cleanName.toLowerCase();
                        return (
                          <li key={t.slug}>
                            <button
                              type="button"
                              onClick={() => {
                                onChange(t.slug);
                                setOpen(false);
                              }}
                              // ≥44px tall on mobile via py-3 + line-height.
                              // Stack name + translator vertically so neither
                              // truncates awkwardly on narrow viewports.
                              className={`flex w-full touch-manipulation items-start justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors sm:py-2.5 ${
                                active
                                  ? 'bg-leaf/15 text-leaf'
                                  : 'hover:bg-paper-100 active:bg-paper-100'
                              }`}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="font-display block text-[15px] leading-snug sm:text-sm">
                                  {cleanName}
                                </span>
                                {showsTranslator ? (
                                  <span className="smallcaps text-ink-muted mt-0.5 block truncate text-[11px] tracking-widest sm:text-[10px]">
                                    {t.translator}
                                  </span>
                                ) : null}
                              </span>
                              {active ? (
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  aria-hidden
                                  className="mt-1 shrink-0"
                                >
                                  <path
                                    d="M5 13l4 4L19 7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {filtered.length === 0 ? (
                <p className="text-ink-muted py-8 text-center text-sm italic">No match.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
