'use client';

/**
 * KhatmDetail — single khatm with the 604-page grid.
 *
 * Each cell is a button that claims the page for the current user (or
 * the picked assignee, if guardian). Empty cells are warm-paper; claimed
 * cells take on the claimer's avatar color. Tap a claimed cell to see
 * who has it.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { khatm as khatmApi, type KhatmDetailPayload } from '../../lib/family-api.js';
import { useUser } from '../../lib/use-user.js';

import { MemberAvatar } from './MemberAvatar.js';

import type { ReactNode } from 'react';

interface Props {
  readonly khatmId: string;
}

const COLS = 31;
const PAGE_COUNT = 604;
const ROWS = Math.ceil(PAGE_COUNT / COLS);

function memberColor(uid: string, roster: KhatmDetailPayload['roster']): string {
  const m = roster.find((r) => r.userId === uid);
  if (m?.avatarColor && /^[0-9a-fA-F]{6}$/.test(m.avatarColor)) {
    return `#${m.avatarColor}`;
  }
  return '#c8a04a';
}

export function KhatmDetail({ khatmId }: Props): ReactNode {
  const { status, user } = useUser();
  const [data, setData] = useState<KhatmDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingFor, setClaimingFor] = useState<string | null>(null); // userId
  const [busyPage, setBusyPage] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ page: number; ownerName: string } | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    khatmApi
      .get(khatmId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (user) setClaimingFor(user.id);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this khatm.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [khatmId, status, user]);

  const ownership = useMemo(() => data?.pageOwnership ?? {}, [data]);
  const roster = data?.roster ?? [];

  if (status === 'anonymous') {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="text-ink-strong text-2xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          Sign in to view this khatm
        </h1>
        <Link
          href="/signin"
          className="bg-ink hover:bg-ink-strong text-paper mt-6 inline-flex rounded-lg px-5 py-2 text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="bg-paper-100 mx-auto h-96 w-full max-w-3xl animate-pulse rounded-2xl" />;
  }
  if (error || !data) {
    return <p className="text-ink-muted px-5 py-16 text-center text-sm">{error}</p>;
  }

  const k = data.khatm;
  const claimedCount = data.totalClaimed;
  const pct = Math.round((claimedCount / PAGE_COUNT) * 100);

  async function claim(page: number): Promise<void> {
    if (!claimingFor || k.status !== 'active') return;
    setBusyPage(page);
    try {
      const fresh = await khatmApi.claimPage(khatmId, { pageNumber: page, forUserId: claimingFor });
      setData(fresh);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'qalaam.khatm.out-of-order') {
        setError('Sequential mode — please pick the next page in order.');
        setTimeout(() => {
          setError(null);
        }, 3500);
      } else if (e.code === 'qalaam.khatm.page-already-claimed') {
        // Refresh in-place rather than error toast
        try {
          const fresh = await khatmApi.get(khatmId);
          setData(fresh);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setBusyPage(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <header>
        <Link
          href="/family/khatm"
          className="text-ink-muted hover:text-leaf inline-block text-xs"
          aria-label="Back to family khatm list"
        >
          ← Family khatm
        </Link>
        <h1
          className="text-ink-strong mt-2"
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 600,
          }}
        >
          {k.title}
        </h1>
        <div className="text-ink-muted mt-1.5 flex flex-wrap gap-3 text-xs">
          <span>Mode: {k.mode}</span>
          <span>Started: {k.startDate}</span>
          {k.targetDate ? <span>Target: {k.targetDate}</span> : null}
          <span>
            <span className="text-ink-strong font-medium">{claimedCount.toString()}</span> /{' '}
            {PAGE_COUNT.toString()} pages ({pct.toString()}%)
          </span>
        </div>
      </header>

      <section
        className="border-hairline bg-surface rounded-2xl border p-6"
        aria-label="Roster + claim controls"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">
            Claim pages for
          </span>
          {roster.map((m) => (
            <button
              key={m.userId}
              type="button"
              aria-pressed={claimingFor === m.userId}
              onClick={() => {
                setClaimingFor(m.userId);
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                claimingFor === m.userId
                  ? 'border-leaf bg-leaf/10 text-leaf-700'
                  : 'border-hairline hover:border-leaf-300 bg-surface'
              }`}
            >
              <MemberAvatar
                displayName={m.displayName}
                avatarColor={m.avatarColor}
                size={20}
                subtle
              />
              <span>{m.displayName}</span>
            </button>
          ))}
        </div>

        {error ? (
          <p
            role="alert"
            className="border-mistake-error/30 bg-mistake-error/10 text-mistake-error mb-3 rounded-lg border px-3 py-1.5 text-xs"
          >
            {error}
          </p>
        ) : null}

        {/* The grid */}
        <div
          role="grid"
          aria-label="Mushaf page grid"
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${COLS.toString()}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const page = i + 1;
            if (page > PAGE_COUNT) {
              return <div key={page} aria-hidden style={{ visibility: 'hidden' }} />;
            }
            const ownerId = ownership[page.toString()];
            const owner = ownerId ? roster.find((r) => r.userId === ownerId) : null;
            const isMine = ownerId === user?.id;
            const claimed = ownerId !== undefined;
            const fill = claimed && ownerId ? memberColor(ownerId, roster) : 'transparent';
            const bg = claimed
              ? `${fill}33` // 20% opacity
              : 'var(--color-paper-100)';
            const border = claimed ? `1px solid ${fill}55` : '1px solid var(--color-paper-200)';
            return (
              <button
                key={page}
                type="button"
                role="gridcell"
                disabled={busyPage === page || k.status !== 'active'}
                onClick={() => {
                  if (claimed && owner) {
                    setTooltip({
                      page,
                      ownerName: owner.displayName,
                    });
                    setTimeout(() => {
                      setTooltip(null);
                    }, 2500);
                  } else {
                    void claim(page);
                  }
                }}
                title={
                  claimed
                    ? `Page ${page.toString()} · ${owner?.displayName ?? '—'}`
                    : `Page ${page.toString()}`
                }
                aria-label={
                  claimed
                    ? `Page ${page.toString()} claimed by ${owner?.displayName ?? '—'}`
                    : `Claim page ${page.toString()}`
                }
                className={`aspect-square rounded-[2px] text-[8px] transition-all hover:scale-110 focus:outline-none focus:ring-1 focus:ring-[color:var(--color-leaf-500)] ${
                  busyPage === page ? 'animate-pulse' : ''
                } ${isMine ? 'shadow-[inset_0_0_0_1.5px_var(--color-leaf-500)]' : ''}`}
                style={{ background: bg, border }}
              />
            );
          })}
        </div>

        {tooltip ? (
          <p className="text-ink-muted mt-3 text-xs italic">
            Page {tooltip.page.toString()} — {tooltip.ownerName}
          </p>
        ) : null}
      </section>

      <section
        className="border-hairline bg-surface rounded-2xl border p-6"
        aria-label="Wall display"
      >
        <h3
          className="text-ink-strong mb-2 text-base"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          Wall display mode
        </h3>
        <p className="text-ink-muted mb-3 text-sm leading-relaxed">
          Open this khatm on a shared family device or TV. Auto-refreshes; shows the latest
          contributions and progress at a glance.
        </p>
        <Link
          href={`/family/khatm/${khatmId}/wall`}
          className="border-hairline hover:border-leaf hover:text-leaf bg-surface inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm transition-colors"
        >
          Open wall display →
        </Link>
      </section>
    </div>
  );
}
