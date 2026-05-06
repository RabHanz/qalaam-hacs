/**
 * playback-store — canonical localStorage keys + helpers shared by
 * /listen (MiniPlayer) and /read (ContinuousReaderPlayer) so the two
 * surfaces present a single, continuous session.
 *
 * Without this, picking a reciter on /listen and then navigating to
 * /read would lose the choice (different keys), and the audio would
 * stop instead of carrying over.
 *
 * The keys here are read+written by both players. The helpers do the
 * usual safe-storage dance (window guard, try/catch) so SSR and
 * private-mode quotas can't blow up.
 */

const KEY_RECITER = 'qalaam-reciter';
const KEY_VERSE = 'qalaam-verse-key';
const KEY_PLAYING = 'qalaam-playing';
// Last-known playback position within the current verse, in seconds.
// Written on every seek-commit and on a coarse interval while playing
// so cross-page resume respects the user's seek.
const KEY_POSITION = 'qalaam-position-seconds';
// Old keys we used to write — read on mount for one cycle so the
// user's earlier choice survives the migration, then write to the
// canonical keys going forward.
const LEGACY_KEY_LISTEN_RECITER = 'qalaam-listen-reciter';
const LEGACY_KEY_LISTEN_VERSE = 'qalaam-listen-verse-key';

const VERSE_KEY_RE = /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/;

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — non-fatal */
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface PlaybackSnapshot {
  reciterSlug: string | null;
  verseKey: string | null;
  /** True if the user was actively playing audio at the last write. */
  isPlaying: boolean;
  /** Last-known playback position within the current verse (seconds).
   *  Null if we never wrote a position (fresh user / no seek). */
  positionSeconds: number | null;
}

export function readPlaybackSnapshot(): PlaybackSnapshot {
  const reciterSlug = safeRead(KEY_RECITER) ?? safeRead(LEGACY_KEY_LISTEN_RECITER);
  const rawVerse = safeRead(KEY_VERSE) ?? safeRead(LEGACY_KEY_LISTEN_VERSE);
  const verseKey = rawVerse && VERSE_KEY_RE.test(rawVerse) ? rawVerse : null;
  const isPlaying = safeRead(KEY_PLAYING) === '1';
  const rawPos = safeRead(KEY_POSITION);
  const positionSeconds =
    rawPos !== null && Number.isFinite(Number.parseFloat(rawPos))
      ? Number.parseFloat(rawPos)
      : null;
  return { reciterSlug, verseKey, isPlaying, positionSeconds };
}

export function writeReciter(slug: string): void {
  safeWrite(KEY_RECITER, slug);
  // Mirror to the legacy key for one more deploy cycle so older
  // builds in other open tabs still see it.
  safeWrite(LEGACY_KEY_LISTEN_RECITER, slug);
}

export function writeVerseKey(verseKey: string): void {
  if (!VERSE_KEY_RE.test(verseKey)) return;
  safeWrite(KEY_VERSE, verseKey);
  safeWrite(LEGACY_KEY_LISTEN_VERSE, verseKey);
}

export function writePlaying(playing: boolean): void {
  if (playing) safeWrite(KEY_PLAYING, '1');
  else safeRemove(KEY_PLAYING);
}

export function writePositionSeconds(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  safeWrite(KEY_POSITION, seconds.toFixed(2));
}

export function clearPositionSeconds(): void {
  safeRemove(KEY_POSITION);
}

/** Parse "S:A" → [surah, ayah]; returns null on malformed input. */
export function parseVerseKey(verseKey: string): [number, number] | null {
  if (!VERSE_KEY_RE.test(verseKey)) return null;
  const parts = verseKey.split(':');
  const s = Number.parseInt(parts[0] ?? '', 10);
  const a = Number.parseInt(parts[1] ?? '', 10);
  if (!Number.isFinite(s) || !Number.isFinite(a)) return null;
  return [s, a];
}
