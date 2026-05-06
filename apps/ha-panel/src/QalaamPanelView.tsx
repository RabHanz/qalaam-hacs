/**
 * Qalaam panel — Editorial-Scripture aesthetic for Home Assistant.
 *
 * Design language: warm paper + ink + leaf-gold, lifted from CLAUDE.md
 * §11.3 design non-negotiables. Inside HA we inherit the user's theme
 * via HA's CSS custom properties, but every surface still carries
 * Qalaam's distinctive typography (Fraunces display, IBM Plex body,
 * Amiri Quran for Arabic), Islamic-illumination geometry (hairline
 * dividers, gold corner-flourishes), and the calm/contemplative
 * adab the brand demands (no XP, no streak-shaming, never leaderboards).
 *
 * Theming approach: every color reaches into HA's standard CSS custom
 * properties so users on dark themes see dark cards, light themes see
 * paper. Brand tokens are fallbacks. The `prefers-color-scheme` block
 * handles the rare boot-before-HA-pushes-vars case.
 *
 * SURFACE COVERAGE (B4 refresh, 2026-05-06): every sensor + binary_sensor
 * + select + media_player the qalaam HA component exposes is surfaced.
 *
 * Adab non-negotiables honored:
 *   • streak shown but framed as "grace days roll forward" — never
 *     "you broke your X-day streak"
 *   • zero gamification (no XP, no coins, no leaderboards)
 *   • family-private framing in header + footer
 *   • Ramadan flag → softer accent, never celebratory popup
 */
import { useMemo } from 'preact/hooks';

export interface HassEntity {
  readonly entity_id: string;
  readonly state: string;
  readonly attributes?: Record<string, unknown>;
}

export interface HassLike {
  readonly states?: Record<string, HassEntity>;
  readonly themes?: { readonly darkMode?: boolean };
  readonly user?: { readonly name?: string };
}

interface QalaamPanelViewProps {
  readonly hass: HassLike | undefined;
  readonly narrow: boolean;
}

const T = {
  brandTeal: '#1b4d5a',
  brandTealDeep: '#103840',
  brandGold: '#c69426', // leaf-500
  brandGoldSoft: '#e2b46a', // leaf-300
  brandGoldDeep: '#8a6614', // leaf-700
  paper100: '#fbf9f4',
  paper200: '#f3eee2',
  paper300: '#e8dfc8',
  surfaceDark: '#0d1417',
  surfaceDarkRaised: '#1a262b',
  inkDark: '#04181d',
  inkLight: '#f0eee7',
};

