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

/**
 * Verse counts for every surah, by surah index (1..114). Hard-coded
 * because the values are immutable scripture and we don't want any
 * cross-surah advance / chaining to depend on a metadata fetch
 * succeeding in time.
 */
export const SURAH_VERSE_COUNTS: readonly number[] = [
  /* 1   */ 7, /* 2   */ 286, /* 3   */ 200, /* 4   */ 176, /* 5   */ 120, /* 6   */ 165,
  /* 7   */ 206, /* 8   */ 75, /* 9   */ 129, /* 10  */ 109, /* 11  */ 123, /* 12  */ 111,
  /* 13  */ 43, /* 14  */ 52, /* 15  */ 99, /* 16  */ 128, /* 17  */ 111, /* 18  */ 110,
  /* 19  */ 98, /* 20  */ 135, /* 21  */ 112, /* 22  */ 78, /* 23  */ 118, /* 24  */ 64,
  /* 25  */ 77, /* 26  */ 227, /* 27  */ 93, /* 28  */ 88, /* 29  */ 69, /* 30  */ 60, /* 31  */ 34,
  /* 32  */ 30, /* 33  */ 73, /* 34  */ 54, /* 35  */ 45, /* 36  */ 83, /* 37  */ 182, /* 38  */ 88,
  /* 39  */ 75, /* 40  */ 85, /* 41  */ 54, /* 42  */ 53, /* 43  */ 89, /* 44  */ 59, /* 45  */ 37,
  /* 46  */ 35, /* 47  */ 38, /* 48  */ 29, /* 49  */ 18, /* 50  */ 45, /* 51  */ 60, /* 52  */ 49,
  /* 53  */ 62, /* 54  */ 55, /* 55  */ 78, /* 56  */ 96, /* 57  */ 29, /* 58  */ 22, /* 59  */ 24,
  /* 60  */ 13, /* 61  */ 14, /* 62  */ 11, /* 63  */ 11, /* 64  */ 18, /* 65  */ 12, /* 66  */ 12,
  /* 67  */ 30, /* 68  */ 52, /* 69  */ 52, /* 70  */ 44, /* 71  */ 28, /* 72  */ 28, /* 73  */ 20,
  /* 74  */ 56, /* 75  */ 40, /* 76  */ 31, /* 77  */ 50, /* 78  */ 40, /* 79  */ 46, /* 80  */ 42,
  /* 81  */ 29, /* 82  */ 19, /* 83  */ 36, /* 84  */ 25, /* 85  */ 22, /* 86  */ 17, /* 87  */ 19,
  /* 88  */ 26, /* 89  */ 30, /* 90  */ 20, /* 91  */ 15, /* 92  */ 21, /* 93  */ 11, /* 94  */ 8,
  /* 95  */ 8, /* 96  */ 19, /* 97  */ 5, /* 98  */ 8, /* 99  */ 8, /* 100 */ 11, /* 101 */ 11,
  /* 102 */ 8, /* 103 */ 3, /* 104 */ 9, /* 105 */ 5, /* 106 */ 4, /* 107 */ 7, /* 108 */ 3,
  /* 109 */ 6, /* 110 */ 3, /* 111 */ 5, /* 112 */ 4, /* 113 */ 5, /* 114 */ 6,
];

/** verseCount for a surah (1..114), or 0 if out of range. */
export function verseCountFor(surah: number): number {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return 0;
  return SURAH_VERSE_COUNTS[surah - 1] ?? 0;
}
