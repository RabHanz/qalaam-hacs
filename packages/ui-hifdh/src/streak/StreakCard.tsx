/**
 * StreakCard — current streak with grace days. Per strategy §21.14.
 *
 * Copy intentionally never blames the user. A missed day surfaces as a
 * "welcome back" prompt, not a streak-broken alert.
 */
import { Card, Heading, Text } from '@qalaam/ui';
import type { ReactNode } from 'react';

export interface StreakCardProps {
  readonly currentStreakDays: number;
  readonly graceDaysRemainingThisMonth: number;
  readonly missedYesterday: boolean;
}

export function StreakCard({
  currentStreakDays,
  graceDaysRemainingThisMonth,
  missedYesterday,
}: StreakCardProps): ReactNode {
  return (
    <Card aria-label="Hifdh streak">
      <Heading level={3}>
        {currentStreakDays > 0 ? `${currentStreakDays.toString()}-day streak` : 'Begin a new streak'}
      </Heading>
      <Text size="caption" tone="muted" style={{ display: 'block', marginTop: '0.5rem' }}>
        Grace days available this month: {graceDaysRemainingThisMonth.toString()}
      </Text>
      {missedYesterday ? (
        <Text size="body" style={{ display: 'block', marginTop: '1rem' }}>
          Welcome back. Pick up where you left off.
        </Text>
      ) : (
        <Text size="body" style={{ display: 'block', marginTop: '1rem' }}>
          Keep going. Every day adds up.
        </Text>
      )}
    </Card>
  );
}
