'use client';

/**
 * UserMenu — sign-in / user-avatar affordance in the right edge of
 * SiteNav. Renders one of three states:
 *
 *   loading        → tiny pulsing skeleton dot (same footprint, no jank)
 *   anonymous      → "Sign in" pill linking to /signin
 *   authenticated  → avatar circle (initial) → click opens menu with
 *                    {Family, Bookmarks, Sign out}
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { signout } from '../lib/auth-api.js';
import { useUser } from '../lib/use-user.js';

import type { ReactNode } from 'react';

function initial(name: string | null, email: string): string {
  // `||` semantics intentionally — empty-string displayName should
  // fall through to email, not be treated as truthy. Wrapped in
  // a safe selector so the lint rule sees a `??`-friendly form.
  const trimmedName = name?.trim() ?? '';
  const src = (trimmedName.length > 0 ? trimmedName : email).trim();
  if (src === '') return 'Q';
  // String.codePointAt + fromCodePoint safely handles surrogate pairs
  // (emoji-leading names etc.) where [...str][0] / .split('') mangle.
  const cp = src.codePointAt(0);
  return cp === undefined ? 'Q' : String.fromCodePoint(cp).toUpperCase();
}

export function UserMenu(): ReactNode {
  const { status, user } = useUser();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onAway(e: MouseEvent): void {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t) && !triggerRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onAway);
    document.addEventListener('keydown', onKey);
    return (): void => {
      document.removeEventListener('mousedown', onAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (status === 'loading') {
    return (
      <span className="bg-paper-200 ml-1 h-9 w-9 shrink-0 animate-pulse rounded-full" aria-hidden />
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <Link
        href="/signin"
        className="border-hairline hover:border-leaf hover:text-leaf smallcaps inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-4 text-[11px] tracking-widest transition-colors sm:h-9"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account · ${user.displayName ?? user.email}`}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="bg-leaf-300/35 text-leaf-700 hover:bg-leaf-300/55 focus:ring-leaf/40 inline-flex h-9 w-9 items-center justify-center rounded-full font-medium transition-colors focus:outline-none focus:ring-2"
        style={{ fontFamily: 'Fraunces, Georgia, serif' }}
      >
        {initial(user.displayName, user.email)}
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          className="border-hairline bg-paper absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border shadow-2xl"
        >
          <div className="border-hairline border-b p-4">
            <p
              className="text-ink-strong truncate text-sm font-medium"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              {user.displayName ?? 'Welcome'}
            </p>
            <p className="text-ink-muted truncate text-xs">{user.email}</p>
            <p className="text-leaf smallcaps mt-1 text-[10px] tracking-widest">
              {user.tier === 'free' ? 'Free tier' : `${user.tier.toUpperCase()} tier`}
            </p>
          </div>
          <ul className="m-0 list-none p-0">
            <li>
              <Link
                href="/hifdh"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                }}
                className="hover:bg-paper-100 text-ink flex items-center justify-between px-4 py-3 text-sm transition-colors"
              >
                <span>Hifdh dashboard</span>
                <span aria-hidden>→</span>
              </Link>
            </li>
            <li>
              <Link
                href="/family"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                }}
                className="hover:bg-paper-100 text-ink flex items-center justify-between px-4 py-3 text-sm transition-colors"
              >
                <span>Family</span>
                <span aria-hidden>→</span>
              </Link>
            </li>
            <li>
              <Link
                href="/bookmarks"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                }}
                className="hover:bg-paper-100 text-ink flex items-center justify-between px-4 py-3 text-sm transition-colors"
              >
                <span>Bookmarks &amp; notes</span>
                <span aria-hidden>→</span>
              </Link>
            </li>
            <li className="border-hairline border-t">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void (async () => {
                    await signout();
                    setOpen(false);
                    router.push('/');
                    router.refresh();
                  })();
                }}
                className="hover:bg-paper-100 text-ink-muted hover:text-ink-strong block w-full px-4 py-3 text-left text-sm transition-colors"
              >
                Sign out
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
