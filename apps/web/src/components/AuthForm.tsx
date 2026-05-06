'use client';

/**
 * AuthForm — shared sign-in / sign-up form with editorial-scripture
 * aesthetic per CLAUDE.md §11.3.
 *
 * Visual direction: warm paper card, gold-illuminated header, restrained
 * geometry. NO purple gradients, NO generic Inter sign-in template.
 * Fraunces display + IBM Plex body match the rest of the design system.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signin, signup } from '../lib/auth-api.js';

import type { ReactNode } from 'react';

interface Props {
  readonly mode: 'signin' | 'signup';
}

export function AuthForm({ mode }: Props): ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doSubmit(): Promise<void> {
    if (busy) return;
    setError(null);
    setBusy(true);
    const fn = mode === 'signin' ? signin : signup;
    const trimmedName = displayName.trim();
    const result = await fn(
      mode === 'signin'
        ? { email, password }
        : {
            email,
            password,
            displayName: trimmedName.length > 0 ? trimmedName : undefined,
          },
    );
    setBusy(false);
    if (!result.ok) {
      setError(humanizeError(result.code, result.message, result.retryAfterSeconds));
      return;
    }
    router.push('/hifdh');
    router.refresh();
  }

  const isSignin = mode === 'signin';
  const title = isSignin ? 'Welcome back' : 'Create your account';
  const sub = isSignin
    ? 'Pick up where you left off — your Hifdh state, family, bookmarks.'
    : 'Family-private. Audio never leaves your device. No tracking.';
  const cta = isSignin ? 'Sign in' : 'Create account';
  const otherHref = isSignin ? '/signup' : '/signin';
  const otherLabel = isSignin ? 'New to Qalaam?' : 'Already have an account?';
  const otherLink = isSignin ? 'Create an account' : 'Sign in';

  return (
    <div
      className="bg-paper-50 relative min-h-[calc(100vh-4rem)] overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(at 12% 0%, color-mix(in srgb, var(--color-leaf-300) 6%, transparent) 0%, transparent 60%), url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27><filter id=%27n%27><feTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%272%27 stitchTiles=%27stitch%27/></filter><rect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%270.025%27/></svg>")',
      }}
    >
      <div className="mx-auto flex max-w-md flex-col items-center px-6 pb-16 pt-12 sm:pt-20">
        {/* Brand */}
        <div className="mb-8 text-center">
          <p className="smallcaps text-leaf mb-2 text-[10px] tracking-[0.22em]">Qalaam</p>
          <h1
            className="text-ink-strong"
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
              fontWeight: 600,
              letterSpacing: '-0.014em',
              lineHeight: 1.1,
            }}
          >
            {title}
          </h1>
          <p className="text-ink-muted mx-auto mt-3 max-w-[36ch] text-sm leading-relaxed">{sub}</p>
        </div>

        {/* Card */}
        <article
          className="relative w-full overflow-hidden rounded-2xl border border-[var(--c-rule)] bg-white shadow-[0_1px_3px_rgba(16,56,64,0.05),0_24px_48px_-24px_rgba(16,56,64,0.12)]"
          aria-label={`${cta} form`}
        >
          {/* Gold-foil corner crest — pure CSS 8-point star */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 22,
              height: 22,
              opacity: 0.55,
              background:
                'conic-gradient(from 22.5deg, var(--color-leaf-500) 0deg 45deg, transparent 45deg 90deg, var(--color-leaf-500) 90deg 135deg, transparent 135deg 180deg, var(--color-leaf-500) 180deg 225deg, transparent 225deg 270deg, var(--color-leaf-500) 270deg 315deg, transparent 315deg 360deg)',
              maskImage: 'radial-gradient(circle at center, black 50%, transparent 51%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 50%, transparent 51%)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          <form
            onSubmit={(e): void => {
              e.preventDefault();
              void doSubmit();
            }}
            className="relative z-10 flex flex-col gap-5 p-7 sm:p-8"
          >
            {!isSignin ? (
              <label className="flex flex-col gap-1.5">
                <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">
                  Display name
                  <span className="ml-2 text-[10px] normal-case opacity-60">(optional)</span>
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.currentTarget.value);
                  }}
                  className="border-hairline focus:border-leaf focus:ring-leaf/30 rounded-lg border bg-transparent px-3.5 py-2.5 text-base outline-none focus:ring-2"
                  placeholder="How should we greet you?"
                  maxLength={80}
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1.5">
              <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.currentTarget.value);
                }}
                className="border-hairline focus:border-leaf focus:ring-leaf/30 rounded-lg border bg-transparent px-3.5 py-2.5 text-base outline-none focus:ring-2"
                placeholder="you@example.com"
                inputMode="email"
                autoCapitalize="none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">
                Password
                {!isSignin ? (
                  <span className="ml-2 text-[10px] normal-case opacity-60">8+ characters</span>
                ) : null}
              </span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={isSignin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.currentTarget.value);
                }}
                className="border-hairline focus:border-leaf focus:ring-leaf/30 rounded-lg border bg-transparent px-3.5 py-2.5 text-base outline-none focus:ring-2"
                placeholder="••••••••"
              />
            </label>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-red-300/40 bg-red-50/60 px-3.5 py-2.5 text-sm text-red-800"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="bg-ink hover:bg-ink-strong text-paper inline-flex h-12 items-center justify-center rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60"
              style={{ letterSpacing: '0.02em' }}
            >
              {busy ? 'Working…' : cta}
            </button>

            <p className="text-ink-muted text-center text-xs leading-relaxed">
              {otherLabel}{' '}
              <a
                href={otherHref}
                className="text-leaf font-medium underline-offset-4 hover:underline"
              >
                {otherLink}
              </a>
            </p>
          </form>
        </article>

        <p className="text-ink-muted/80 mt-7 max-w-[36ch] text-center text-[11px] leading-relaxed">
          {isSignin ? (
            <>By signing in you agree to keep your family-private Hifdh data on this device.</>
          ) : (
            <>
              By creating an account you agree that audio and Hifdh state stay on your installation
              and are never shared without your explicit consent.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function humanizeError(
  code: string | undefined,
  message: string | undefined,
  retryAfterSeconds: number | undefined,
): string {
  switch (code) {
    case 'qalaam.auth.invalid-credentials':
      return 'Email or password is incorrect.';
    case 'qalaam.auth.email-taken':
      return 'That email is already registered. Try signing in instead.';
    case 'qalaam.auth.weak-password':
      return 'Password must be at least 8 characters.';
    case 'qalaam.auth.bad-email':
      return 'Please use a valid email address.';
    case 'qalaam.auth.too-many-attempts':
      return retryAfterSeconds
        ? `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60).toString()} minutes.`
        : 'Too many attempts. Try again in a few minutes.';
    case 'qalaam.auth.account-locked':
      return retryAfterSeconds
        ? `Account temporarily locked for security. Try again in ${Math.ceil(retryAfterSeconds / 60).toString()} minutes.`
        : 'Account temporarily locked. Try again later.';
    case 'qalaam.net.unreachable':
      return "We couldn't reach the Qalaam server. Check your connection.";
    default:
      return message ?? 'Something went wrong. Try again.';
  }
}
