'use client';

/**
 * SupportPane — wide-bottom row showing support requests. Defaults
 * to "open" view so the maintainer can triage without scrolling.
 *
 * Each row: kind chip + email + message preview + "Resolve" button.
 * Clicking Resolve marks the row handled and writes an audit entry.
 */
import { useEffect, useState } from 'react';

import { resolveApiBase } from '../../lib/api-base.js';
import { LoadingState } from '../LoadingState.js';

import type { ReactNode } from 'react';

interface SupportRequest {
  id: number;
  ts: string;
  userId: string | null;
  email: string | null;
  kind: string;
  targetTier: string | null;
  message: string | null;
  handledAt: string | null;
  handledBy: string | null;
}

interface Props {
  readonly onMutate: () => void;
}

const STATUS_OPTIONS = ['open', 'resolved', 'all'] as const;

function kindLabel(kind: string): string {
  if (kind === 'cant-afford') return 'Can’t afford';
  if (kind === 'upgrade') return 'Upgrade interest';
  if (kind === 'feedback') return 'Feedback';
  return kind;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return iso;
  }
}

export function SupportPane({ onMutate }: Props): ReactNode {
  const apiBase = resolveApiBase();
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('open');
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const lifecycle = { cancelled: false };
    void (async () => {
      try {
        const url = new URL(`${apiBase}/v1/admin/support`, window.location.origin);
        url.searchParams.set('status', status);
        url.searchParams.set('limit', '100');
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          setError('Could not load support requests.');
          return;
        }
        const body = (await res.json()) as { requests: SupportRequest[] };
        if (!lifecycle.cancelled) {
          setRequests(body.requests);
          setError(null);
        }
      } catch {
        if (!lifecycle.cancelled) setError('Network error loading support.');
      }
    })();
    return () => {
      lifecycle.cancelled = true;
    };
  }, [apiBase, status, reloadTick]);

  async function setResolved(id: number, resolved: boolean): Promise<void> {
    try {
      const res = await fetch(`${apiBase}/v1/admin/support/${id.toString()}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status.toString()}`);
      setReloadTick((n) => n + 1);
      onMutate();
    } catch {
      setError('Could not save — try again.');
    }
  }

  return (
    <div className="paper-card overflow-hidden">
      <header className="border-hairline flex items-baseline justify-between gap-3 border-b p-4 sm:p-5">
        <p className="smallcaps text-leaf text-[10px] tracking-widest">Support inbox</p>
        <div className="flex items-center gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatus(s);
                }}
                aria-pressed={active}
                className={`smallcaps rounded-full border px-3 py-1 text-[11px] tracking-wider transition-colors ${
                  active
                    ? 'bg-leaf text-paper border-leaf'
                    : 'border-hairline text-ink hover:bg-paper-200/60'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </header>

      {error ? (
        <p className="text-mistake-error p-5 text-sm">{error}</p>
      ) : requests === null ? (
        <div className="p-5">
          <LoadingState label="Loading support requests…" lines={3} />
        </div>
      ) : requests.length === 0 ? (
        <p className="text-ink-muted p-5 text-center text-sm italic">
          {status === 'resolved' ? 'No resolved requests yet.' : 'Inbox is clear.'}
        </p>
      ) : (
        <ul className="divide-hairline divide-y" role="list">
          {requests.map((r) => {
            const handled = Boolean(r.handledAt);
            return (
              <li key={r.id} className={`px-4 py-3 sm:px-5 ${handled ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="border-leaf/40 text-leaf inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums">
                    {kindLabel(r.kind)}
                    {r.targetTier ? ` · ${r.targetTier}` : ''}
                  </span>
                  <p className="text-ink-strong text-sm">{r.email ?? '—'}</p>
                  <p className="text-ink-muted ml-auto font-mono text-[10px] tabular-nums">
                    #{r.id.toString()} · {formatDate(r.ts)}
                  </p>
                </div>
                {r.message ? (
                  <p className="text-ink-muted mt-2 max-w-prose whitespace-pre-wrap text-sm leading-relaxed">
                    {r.message}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  {handled ? (
                    <button
                      type="button"
                      onClick={() => {
                        void setResolved(r.id, false);
                      }}
                      className="smallcaps text-ink-muted hover:text-leaf text-[11px]"
                    >
                      Re-open
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void setResolved(r.id, true);
                      }}
                      className="border-leaf text-leaf hover:bg-leaf/10 smallcaps rounded-full border px-3 py-0.5 text-[11px] tracking-wider"
                    >
                      Mark resolved
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