const STYLE = `
  :host { display: block; height: 100%; container-type: inline-size; }
  /* Brand-fallback variables — HA's variables take precedence at runtime. */
  :host {
    --q-bg: var(--primary-background-color, ${T.paper100});
    --q-bg-soft: var(--secondary-background-color, ${T.paper200});
    --q-bg-deep: ${T.paper300};
    --q-card: var(--card-background-color, var(--ha-card-background, #ffffff));
    --q-text: var(--primary-text-color, ${T.brandTealDeep});
    --q-text-strong: ${T.inkDark};
    --q-text-muted: var(--secondary-text-color, rgba(16, 56, 64, 0.65));
    --q-accent: var(--accent-color, ${T.brandGold});
    --q-accent-soft: ${T.brandGoldSoft};
    --q-accent-deep: ${T.brandGoldDeep};
    --q-radius: var(--ha-card-border-radius, 16px);
    --q-shadow: 0 1px 3px rgba(16, 56, 64, 0.05), 0 14px 32px -16px rgba(16, 56, 64, 0.08);
    --q-shadow-card: var(--ha-card-box-shadow, var(--q-shadow));
    --q-divider: var(--divider-color, rgba(16, 56, 64, 0.1));
    --q-rule-strong: rgba(16, 56, 64, 0.18);
    /* Subtle gold gradient used by hero illumination + accent stat */
    --q-gold-grad: linear-gradient(
      135deg,
      color-mix(in srgb, var(--q-accent-soft) 22%, transparent) 0%,
      color-mix(in srgb, var(--q-accent) 8%, transparent) 35%,
      transparent 70%
    );
  }
  @media (prefers-color-scheme: dark) {
    :host {
      --q-bg: var(--primary-background-color, ${T.surfaceDark});
      --q-bg-soft: var(--secondary-background-color, ${T.surfaceDarkRaised});
      --q-bg-deep: #1a262b;
      --q-card: var(--card-background-color, ${T.surfaceDarkRaised});
      --q-text: var(--primary-text-color, ${T.inkLight});
      --q-text-strong: #ffffff;
      --q-text-muted: var(--secondary-text-color, rgba(240, 238, 231, 0.62));
      --q-accent: var(--accent-color, #e8c478);
      --q-accent-soft: #d6a657;
      --q-accent-deep: #b6862c;
      --q-divider: var(--divider-color, rgba(255, 255, 255, 0.08));
      --q-rule-strong: rgba(255, 255, 255, 0.16);
    }
  }

  /* Custom property animation registration — needed for the soft pulse
   * on the prayer card to interpolate cleanly. */
  @property --q-pulse {
    syntax: '<number>';
    initial-value: 0;
    inherits: false;
  }

  main {
    font-family: var(--paper-font-body1_-_font-family, 'IBM Plex Sans', -apple-system, system-ui, sans-serif);
    padding: clamp(1.1rem, 4vw, 2.4rem) clamp(1rem, 4vw, 2.4rem);
    background: var(--q-bg);
    color: var(--q-text);
    min-height: 100vh;
    box-sizing: border-box;
    /* Subtle paper grain — barely visible, just enough to avoid the
     * "flat tech app" feel. SVG noise embedded as data URI so we don't
     * need a network request. 2% opacity on light paper, 4% on dark. */
    background-image: var(--q-bg-noise, none),
      radial-gradient(at 12% 0%, color-mix(in srgb, var(--q-accent-soft) 6%, transparent) 0%, transparent 60%);
  }
  @media (prefers-color-scheme: light) {
    main {
      --q-bg-noise: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.025'/></svg>");
    }
  }

  header {
    margin-bottom: clamp(1.25rem, 4vw, 2rem);
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-bottom: 1.1rem;
    border-bottom: 1px solid var(--q-divider);
    /* Tiny gold tick at left edge — illuminated-manuscript flourish */
    position: relative;
  }
  header::before {
    content: '';
    position: absolute;
    left: -0.4rem;
    top: 0.4rem;
    bottom: 1.2rem;
    width: 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--q-accent) 0%, transparent 100%);
    opacity: 0.55;
  }
  h1 {
    font-family: 'Fraunces', 'Times New Roman', Georgia, serif;
    font-size: clamp(1.5rem, 3vw, 1.95rem);
    font-weight: 600;
    margin: 0 0 0.25rem;
    letter-spacing: -0.014em;
    line-height: 1.1;
    color: var(--q-text-strong);
  }
  header .lede {
    font-size: 0.92rem;
    line-height: 1.55;
    opacity: 0.92;
    color: var(--q-text-muted);
    margin: 0;
    max-width: 60ch;
  }
  .ramadan-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.7rem;
    padding: 0.32rem 0.85rem;
    border-radius: 999px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    background: var(--q-gold-grad), var(--q-card);
    color: var(--q-accent-deep);
    border: 1px solid color-mix(in srgb, var(--q-accent) 40%, transparent);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--q-accent) 20%, transparent);
    align-self: center;
    animation: q-fade-in 600ms ease-out 200ms backwards;
  }
  .ramadan-pill::before {
    content: '';
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--q-accent);
    box-shadow: inset -0.2rem -0.05rem 0 var(--q-accent-deep);
    /* CSS-only crescent: a circle with an inset shadow that occludes one side */
  }

  /* Hero — Word + Topic of the day. The most editorial element. */
  .hero {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1.4rem;
    animation: q-fade-up 540ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  @container (min-width: 720px) { .hero { grid-template-columns: 1.4fr 1fr; } }
  @media (min-width: 720px) { .hero { grid-template-columns: 1.4fr 1fr; } }
  .hero-card {
    position: relative;
    background: var(--q-card);
    border-radius: var(--q-radius);
    padding: clamp(1.4rem, 3vw, 1.8rem) clamp(1.4rem, 3vw, 1.8rem);
    box-shadow: var(--q-shadow-card);
    border: 1px solid var(--q-divider);
    overflow: hidden;
    isolation: isolate;
  }
  /* Gold illumination on the word-of-day hero — mimics gilded margin
   * decoration on a fine printed mushaf. Pure CSS (no images). */
  .hero-card.illuminated::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--q-gold-grad);
    pointer-events: none;
    z-index: 0;
  }
  /* Decorative corner crest — abstract geometric Islamic-pattern motif.
   * Three rotated squares form an 8-point star, painted in gold.
   * Pure CSS, no SVG dependency. */
  .hero-card.illuminated::after {
    content: '';
    position: absolute;
    top: 1.1rem;
    right: 1.1rem;
    width: 1.6rem;
    height: 1.6rem;
    background:
      conic-gradient(
        from 22.5deg,
        var(--q-accent) 0deg 45deg,
        transparent 45deg 90deg,
        var(--q-accent) 90deg 135deg,
        transparent 135deg 180deg,
        var(--q-accent) 180deg 225deg,
        transparent 225deg 270deg,
        var(--q-accent) 270deg 315deg,
        transparent 315deg 360deg
      );
    mask: radial-gradient(circle at center, black 50%, transparent 51%);
    -webkit-mask: radial-gradient(circle at center, black 50%, transparent 51%);
    opacity: 0.65;
    z-index: 0;
  }
  .hero-card > * { position: relative; z-index: 1; }

  .smallcaps {
    font-size: 0.68rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--q-accent-deep);
    font-weight: 700;
    font-family: 'Fraunces', Georgia, serif;
  }
  .smallcaps.muted { color: var(--q-text-muted); font-weight: 600; }
  .arabic {
    font-family: 'Amiri Quran', 'KFGQPC HAFS Uthmanic Script V2', 'Noto Naskh Arabic', serif;
    direction: rtl;
    unicode-bidi: plaintext;
    color: var(--q-accent-deep);
    font-weight: 600;
    line-height: 1.6;
    margin: 0.7rem 0 0.4rem;
  }
  .arabic.huge { font-size: clamp(2.2rem, 5vw, 2.85rem); letter-spacing: 0; }
  .gloss {
    font-family: 'Fraunces', Georgia, serif;
    font-size: clamp(1.15rem, 2.4vw, 1.45rem);
    font-weight: 600;
    margin: 0.4rem 0 0.3rem;
    line-height: 1.25;
    color: var(--q-text-strong);
  }
  .meta {
    font-size: 0.85rem;
    line-height: 1.55;
    color: var(--q-text-muted);
    margin: 0.5rem 0 0;
  }
  .meta code {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    background: var(--q-bg-soft);
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
    font-size: 0.85em;
    color: var(--q-accent-deep);
  }

  .topic-card h2 {
    font-family: 'Fraunces', Georgia, serif;
    font-size: clamp(1.15rem, 2.4vw, 1.4rem);
    font-weight: 600;
    margin: 0.55rem 0 0.4rem;
    line-height: 1.25;
    color: var(--q-text-strong);
  }
  .topic-card .summary {
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--q-text-muted);
    margin: 0.4rem 0 1rem;
  }

  /* Stat grid — every sensor a chip. */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 0.85rem;
    margin-bottom: 1.4rem;
    animation: q-fade-up 540ms 80ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  .stat {
    background: var(--q-card);
    border-radius: 14px;
    padding: 1rem 1.1rem;
    border: 1px solid var(--q-divider);
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease;
    position: relative;
  }
  .stat:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--q-accent) 35%, var(--q-divider)); }
  .stat .label {
    color: var(--q-text-muted);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .stat .value {
    display: block;
    margin-top: 0.4rem;
    font-family: 'Fraunces', Georgia, serif;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--q-text-strong);
    font-variant-numeric: tabular-nums;
  }
  .stat .sub {
    display: block;
    margin-top: 0.25rem;
    color: var(--q-text-muted);
    font-size: 0.78rem;
    line-height: 1.45;
  }
  .stat.accent {
    background:
      var(--q-gold-grad),
      var(--q-card);
    border-color: color-mix(in srgb, var(--q-accent) 28%, var(--q-divider));
  }
  .stat.accent .value { color: var(--q-accent-deep); }
  .stat.imminent {
    /* Used when the next-prayer is < 10 min away. Soft heartbeat. */
    animation: q-prayer-pulse 2.4s ease-in-out infinite;
  }

  .row-section { margin-bottom: 1.4rem; animation: q-fade-up 540ms 160ms cubic-bezier(0.16, 1, 0.3, 1) backwards; }
  .row-section h2 {
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--q-text-muted);
    font-weight: 700;
    margin: 0 0 0.7rem;
    font-family: 'Fraunces', Georgia, serif;
  }
  .row-card {
    background: var(--q-card);
    border-radius: var(--q-radius);
    border: 1px solid var(--q-divider);
    box-shadow: var(--q-shadow-card);
    overflow: hidden;
  }
  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.95rem 1.3rem;
    border-bottom: 1px solid var(--q-divider);
  }
  .row:last-child { border-bottom: none; }
  .row .label { color: var(--q-text-muted); font-size: 0.875rem; }
  .row .value { font-weight: 600; font-size: 0.95rem; text-align: right; font-variant-numeric: tabular-nums; }
  .row .hint { color: var(--q-text-muted); font-size: 0.78rem; display: block; margin-top: 0.2rem; max-width: 36ch; }
  .row .value.idle { color: var(--q-text-muted); font-weight: 500; }
  .row.entity .label {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 0.78rem;
    color: var(--q-text);
  }
  .live-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    margin-right: 0.4em;
    background: var(--q-accent);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--q-accent) 40%, transparent);
    animation: q-live-dot 1.4s ease-in-out infinite;
    vertical-align: 0.075em;
  }

  .actions { display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1.1rem; }
  button.qalaam {
    background: var(--primary-color, ${T.brandTeal});
    color: var(--text-primary-color, #fff);
    border: none;
    padding: 0.65rem 1.05rem;
    border-radius: 0.7rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: filter 120ms ease, transform 120ms ease, box-shadow 120ms ease;
    font-family: inherit;
    box-shadow: 0 1px 2px rgba(16, 56, 64, 0.12);
  }
  button.qalaam:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px -2px rgba(16, 56, 64, 0.2);
  }
  button.qalaam:active { transform: translateY(0); filter: brightness(0.96); }
  button.qalaam:focus-visible {
    outline: 2px solid var(--q-accent);
    outline-offset: 3px;
  }
  button.qalaam.secondary {
    background: transparent;
    color: var(--q-text);
    border: 1px solid var(--q-divider);
    box-shadow: none;
  }
  button.qalaam.secondary:hover { border-color: var(--q-accent); color: var(--q-accent-deep); transform: translateY(-1px); }
  button.qalaam.gold { background: var(--q-accent); color: var(--q-bg); }
  button.qalaam.gold:hover { background: var(--q-accent-soft); }
  .empty { color: var(--q-text-muted); font-size: 0.9rem; padding: 0.4rem 0 0.2rem; line-height: 1.55; max-width: 56ch; }

  footer.qalaam-footer {
    margin-top: 2.2rem;
    padding-top: 1.3rem;
    border-top: 1px dashed var(--q-divider);
    font-size: 0.78rem;
    color: var(--q-text-muted);
    line-height: 1.6;
    max-width: 64ch;
  }
  footer.qalaam-footer .smallcaps-foot {
    color: var(--q-accent-deep);
    margin-right: 0.55rem;
    font-size: 0.68rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 700;
    font-family: 'Fraunces', Georgia, serif;
  }

  @keyframes q-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes q-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes q-prayer-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--q-accent) 0%, transparent); }
    50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--q-accent) 18%, transparent); }
  }
  @keyframes q-live-dot {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--q-accent) 40%, transparent); }
    70% { box-shadow: 0 0 0 6px transparent; }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero, .stat-grid, .row-section, .ramadan-pill { animation: none; }
    .stat:hover { transform: none; }
    button.qalaam { transition: none; }
    button.qalaam:hover { transform: none; }
    .stat.imminent { animation: none; }
    .live-dot { animation: none; }
  }
`;

