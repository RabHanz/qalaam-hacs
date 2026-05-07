'use client';

/**
 * InstallHint — surfaces the browser's "Install this app" prompt as
 * a small, restrained pill in the UserMenu region.
 *
 * Behaviour:
 *   - Listens for `beforeinstallprompt` (Chromium / Edge / Samsung).
 *   - When fired, the browser asks us to defer the prompt; we cache
 *     the event and render a small "Install Qalaam" affordance.
 *   - On click, we call deferred.prompt() — the actual install dialog
 *     opens. We listen for the user's choice and clear our state.
 *   - After install, `appinstalled` fires globally — we hide the hint.
 *
 * Renders nothing on Safari / iOS (no beforeinstallprompt support);
 * those users add via the browser's share-sheet "Add to Home Screen"
 * which Apple controls. There is no useful affordance we can offer.
 */
import { useEffect, useState } from 'react';

import type { ReactNode } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

export function InstallHint(): ReactNode {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onBefore(e: Event): void {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled(): void {
      setDeferred(null);
    }
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  async function trigger(): Promise<void> {
    if (!deferred || busy) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setDeferred(null);
    } catch {
      /* user dismissed or browser refused — leave the hint visible
         so they can try again later. */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        void trigger();
      }}
      disabled={busy}
      title="Install Qalaam to your home screen"
      className="border-leaf/40 text-leaf hover:bg-leaf/10 smallcaps inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[10px] tracking-widest transition-colors disabled:opacity-50"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M12 4v12" strokeLinecap="round" />
        <path d="M7 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 20h14" strokeLinecap="round" />
      </svg>
      <span className="hidden sm:inline">Install</span>
    </button>
  );
}
