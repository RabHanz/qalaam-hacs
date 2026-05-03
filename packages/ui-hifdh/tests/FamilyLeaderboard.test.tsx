import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FamilyLeaderboard } from '../src/leaderboard/FamilyLeaderboard.js';

afterEach(() => {
  cleanup();
});

const ENTRIES = [
  {
    userId: 'u1',
    displayName: 'Aisha',
    minutesThisWeek: 95,
    pagesReviewed: 14,
    streakDays: 7,
    isYou: false,
  },
  {
    userId: 'u2',
    displayName: 'Yusuf',
    minutesThisWeek: 140,
    pagesReviewed: 21,
    streakDays: 12,
    isYou: true,
  },
  {
    userId: 'u3',
    displayName: 'Maryam',
    minutesThisWeek: 30,
    pagesReviewed: 5,
    streakDays: 0,
    isYou: false,
  },
] as const;

describe('FamilyLeaderboard', () => {
  it('renders the family-private framing in the header', () => {
    render(
      <FamilyLeaderboard
        familyName="Al-Hashimi"
        entries={ENTRIES}
        weekStartIso="2026-04-27T00:00:00Z"
      />,
    );
    // Family-private disclosure
    expect(screen.getByText(/Family-private/i)).toBeDefined();
    // Ikhlas framing
    expect(screen.getByText(/encourage each other/i)).toBeDefined();
  });

  it('orders entries by minutes desc but does NOT show rank labels', () => {
    render(
      <FamilyLeaderboard
        familyName="Al-Hashimi"
        entries={ENTRIES}
        weekStartIso="2026-04-27T00:00:00Z"
      />,
    );
    const list = screen.getByLabelText(/family activity this week/i);
    const items = within(list).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Yusuf');
    expect(items[1]?.textContent).toContain('Aisha');
    expect(items[2]?.textContent).toContain('Maryam');
    // No rank suffixes anywhere
    for (const item of items) {
      expect(item.textContent).not.toMatch(/#1\b|1st\b|2nd\b|3rd\b|winner/i);
    }
  });

  it('flags the current user with "(you)" without changing rank', () => {
    render(
      <FamilyLeaderboard
        familyName="Al-Hashimi"
        entries={ENTRIES}
        weekStartIso="2026-04-27T00:00:00Z"
      />,
    );
    const list = screen.getByLabelText(/family activity this week/i);
    const items = within(list).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('(you)');
  });

  it('uses "fresh start" copy instead of "0-day streak"', () => {
    render(
      <FamilyLeaderboard
        familyName="Al-Hashimi"
        entries={ENTRIES}
        weekStartIso="2026-04-27T00:00:00Z"
      />,
    );
    // "fresh start" appears inside a longer line — match by partial text.
    expect(document.body.textContent).toMatch(/fresh start/i);
    expect(document.body.textContent).not.toMatch(/0-day streak/i);
  });

  it('renders an empty-state with non-blaming copy', () => {
    render(
      <FamilyLeaderboard
        familyName="Al-Hashimi"
        entries={[]}
        weekStartIso="2026-04-27T00:00:00Z"
      />,
    );
    expect(screen.getByText(/begin whenever you are ready/i)).toBeDefined();
  });

  it('exposes the bar chart with progressbar role + aria values', () => {
    render(
      <FamilyLeaderboard
        familyName="Al-Hashimi"
        entries={ENTRIES}
        weekStartIso="2026-04-27T00:00:00Z"
      />,
    );
    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBe(ENTRIES.length);
    // The largest value sets the aria-valuemax for all bars (max-bar normalized)
    const maxValue = Math.max(...ENTRIES.map((e) => e.minutesThisWeek));
    for (const bar of bars) {
      expect(bar.getAttribute('aria-valuemax')).toBe(maxValue.toString());
    }
  });

  it('shows the family aggregate at the foot, never naming a "winner"', () => {
    render(
      <FamilyLeaderboard
        familyName="Al-Hashimi"
        entries={ENTRIES}
        weekStartIso="2026-04-27T00:00:00Z"
      />,
    );
    // Total = 95 + 140 + 30 = 265 min = 4h 25m
    expect(document.body.textContent).toMatch(/Together this week:\s*4 h 25 min/i);
    expect(document.body.textContent).not.toMatch(/winner|champion|first place/i);
  });
});
