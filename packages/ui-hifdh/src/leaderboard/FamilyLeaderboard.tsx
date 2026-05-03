/**
 * FamilyLeaderboard — family-private weekly encouragement view.
 *
 * Per CLAUDE.md adab non-negotiables + STRATEGY_AND_ROADMAP.md §6.4 + §21.11:
 *
 *   1. **NEVER public.** No global leaderboard. No cross-family comparison.
 *      Component is opt-in per family unit.
 *   2. **Framed as encouragement, not competition.** No "winner" / "loser" /
 *      "top 3" language. No medals, trophies, or rank suffixes.
 *   3. **No XP / coins / gems.** The metric is qira'ah minutes — actual time
 *      spent with the Qur'an — not abstract points that gamify worship.
 *   4. **Streaks have grace days.** A missed day surfaces as "welcome back",
 *      never as "you lost your streak."
 *   5. **Explicit ikhlas reminder** in the header copy. The whole framing is
 *      "to encourage each other, not to show off."
 *   6. **Children appear with displayName only** — no avatars, no last name,
 *      no global IDs visible to other family members.
 *
 * The component is intentionally minimal. It does NOT render a "top of the
 * week" call-out, even when one member has done dramatically more than another.
 * The visual design uses a single bar chart sorted by activity, not by rank.
 */
import { Card, Heading, Text } from '@qalaam/ui';
import type { ReactNode } from 'react';

export interface LeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  /** Total minutes of Hifdh practice (sabaq + sabqi + manzil) this week. */
  readonly minutesThisWeek: number;
  /** Pages reviewed at least once this week. */
  readonly pagesReviewed: number;
  /** Current streak in days (with grace credited). */
  readonly streakDays: number;
  /** True when the family member is the currently-viewing user. */
  readonly isYou: boolean;
}

export interface FamilyLeaderboardProps {
  readonly familyName: string;
  readonly entries: readonly LeaderboardEntry[];
  /** ISO-8601 string identifying the start of the week the data covers. */
  readonly weekStartIso: string;
  /**
   * When true, the encouragement copy refers to the family in second person
   * ("your family"). When false, it refers in third person — used for the
   * parent-overview view. Defaults to true.
   */
  readonly secondPerson?: boolean;
}

const FAMILY_PALETTE: readonly string[] = [
  '#5b8def',
  '#6cb967',
  '#d18a3f',
  '#a76cb9',
  '#cf6c6c',
  '#4ea49a',
];

function colorForIndex(i: number): string {
  return FAMILY_PALETTE[i % FAMILY_PALETTE.length] ?? '#888';
}

function formatMinutes(m: number): string {
  if (m <= 0) return '0 min';
  if (m < 60) return `${m.toString()} min`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${hrs.toString()} h` : `${hrs.toString()} h ${rem.toString()} min`;
}

function formatWeekRange(weekStartIso: string): string {
  const start = new Date(weekStartIso);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date): string =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function FamilyLeaderboard({
  familyName,
  entries,
  weekStartIso,
  secondPerson = true,
}: FamilyLeaderboardProps): ReactNode {
  // Sort by minutes desc but DO NOT label rank. The ordering is purely visual
  // (longest bars at the top), not a competitive ranking.
  const sorted = [...entries].sort((a, b) => b.minutesThisWeek - a.minutesThisWeek);
  const maxMinutes = Math.max(1, ...sorted.map((e) => e.minutesThisWeek));
  const totalFamilyMinutes = sorted.reduce((acc, e) => acc + e.minutesThisWeek, 0);

  return (
    <Card aria-label={`${familyName} weekly encouragement`}>
      <header style={{ marginBottom: '1.25rem' }}>
        <Heading level={3}>
          {familyName} — week of {formatWeekRange(weekStartIso)}
        </Heading>
        <Text size="caption" tone="muted" style={{ display: 'block', marginTop: '0.4rem' }}>
          Family-private. Never shared outside {secondPerson ? 'your' : 'the'} household.
        </Text>
        <Text
          size="caption"
          tone="muted"
          style={{ display: 'block', marginTop: '0.4rem', fontStyle: 'italic' }}
        >
          To encourage each other, not to show off. May Allah ﷻ accept from us all.
        </Text>
      </header>

      {sorted.length === 0 ? (
        <Text size="body">No activity yet this week. Begin whenever you are ready.</Text>
      ) : (
        <ul
          aria-label="Family activity this week"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: '0.85rem',
          }}
        >
          {sorted.map((entry, idx) => {
            const widthPct = Math.round((entry.minutesThisWeek / maxMinutes) * 100);
            const color = colorForIndex(idx);
            return (
              <li key={entry.userId}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: '0.25rem',
                  }}
                >
                  <Text size="body" style={{ fontWeight: entry.isYou ? 700 : 500 }}>
                    {entry.displayName}
                    {entry.isYou ? (
                      <span aria-label="you" style={{ marginLeft: '0.4rem', opacity: 0.7 }}>
                        (you)
                      </span>
                    ) : null}
                  </Text>
                  <Text size="caption" tone="muted">
                    {formatMinutes(entry.minutesThisWeek)} · {entry.pagesReviewed.toString()} pages ·{' '}
                    {entry.streakDays > 0
                      ? `${entry.streakDays.toString()}-day streak`
                      : 'fresh start'}
                  </Text>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={maxMinutes}
                  aria-valuenow={entry.minutesThisWeek}
                  aria-label={`${entry.displayName} this week`}
                  style={{
                    height: '0.5rem',
                    background: 'var(--color-surface-2, rgba(0,0,0,0.06))',
                    borderRadius: '999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct.toString()}%`,
                      height: '100%',
                      background: color,
                      transition: 'width 320ms ease',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer style={{ marginTop: '1.25rem' }}>
        <Text size="caption" tone="muted">
          Together this week: {formatMinutes(totalFamilyMinutes)}.
        </Text>
      </footer>
    </Card>
  );
}
