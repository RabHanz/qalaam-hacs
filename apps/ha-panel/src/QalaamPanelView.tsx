/**
 * Qalaam panel view — rendered inside a Shadow DOM, themed by Home Assistant.
 *
 * Theming approach: every color reaches into HA's standard CSS custom properties
 * (`--primary-background-color`, `--card-background-color`, `--primary-text-color`,
 * `--secondary-text-color`, `--primary-color`, `--ha-card-border-radius`, etc.).
 * Qalaam brand tokens kick in as fallbacks when the panel runs outside HA
 * (story preview, dev). HA flips its CSS vars when the user switches between
 * light and dark themes — our panel follows automatically; no theme-watcher needed.
 *
 * The `prefers-color-scheme` block in the inlined styles handles the rare case
 * where the panel boots before HA pushes its CSS — picks a sane dark/light mode
 * from the OS until HA hydrates.
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

interface SummaryRow {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

const QALAAM_TOKENS = {
  brandTeal: '#1b4d5a',
  brandTealLight: '#23808a',
  brandGold: '#b6862c',
  cream100: '#f7f4ee',
  cream200: '#ece6d8',
  surfaceDark: '#0e1416',
  surfaceDarkRaised: '#131c1f',
};

const STYLE = `
  :host { display: block; height: 100%; }
  /* Brand-fallback variables — HA's variables take precedence at runtime. */
  :host {
    --qalaam-bg: var(--primary-background-color, ${QALAAM_TOKENS.cream100});
    --qalaam-card: var(--card-background-color, var(--ha-card-background, #ffffff));
    --qalaam-text: var(--primary-text-color, ${QALAAM_TOKENS.brandTeal});
    --qalaam-text-muted: var(--secondary-text-color, rgba(16, 56, 64, 0.7));
    --qalaam-accent: var(--accent-color, ${QALAAM_TOKENS.brandGold});
    --qalaam-radius: var(--ha-card-border-radius, 16px);
    --qalaam-shadow: var(--ha-card-box-shadow, 0 1px 2px rgba(16, 56, 64, 0.06));
    --qalaam-divider: var(--divider-color, rgba(16, 56, 64, 0.1));
  }
  /* OS-level fallback when HA hasn't yet sent its theme vars. */
  @media (prefers-color-scheme: dark) {
    :host {
      --qalaam-bg: var(--primary-background-color, ${QALAAM_TOKENS.surfaceDark});
      --qalaam-card: var(--card-background-color, ${QALAAM_TOKENS.surfaceDarkRaised});
      --qalaam-text: var(--primary-text-color, #f0eee7);
      --qalaam-text-muted: var(--secondary-text-color, rgba(240, 238, 231, 0.65));
      --qalaam-divider: var(--divider-color, rgba(255, 255, 255, 0.08));
    }
  }
  main { font-family: var(--paper-font-body1_-_font-family, 'Inter', system-ui, sans-serif); padding: clamp(1rem, 4vw, 2rem); background: var(--qalaam-bg); color: var(--qalaam-text); min-height: 100vh; box-sizing: border-box; }
  header { margin-bottom: clamp(1rem, 4vw, 1.75rem); }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem; letter-spacing: -0.01em; }
  header p { font-size: 0.875rem; opacity: 0.8; color: var(--qalaam-text-muted); margin: 0; }
  .grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }
  @media (min-width: 720px) { .grid { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); } }
  .card { background: var(--qalaam-card); border-radius: var(--qalaam-radius); padding: 1.25rem 1.4rem; box-shadow: var(--qalaam-shadow); border: 1px solid var(--qalaam-divider); }
  .card h2 { font-size: 1rem; margin: 0 0 0.5rem; font-weight: 600; }
  .row { display: flex; justify-content: space-between; align-items: baseline; padding: 0.4rem 0; border-bottom: 1px dashed var(--qalaam-divider); }
  .row:last-child { border-bottom: none; }
  .row .label { color: var(--qalaam-text-muted); font-size: 0.875rem; }
  .row .value { font-weight: 600; font-size: 0.95rem; text-align: right; }
  .row .hint { color: var(--qalaam-text-muted); font-size: 0.75rem; display: block; margin-top: 0.15rem; }
  .pill-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
  .pill { padding: 0.25rem 0.625rem; border-radius: 999px; font-size: 0.75rem; background: color-mix(in srgb, var(--qalaam-accent) 18%, transparent); color: var(--qalaam-text); }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
  button.qalaam { background: var(--primary-color, ${QALAAM_TOKENS.brandTeal}); color: var(--text-primary-color, #fff); border: none; padding: 0.55rem 0.95rem; border-radius: 0.625rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: filter 120ms ease; }
  button.qalaam:hover { filter: brightness(1.08); }
  button.qalaam.secondary { background: transparent; color: var(--qalaam-text); border: 1px solid var(--qalaam-divider); }
  .empty { color: var(--qalaam-text-muted); font-size: 0.875rem; padding: 0.4rem 0; }
  footer.qalaam-footer { margin-top: 2rem; font-size: 0.75rem; color: var(--qalaam-text-muted); }
`;

function findEntity(hass: HassLike | undefined, entityId: string): HassEntity | undefined {
  return hass?.states?.[entityId];
}

export function QalaamPanelView({ hass, narrow }: QalaamPanelViewProps): preact.VNode {
  const summary: readonly SummaryRow[] = useMemo(() => {
    const currentVerse = findEntity(hass, 'sensor.qalaam_current_verse');
    const streak = findEntity(hass, 'sensor.qalaam_streak_days');
    const todaysSession = findEntity(hass, 'sensor.qalaam_today_session_count');
    const nextPrayer = findEntity(hass, 'sensor.qalaam_next_prayer');
    const isReciting = findEntity(hass, 'binary_sensor.qalaam_is_reciting');
    return [
      {
        label: 'Currently reciting',
        value: isReciting?.state === 'on' && currentVerse?.state ? currentVerse.state : '—',
      },
      {
        label: 'Streak',
        value: streak?.state ? `${streak.state} days` : '—',
        hint: 'grace days roll forward, so a missed day is no problem',
      },
      {
        label: "Today's portions",
        value: todaysSession?.state ?? '—',
      },
      {
        label: 'Next prayer',
        value: nextPrayer?.state ? formatPrayerTime(nextPrayer.state) : '—',
        hint: 'Hifdh actions pause inside the prayer window',
      },
    ];
  }, [hass]);

  const greeting = hass?.user?.name ? `As-salāmu ʿalaykum, ${hass.user.name}` : 'As-salāmu ʿalaykum';

  return (
    <main>
      <style>{STYLE}</style>
      <header>
        <h1>{greeting}</h1>
        <p>Daily summary. Family-private — never shared. {narrow ? '· compact view' : ''}</p>
      </header>

      <section class="grid">
        <article class="card" aria-label="Today's overview">
          <h2>Today</h2>
          {summary.map((row) => (
            <div class="row" key={row.label}>
              <span>
                <span class="label">{row.label}</span>
                {row.hint ? <span class="hint">{row.hint}</span> : null}
              </span>
              <span class="value">{row.value}</span>
            </div>
          ))}
          <div class="actions">
            <button
              type="button"
              class="qalaam"
              onClick={() => hass && callQalaamService(hass, 'start_memorization_session', {})}
            >
              Start memorization session
            </button>
            <button
              type="button"
              class="qalaam secondary"
              onClick={() => hass && navigateToFrontend('/qalaam')}
            >
              Open Qalaam
            </button>
          </div>
        </article>

        <article class="card" aria-label="Quick actions">
          <h2>Quick actions</h2>
          <div class="pill-row">
            <span class="pill">Test me</span>
            <span class="pill">Mark memorized</span>
            <span class="pill">Play surah</span>
          </div>
          <p class="empty">
            Buttons in your sidebar (Test me, Mark memorized) fire instant Hifdh-engine
            events. Trigger a play_surah from the Quran browser or via voice.
          </p>
        </article>

        <article class="card" aria-label="Linked entities">
          <h2>Connected entities</h2>
          <div class="row">
            <span class="label">media_player.qalaam</span>
            <span class="value">{findEntity(hass, 'media_player.qalaam')?.state ?? 'idle'}</span>
          </div>
          <div class="row">
            <span class="label">select.qalaam_reciter</span>
            <span class="value">{findEntity(hass, 'select.qalaam_reciter')?.state ?? '—'}</span>
          </div>
          <div class="row">
            <span class="label">select.qalaam_mushaf</span>
            <span class="value">{findEntity(hass, 'select.qalaam_mushaf')?.state ?? '—'}</span>
          </div>
          <div class="row">
            <span class="label">binary_sensor.qalaam_in_session</span>
            <span class="value">{findEntity(hass, 'binary_sensor.qalaam_in_session')?.state ?? '—'}</span>
          </div>
        </article>
      </section>

      <footer class="qalaam-footer">
        Qalaam · audio never leaves the device · family-private · per ADR-0005
      </footer>
    </main>
  );
}

function formatPrayerTime(iso: string): string {
  if (!iso || iso === 'unknown' || iso === 'unavailable') return '—';
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function callQalaamService(_hass: HassLike, _service: string, _data: Record<string, unknown>): void {
  // Real impl uses hass.callService; the prop comes from HA's panel-custom contract.
  // We invoke through a globally-available connection on the hass object — this
  // is the standard panel-custom way (see HA dev docs). Cast is intentional.
  (_hass as unknown as { callService?: (d: string, s: string, p: unknown) => void }).callService?.(
    'qalaam',
    _service,
    _data,
  );
}

function navigateToFrontend(path: string): void {
  // HA frontend uses history-API navigation; window.location works as a fallback.
  if (typeof window !== 'undefined') window.history.pushState({}, '', path);
}
