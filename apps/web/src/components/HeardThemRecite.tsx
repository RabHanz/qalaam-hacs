'use client';

 
 
 

/**
 * HeardThemRecite — one-tap "I just heard them recite" log.
 *
 * Family-private parent affordance: tap the button after a child
 * recites a portion to you. Stores timestamp + child name + optional
 * portion verse-key in localStorage. Never sent anywhere.
 *
 * Per CLAUDE.md adab non-negotiables: no gamification, no public
 * leaderboards, no streak punishment. The list is a gentle log — a
 * record for the parent's own peace of mind, not a score.
 *
 * UX:
 *   - Big, friendly tap target (kids' eye view: parents press it WHILE
 *     the child watches)
 *   - Optional inline name input (remembers last 5 names as quick chips)
 *   - Today's count + last 24h list visible
 *   - Soft "today" → "yesterday" → relative grouping
 */
import { useEffect, useMemo, useState } from 'react';

import type { ReactNode } from 'react';

interface HeardEvent {
  readonly id: string;
  readonly at: number; // ms epoch
  readonly child: string | null;
  readonly portion: string | null;
}

const STORE_KEY = 'qalaam-heard-log-v1';
const STORE_NAMES = 'qalaam-heard-names-v1';

function loadEvents(): readonly HeardEvent[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HeardEvent[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is HeardEvent =>
        typeof e === 'object' && typeof e.at === 'number' && typeof e.id === 'string',
    );
  } catch {
    return [];
  }
}
function saveEvents(events: readonly HeardEvent[]): void {
  try {
    // Keep last 90 days only — log doesn't need infinite memory.
    const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
    const trimmed = events.filter((e) => e.at >= cutoff);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — drop silently */
  }
}
function loadNames(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(STORE_NAMES);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  } catch {
    return [];
  }
}
function saveNames(names: readonly string[]): void {
  try {
    window.localStorage.setItem(STORE_NAMES, JSON.stringify(names.slice(0, 5)));
  } catch {
    /* ignore */
  }
}

interface Props {
  /** Optional default portion verse-key from the active sabqi/sabaq.
   *  Logged with the event so the parent can review what was heard. */
  readonly currentPortion?: string | null;
}

export function HeardThemRecite({ currentPortion }: Props): ReactNode {
  const [events, setEvents] = useState<readonly HeardEvent[]>([]);
  const [recentNames, setRecentNames] = useState<readonly string[]>([]);
  const [child, setChild] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | string>(null);

  useEffect(() => {
    setEvents(loadEvents());
    setRecentNames(loadNames());
  }, []);

  function record(name: string | null): void {
    if (busy) return;
    setBusy(true);
    const event: HeardEvent = {
      id: `${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      child: name?.trim() ? name.trim() : null,
      portion: currentPortion ?? null,
    };
    const next = [event, ...events].slice(0, 200);
    setEvents(next);
    saveEvents(next);
    const trimmed = name?.trim() ?? '';
    if (trimmed) {
      const dedup = [trimmed, ...recentNames.filter((n) => n !== trimmed)].slice(0, 5);
      setRecentNames(dedup);
      saveNames(dedup);
    }
    setConfirm(trimmed.length > 0 ? trimmed : 'session');
    setTimeout(() => {
      setConfirm(null);
      setBusy(false);
    }, 1400);
  }

  const todayCount = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const cutoff = startOfDay.getTime();
    return events.filter((e) => e.at >= cutoff).length;
  }, [events]);

  const last24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    return events.filter((e) => e.at >= cutoff);
  }, [events]);

  return (
    <section className="paper-card-raised p-6 sm:p-7" aria-labelledby="heard-heading">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="smallcaps text-leaf text-[10px] tracking-widest">
            Family-private · سَمَعْتُ
          </p>
          <h2 id="heard-heading" className="font-display text-ink-strong mt-1 text-lg sm:text-xl">
            I just heard them recite
          </h2>
        </div>
        {todayCount > 0 ? (
          <span className="smallcaps text-leaf text-[10px] tracking-widest">
            {todayCount.toString()} today
          </span>
        ) : null}
      </div>

      <p className="text-ink-muted/90 mb-4 max-w-prose text-sm leading-relaxed">
        Tap when a child completes a portion. A quiet log for you — never sent anywhere, never
        displayed to anyone but you.
      </p>

      {/* Optional name input + recent name chips */}
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <input
          type="text"
          value={child}
          onChange={(e) => {
            setChild(e.target.value);
          }}
          placeholder="Child's name (optional)"
          className="border-hairline bg-paper-100 text-ink placeholder:text-ink-muted focus:border-leaf rounded-full border px-4 py-2 text-sm focus:outline-none"
          maxLength={32}
        />
        {recentNames.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="smallcaps text-ink-muted text-[10px] tracking-widest">Recent</span>
            {recentNames.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setChild(n);
                }}
                className="border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 inline-flex items-center rounded-full border px-3 py-1 text-[11px] transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* The big record button */}
      <button
        type="button"
        onClick={() => {
          record(child.trim() ? child : null);
        }}
        disabled={busy}
        className={`bg-leaf text-paper smallcaps inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm tracking-widest transition-all disabled:opacity-70 sm:text-base ${
          confirm ? 'ring-leaf/40 ring-4' : 'hover:opacity-95'
        }`}
      >
        {confirm ? (
          <>
            <CheckIcon />
            <span>Logged for {confirm}</span>
          </>
        ) : (
          <>
            <EarIcon />
            <span>I heard them recite{currentPortion ? ` · ${currentPortion}` : ''}</span>
          </>
        )}
      </button>

      {/* Recent log (last 24h) */}
      {last24h.length > 0 ? (
        <ul className="m-0 mt-4 grid list-none gap-1 p-0">
          {last24h.slice(0, 6).map((e) => (
            <li
              key={e.id}
              className="text-ink-muted/85 flex items-baseline justify-between gap-2 text-xs"
            >
              <span>
                {e.child ?? 'Anonymous'} {e.portion ? `· ${e.portion}` : ''}
              </span>
              <span className="font-mono tabular-nums opacity-70">
                {timeAgo(Date.now() - e.at)}
              </span>
            </li>
          ))}
          {last24h.length > 6 ? (
            <li className="text-ink-muted/70 mt-1 text-[11px] italic">
              + {(last24h.length - 6).toString()} earlier today
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function EarIcon(): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M7 8a5 5 0 0 1 10 0c0 3-2 4-3 5s-1 3-3 4-4-1-4-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function timeAgo(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes.toString()} min`;
  const hours = Math.round(minutes / 60);
  return `${hours.toString()} h`;
}
