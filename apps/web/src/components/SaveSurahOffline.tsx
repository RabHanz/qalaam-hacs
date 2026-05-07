'use client';

/**
 * SaveSurahOffline — single-button surface for D3 Phase 2.
 *
 * States:
 *   - idle           "Save offline · 286 verses"
 *   - probing        "Checking…"
 *   - cached         "✓ Saved offline"   (with delete-revealing hover)
 *   - downloading    progress bar 0–100% + "Saving X / Y verses"
 *   - error          inline message + retry
 *
 * Aesthetic: paper card, leaf-bordered when active, hairline progress
 * bar inside the button itself (no separate component). Mono tabular-
 * nums for counts/sizes. NO toasts, NO modals.
 */
import { useEffect, useRef, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';
import { isSurahFullyCached, prefetchSurahAudio } from '../lib/offline-cache.js';
import { verseCountFor } from '../lib/playback-store.js';

import type { ReactNode } from 'react';

interface Props {
  readonly surah: number;
  readonly reciterSlug: string;
}

type Status = 'idle' | 'probing' | 'cached' | 'downloading' | 'error';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toString()} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SaveSurahOffline({ surah, reciterSlug }: Props): ReactNode {
  const apiBase = resolveApiBase();
  const verseCount = verseCountFor(surah);
  const [status, setStatus] = useState<Status>('idle');
  const [completed, setCompleted] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [errors, setErrors] = useState(0);
  const cancelRef = useRef<(() => void) | null>(null);

  // Probe whether the surah is already cached on mount + whenever the
  // (surah, reciter) pair changes. Probe is 2 cache.match calls — cheap.
  useEffect(() => {
    const lifecycle = { cancelled: false };
    setStatus('probing');
    void (async () => {
      const cached = await isSurahFullyCached(apiBase, surah, reciterSlug);
      if (lifecycle.cancelled) return;
      setStatus(cached ? 'cached' : 'idle');
    })();
    return () => {
      lifecycle.cancelled = true;
    };
  }, [apiBase, surah, reciterSlug]);

  function startSave(): void {
    if (status === 'downloading') return;
    setCompleted(0);
    setBytes(0);
    setErrors(0);
    setStatus('downloading');
    const handle = prefetchSurahAudio(apiBase, surah, reciterSlug, (p) => {
      setCompleted(p.completed);
      setBytes(p.bytes);
      setErrors(p.errors);
    });
    cancelRef.current = () => {
      handle.cancel();
    };
    void handle.promise.then(
      (final) => {
        cancelRef.current = null;
        setStatus(final.errors >= final.total ? 'error' : 'cached');
      },
      () => {
        cancelRef.current = null;
        setStatus('error');
      },
    );
  }

  function cancel(): void {
    cancelRef.current?.();
    setStatus('idle');
  }

  // Browser-without-Cache-API check uses a runtime guard via a
  // conditional access since the global `caches` is typed as always
  // defined. Negligible cost on every render; renders nothing when
  // unavailable so the feature degrades silently.
  if (typeof window !== 'undefined' && !(window as unknown as { caches?: unknown }).caches) {
    return null;
  }

  if (status === 'probing') {
    return (
      <div className="text-ink-muted smallcaps inline-flex h-9 items-center text-[10px] tracking-widest">
        <span className="bg-paper-200 mr-2 inline-block h-2 w-16 animate-pulse rounded" />
      </div>
    );
  }

  if (status === 'cached') {
    return (
      <div className="border-leaf/30 text-leaf-700 smallcaps inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[10px] tracking-widest">
        <span aria-hidden className="bg-leaf inline-block h-1.5 w-1.5 rounded-full" />
        Saved offline
      </div>
    );
  }

  if (status === 'downloading') {
    const pct = verseCount > 0 ? Math.round((completed / verseCount) * 100) : 0;
    return (
      <div className="border-hairline relative inline-flex h-9 min-w-[200px] items-center overflow-hidden rounded-full border">
        <div
          aria-hidden
          className="bg-leaf-300/40 absolute inset-y-0 left-0 transition-[width] duration-150 ease-out"
          style={{ width: `${pct.toString()}%` }}
        />
        <div className="relative flex w-full items-center justify-between px-4">
          <span className="smallcaps text-ink text-[10px] tracking-widest">
            Saving {completed.toString()} / {verseCount.toString()}
          </span>
          <button
            type="button"
            onClick={cancel}
            className="text-ink-muted hover:text-ink-strong text-xs"
            aria-label="Cancel download"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={startSave}
        className="border-hairline text-mistake-error hover:border-mistake-error/40 smallcaps inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[10px] tracking-widest"
        title={errors > 0 ? `${errors.toString()} verses failed` : 'Saving failed'}
      >
        Retry · {formatBytes(bytes)}
      </button>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={startSave}
      className="border-hairline text-ink hover:border-leaf/40 hover:text-leaf-700 smallcaps inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[10px] tracking-widest transition-colors"
    >
      <svg
        width="11"
        height="11"
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
      Save offline · {verseCount.toString()} verses
    </button>
  );
}
