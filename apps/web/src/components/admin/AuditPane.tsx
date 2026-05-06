'use client';

/**
 * AuditPane — tail-feed of recent admin actions.
 *
 * Each entry: action (mono), target email, who-did-it, time-ago.
 * New entries fade in (subtle) when reloadTick changes. No live-poll
 * yet — refetches when the parent bumps reloadTick (i.e. after any
 * mutation we made).
 */
import { useEffect, useState } from 'react';

import { resolveApiBase } from '../../lib/api-base.js';
import { LoadingState } from '../LoadingState.js';

import type { ReactNode } from 'react';

interface AuditEntry {
  id: number;
  ts: string;
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  targetUserId: string | null;
  targetEmail: string | null;
  payload: Record<string, unknown> | null;
}

interface Props {
  readonly reloadTick: number;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
    if (Number.isNaN(d.getTime())) return iso;
    const ms = Date.now() - d.getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m.toString()}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h.toString()}h ago`;
    return `${Math.floor(h / 24).toString()}d ago`;
  } catch {
    return iso;
  }
}

function summarisePayload(action: string, payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  if (action === 'user.update') {
    const parts: string[] = [];
    for (const k of Object.keys(payload)) {
      const raw: unknown = payload[k];
      if (raw && typeof raw === 'object' && 'from' in raw && 'to' in raw) {
        const v = raw as { from: unknown; to: unknown };
        parts.push(`${k}: ${String(v.from)} → ${String(v.to)}`);
      }
    }
    return parts.join(' · ');
  }
  if (action.startsWith('support.')) {
    const sid = (payload as { supportId?: number }).supportId;
    return sid ? `support#${sid.toString()}` : '';
  }
  return JSON.stringify(payload);
}

export function AuditPane({ reloadTick }: Props): ReactNode {
  const apiBase = resolveApiBase();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lifecycle = { cancelled: false };
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/admin/audit?limit=50`, {
          credentials: 'include',
        });
        if (!res.ok) {
          setError('Could not load audit.');
          return;
        }
        const body = (await res.json()) as { entries: AuditEntry[] };
        if (!lifecycle.cancelled) {
          setEntries(body.entries);
          setError(null);
        }
      } catch {
        if (!lifecycle.cancelled) setError('Network error loading audit.');
      }
    })();
    return () => {
      lifecycle.cancelled = true;
    };
  }, [apiBase, reloadTick]);

  return (
    <div className="paper-card overflow-hidden">
      <header className="border-hairline border-b p-4 sm:p-5">
        <p className="smallcaps text-leaf text-[10px] tracking-widest">Audit</p>
      </header>
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
        {error ? (
          <p className="text-mistake-error p-5 text-sm">{error}</p>
        ) : entries === null ? (
          <div className="p-5">
            <LoadingState label="Loading audit…" lines={4} />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-ink-muted p-5 text-center text-sm italic">No actions yet.</p>
        ) : (
          <ul className="divide-hairline divide-y" role="list">
            {entries.map((e, idx) => (
              <li
                key={e.id}
                className="px-4 py-3 sm:px-5"
                style={{
                  animation:
                    idx === 0 ? 'q-fade-in 240ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-ink-strong font-mono text-xs tabular-nums">{e.action}</p>
                  <p className="text-ink-muted shrink-0 text-[10px] tabular-nums">
                    {formatTime(e.ts)}
                  </p>
                </div>
                <p className="text-ink-muted mt-1 truncate text-[11px]">
                  {e.actorEmail ?? '—'}
                  {e.targetEmail ? (
                    <>
                      <span className="mx-1.5 opacity-60">→</span>
                      {e.targetEmail}
                    </>
                  ) : null}
                </p>
                {e.payload ? (
                  <p className="text-ink-muted mt-1 truncate font-mono text-[10px] tabular-nums opacity-80">
                    {summarisePayload(e.action, e.payload)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
