'use client';

/**
 * UsersPane — search + filter + paginate the user list, inline-edit
 * tier and minor flag.
 *
 * UX: a tight search box (debounced), tier-filter chip-row, then a
 * dense table. Tier dropdown commits on change with optimistic update.
 * If the PATCH fails the row reverts and a small inline error
 * surfaces. No modals, no spinners — just inline.
 */
import { useEffect, useRef, useState } from 'react';

import { resolveApiBase } from '../../lib/api-base.js';
import { LoadingState } from '../LoadingState.js';

import type { ReactNode } from 'react';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  tier: string;
  isMinor: boolean;
  isShadow: boolean;
  createdAt: string;
  lastSeenAt: string;
  haUrl: string | null;
}

interface Props {
  readonly onMutate: () => void;
}

const TIER_OPTIONS = ['free', 'premium', 'pro'] as const;
const PAGE_SIZE = 50;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
    if (Number.isNaN(d.getTime())) return iso;
    const now = Date.now();
    const ms = now - d.getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m.toString()}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h.toString()}h`;
    const day = Math.floor(h / 24);
    if (day < 30) return `${day.toString()}d`;
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export function UsersPane({ onMutate }: Props): ReactNode {
  const apiBase = resolveApiBase();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<string>('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const debounceRef = useRef<number | null>(null);

  // Debounce the search box so every keystroke doesn't refetch.
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQ(q);
      setOffset(0);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  useEffect(() => {
    const lifecycle = { cancelled: false };
    void (async () => {
      try {
        const url = new URL(`${apiBase}/v1/admin/users`, window.location.origin);
        if (debouncedQ) url.searchParams.set('q', debouncedQ);
        if (tier) url.searchParams.set('tier', tier);
        url.searchParams.set('limit', PAGE_SIZE.toString());
        url.searchParams.set('offset', offset.toString());
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          setError('Could not load users.');
          return;
        }
        const body = (await res.json()) as { total: number; users: AdminUser[] };
        if (lifecycle.cancelled) return;
        setUsers(body.users);
        setTotal(body.total);
        setError(null);
      } catch {
        if (!lifecycle.cancelled) setError('Network error loading users.');
      }
    })();
    return () => {
      lifecycle.cancelled = true;
    };
  }, [apiBase, debouncedQ, tier, offset, reloadTick]);

  async function patchUser(id: string, patch: Partial<AdminUser>): Promise<void> {
    const before = users?.find((u) => u.id === id);
    if (!before) return;
    // Optimistic: update local state immediately.
    setUsers((cur) => (cur ? cur.map((u) => (u.id === id ? { ...u, ...patch } : u)) : cur));
    setRowError((cur) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(cur)) {
        if (k !== id) next[k] = v;
      }
      return next;
    });
    try {
      const res = await fetch(`${apiBase}/v1/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status.toString()}`);
      onMutate();
    } catch {
      // Revert
      setUsers((cur) => (cur ? cur.map((u) => (u.id === id ? before : u)) : cur));
      setRowError((cur) => ({ ...cur, [id]: 'Could not save — try again.' }));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="paper-card overflow-hidden">
      <header className="border-hairline space-y-3 border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="smallcaps text-leaf text-[10px] tracking-widest">Users</p>
          <p className="text-ink-muted font-mono text-[11px] tabular-nums">
            {total.toString()} match{total === 1 ? '' : 'es'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
            placeholder="Search email or display name…"
            className="border-hairline bg-paper text-ink placeholder:text-ink-muted focus:border-leaf min-w-0 flex-1 rounded-full border px-4 py-1.5 text-sm focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            {(['', ...TIER_OPTIONS] as const).map((t) => {
              const active = tier === t;
              const label = t === '' ? 'All' : t;
              return (
                <button
                  key={t || 'all'}
                  type="button"
                  onClick={() => {
                    setTier(t);
                    setOffset(0);
                  }}
                  aria-pressed={active}
                  className={`smallcaps rounded-full border px-3 py-1 text-[11px] tracking-wider transition-colors ${
                    active
                      ? 'bg-leaf text-paper border-leaf'
                      : 'border-hairline text-ink hover:bg-paper-200/60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
        {error ? (
          <p className="text-mistake-error p-5 text-sm">{error}</p>
        ) : users === null ? (
          <div className="p-5">
            <LoadingState label="Loading users…" lines={5} />
          </div>
        ) : users.length === 0 ? (
          <p className="text-ink-muted p-5 text-center text-sm italic">No users match.</p>
        ) : (
          <ul className="divide-hairline divide-y" role="list">
            {users.map((u) => (
              <li
                key={u.id}
                className="hover:bg-paper-100/60 flex flex-wrap items-baseline gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate text-sm">
                    {u.email}
                    {u.isShadow ? (
                      <span className="smallcaps text-ink-muted ml-2 text-[10px] tracking-widest">
                        shadow
                      </span>
                    ) : null}
                  </p>
                  <p className="text-ink-muted mt-0.5 truncate font-mono text-[11px] tabular-nums">
                    {u.displayName ?? '—'}
                    <span className="mx-1.5 opacity-60">·</span>
                    seen {formatTime(u.lastSeenAt)}
                  </p>
                  {rowError[u.id] ? (
                    <p className="text-mistake-error mt-1 text-[11px] italic">{rowError[u.id]}</p>
                  ) : null}
                </div>

                <label className="flex shrink-0 items-center gap-2">
                  <span className="smallcaps text-ink-muted text-[10px] tracking-widest">Tier</span>
                  <select
                    value={u.tier}
                    onChange={(e) => {
                      void patchUser(u.id, { tier: e.target.value });
                    }}
                    className={`border-hairline bg-paper rounded-md border px-2 py-1 font-mono text-xs tabular-nums focus:outline-none ${
                      u.tier === 'pro'
                        ? 'text-leaf'
                        : u.tier === 'premium'
                          ? 'text-gold'
                          : 'text-ink'
                    }`}
                  >
                    {TIER_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={u.isMinor}
                    onChange={(e) => {
                      void patchUser(u.id, { isMinor: e.target.checked });
                    }}
                    className="accent-leaf"
                  />
                  <span className="smallcaps text-ink-muted text-[10px] tracking-widest">Kids</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {users && users.length > 0 ? (
        <footer className="border-hairline flex items-center justify-between gap-3 border-t px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => {
              setOffset(Math.max(0, offset - PAGE_SIZE));
            }}
            disabled={offset === 0}
            className="smallcaps text-ink-muted hover:text-leaf text-xs disabled:opacity-30"
          >
            ← prev
          </button>
          <span className="text-ink-muted font-mono text-[11px] tabular-nums">
            {currentPage.toString()} / {totalPages.toString()}
          </span>
          <button
            type="button"
            onClick={() => {
              if (offset + PAGE_SIZE < total) setOffset(offset + PAGE_SIZE);
            }}
            disabled={offset + PAGE_SIZE >= total}
            className="smallcaps text-ink-muted hover:text-leaf text-xs disabled:opacity-30"
          >
            next →
          </button>
        </footer>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setReloadTick((n) => n + 1);
        }}
        className="hidden"
        aria-hidden
      />
    </div>
  );
}
