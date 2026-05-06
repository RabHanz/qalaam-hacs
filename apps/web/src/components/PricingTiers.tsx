'use client';

/**
 * PricingTiers — three-tier billing surface (Free / Premium / Pro) +
 * "I can't afford it" form. Stripe checkout integration deferred to
 * deployment commit; for now the upgrade CTA submits a /v1/support
 * request which the operator follows up on manually.
 *
 * Adab non-negotiables (CLAUDE.md):
 *   - "I can't afford it" prominent, not buried.
 *   - No urgency tricks (no countdown, no "limited spots", no scarcity).
 *   - The Free tier is genuinely useful, not crippleware.
 *   - Family-private framing visible on every tier card.
 */
import Link from 'next/link';
import { useState } from 'react';

import { submitSupport, type SupportKind, type TargetTier } from '../lib/support-api.js';
import { useUser } from '../lib/use-user.js';

import type { ReactNode } from 'react';

interface Feature {
  readonly text: string;
  readonly note?: string;
}

interface Tier {
  readonly id: 'free' | 'premium' | 'pro';
  readonly name: string;
  readonly price: string;
  readonly period: string;
  readonly tagline: string;
  readonly features: readonly Feature[];
  readonly highlight?: boolean;
}

const TIERS: readonly Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline:
      'Genuinely useful. Not crippleware. The whole mushaf, every translation, recite-and-check.',
    features: [
      { text: 'Full Mushaf · Madinah, Tajweed, IndoPak' },
      { text: 'WBW translations + tafsir picker' },
      { text: 'Bookmarks · highlights · notes' },
      { text: 'Recite-and-check (browser ASR)' },
      { text: 'Daily Hifdh dashboard' },
      { text: 'Auto-Family + 1 child profile' },
      { text: 'Audio playback + Cast / AirPlay / Sonos' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$8',
    period: '/ month',
    highlight: true,
    tagline:
      'For families: the heatmap, the khatm wall, voice notes, parent dashboard, every child profile.',
    features: [
      { text: 'Everything in Free' },
      { text: 'Up to 6 family member profiles' },
      { text: 'Per-child plan creator + parent dashboard' },
      { text: 'Per-page mistake heatmap (auth-gated)' },
      { text: 'Family khatm — sequential / distributed / by-juz' },
      { text: 'Family voice notes + praise stickers' },
      { text: 'Self-hosted ASR worker (Tarteel-tuned faster-whisper)' },
      { text: 'Offline downloads (per-surah / per-juz)', note: 'rolling out' },
      { text: 'Home Assistant integration · panel + sensors + services' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$24',
    period: '/ month',
    tagline:
      'For teachers + halaqah leaders: voice cloning, multi-family, deeper analytics. Everything we ever build.',
    features: [
      { text: 'Everything in Premium' },
      { text: 'Voice cloning v2 — your reciter, watermarked' },
      { text: 'Personal teacher voice cloning (consented)' },
      { text: 'Up to 30 family members across multiple households' },
      { text: 'Per-student weekly review reports' },
      { text: 'Priority support + early access to new features' },
      { text: 'Khatm wall multi-display sync' },
    ],
  },
];

export function PricingTiers(): ReactNode {
  const { user } = useUser();
  const [showAffordForm, setShowAffordForm] = useState(false);
  const [showUpgradeForm, setShowUpgradeForm] = useState<TargetTier | null>(null);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <header className="text-center">
        <p className="smallcaps text-leaf text-[10px] tracking-[0.22em]">Pricing · honest</p>
        <h1
          className="text-ink-strong mt-2"
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            fontWeight: 600,
            letterSpacing: '-0.014em',
            lineHeight: 1.05,
          }}
        >
          One thing we promise: never paywall what matters.
        </h1>
        <p className="text-ink-muted mx-auto mt-4 max-w-[60ch] text-sm leading-relaxed sm:text-base">
          The whole Mushaf, every translation, recite-and-check, daily Hifdh — Free, forever. The
          paid tiers exist to fund the family + teacher tools that take real work to maintain.
        </p>
        {user ? (
          <p className="text-leaf-700 mt-3 text-xs italic">
            You're on the{' '}
            <strong className="font-medium">{user.tier === 'free' ? 'Free' : user.tier}</strong>{' '}
            tier today.
          </p>
        ) : null}
      </header>

      <section className="grid gap-5 lg:grid-cols-3" aria-label="Pricing tiers">
        {TIERS.map((t) => (
          <TierCard
            key={t.id}
            tier={t}
            currentTier={user?.tier ?? null}
            onUpgrade={() => {
              if (t.id === 'premium' || t.id === 'pro') setShowUpgradeForm(t.id);
            }}
          />
        ))}
      </section>

      <section className="border-hairline bg-paper rounded-2xl border p-6 sm:p-8">
        <header className="mb-3">
          <p className="smallcaps text-leaf text-[10px] tracking-[0.22em]">
            Money should not stand between you and the Quran
          </p>
          <h2
            className="text-ink-strong mt-2 text-lg"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            "I can't afford it" — say so. We'll help.
          </h2>
        </header>
        <p className="text-ink-muted max-w-[60ch] text-sm leading-relaxed">
          If the price is a barrier, write us a few words and we'll sort it. No questions asked, no
          income proof, no embarrassment. Premium and Pro get unlocked manually until our payment
          processor is live.
        </p>
        {showAffordForm ? (
          <SupportForm
            kind="cant-afford"
            placeholder="Your circumstances, in your own words. We'll write back within a week."
            ctaLabel="Send the request"
            onClose={() => {
              setShowAffordForm(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowAffordForm(true);
            }}
            className="bg-ink hover:bg-ink-strong text-paper mt-4 inline-flex rounded-lg px-5 py-2 text-sm font-medium transition-colors"
          >
            Open the form
          </button>
        )}
      </section>

      {showUpgradeForm ? (
        <section className="border-hairline bg-paper rounded-2xl border p-6 sm:p-8">
          <header className="mb-3">
            <p className="smallcaps text-leaf text-[10px] tracking-[0.22em]">
              Request {showUpgradeForm} access
            </p>
            <h2
              className="text-ink-strong mt-2 text-lg"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Stripe is wiring up — until then we activate manually.
            </h2>
          </header>
          <p className="text-ink-muted max-w-[60ch] text-sm leading-relaxed">
            Tell us a bit about your household / halaqah and which features you need. We'll activate
            the {showUpgradeForm} tier on your account within a few days.
          </p>
          <SupportForm
            kind="upgrade"
            targetTier={showUpgradeForm}
            placeholder="Family size · use case · any context that helps us help you"
            ctaLabel="Send the request"
            onClose={() => {
              setShowUpgradeForm(null);
            }}
          />
        </section>
      ) : null}

      <SeeAlso />
    </div>
  );
}

