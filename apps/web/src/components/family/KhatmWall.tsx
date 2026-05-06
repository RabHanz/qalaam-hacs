'use client';

/**
 * KhatmWall — kiosk/TV display for a family khatm.
 *
 * Auto-refreshes every 30s. Renders large progress arc + recent claims
 * stream + per-juz heat. Designed for arm's-length viewing on a shared
 * family device.
 */
import { useEffect, useState } from 'react';

import { khatm as khatmApi, type KhatmDetailPayload } from '../../lib/family-api.js';

import { MemberAvatar } from './MemberAvatar.js';

import type { ReactNode } from 'react';

interface Props {
  readonly khatmId: string;
}

const PAGE_COUNT = 604;
const REFRESH_MS = 30_000;

function relativeTime(iso: string): string {
  const ts = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000).toString()}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000).toString()}h ago`;
  return `${Math.floor(diff / 86_400_000).toString()}d ago`;
}

export function KhatmWall({ khatmId }: Props): ReactNode {
  const [data, setData] = useState<KhatmDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async (): Promise<void> => {
      try {
        const fresh = await khatmApi.wall(khatmId);
        if (!cancelled) {
          setData(fresh);
          setError(null);
        }
      } catch (err) {
        const e = err as { status?: number };
        if (!cancelled) {
          if (e.status === 401) {
            setError('Sign in to view this khatm.');
          } else if (e.status === 403) {
            setError("You're not a member of this family.");
          } else if (e.status === 404) {
            setError('Khatm not found.');
          } else {
            setError('Could not load this khatm.');
          }
        }
      }
    };

    void fetchOnce();
    const timer = setInterval(() => {
      void fetchOnce();
    }, REFRESH_MS);
    return (): void => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [khatmId]);

  if (error) {
    return (
      <div className="bg-paper-50 flex min-h-screen items-center justify-center px-8 text-center">
        <p className="text-ink-muted text-lg">{error}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="bg-paper-50 min-h-screen" />;
  }

  const k = data.khatm;
  const claimed = data.totalClaimed;
  const pct = (claimed / PAGE_COUNT) * 100;

  // SVG arc parameters
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="bg-paper-50 min-h-screen overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(at 50% 0%, color-mixin(in srgb, var(--color-leaf-300) 8%, transparent) 0%, transparent 70%)',
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-12 px-8 py-12">
        <header className="text-center">
          <p className="smallcaps text-leaf text-[10px] tracking-[0.32em]">Family-private khatm</p>
          <h1
            className="text-ink-strong mt-3"
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 600,
              letterSpacing: '-0.012em',
              lineHeight: 1.05,
            }}
          >
            {k.title}
          </h1>
          <p className="text-ink-muted mt-2 text-sm">
            Started {k.startDate}
            {k.targetDate ? ` · target ${k.targetDate}` : ''} ·{' '}
            {k.mode === 'sequential'
              ? 'Sequential'
              : k.mode === 'distributed'
                ? 'Distributed'
                : 'By juz'}
          </p>
        </header>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* Progress dial */}
          <div className="flex flex-col items-center">
            <svg width="320" height="320" viewBox="0 0 320 320" aria-hidden>
              <defs>
                <linearGradient id="khatm-arc" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--color-leaf-300)" />
                  <stop offset="100%" stopColor="var(--color-leaf-700)" />
                </linearGradient>
              </defs>
              <circle
                cx="160"
                cy="160"
                r={radius}
                fill="none"
                stroke="var(--color-paper-200)"
                strokeWidth="14"
              />
              <circle
                cx="160"
                cy="160"
                r={radius}
                fill="none"
                stroke="url(#khatm-arc)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '160px 160px',
                  transition: 'stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0, 1)',
                }}
              />
              <text
                x="160"
                y="160"
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Fraunces, Georgia, serif"
                fontSize="64"
                fontWeight="600"
                fill="var(--color-ink-700)"
              >
                {Math.round(pct).toString()}%
              </text>
              <text
                x="160"
                y="208"
                textAnchor="middle"
                fontFamily="Fraunces, Georgia, serif"
                fontSize="14"
                fill="var(--color-ink-500)"
              >
                {claimed.toString()} of {PAGE_COUNT.toString()} pages
              </text>
            </svg>

            {/* Roster */}
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              {data.roster.map((m) => {
                const owns = Object.values(data.pageOwnership).filter((u) => u === m.userId).length;
                return (
                  <div
                    key={m.userId}
                    className="flex flex-col items-center gap-1.5"
                    aria-label={`${m.displayName}: ${owns.toString()} pages`}
                  >
                    <MemberAvatar
                      displayName={m.displayName}
                      avatarColor={m.avatarColor}
                      size={56}
                    />
                    <span
                      className="text-ink-strong text-sm font-medium"
                      style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                    >
                      {m.displayName}
                    </span>
                    <span className="text-ink-muted text-xs">
                      {owns.toString()} {owns === 1 ? 'page' : 'pages'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent contributions */}
          <div className="border-hairline bg-surface rounded-2xl border p-6">
            <h3
              className="text-ink-strong mb-4 text-lg"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Recent contributions
            </h3>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {(data.recent ?? []).slice(0, 8).map((r, idx) => (
                <li
                  key={`${r.page.toString()}-${idx.toString()}`}
                  className="flex items-center gap-3"
                >
                  <MemberAvatar displayName={r.displayName} avatarColor={r.avatarColor} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink-strong text-sm font-medium">
                      {r.displayName} <span className="text-ink-muted font-normal">recited</span>{' '}
                      page <span className="font-mono">{r.page.toString()}</span>
                    </p>
                    <p className="text-ink-muted text-[11px]">{relativeTime(r.ts)}</p>
                  </div>
                </li>
              ))}
              {(data.recent ?? []).length === 0 ? (
                <li className="text-ink-muted text-sm italic">
                  No pages recited yet — be the first.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <p className="text-ink-muted text-center text-[10px] uppercase tracking-widest">
          Auto-refreshes every 30s · Family-private · No data leaves your installation
        </p>
      </div>
    </div>
  );
}
