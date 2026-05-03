/**
 * Landing — the first 60 seconds.
 *
 * Per strategy §21.3 / §21.11: borrow Quranly's onboarding gentleness AND
 * Tarteel's depth. Default tone is calm; one-tap to begin reading; the
 * "I can't afford it" tier (§21.11.1) shows up later in the paywall flow.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function HomePage(): ReactNode {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Qalaam</h1>
        <nav aria-label="Primary" className="flex gap-4 text-sm">
          <Link href="/read/1" className="opacity-80 hover:opacity-100">
            Read
          </Link>
          <Link href="/listen" className="opacity-80 hover:opacity-100">
            Listen
          </Link>
          <Link href="/hifdh" className="opacity-80 hover:opacity-100">
            Hifdh
          </Link>
        </nav>
      </header>

      <section className="flex flex-col gap-6">
        <p className="text-3xl font-light leading-tight">
          A Quran companion for the whole home.
        </p>
        <p className="max-w-xl text-base opacity-80">
          Read, listen, and memorize — across every speaker in your house.
          Built for families. Respects your prayer times. No ads, ever.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/read/1"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-teal-500)] px-6 py-3 text-white transition-colors hover:bg-[var(--color-teal-700)]"
          >
            Start with Al-Fatiha
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-teal-500)]/20 px-6 py-3 text-[var(--color-teal-500)] hover:bg-[var(--color-surface-overlay)]"
          >
            Learn more
          </Link>
        </div>
      </section>

      <footer className="mt-auto text-xs opacity-60">
        v0.0.1 · See <code>Docs/STRATEGY_AND_ROADMAP.md</code> for the full plan.
      </footer>
    </div>
  );
}
