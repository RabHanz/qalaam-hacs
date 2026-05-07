/**
 * orientation-state — tiny shared util for the Today surface.
 *
 * `OrientationCard` shows itself for brand-new accounts (no last-played
 * verse, dismissal flag unset). `ReviewCard` reads the same predicate
 * to suppress itself while orientation is visible — otherwise we'd
 * surface the inviting-demo Hifdh state next to a "begin a Hifdh plan"
 * nudge, which would feel contradictory.
 *
 * Both keys live in localStorage; this util is the single place that
 * resolves the predicate so the two components can never drift.
 */

const KEY_DISMISSED = 'qalaam-orientation-dismissed';
const KEY_VERSE = 'qalaam-verse-key';
const LEGACY_KEY_LISTEN_VERSE = 'qalaam-listen-verse-key';

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * True when the user is in the "first-run" state — no playback yet,
 * orientation not dismissed. Returns false during SSR (no window).
 */
export function shouldShowOrientation(forceShow = false): boolean {
  if (typeof window === 'undefined') return false;
  if (forceShow) return true;
  if (safeRead(KEY_DISMISSED) === '1') return false;
  const vk = safeRead(KEY_VERSE) ?? safeRead(LEGACY_KEY_LISTEN_VERSE);
  if (vk && vk.length > 0) return false;
  return true;
}

export function dismissOrientation(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_DISMISSED, '1');
  } catch {
    /* private mode — best-effort */
  }
}