function TierCard({
  tier,
  currentTier,
  onUpgrade,
}: {
  tier: Tier;
  currentTier: string | null;
  onUpgrade: () => void;
}): ReactNode {
  const isCurrent = currentTier === tier.id;
  return (
    <article
      aria-label={`${tier.name} tier`}
      className={`bg-paper relative flex flex-col gap-4 rounded-2xl border p-6 sm:p-7 ${
        tier.highlight
          ? 'border-leaf-300 shadow-[0_24px_48px_-24px_rgba(198,148,38,0.25)]'
          : 'border-hairline'
      }`}
    >
      {tier.highlight ? (
        <span className="smallcaps text-leaf-700 absolute right-5 top-5 text-[10px] tracking-widest">
          Most families
        </span>
      ) : null}
      <header>
        <p className="smallcaps text-leaf text-[10px] tracking-[0.22em]">{tier.name}</p>
        <p
          className="text-ink-strong mt-2 flex items-baseline gap-2"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          <span className="text-4xl font-semibold sm:text-5xl">{tier.price}</span>
          <span className="text-ink-muted text-sm">{tier.period}</span>
        </p>
        <p className="text-ink-muted mt-3 text-sm italic leading-relaxed">{tier.tagline}</p>
      </header>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
        {tier.features.map((f) => (
          <li key={f.text} className="flex items-baseline gap-2">
            <span className="text-leaf shrink-0" aria-hidden>
              ✦
            </span>
            <span className="text-ink leading-snug">
              {f.text}
              {f.note ? (
                <span className="text-ink-muted ml-1 text-[11px] italic">· {f.note}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <p className="border-hairline bg-leaf/5 text-leaf-700 mt-2 rounded-lg border px-4 py-2 text-center text-xs italic">
          Your current tier
        </p>
      ) : tier.id === 'free' ? (
        <Link
          href="/signup"
          className="border-hairline hover:border-leaf hover:text-leaf inline-flex justify-center rounded-lg border bg-white px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Create account · Free
        </Link>
      ) : (
        <button
          type="button"
          onClick={onUpgrade}
          className={`inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            tier.highlight
              ? 'bg-ink hover:bg-ink-strong text-paper'
              : 'border-hairline hover:border-leaf hover:text-leaf border bg-white'
          }`}
        >
          Request {tier.name}
        </button>
      )}
      <p className="text-ink-muted mt-1 text-[10px] uppercase tracking-widest">
        Family-private · audio never leaves your installation
      </p>
    </article>
  );
}

function SupportForm({
  kind,
  targetTier,
  placeholder,
  ctaLabel,
  onClose,
}: {
  kind: SupportKind;
  targetTier?: TargetTier;
  placeholder: string;
  ctaLabel: string;
  onClose: () => void;
}): ReactNode {
  const { user } = useUser();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(): Promise<void> {
    setBusy(true);
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setError('Please write a few words.');
      setBusy(false);
      return;
    }
    const args: {
      kind: SupportKind;
      message: string;
      email?: string;
      targetTier?: TargetTier;
    } = { kind, message: trimmed };
    if (!user) args.email = email.trim();
    if (targetTier) args.targetTier = targetTier;
    const result = await submitSupport(args);
    setBusy(false);
    if (!result.ok) {
      setError(humanizeSupportError(result.code, result.message));
      return;
    }
    setSent(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  }

  if (sent) {
    return (
      <div className="border-hairline bg-paper-50 mt-4 rounded-xl border p-4">
        <p className="text-leaf-700 text-sm">
          We received it — Jazak Allahu khayr. Expect a reply within a few days.
        </p>
      </div>
    );
  }

  return (
    <div className="border-hairline bg-paper-50 mt-4 flex flex-col gap-3 rounded-xl border p-5">
      {!user ? (
        <label className="flex flex-col gap-1.5">
          <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.currentTarget.value);
            }}
            inputMode="email"
            autoComplete="email"
            className="border-hairline focus:border-leaf focus:ring-leaf/30 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
            placeholder="you@example.com"
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">Message</span>
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.currentTarget.value);
          }}
          rows={4}
          maxLength={4000}
          className="border-hairline focus:border-leaf focus:ring-leaf/30 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
          placeholder={placeholder}
        />
      </label>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300/40 bg-red-50/60 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-ink-muted hover:text-ink-strong rounded-lg px-4 py-2 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || message.trim().length === 0}
          onClick={() => {
            void send();
          }}
          className="bg-ink hover:bg-ink-strong text-paper rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Sending…' : ctaLabel}
        </button>
      </div>
    </div>
  );
}

