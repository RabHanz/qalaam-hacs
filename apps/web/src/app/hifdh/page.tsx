/**
 * /hifdh — family-private daily Hifdh dashboard.
 *
 * Per CLAUDE.md §11.3 design non-negotiables: empty / loading / error states.
 * Per strategy §7.4 + §21.10: daily summary only — no real-time alerts.
 *
 * Wires the live `@qalaam/ui-hifdh` components: StreakCard, FamilyLeaderboard,
 * ParentDashboard. Backend reads via `/v1/hifdh/state` + `/v1/family/summary`
 * (the latter falls back to a single-user view when no family context is
 * available).
 */
import {
  FamilyLeaderboard,
  ParentDashboard,
  StreakCard,
  type ChildSummary,
  type LeaderboardEntry,
} from '@qalaam/ui-hifdh';
import { Suspense } from 'react';

import { EmptyState } from '../../components/EmptyState.js';
import { LoadingState } from '../../components/LoadingState.js';
import { MutashabihatWatchlistPane } from '../../components/MutashabihatWatchlistPane.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Hifdh — Family',
  description: 'Daily Hifdh summary. Family-private — never shared.',
};

interface HifdhStatePayload {
  user_id: string;
  streak_days: number;
  grace_days_remaining: number;
  current_sabqi: string | null;
  manzil_cycle_position: string | null;
  weakest_pages: string[];
  mutashabihat_watchlist: string[];
  today_session_count: number;
  family_members?: ChildSummary[];
  weekly_leaderboard?: LeaderboardEntry[];
  family_name?: string;
  week_start_iso?: string;
  generated_at?: string;
  missed_yesterday?: boolean;
}

async function fetchHifdh(baseUrl: string, userId: string): Promise<HifdhStatePayload | null> {
  try {
    const url = new URL(`${baseUrl}/v1/hifdh/state`);
    url.searchParams.set('user_id', userId);
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as HifdhStatePayload;
  } catch {
    return null;
  }
}

async function HifdhContent({
  baseUrl,
  userId,
}: {
  baseUrl: string;
  userId: string;
}): Promise<ReactNode> {
  const state = await fetchHifdh(baseUrl, userId);
  if (!state) {
    return (
      <EmptyState
        title="Backend unreachable"
        hint="Could not load your Hifdh state. Check your connection or backend URL and try again."
      />
    );
  }

  const hasMembers = (state.family_members?.length ?? 0) > 0;
  const hasLeaderboard = (state.weekly_leaderboard?.length ?? 0) > 0;
  const familyName = state.family_name ?? 'Your family';
  const weekStartIso =
    state.week_start_iso ??
    (() => {
      const now = new Date();
      const day = now.getUTCDay(); // Sun=0
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
      monday.setUTCHours(0, 0, 0, 0);
      return monday.toISOString();
    })();
  const generatedAt = state.generated_at ?? new Date().toISOString();
  // Pull the first verse_key out of the sabqi range "2:255-2:257" → "2:255"
  // for the per-user mutashabihat watchlist surface.
  const sabqiHead = state.current_sabqi?.split(/[\s\-–—]+/)[0]?.trim() ?? '';

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <StreakCard
        currentStreakDays={state.streak_days}
        graceDaysRemainingThisMonth={state.grace_days_remaining}
        missedYesterday={state.missed_yesterday ?? false}
      />

      {sabqiHead ? <MutashabihatWatchlistPane verseKey={sabqiHead} limit={3} /> : null}

      {hasMembers ? (
        <ParentDashboard
          familyName={familyName}
          children={state.family_members ?? []}
          generatedAt={generatedAt}
        />
      ) : (
        <article
          style={{
            background: 'var(--color-surface-raised, #fff)',
            borderRadius: '1rem',
            padding: '1.5rem',
            boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Today</h2>
          <p style={{ marginTop: '0.5rem', opacity: 0.85 }}>
            Current sabqi: <strong>{state.current_sabqi ?? 'not yet set'}</strong>. Portions due
            today: <strong>{state.today_session_count.toString()}</strong>.
          </p>
          {state.weakest_pages.length > 0 ? (
            <p style={{ marginTop: '0.75rem', opacity: 0.85, fontSize: '0.875rem' }}>
              Weakest pages: {state.weakest_pages.join(' · ')}
            </p>
          ) : null}
          {state.mutashabihat_watchlist.length > 0 ? (
            <p style={{ marginTop: '0.5rem', opacity: 0.85, fontSize: '0.875rem' }}>
              Mutashabihat watch: {state.mutashabihat_watchlist.join(' · ')}
            </p>
          ) : null}
        </article>
      )}

      {hasLeaderboard ? (
        <FamilyLeaderboard
          familyName={familyName}
          entries={state.weekly_leaderboard ?? []}
          weekStartIso={weekStartIso}
        />
      ) : null}
    </div>
  );
}

export default function HifdhPage(): ReactNode {
  // Server-side env. PUBLIC_API_URL is the Fastify backend URL.
  const baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4100';
  const userId = process.env.PUBLIC_DEMO_USER_ID ?? 'demo-user';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Hifdh</h1>
        <p className="text-sm opacity-70">Daily summary. Family-private — never shared.</p>
      </header>
      <Suspense fallback={<LoadingState label="Loading Hifdh state…" lines={6} />}>
        <HifdhContent baseUrl={baseUrl} userId={userId} />
      </Suspense>
    </div>
  );
}
