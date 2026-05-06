'use client';

/**
 * MetricsPane — left rail of /admin. Stacks small counters in a
 * single tall card so the eye runs vertically without table chrome.
 *
 * Visual: paper card, hairline-divided rows. Tier counts get a
 * tiny color pip (free=ink-muted, premium=gold, pro=teal). Numbers
 * in mono tabular-nums so they line up.
 */
import type { SystemSnapshot } from './AdminConsole.js';
import type { ReactNode } from 'react';

interface Props {
  readonly snapshot: SystemSnapshot;
}

interface RowProps {
  readonly label: string;
  readonly value: number | string;
  readonly hint?: string;
  readonly accent?: 'leaf' | 'gold' | 'mistake' | null;
}

function Row({ label, value, hint, accent }: RowProps): ReactNode {
  return (
    <div className="border-hairline flex items-baseline justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        {accent ? (
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
              accent === 'leaf' ? 'bg-leaf' : accent === 'gold' ? 'bg-gold' : 'bg-mistake-error'
            }`}
          />
        ) : null}
        <span className="text-ink truncate text-sm">{label}</span>
      </div>
      <div className="flex shrink-0 items-baseline gap-2">
        {hint ? (
          <span className="smallcaps text-ink-muted text-[10px] tracking-widest">{hint}</span>
        ) : null}
        <span className="text-ink-strong font-mono text-sm tabular-nums">{value}</span>
      </div>
    </div>
  );
}

export function MetricsPane({ snapshot }: Props): ReactNode {
  const tier = snapshot.users.byTier;
  return (
    <div className="paper-card space-y-1 p-5 sm:p-6">
      <p className="smallcaps text-leaf mb-3 text-[10px] tracking-widest">System</p>
      <Row label="Users · total" value={snapshot.users.total} />
      <Row label="Free" value={tier.free ?? 0} accent={null} />
      <Row label="Premium" value={tier.premium ?? 0} accent="gold" />
      <Row label="Pro" value={tier.pro ?? 0} accent="leaf" />
      <Row label="Minors" value={snapshot.users.minors} hint="kids' mode" />
      <Row label="Shadow profiles" value={snapshot.users.shadow} hint="parent-managed" />
      <Row label="Signups · 7d" value={snapshot.users.signupsLast7d} />

      <p className="smallcaps text-leaf mb-2 mt-5 text-[10px] tracking-widest">Live</p>
      <Row label="Active sessions" value={snapshot.sessions.active} />
      <Row label="API keys (active)" value={snapshot.apiKeys.active} />
      <Row
        label="Support · open"
        value={snapshot.support.open}
        accent={snapshot.support.open > 0 ? 'mistake' : null}
      />
    </div>
  );
}
