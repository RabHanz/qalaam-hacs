'use client';

/**
 * AdminConsole — single client island that orchestrates the four
 * admin views (system stats, users, audit log, support inbox).
 *
 * Layout: 12-col grid. On desktop:
 *   ┌──────────────┬──────────────────────────────┬──────────────┐
 *   │   Metrics    │           Users               │    Audit     │
 *   │   (3 col)    │           (6 col)             │    (3 col)   │
 *   └──────────────┴──────────────────────────────┴──────────────┘
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │                          Support                             │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * On mobile everything stacks. Each pane is its own component so they
 * can refetch independently (e.g. user-tier-bump should not reload
 * audit + support).
 */
import { useCallback, useEffect, useState } from 'react';

import { resolveApiBase } from '../../lib/api-base.js';
import { LoadingState } from '../LoadingState.js';

import { AuditPane } from './AuditPane.js';
import { MetricsPane } from './MetricsPane.js';
import { SupportPane } from './SupportPane.js';
import { UsersPane } from './UsersPane.js';

import type { ReactNode } from 'react';

export interface SystemSnapshot {
  users: {
    total: number;
    byTier: Record<string, number>;
    minors: number;
    shadow: number;
    signupsLast7d: number;
  };
  sessions: { active: number };
  support: { open: number };
  apiKeys: { active: number };
}

export function AdminConsole(): ReactNode {
  const apiBase = resolveApiBase();
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const lifecycle = { cancelled: false };
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/admin/system`, { credentials: 'include' });
        if (!res.ok) {
          if (!lifecycle.cancelled) setSystemError('Unable to load system snapshot.');
          return;
        }
        const body = (await res.json()) as SystemSnapshot;
        if (!lifecycle.cancelled) setSystem(body);
      } catch {
        if (!lifecycle.cancelled) setSystemError('Network error loading metrics.');
      }
    })();
    return () => {
      lifecycle.cancelled = true;
    };
  }, [apiBase, reloadTick]);

  const refetchAll = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-12">
        <section aria-label="System metrics" className="lg:col-span-3">
          {system ? (
            <MetricsPane snapshot={system} />
          ) : systemError ? (
            <p className="paper-card text-mistake-error p-4 text-sm">{systemError}</p>
          ) : (
            <LoadingState label="Loading metrics…" lines={4} />
          )}
        </section>

        <section aria-label="Users" className="lg:col-span-6">
          <UsersPane onMutate={refetchAll} />
        </section>

        <section aria-label="Audit log" className="lg:col-span-3">
          <AuditPane reloadTick={reloadTick} />
        </section>
      </div>

      <section aria-label="Support requests">
        <SupportPane onMutate={refetchAll} />
      </section>
    </div>
  );
}
