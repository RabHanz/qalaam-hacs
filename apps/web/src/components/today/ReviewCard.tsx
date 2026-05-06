'use client';

/**
 * ReviewCard — surfaces the user's hifdh queue for today.
 *
 * Pulls /v1/hifdh/state and renders only the actionable bits: portions
 * due today, current sabqi/sabaq, weakest pages. Renders nothing on
 * fetch failure (silent — the marketing fallback is the natural place
 * to nudge new users into Hifdh).
 *
 * Adab: NO "you broke your streak" alarmism. NO XP/coins. The streak
 * is shown only when ≥1 day, in calm grey, alongside grace days. A
 * day-zero user sees an inviting "begin" copy, not a guilt nudge.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { resolveApiBase } from '../../lib/api-base.js';

import type { ReactNode } from 'react';

interface HifdhState {
  user_id: string;
  streak_days: number;
  grace_days_remaining: number;
  current_sabqi: string | null;
  current_sabaq: string | null;
  portions_due_today: number;
  minutes_completed_today: number;
  manzil_cycle_position: string | null;
  weakest_pages: readonly string[];
  mutashabihat_watchlist: readonly string[];
  generated_at: string;
}

export function ReviewCard(): ReactNode {
  const apiBase = resolveApiBase();
  const [state, setState] = useState<HifdhState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const lifecycle = { cancelled: false };
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/hifdh/state`, { credentials: 'include' });
        if (!res.ok) {
          if (!lifecycle.cancelled) setError(true);
          return;
        }
        const body = (await res.json()) as HifdhState;
        if (!lifecycle.cancelled) setState(body);
      } catch {
        if (!lifecycle.cancelled) setError(true);
      }
    })();
    return () => {
      lifecycle.cancelled = true;
    };
  }, [apiBase]);

  if (error) return null;
  if (!state) {
    // Skeleton in the same footprint so the rail doesn't shift on hydrate.
    return (
      <div className="paper-card p-5 sm:p-6" aria-hidden>
        <div className="bg-paper-200/60 h-3 w-20 animate-pulse rounded" />
        <div className="bg-paper-200/60 mt-3 h-6 w-40 animate-pulse rounded" />
        <div className="bg-paper-200/60 mt-2 h-3 w-28 animate-pulse rounded" />
      </div>
    );
  }

  const due = state.portions_due_today;
  const dueLabel =
    due === 0
      ? 'No reviews queued today'
      : `${due.toString()} ${due === 1 ? 'portion' : 'portions'} due`;

  return (
    <Link
      href="/hifdh"
      className="paper-card hover:border-leaf/40 group block p-5 transition-colors sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="smallcaps text-leaf text-[10px] tracking-widest">Hifdh · حِفْظ</p>
        {state.streak_days > 0 ? (
          <p className="text-ink-muted font-mono text-[10px] tabular-nums">
            {state.streak_days.toString()}d
            {state.grace_days_remaining > 0 ? (
              <span className="opacity-50"> · {state.grace_days_remaining.toString()} grace</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <p className="font-display text-ink-strong mt-3 text-xl font-light leading-tight sm:text-2xl">
        {dueLabel}
      </p>

      {state.current_sabqi ? (
        <p className="text-ink-muted mt-2 text-xs leading-relaxed">
          <span className="smallcaps tracking-widest">Sabqi</span>{' '}
          <span className="font-mono tabular-nums">{state.current_sabqi}</span>
          {state.current_sabaq ? (
            <>
              <span className="mx-1.5 opacity-60">·</span>
              <span className="smallcaps tracking-widest">Sabaq</span>{' '}
              <span className="font-mono tabular-nums">{state.current_sabaq}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {state.weakest_pages.length > 0 ? (
        <p className="text-ink-muted mt-2 text-[11px] leading-relaxed">
          <span className="smallcaps tracking-widest">Watching</span>{' '}
          <span className="font-mono tabular-nums">
            {state.weakest_pages.slice(0, 3).join(' · ')}
          </span>
        </p>
      ) : null}

      <p className="smallcaps text-leaf mt-4 inline-flex items-center gap-1.5 text-[11px] tracking-widest">
        {due > 0 ? 'Begin review' : 'Open dashboard'}
        <span aria-hidden className="rtl-flip transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </p>
    </Link>
  );
}
