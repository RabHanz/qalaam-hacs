/**
 * /hifdh — family-private daily Hifdh dashboard.
 *
 * Design intent (per CLAUDE.md adab non-negotiables + competitive UX
 * research): explicit family-private ribbon at the top, streak as a
 * single calm column count (NO gamified counter, NO trophies), grace
 * days as a visible figure (Quranly's failure mode is punishing the
 * user — Qalaam refuses to). "Welcome back" framing if missed yesterday,
 * never "you broke your streak."
 *
 * Per strategy §7.4 + §21.10: daily summary only — no real-time alerts.
 */
import {
  FamilyLeaderboard,
  ParentDashboard,
  type ChildSummary,
  type LeaderboardEntry,
} from '@qalaam/ui-hifdh';
import { Suspense } from 'react';

import { EmptyState } from '../../components/EmptyState.js';
import { HairlineDivider } from '../../components/Glyph.js';
import { LoadingState } from '../../components/LoadingState.js';
import { MutashabihatWatchlistPane } from '../../components/MutashabihatWatchlistPane.js';
import { SiteNav } from '../../components/SiteNav.js';

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
      const day = now.getUTCDay();
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
      monday.setUTCHours(0, 0, 0, 0);
      return monday.toISOString();
    })();
  const generatedAt = state.generated_at ?? new Date().toISOString();
  const sabqiHead = state.current_sabqi?.split(/[\s\-–—]+/)[0]?.trim() ?? '';

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 reveal">
      {/* MAIN COLUMN */}
      <div className="lg:col-span-8 space-y-6">
        {/* Hero — streak + portions in a calm typographic row */}
        <section className="paper-card-raised relative overflow-hidden p-8 md:p-10">
          <div
            className="absolute -left-16 -bottom-16 h-44 w-44 rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, var(--color-leaf-300) 0%, transparent 70%)' }}
            aria-hidden
          />
          <div className="relative grid gap-8 sm:grid-cols-3 sm:gap-12 sm:items-baseline">
            <Stat
              label="Continuous days"
              value={(state.streak_days ?? 0).toString()}
              caption={
                state.missed_yesterday
                  ? 'Welcome back. Pick up where you left off.'
                  : 'Keep going. Every day adds up.'
              }
            />
            <Stat
              label="Portions due today"
              value={(state.today_session_count ?? 0).toString()}
              caption={state.current_sabqi ? `Current sabaq: ${state.current_sabqi}` : 'No sabaq set yet.'}
            />
            <Stat
              label="Grace days this month"
              value={(state.grace_days_remaining ?? 0).toString()}
              caption="Skip a day without breaking the rhythm."
            />
          </div>
        </section>

        {/* Weakest pages + sabqi context */}
        <section className="paper-card-raised p-8 md:p-10">
          <h2 className="font-display text-2xl font-light tracking-tight mb-2">Today</h2>
          <p className="text-base text-ink-muted leading-relaxed">
            {state.manzil_cycle_position ? (
              <>
                You're in <strong className="text-ink">{state.manzil_cycle_position}</strong>.
                {' '}
              </>
            ) : null}
            {(state.weakest_pages?.length ?? 0) > 0 ? (
              <>
                Pages needing review: <span className="font-mono text-ink">{(state.weakest_pages ?? []).join(' · ')}</span>.
              </>
            ) : (
              <>No weak pages flagged yet.</>
            )}
          </p>

          {(state.mutashabihat_watchlist?.length ?? 0) > 0 ? (
            <>
              <HairlineDivider />
              <p className="text-sm text-ink-muted">
                <span className="smallcaps text-leaf text-xs mr-2">Mutashabihat</span>
                Watch for confusion at: <span className="font-mono text-ink">{(state.mutashabihat_watchlist ?? []).join(' · ')}</span>
              </p>
            </>
          ) : null}
        </section>

        {/* Family parent dashboard or single-user prompt */}
        {hasMembers ? (
          <section className="paper-card-raised p-8 md:p-10">
            <ParentDashboard
              familyName={familyName}
              children={state.family_members ?? []}
              generatedAt={generatedAt}
            />
          </section>
        ) : null}

        {/* Family leaderboard (family-private, opt-in framing built into component) */}
        {hasLeaderboard ? (
          <section className="paper-card-raised p-8 md:p-10">
            <FamilyLeaderboard
              familyName={familyName}
              entries={state.weekly_leaderboard ?? []}
              weekStartIso={weekStartIso}
            />
          </section>
        ) : null}
      </div>

      {/* SIDEBAR — mutashabihat watchlist + family-private reminder */}
      <aside className="lg:col-span-4 space-y-4">
        <div className="lg:sticky lg:top-24 space-y-4">
          {sabqiHead ? <MutashabihatWatchlistPane verseKey={sabqiHead} limit={4} /> : null}

          <div className="paper-card p-5">
            <p className="smallcaps text-leaf text-xs">Adab</p>
            <p className="font-display mt-3 text-base italic leading-relaxed text-ink">
              No XP, no leaderboards, no public sharing.
            </p>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">
              Hifdh is between you and Allah. We surface daily summaries
              only — never real-time alerts. Streaks have grace days.
              Family stats stay inside your household.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

interface StatProps {
  readonly label: string;
  readonly value: string;
  readonly caption: string;
}

function Stat({ label, value, caption }: StatProps): ReactNode {
  return (
    <div>
      <p className="smallcaps text-leaf text-xs">{label}</p>
      <p
        className="font-display mt-3 text-6xl md:text-7xl font-light tracking-tight text-ink-strong tabular-nums"
        style={{ lineHeight: 1 }}
      >
        {value}
      </p>
      <p className="mt-3 text-sm text-ink-muted leading-relaxed">{caption}</p>
    </div>
  );
}

export default function HifdhPage(): ReactNode {
  const baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  const userId = process.env.PUBLIC_DEMO_USER_ID ?? 'demo-user';

  return (
    <>
      <SiteNav />

      {/* Family-private ribbon — explicit, always visible */}
      <div className="bg-paper-100 border-b border-hairline">
        <div className="mx-auto max-w-7xl px-6 py-2 text-xs">
          <span className="smallcaps text-leaf">Family-private</span>
          <span className="text-ink-muted ml-3">
            Daily summary only. Never shared, never gamified, never punishing.
          </span>
        </div>
      </div>

      <header className="border-b border-hairline">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="smallcaps text-leaf text-xs">Hifdh · حِفْظ</p>
          <h1 className="font-display mt-3 text-4xl md:text-5xl font-light tracking-tight">
            Today, with intention.
          </h1>
          <p className="mt-3 max-w-prose text-base text-ink-muted leading-relaxed">
            Your daily summary, drawn from FSRS-6 spacing + mutashabihat-aware
            review. No real-time alerts. Streaks include grace days.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <Suspense fallback={<LoadingState label="Loading Hifdh state…" lines={6} />}>
          <HifdhContent baseUrl={baseUrl} userId={userId} />
        </Suspense>
      </div>
    </>
  );
}
