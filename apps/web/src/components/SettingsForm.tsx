'use client';

/**
 * SettingsForm — profile editor.
 *
 * Free fields:
 *   • Display name
 *
 * Premium / Pro:
 *   • Home Assistant URL (used by the SendToPicker on every player +
 *     by the family panel deep-link). Stored per-user — every household
 *     keeps their HA address private.
 *
 * Adab + UX:
 *   • The HA-URL row is visible to every tier so users can see what
 *     they'd unlock, but locked with a small "Premium / Pro" badge +
 *     deep-link to /pricing rather than a hard error.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { updateProfile } from '../lib/auth-api.js';
import { useUser } from '../lib/use-user.js';

import type { ReactNode } from 'react';

export function SettingsForm(): ReactNode {
  const { status, user } = useUser();
  const [displayName, setDisplayName] = useState('');
  const [haUrl, setHaUrl] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingHa, setSavingHa] = useState(false);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [haStatus, setHaStatus] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [haError, setHaError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setHaUrl(user.haUrl ?? '');
    }
  }, [user]);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <div className="bg-paper-100 h-12 w-52 animate-pulse rounded" />
        <div className="bg-paper-100 mt-6 h-44 w-full animate-pulse rounded-2xl" />
      </div>
    );
  }
  if (status === 'anonymous' || !user) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="smallcaps text-leaf mb-2 text-[10px] tracking-[0.22em]">Settings</p>
        <h1
          className="text-ink-strong"
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(1.75rem, 4vw, 2.4rem)',
            fontWeight: 600,
          }}
        >
          Sign in to manage your profile
        </h1>
        <Link href="/signin" className="btn-primary mt-6 inline-flex text-sm">
          Sign in
        </Link>
      </div>
    );
  }

  const haUnlocked = user.tier === 'premium' || user.tier === 'pro';

  async function saveName(): Promise<void> {
    setSavingName(true);
    setNameError(null);
    setNameStatus(null);
    const trimmed = displayName.trim();
    const result = await updateProfile({ displayName: trimmed.length > 0 ? trimmed : null });
    setSavingName(false);
    if (!result.ok) {
      setNameError(humanize(result.code, result.message));
      return;
    }
    setNameStatus('Saved');
    setTimeout(() => {
      setNameStatus(null);
    }, 1500);
  }

  async function saveHa(): Promise<void> {
    setSavingHa(true);
    setHaError(null);
    setHaStatus(null);
    const trimmed = haUrl.trim();
    const result = await updateProfile({ haUrl: trimmed.length > 0 ? trimmed : null });
    setSavingHa(false);
    if (!result.ok) {
      setHaError(humanize(result.code, result.message));
      return;
    }
    setHaStatus('Saved');
    setTimeout(() => {
      setHaStatus(null);
    }, 1500);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <header>
        <p className="smallcaps text-leaf text-[10px] tracking-[0.22em]">Profile</p>
        <h1
          className="text-ink-strong mt-2"
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(1.75rem, 4vw, 2.4rem)',
            fontWeight: 600,
            letterSpacing: '-0.012em',
            lineHeight: 1.15,
          }}
        >
          Settings
        </h1>
        <p className="text-ink-muted mt-2 text-sm">
          Signed in as <span className="text-ink-strong font-medium">{user.email}</span> · tier:{' '}
          <span className="text-ink-strong font-medium uppercase">{user.tier}</span>
        </p>
      </header>

      {/* Display name */}
      <section className="bg-surface border-hairline rounded-2xl border p-6">
        <h2
          className="text-ink-strong mb-1 text-base"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          Display name
        </h2>
        <p className="text-ink-muted mb-4 text-xs leading-relaxed">
          Shown in your family roster and to anyone who receives a praise sticker from you.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.currentTarget.value);
            }}
            maxLength={80}
            placeholder="Your name"
            className="border-hairline focus:border-leaf focus:ring-leaf/30 bg-surface flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
          />
          <button
            type="button"
            disabled={savingName}
            onClick={() => {
              void saveName();
            }}
            className="btn-primary text-sm"
          >
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </div>
        {nameError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-300/40 bg-red-50/60 px-3 py-2 text-sm text-red-800"
          >
            {nameError}
          </p>
        ) : null}
        {nameStatus ? <p className="text-leaf-700 mt-3 text-xs">{nameStatus}</p> : null}
      </section>

      {/* Home Assistant URL */}
      <section className="bg-surface border-hairline rounded-2xl border p-6">
        <header className="mb-1 flex items-baseline justify-between gap-2">
          <h2
            className="text-ink-strong text-base"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            Home Assistant URL
          </h2>
          {!haUnlocked ? (
            <span className="smallcaps bg-leaf/15 text-leaf-700 rounded-full px-2 py-0.5 text-[10px] tracking-widest">
              Premium / Pro
            </span>
          ) : null}
        </header>
        <p className="text-ink-muted mb-4 text-xs leading-relaxed">
          Your Home Assistant URL — used by the "Send to" picker on every player to deep-link into
          HA's media browser. Stored per-user; never shared. Example:{' '}
          <code className="bg-paper-100 rounded px-1.5 py-0.5 text-[11px]">
            http://homeassistant.local:8123
          </code>
          .
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="url"
            value={haUrl}
            onChange={(e) => {
              setHaUrl(e.currentTarget.value);
            }}
            disabled={!haUnlocked}
            maxLength={200}
            placeholder={haUnlocked ? 'http://homeassistant.local:8123' : 'Upgrade to set'}
            className="border-hairline focus:border-leaf focus:ring-leaf/30 bg-surface flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {haUnlocked ? (
            <button
              type="button"
              disabled={savingHa}
              onClick={() => {
                void saveHa();
              }}
              className="btn-primary text-sm"
            >
              {savingHa ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <Link href="/pricing" className="btn-ghost text-sm">
              See plans
            </Link>
          )}
        </div>
        {haError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-300/40 bg-red-50/60 px-3 py-2 text-sm text-red-800"
          >
            {haError}
          </p>
        ) : null}
        {haStatus ? <p className="text-leaf-700 mt-3 text-xs">{haStatus}</p> : null}
      </section>

      {/* Tier card */}
      <section className="bg-surface border-hairline rounded-2xl border p-6">
        <h2
          className="text-ink-strong mb-1 text-base"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          Tier
        </h2>
        <p className="text-ink-muted mb-3 text-xs leading-relaxed">
          You're on the <span className="text-ink-strong font-medium uppercase">{user.tier}</span>{' '}
          tier.
          {user.tier === 'free' ? ' Upgrade to unlock the family + HA features.' : ''}
        </p>
        <Link href="/pricing" className="btn-ghost text-sm">
          {user.tier === 'free' ? 'See plans' : 'Manage plan'}
        </Link>
      </section>
    </div>
  );
}

function humanize(code: string | undefined, message: string | undefined): string {
  switch (code) {
    case 'qalaam.auth.tier-required':
      return 'Home Assistant URL is a Premium / Pro feature.';
    case 'qalaam.auth.bad-display-name':
      return 'Pick a name 1-80 characters.';
    case 'qalaam.auth.bad-ha-url':
      return 'Please use a full URL like http://homeassistant.local:8123.';
    case 'qalaam.net.unreachable':
      return "We couldn't reach the Qalaam server. Check your connection.";
    default:
      return message ?? 'Could not save right now.';
  }
}