function SeeAlso(): ReactNode {
  return (
    <nav aria-label="Related" className="border-hairline bg-paper rounded-2xl border p-6">
      <h3
        className="text-ink-strong mb-3 text-sm"
        style={{ fontFamily: 'Fraunces, Georgia, serif' }}
      >
        Trust + transparency
      </h3>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
        <li>
          <Link
            href="/credits"
            className="border-hairline hover:border-leaf hover:text-leaf flex flex-col gap-1 rounded-xl border bg-white p-4 transition-colors"
          >
            <span
              className="text-ink-strong text-sm"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Every QUL attribution
            </span>
            <span className="text-ink-muted text-[11px] leading-relaxed">
              Each font, translation, tafsir, reciter — sourced + licensed.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/family"
            className="border-hairline hover:border-leaf hover:text-leaf flex flex-col gap-1 rounded-xl border bg-white p-4 transition-colors"
          >
            <span
              className="text-ink-strong text-sm"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Family-private architecture
            </span>
            <span className="text-ink-muted text-[11px] leading-relaxed">
              Audio + Hifdh state stay on your installation. Self-host friendly.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/hifdh"
            className="border-hairline hover:border-leaf hover:text-leaf flex flex-col gap-1 rounded-xl border bg-white p-4 transition-colors"
          >
            <span
              className="text-ink-strong text-sm"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Try the daily Hifdh dashboard
            </span>
            <span className="text-ink-muted text-[11px] leading-relaxed">
              No account needed to look around.
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function humanizeSupportError(code: string | undefined, message: string | undefined): string {
  switch (code) {
    case 'qalaam.support.bad-email':
      return 'Please add a valid email so we can write back.';
    case 'qalaam.support.empty-message':
      return 'Please write a few words.';
    case 'qalaam.support.message-too-long':
      return 'Please keep it under 4,000 characters.';
    default:
      return message ?? 'Could not send. Try again in a bit.';
  }
}
