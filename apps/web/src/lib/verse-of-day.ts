/**
 * Verse-of-the-day picker — curated, deterministic by date.
 *
 * Rotation rules:
 *   - 30 well-loved verses, hand-picked: openings, du'as, mercy + reliance
 *     verses, the closing surahs. Each verse can stand on its own as a
 *     daily companion, no surrounding context required.
 *   - The picked verse is `dayOfYear % VERSES.length` so the same date
 *     in the same year always yields the same pick — predictable for
 *     SEO and SSR cache.
 *   - The list intentionally excludes verses that REQUIRE a translation
 *     to be meaningful (those work better in /study). The picks are
 *     beloved enough that even non-Arabic speakers know them.
 */

export interface VotdPick {
  readonly verseKey: string;
  /** Short, human-readable name in the editorial register — used as a
   *  card subtitle. NOT the Quran.com slug. */
  readonly title: string;
}

/**
 * Curated list. Order doesn't matter beyond determinism.
 */
const VERSES: readonly VotdPick[] = [
  { verseKey: '1:6', title: 'Sūrat al-Fātiḥa · the prayer for guidance' },
  { verseKey: '2:152', title: 'Sūrat al-Baqara · remembrance' },
  { verseKey: '2:201', title: 'Sūrat al-Baqara · the balanced du‘ā' },
  { verseKey: '2:255', title: 'Āyat al-Kursī · the throne verse' },
  { verseKey: '2:286', title: 'Sūrat al-Baqara · its last verse' },
  { verseKey: '3:8', title: 'Sūrat Āl ‘Imrān · keep our hearts steady' },
  { verseKey: '3:26', title: 'Sūrat Āl ‘Imrān · the giver of dominion' },
  { verseKey: '3:159', title: 'Sūrat Āl ‘Imrān · gentleness as a gift' },
  { verseKey: '7:23', title: 'Sūrat al-A‘rāf · the du‘ā of Adam' },
  { verseKey: '14:40', title: 'Sūrat Ibrāhīm · keep me steadfast in prayer' },
  { verseKey: '17:23', title: 'Sūrat al-Isrā’ · the kindness owed to parents' },
  { verseKey: '17:80', title: 'Sūrat al-Isrā’ · the du‘ā of arrival and departure' },
  { verseKey: '18:10', title: 'Sūrat al-Kahf · the cave-dwellers’ du‘ā' },
  { verseKey: '20:25', title: 'Sūrat Ṭā Hā · the du‘ā for clarity' },
  { verseKey: '20:114', title: 'Sūrat Ṭā Hā · increase me in knowledge' },
  { verseKey: '21:87', title: 'Sūrat al-Anbiyā’ · Yūnus’s du‘ā' },
  { verseKey: '25:74', title: 'Sūrat al-Furqān · a du‘ā for family' },
  { verseKey: '28:24', title: 'Sūrat al-Qaṣaṣ · Mūsā’s du‘ā in need' },
  { verseKey: '39:53', title: 'Sūrat az-Zumar · do not despair of mercy' },
  { verseKey: '40:60', title: 'Sūrat Ghāfir · call upon Me, I will respond' },
  { verseKey: '55:13', title: 'Sūrat ar-Raḥmān · which favours' },
  { verseKey: '65:2', title: 'Sūrat aṭ-Ṭalāq · a way out' },
  { verseKey: '65:3', title: 'Sūrat aṭ-Ṭalāq · provision from the unseen' },
  { verseKey: '67:1', title: 'Sūrat al-Mulk · its opening' },
  { verseKey: '93:5', title: 'Sūrat aḍ-Ḍuḥā · He will give you' },
  { verseKey: '93:7', title: 'Sūrat aḍ-Ḍuḥā · He found you' },
  { verseKey: '94:5', title: 'Sūrat ash-Sharḥ · ease with hardship' },
  { verseKey: '110:1', title: 'Sūrat an-Naṣr · victory' },
  { verseKey: '112:1', title: 'Sūrat al-Ikhlāṣ · the One' },
  { verseKey: '113:1', title: 'Sūrat al-Falaq · seek refuge' },
];

/**
 * Day-of-year (1..366) for a given date in the user's local zone.
 * For a server-render this gets called with `new Date()` in UTC,
 * which is fine — verse rotates within a 24-hour window everywhere.
 */
function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const here = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((here - start) / 86_400_000);
}

const FALLBACK_PICK: VotdPick = { verseKey: '1:1', title: 'Sūrat al-Fātiḥa · the opening' };

export function pickVerseOfDay(now: Date = new Date()): VotdPick {
  const idx = dayOfYear(now) % VERSES.length;
  return VERSES[idx] ?? FALLBACK_PICK;
}
