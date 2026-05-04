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

  // Esc closes; focus on open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener('keydown', onKey);
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
              (t) =>
                t.name.toLowerCase().includes(q) ||
                t.translator.toLowerCase().includes(q),
            );
        return items2.length > 0 ? { lang, items: items2 } : null;
      })
      .filter((g): g is { lang: string; items: Translation[] } => g !== null);
  }, [grouped, filter]);

  const active = translations.find((t) => t.slug === value);
  const triggerLabel =
    value === 'none'
      ? 'Arabic only'
      : active
        ? `${active.name.replace(/^The /, '')}`
        : 'Translation…';
  const triggerLang =
    value === 'none' ? '' : active ? active.language.toUpperCase() : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={active?.translator ?? 'Pick a translation'}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] sm:text-xs smallcaps tracking-wider transition-colors border ${
          value !== 'none'
            ? 'bg-leaf text-paper border-leaf'
            : 'border-hairline text-ink hover:bg-paper-200/60'
        }`}
      >
        <span>{triggerLabel}</span>
        {triggerLang ? (
          <span
            className={`text-[9px] tracking-widest opacity-70 ${
              value !== 'none' ? 'text-paper' : 'text-ink-muted'
            }`}
          >
            {triggerLang}
          </span>
        ) : null}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
          />
          <div
            className="relative w-full sm:max-w-md sm:rounded-2xl bg-paper border-t sm:border border-hairline shadow-2xl rounded-t-2xl sheet-rise"
            style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-paper-300/60" aria-hidden />
            </div>

            <header className="px-5 sm:px-6 pt-3 sm:pt-6 pb-3 flex items-baseline justify-between">
              <div>
                <p className="smallcaps text-leaf text-[11px] tracking-widest">Translation</p>
                <h2 className="font-display text-xl sm:text-2xl text-ink-strong">
                  {translations.length.toString()} renderings · {grouped.length.toString()} languages
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-ink-muted hover:text-ink p-1 -mr-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="px-5 sm:px-6 pb-3">
              <input
                ref={inputRef}
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Language or translator…"
                className="w-full rounded-full border border-hairline bg-paper-100 px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-leaf"
              />
              <button
                type="button"
                onClick={() => {
                  onChange('none');
                  setOpen(false);
                }}
                className={`mt-3 w-full text-left rounded-full px-4 py-2 text-sm border transition-colors ${
                  value === 'none'
                    ? 'bg-leaf text-paper border-leaf'
                    : 'border-hairline text-ink hover:bg-paper-100'
                }`}
              >
                Arabic only
              </button>
            </div>

            <div className="overflow-y-auto px-3 sm:px-4 pb-6 flex-1">
              {filtered.map(({ lang, items }) => {
                const meta = LANG_NAMES[lang];
                return (
                  <div key={lang} className="mb-5">
                    <div className="flex items-baseline justify-between px-2 mb-1.5">
                      <p className="smallcaps text-leaf text-[10px] tracking-widest">
                        {meta?.en ?? lang.toUpperCase()}
                      </p>
                      {meta?.native && meta.native !== meta.en ? (
                        <p className="text-xs text-ink-muted" lang={lang} dir={lang === 'ar' || lang === 'ur' || lang === 'fa' ? 'rtl' : 'ltr'}>
                          {meta.native}
                        </p>
                      ) : null}
                    </div>
                    <ul className="space-y-1">
                      {items.map((t) => {
                        const active = t.slug === value;
                        return (
                          <li key={t.slug}>
                            <button
                              type="button"
                              onClick={() => {
                                onChange(t.slug);
                                setOpen(false);
                              }}
                              className={`w-full text-left flex items-baseline justify-between gap-3 px-3 py-2.5 rounded-md transition-colors ${
                                active ? 'bg-leaf/15 text-leaf' : 'hover:bg-paper-100'
                              }`}
                            >
                              <span className="font-display text-sm truncate">
                                {t.name.replace(/^The /, '')}
                              </span>
                              <span className="text-[10px] smallcaps text-ink-muted tracking-widest shrink-0 truncate max-w-[40%]">
                                {t.translator}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-ink-muted italic py-8">No match.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