function findEntity(hass: HassLike | undefined, entityId: string): HassEntity | undefined {
  return hass?.states?.[entityId];
}

/** State value with fallback for `unavailable` / `unknown` / empty. */
function stateOf(e: HassEntity | undefined, fallback = '—'): string {
  if (!e) return fallback;
  if (e.state === 'unavailable' || e.state === 'unknown' || !e.state) return fallback;
  return e.state;
}

function attrStr(e: HassEntity | undefined, key: string): string | undefined {
  const v = e?.attributes?.[key];
  return typeof v === 'string' ? v : undefined;
}
function attrNum(e: HassEntity | undefined, key: string): number | undefined {
  const v = e?.attributes?.[key];
  return typeof v === 'number' ? v : undefined;
}

/** True if the next prayer is < 10 minutes away (gentle reminder cue). */
function isPrayerImminent(iso: string): boolean {
  if (!iso || iso === '—' || iso === 'unknown' || iso === 'unavailable') return false;
  try {
    const ms = new Date(iso).getTime() - Date.now();
    return ms > 0 && ms <= 10 * 60 * 1000;
  } catch {
    return false;
  }
}

export function QalaamPanelView({ hass, narrow }: QalaamPanelViewProps): preact.VNode {
  const e = useMemo(() => {
    return {
      currentVerse: findEntity(hass, 'sensor.qalaam_current_verse'),
      streak: findEntity(hass, 'sensor.qalaam_streak_days'),
      todaysSession: findEntity(hass, 'sensor.qalaam_today_session_count'),
      grace: findEntity(hass, 'sensor.qalaam_grace_days_remaining'),
      currentSabqi: findEntity(hass, 'sensor.qalaam_current_sabqi'),
      nextPrayer: findEntity(hass, 'sensor.qalaam_next_prayer'),
      wordOfDay: findEntity(hass, 'sensor.qalaam_word_of_day'),
      topicOfDay: findEntity(hass, 'sensor.qalaam_topic_of_day'),
      hijri: findEntity(hass, 'sensor.qalaam_hijri_date'),
      mutashabihat: findEntity(hass, 'sensor.qalaam_mutashabihat_count'),
      activeReciter: findEntity(hass, 'sensor.qalaam_active_reciter'),
      isReciting: findEntity(hass, 'binary_sensor.qalaam_is_reciting'),
      inSession: findEntity(hass, 'binary_sensor.qalaam_in_session'),
      ramadan: findEntity(hass, 'binary_sensor.qalaam_ramadan'),
      mediaPlayer: findEntity(hass, 'media_player.qalaam'),
      reciterSelect: findEntity(hass, 'select.qalaam_reciter'),
      mushafSelect: findEntity(hass, 'select.qalaam_mushaf'),
    };
  }, [hass]);

  const greeting = hass?.user?.name
    ? `As-salāmu ʿalaykum, ${hass.user.name}`
    : 'As-salāmu ʿalaykum';
  const isRamadan = e.ramadan?.state === 'on';
  const wordArabic = attrStr(e.wordOfDay, 'arabic') ?? e.wordOfDay?.state ?? '—';
  const wordEnglish = attrStr(e.wordOfDay, 'translation') ?? '';
  const wordRoot = attrStr(e.wordOfDay, 'root');
  const wordOccurrences = attrNum(e.wordOfDay, 'occurrences');
  const topicSummary = attrStr(e.topicOfDay, 'summary');
  const topicSlug = attrStr(e.topicOfDay, 'slug');
  const topicName =
    e.topicOfDay?.state && e.topicOfDay.state !== 'unknown'
      ? e.topicOfDay.state.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
  const mutashabihatN = Number(stateOf(e.mutashabihat, '0'));
  const inSessionLive = e.inSession?.state === 'on';
  const isRecitingLive = e.isReciting?.state === 'on';
  const nextPrayerIso = stateOf(e.nextPrayer, '—');
  const prayerImminent = isPrayerImminent(nextPrayerIso);

  return (
    <main>
      <style>{STYLE}</style>
      <header>
        <div>
          <h1>{greeting}</h1>
          <p class="lede">
            Today's Quranic moment, your hifdh state, and quick actions for every speaker in the
            house. Family-private — never shared.
            {narrow ? ' · compact view' : ''}
          </p>
        </div>
        {isRamadan ? <span class="ramadan-pill">Ramadan</span> : null}
      </header>

      {/* HERO — Word + Topic of the day. */}
      <section class="hero">
        <article class="hero-card illuminated" aria-label="Word of the day">
          <span class="smallcaps">Word of the day</span>
          <p class="arabic huge" lang="ar">
            {wordArabic}
          </p>
          {wordEnglish ? <h2 class="gloss">{wordEnglish}</h2> : null}
          <p class="meta">
            {wordRoot ? (
              <>
                Root <code>{wordRoot}</code>
              </>
            ) : null}
            {wordRoot && wordOccurrences ? ' · ' : null}
            {wordOccurrences ? (
              <>
                {wordOccurrences} occurrence{wordOccurrences === 1 ? '' : 's'} across the Quran
              </>
            ) : null}
          </p>
        </article>
        <article class="hero-card topic-card" aria-label="Topic of the day">
          <span class="smallcaps muted">Topic of the day</span>
          <h2>{topicName ?? '—'}</h2>
          {topicSummary ? <p class="summary">{topicSummary}</p> : null}
          {topicSlug ? (
            <div class="actions">
              <button
                type="button"
                class="qalaam secondary"
                onClick={() => {
                  navigateToFrontend(`/topics/${topicSlug}`);
                }}
              >
                Read every verse on this topic →
              </button>
            </div>
          ) : null}
        </article>
      </section>

      {/* STAT GRID — every sensor as a chip. */}
      <section class="stat-grid" aria-label="Today's snapshot">
        <div class="stat accent">
          <span class="label">Streak</span>
          <strong class="value">{stateOf(e.streak, '0')}</strong>
          <span class="sub">{stateOf(e.grace, '0')} grace days remaining</span>
        </div>
        <div class="stat">
          <span class="label">Sessions today</span>
          <strong class="value">{stateOf(e.todaysSession, '0')}</strong>
          <span class="sub">portions completed</span>
        </div>
        <div class="stat">
          <span class="label">Current sabqi</span>
          <strong class="value" style={{ fontSize: '1.05rem' }}>
            {stateOf(e.currentSabqi, '—')}
          </strong>
          <span class="sub">today's new memorization</span>
        </div>
        <div class={'stat' + (prayerImminent ? ' imminent' : '')}>
          <span class="label">Next prayer</span>
          <strong class="value">{formatPrayerTime(nextPrayerIso)}</strong>
          <span class="sub">
            {prayerImminent
              ? '⏰ within 10 minutes'
              : 'hifdh actions pause inside the prayer window'}
          </span>
        </div>
        <div class="stat">
          <span class="label">Hijri date</span>
          <strong class="value" style={{ fontSize: '1.05rem' }}>
            {stateOf(e.hijri, '—')}
          </strong>
          <span class="sub">{isRamadan ? 'Ramadan — special UI active' : 'Islamic calendar'}</span>
        </div>
        {mutashabihatN > 0 ? (
          <div class="stat accent">
            <span class="label">Mutashabihat</span>
            <strong class="value">{mutashabihatN}</strong>
            <span class="sub">similar-ayah pairs to drill on this portion</span>
          </div>
        ) : null}
      </section>

      {/* CURRENTLY — live state. */}
      <section class="row-section">
        <h2>Currently</h2>
        <div class="row-card">
          <div class="row">
            <span>
              <span class="label">
                {isRecitingLive ? <span class="live-dot" aria-hidden /> : null}
                Reciting now
              </span>
              <span class="hint">
                {isRecitingLive ? 'Audio is flowing through your speakers' : 'No active recitation'}
              </span>
            </span>
            <span class={'value' + (isRecitingLive ? '' : ' idle')}>
              {isRecitingLive ? stateOf(e.currentVerse, 'in progress') : 'idle'}
            </span>
          </div>
          <div class="row">
            <span>
              <span class="label">
                {inSessionLive ? <span class="live-dot" aria-hidden /> : null}
                Hifdh session
              </span>
              <span class="hint">Family-private practice mode</span>
            </span>
            <span class={'value' + (inSessionLive ? '' : ' idle')}>
              {inSessionLive ? 'in session' : 'inactive'}
            </span>
          </div>
          <div class="row">
            <span class="label">Active reciter</span>
            <span class="value">{stateOf(e.activeReciter, '—')}</span>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section class="row-section">
        <h2>Quick actions</h2>
        <div class="row-card" style={{ padding: '1.3rem 1.4rem 1.4rem' }}>
          <p class="empty" style={{ marginTop: 0 }}>
            Trigger a session right from the panel, or tap “Open Qalaam” for the full reader, study,
            and listen surfaces.
          </p>
          <div class="actions">
            <button
              type="button"
              class="qalaam"
              onClick={() => {
                callQalaamService(hass, 'start_memorization_session', {});
              }}
            >
              Start memorization session
            </button>
            <button
              type="button"
              class="qalaam gold"
              onClick={() => {
                callQalaamService(hass, 'play_surah', {
                  surah: 1,
                  target: 'media_player.qalaam',
                });
              }}
            >
              Play Al-Fātiḥa
            </button>
            <button
              type="button"
              class="qalaam secondary"
              onClick={() => {
                navigateToFrontend('/qalaam');
              }}
            >
              Open Qalaam →
            </button>
            <button
              type="button"
              class="qalaam secondary"
              onClick={() => {
                navigateToFrontend('/mushaf/tajweed/1');
              }}
            >
              Open tajweed mushaf →
            </button>
          </div>
        </div>
      </section>

      {/* LINKED ENTITIES */}
      <section class="row-section">
        <h2>Linked entities</h2>
        <div class="row-card">
          <div class="row entity">
            <span class="label">media_player.qalaam</span>
            <span class="value">{stateOf(e.mediaPlayer, 'idle')}</span>
          </div>
          <div class="row entity">
            <span class="label">select.qalaam_reciter</span>
            <span class="value">{stateOf(e.reciterSelect, '—')}</span>
          </div>
          <div class="row entity">
            <span class="label">select.qalaam_mushaf</span>
            <span class="value">{stateOf(e.mushafSelect, '—')}</span>
          </div>
          <div class="row entity">
            <span class="label">binary_sensor.qalaam_in_session</span>
            <span class="value">{stateOf(e.inSession, 'off')}</span>
          </div>
          <div class="row entity">
            <span class="label">binary_sensor.qalaam_is_reciting</span>
            <span class="value">{stateOf(e.isReciting, 'off')}</span>
          </div>
        </div>
      </section>

      <footer class="qalaam-footer">
        <span class="smallcaps-foot">Qalaam</span>
        Audio never leaves the device. Family-private. The panel surfaces only sensors HA already
        exposes — no extra fetches, no third-party calls (per ADR-0005).
      </footer>
    </main>
  );
}

function formatPrayerTime(iso: string): string {
  if (!iso || iso === '—' || iso === 'unknown' || iso === 'unavailable') return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function callQalaamService(
  hass: HassLike | undefined,
  service: string,
  data: Record<string, unknown>,
): void {
  if (!hass) return;
  // Real impl uses hass.callService; the prop comes from HA's panel-custom contract.
  // We invoke through a globally-available connection on the hass object — this
  // is the standard panel-custom way (see HA dev docs). Cast is intentional.
  (
    hass as unknown as {
      callService?: (d: string, s: string, p: unknown) => void;
    }
  ).callService?.('qalaam', service, data);
}

function navigateToFrontend(path: string): void {
  // HA frontend uses history-API navigation; window.location works as a fallback.
  if (typeof window !== 'undefined') window.history.pushState({}, '', path);
}
