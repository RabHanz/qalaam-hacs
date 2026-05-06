/**
 * /admin — maintainer-only operational panel.
 *
 * Server component fetches /v1/admin/me first; if not admin, renders a
 * polite "this surface is private" page so non-admins (and unauthed)
 * never see panel chrome. Once gated, hands off to AdminConsole — a
 * client island that owns the live data + interactions.
 *
 * Design language: command-center on paper. Mono tabular-nums for
 * IDs/timestamps, gold pip for premium tier, restrained motion. Sits
 * inside Qalaam's editorial frame; doesn't try to be a SaaS dashboard
 * dressed up in dark mode.
 */
import { cookies, headers } from 'next/headers';

import { AdminConsole } from '../../components/admin/AdminConsole.js';
import { EmptyState } from '../../components/EmptyState.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Admin · Qalaam',
  description: 'Operational console for Qalaam maintainers.',
};

export const dynamic = 'force-dynamic';

async function checkAdmin(): Promise<{ isAdmin: boolean; email: string | null }> {
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  const cookieHeader = (await cookies()).toString();
  const xfHost = (await headers()).get('host') ?? '';
  try {
    const res = await fetch(`${apiBase}/v1/admin/me`, {
      headers: { cookie: cookieHeader, 'x-forwarded-host': xfHost },
      cache: 'no-store',
    });
    if (!res.ok) return { isAdmin: false, email: null };
    return (await res.json()) as { isAdmin: boolean; email: string | null };
  } catch {
    return { isAdmin: false, email: null };
  }
}

export default async function AdminPage(): Promise<ReactNode> {
  const { isAdmin, email } = await checkAdmin();
  if (!isAdmin) {
    return (
      <>
        <SiteNav />
        <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6 sm:py-28">
          <EmptyState
            title="Private surface"
            hint={
              email
                ? 'This area is reserved for the maintainer team. If you should have access, contact ops to add your address to the allowlist.'
                : 'Sign in to continue. The area you’re trying to reach is reserved for the maintainer team.'
            }
          />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto flex max-w-7xl items-baseline justify-between gap-4 px-4 py-6 sm:px-6 sm:py-8">
          <div>
            <p className="smallcaps text-leaf text-[11px] tracking-widest">
              Admin · لَوْحَة الإِدَارَة
            </p>
            <h1 className="font-display text-ink-strong mt-1.5 text-3xl font-light tracking-tight sm:text-4xl">
              Console
            </h1>
          </div>
          <p className="text-ink-muted shrink-0 font-mono text-[11px] tabular-nums sm:text-xs">
            {email ?? ''}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <AdminConsole />
      </main>
    </>
  );
}
