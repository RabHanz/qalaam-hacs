/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * /hifdh — family-private daily Hifdh dashboard.
 *
 * (Defensive ?? + delete on backend response fields: in-memory types
 * mark fields non-null but the wire payload may omit them on older
 * server versions; the runtime guards are intentional.)
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
import { MistakeHeatmap } from '../../components/family/MistakeHeatmap.js';
import { HairlineDivider } from '../../components/Glyph.js';
import { HeardThemRecite } from '../../components/HeardThemRecite.js';
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
  current_sabaq?: string | null;
  manzil_cycle_position: string | null;
  weakest_pages: string[];
  mutashabihat_watchlist: string[];
  // Backend canonical field name (since 2026-05-04). Older `today_session_count`
  // kept as fallback for pre-existing in-flight responses.
  portions_due_today?: number;
  minutes_completed_today?: number;
  today_session_count?: number;
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
    <div className="reveal grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* MAIN COLUMN */}
      <div className="space-y-6 lg:col-span-8">
        {/* Hero — streak + portions in a calm typographic row */}
        <section className="paper-card-raised relative overflow-hidden p-8 md:p-10">
          <div
            className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full opacity-25"
            style={{
              background: 'radial-gradient(circle, var(--color-leaf-300) 0%, transparent 70%)',
            }}
            aria-hidden
          />
          <div className="relative grid gap-8 sm:grid-cols-3 sm:items-baseline sm:gap-12">
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
              value={(state.portions_due_today ?? state.today_session_count ?? 0).toString()}
              caption={
                state.current_sabqi ? `Current sabaq: ${state.current_sabqi}` : 'No sabaq set yet.'
              }
            />
            <Stat
              label="Grace days this month"
              value={(state.grace_days_remaining ?? 0).toString()}
              caption="Skip a day without breaking the rhythm."
            />
          </div>
        </section>

        {/* Today: portion + weakest pages + watchlist with tappable links */}
        <section className="paper-card-raised p-6 sm:p-8 md:p-10">
          <h2 className="font-display mb-3 text-xl font-light tracking-tight sm:text-2xl">Today</h2>

          {state.manzil_cycle_position ? (
            <p className="text-ink text-sm leading-relaxed sm:text-base">
              You're in <strong className="text-ink-strong">{state.manzil_cycle_position}</strong>.
            </p>
          ) : null}

          {/* Current portion → tappable link to /read */}
          {state.current_sabqi ? (
            <div className="mt-4">
              <p className="smallcaps text-leaf mb-2 text-[11px] tracking-widest">Current sabaq</p>
              <a
                href={`/read/${(state.current_sabqi.split(':')[0] ?? '2').replace(/[^0-9]/g, '')}#${state.current_sabqi.split(' ')[0] ?? state.current_sabqi}`}
                className="border-hairline text-ink hover:border-leaf hover:text-leaf inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm tabular-nums transition-colors"
              >
                <span className="font-mono">{state.current_sabqi}</span>
                <span aria-hidden>→</span>
              </a>
            </div>
          ) : null}

          {(state.weakest_pages?.length ?? 0) > 0 ? (
            <div className="mt-5">
              <p className="smallcaps text-leaf mb-2 text-[11px] tracking-widest">
                Pages needing review
              </p>
              <ul className="flex flex-wrap gap-2">
                {(state.weakest_pages ?? []).map((p) => (
                  <li key={p}>
                    <span className="border-hairline text-ink inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs tabular-nums">
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(state.mutashabihat_watchlist?.length ?? 0) > 0 ? (
            <>
              <HairlineDivider />
              <p className="smallcaps text-leaf mb-2 text-[11px] tracking-widest">
                Mutashabihat — watch for confusion
              </p>
              <ul className="flex flex-wrap gap-2">
                {(state.mutashabihat_watchlist ?? []).map((vk) => {
                  const [s, a] = vk.split(':');
                  return (
                    <li key={vk}>
                      <a
                        href={`/study/${s ?? '2'}/${a ?? '255'}`}
                        className="border-hairline text-ink hover:border-leaf hover:text-leaf inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs tabular-nums transition-colors"
                      >
                        {vk}
                        <span aria-hidden>→</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {/* I just heard them recite — one-tap rating row */}
          <HairlineDivider />
          <p className="smallcaps text-leaf mb-3 text-[11px] tracking-widest">
            I just heard them recite
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Smooth', tone: 'leaf' },
              { label: 'Stumbled', tone: 'amber' },
              { label: 'Choppy', tone: 'amber' },
              { label: 'Replay', tone: 'red' },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                disabled
                title="Wires to /v1/hifdh/rate in v0.5"
                className={`paper-card smallcaps text-ink-muted cursor-not-allowed px-3 py-2.5 text-center text-[11px] tracking-wider opacity-60 sm:text-xs ${
                  b.tone === 'leaf'
                    ? 'border-leaf/30'
                    : b.tone === 'amber'
                      ? 'border-amber-500/30'
                      : 'border-red-500/30'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <p className="text-ink-muted mt-2 text-[11px] italic">
            Wires to <span className="font-mono">/v1/hifdh/rate</span> when family auth lands
            (v0.5).
          </p>
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

        {/* One-tap "I heard them recite" — parent-facing, family-private,
            client-only audit log (no server, no auth). */}
        <HeardThemRecite currentPortion={state.current_sabqi ?? state.current_sabaq ?? null} />

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

        {/* E1 — per-page mistake heatmap. Auth-gated; renders empty
            for anonymous viewers (no warning, just calm placeholder). */}
        <MistakeHeatmap windowDays={30} />
      </div>

      {/* SIDEBAR — mutashabihat watchlist + family-private reminder */}
      <aside className="space-y-4 lg:col-span-4">
        <div className="space-y-4 lg:sticky lg:top-24">
          {sabqiHead ? <MutashabihatWatchlistPane verseKey={sabqiHead} limit={4} /> : null}

          <div className="paper-card p-5">
            <p className="smallcaps text-leaf text-xs">Adab</p>
            <p className="font-display text-ink mt-3 text-base italic leading-relaxed">
              No XP, no leaderboards, no public sharing.
            </p>
            <p className="text-ink-muted mt-3 text-sm leading-relaxed">
              Hifdh is between you and Allah. We surface daily summaries only — never real-time
              alerts. Streaks have grace days. Family stats stay inside your household.
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
        className="font-display text-ink-strong mt-3 text-6xl font-light tabular-nums tracking-tight md:text-7xl"
        style={{ lineHeight: 1 }}
      >
        {value}
      </p>
      <p className="text-ink-muted mt-3 text-sm leading-relaxed">{caption}</p>
    </div>
  );
}

export default function HifdhPage(): ReactNode {
  const baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  const userId = process.env.PUBLIC_DEMO_USER_ID ?? 'demo-user';

  return (
    <>
      <SiteNav />

      {/* Family-private ribbon — explicit, always visible. Mobile collapses to short copy. */}
      <div className="bg-paper-100 border-hairline border-b">
        <div className="mx-auto max-w-7xl px-4 py-2 text-[11px] sm:px-6 sm:text-xs">
          <span className="smallcaps text-leaf tracking-widest">Family-private</span>
          <span className="text-ink-muted ml-2 hidden sm:ml-3 sm:inline">
            Daily summary only. Never shared, never gamified, never punishing.
          </span>
          <span className="text-ink-muted ml-2 sm:hidden">Daily summary only. Never shared.</span>
        </div>
      </div>

      <header className="border-hairline border-b">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">Hifdh · حِفْظ</p>
          <h1 className="font-display mt-2 text-3xl font-light tracking-tight sm:mt-3 sm:text-4xl md:text-5xl">
            Today, with intention.
          </h1>
          <p className="text-ink-muted mt-3 max-w-prose text-sm leading-relaxed sm:text-base">
            Your daily summary, drawn from FSRS-6 spacing + mutashabihat-aware review. No real-time
            alerts. Streaks include grace days.
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
