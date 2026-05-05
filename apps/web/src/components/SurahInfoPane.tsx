/**
 * SurahInfoPane — server-rendered editorial card surfacing /v1/surah-info.
 *
 * Surfaces the INTRO promise: "Asbab al-nuzul (the story behind each
 * verse's revelation) for the verses where it's known" + the per-surah
 * summary, themes, and revelation context that makes a verse actually
 * land.
 *
 * Rendered on:
 *   - /read/[surah] header (compact: revelation place + verse count + summary)
 *   - /study/[surah]/[ayah] sidebar (expanded: themes + virtues + asbab)
 *
 * Hydration-safe: we fetch server-side via the Next.js apiBase so the
 * card paints on first byte; degrade gracefully when the surah row is
 * sparse (e.g., no themes ingested for that surah).
 */
import type { ReactNode } from 'react';

interface SurahInfoData {
  readonly surah: number;
  readonly languageCode: string;
  readonly nameArabic: string;
  readonly nameTranslated: string | null;
  readonly nameMeaning: string | null;
  readonly revelationPlace: 'makkah' | 'madinah';
  readonly revelationOrder: number;
  readonly verseCount: number;
  readonly summary: string | null;
  readonly themes: readonly string[];
  readonly asbabAlNuzul: string | null;
}

interface ApiResponse {
  readonly data: SurahInfoData;
  readonly attribution: string;
  readonly license: string;
}

async function fetchSurahInfo(surah: number, apiBase: string): Promise<ApiResponse | null> {
  try {
    const res = await fetch(`${apiBase}/v1/surah-info/${surah.toString()}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ApiResponse;
  } catch {
    return null;
  }
}

interface CompactProps {
  readonly surah: number;
  readonly apiBase: string;
  readonly variant: 'compact';
}
interface ExpandedProps {
  readonly surah: number;
  readonly apiBase: string;
  readonly variant: 'expanded';
}
type Props = CompactProps | ExpandedProps;

export async function SurahInfoPane(props: Props): Promise<ReactNode> {
  const body = await fetchSurahInfo(props.surah, props.apiBase);
  if (!body?.data) return null;
  const d = body.data;
  const placeLabel = d.revelationPlace === 'makkah' ? 'Makki' : 'Madani';

  if (props.variant === 'compact') {
    if (!d.summary) return null;
    return (
      <aside
        aria-label="Surah summary"
        className="border-hairline mx-auto max-w-3xl border-b px-4 py-4 sm:px-6 sm:py-6"
      >
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">
            {placeLabel} · order {d.revelationOrder.toString()} · {d.verseCount.toString()}{' '}
            {d.verseCount === 1 ? 'verse' : 'verses'}
          </p>
          {d.themes.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {d.themes.slice(0, 4).map((t) => (
                <li
                  key={t}
                  className="border-hairline smallcaps text-ink-muted rounded-full border px-2 py-0.5 text-[10px] tracking-widest"
                >
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="text-ink/85 max-w-prose text-sm leading-relaxed sm:text-[15px]">
          {d.summary.length > 320 ? `${d.summary.slice(0, 320)}…` : d.summary}
        </p>
      </aside>
    );
  }

  // expanded — sidebar on /study
  const hasAnyContent = Boolean(d.summary) || Boolean(d.asbabAlNuzul) || d.themes.length > 0;
  if (!hasAnyContent) return null;
  return (
    <section
      aria-label={`About Surah ${d.nameTranslated ?? d.nameArabic}`}
      className="paper-card space-y-4 p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="smallcaps text-leaf text-[10px] tracking-widest">About this surah</p>
        <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
          {placeLabel} · order {d.revelationOrder.toString()}
        </p>
      </header>

      {d.themes.length > 0 ? (
        <div>
          <p className="smallcaps text-ink-muted mb-1.5 text-[10px] tracking-widest">Themes</p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {d.themes.map((t) => (
              <li
                key={t}
                className="border-hairline smallcaps text-ink rounded-full border px-2.5 py-0.5 text-[11px] tracking-widest"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.summary ? (
        <div>
          <p className="smallcaps text-ink-muted mb-1.5 text-[10px] tracking-widest">Summary</p>
          <p className="text-ink/90 text-[14px] leading-relaxed">{d.summary}</p>
        </div>
      ) : null}

      {d.asbabAlNuzul ? (
        <div>
          <p className="smallcaps text-leaf mb-1.5 text-[10px] tracking-widest">
            Asbāb al-nuzūl · context of revelation
          </p>
          <p className="text-ink/90 text-[14px] leading-relaxed">{d.asbabAlNuzul}</p>
        </div>
      ) : null}

      <p className="text-ink-muted border-hairline/60 border-t pt-2 text-[10px] italic">
        {body.attribution}
      </p>
    </section>
  );
}
