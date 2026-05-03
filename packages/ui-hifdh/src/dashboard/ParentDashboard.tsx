/**
 * ParentDashboard — per-child daily summary.
 *
 * Per strategy §7.4 + §21.10:
 *   - **DAILY SUMMARIES ONLY.** Never real-time. The card explicitly says so.
 *   - No public sharing. Family-private framing in the header.
 *   - One-tap "I just heard them recite" rating launches `<RatingTrigger>`.
 */
import { Card, Heading, Text } from '@qalaam/ui';
import type { ReactNode } from 'react';

export interface ChildSummary {
  readonly userId: string;
  readonly displayName: string;
  readonly currentSabqi: string; // e.g., "Juz 29"
  readonly manzilCyclePosition: string; // e.g., "Day 14 of 30"
  readonly streakDays: number;
  readonly weakestPages: readonly string[]; // top-5 weakest, e.g., ["p. 540", "p. 7"]
  readonly mutashabihatWatchlist: readonly string[];
  readonly heardThemTodayHref: string;
}

export interface ParentDashboardProps {
  readonly familyName: string;
  readonly children: readonly ChildSummary[];
  /** ISO-8601 timestamp the summary was generated. */
  readonly generatedAt: string;
}

export function ParentDashboard({
  familyName,
  children,
  generatedAt,
}: ParentDashboardProps): ReactNode {
  return (
    <section aria-label={`${familyName} Hifdh dashboard`}>
      <header style={{ marginBottom: '1.5rem' }}>
        <Heading level={2}>{familyName} — today</Heading>
        <Text size="caption" tone="muted" style={{ display: 'block' }}>
          Daily summary, generated {new Date(generatedAt).toLocaleString()}. Family-private —
          never shared.
        </Text>
      </header>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {children.map((child) => (
          <Card key={child.userId} aria-label={`${child.displayName} summary`}>
            <Heading level={3}>{child.displayName}</Heading>
            <dl style={{ marginTop: '0.75rem', display: 'grid', gap: '0.4rem' }}>
              <div>
                <dt style={{ fontWeight: 600 }}>Current sabqi</dt>
                <dd style={{ margin: 0 }}>{child.currentSabqi}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600 }}>Manzil cycle</dt>
                <dd style={{ margin: 0 }}>{child.manzilCyclePosition}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600 }}>Streak</dt>
                <dd style={{ margin: 0 }}>
                  {child.streakDays > 0
                    ? `${child.streakDays.toString()} days`
                    : 'fresh start'}
                </dd>
              </div>
              {child.weakestPages.length > 0 ? (
                <div>
                  <dt style={{ fontWeight: 600 }}>Top-5 weakest</dt>
                  <dd style={{ margin: 0 }}>{child.weakestPages.join(' · ')}</dd>
                </div>
              ) : null}
              {child.mutashabihatWatchlist.length > 0 ? (
                <div>
                  <dt style={{ fontWeight: 600 }}>Mutashabihat watch</dt>
                  <dd style={{ margin: 0 }}>{child.mutashabihatWatchlist.join(' · ')}</dd>
                </div>
              ) : null}
            </dl>
            <a
              href={child.heardThemTodayHref}
              style={{
                display: 'inline-block',
                marginTop: '1rem',
                padding: '0.5rem 0.875rem',
                background: 'var(--color-gold-500, #b6862c)',
                color: '#fff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              I just heard them recite
            </a>
          </Card>
        ))}
      </div>
    </section>
  );
}
