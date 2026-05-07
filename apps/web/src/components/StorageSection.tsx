'use client';

/**
 * StorageSection — D3 Phase 2's storage management surface.
 *
 * Shows:
 *   - audio cache size + entry count
 *   - browser storage estimate (usage + quota) when available
 *   - "Clear offline content" button
 *
 * Adab + UX:
 *   - No alarmist "Storage full!" copy. Show the numbers; the user
 *     can decide.
 *   - Clear is a single tap with a small confirm (browser native
 *     window.confirm is intentional — keeps the UI free of toast +
 *     modal chrome).
 */
import { useEffect, useState } from 'react';

import { clearAudioCache, getStorageEstimate } from '../lib/offline-cache.js';

import type { ReactNode } from 'react';

interface Stats {
  usageBytes: number | null;
  quotaBytes: number | null;
  audioCacheBytes: number;
  audioCacheCount: number;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes.toString()} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function StorageSection(): ReactNode {
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const lifecycle = { cancelled: false };
    void (async () => {
      const s = await getStorageEstimate();
      if (lifecycle.cancelled) return;
      setStats(s);
    })();
    return () => {
      lifecycle.cancelled = true;
    };
  }, [reloadTick]);

  // Browsers without Cache API or StorageManager (very old Safari)
  // get nothing. Better silent than a "Storage isn't available" line.
  if (typeof window !== 'undefined' && !(window as unknown as { caches?: unknown }).caches) {
    return null;
  }

  async function clear(): Promise<void> {
    if (busy) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Delete all offline-saved recitations? You can re-save any surah from /listen later.',
      )
    ) {
      return;
    }
    setBusy(true);
    await clearAudioCache();
    setBusy(false);
    setReloadTick((n) => n + 1);
  }

  const u = stats?.usageBytes;
  const q = stats?.quotaBytes;
  const usagePct =
    u !== null && u !== undefined && q !== null && q !== undefined && q > 0
      ? Math.min(100, Math.round((u / q) * 100))
      : null;

  return (
    <section className="bg-surface border-hairline rounded-2xl border p-6">
      <h2
        className="text-ink-strong mb-1 text-base"
        style={{ fontFamily: 'Fraunces, Georgia, serif' }}
      >
        Offline storage
      </h2>
      <p className="text-ink-muted mb-4 text-xs leading-relaxed">
        What you’ve saved to this device for offline listening. The browser sets the storage cap;
        Qalaam never asks for more than it needs.
      </p>

      {stats === null ? (
        <p className="text-ink-muted text-sm italic">Calculating…</p>
      ) : (
        <ul className="divide-hairline divide-y" role="list">
          <li className="flex items-baseline justify-between py-3">
            <span className="text-ink text-sm">Audio cache</span>
            <span className="text-ink-strong font-mono text-sm tabular-nums">
              {formatBytes(stats.audioCacheBytes)}
              <span className="text-ink-muted ml-2 text-xs">
                {stats.audioCacheCount.toString()} verses
              </span>
            </span>
          </li>
          <li className="flex items-baseline justify-between py-3">
            <span className="text-ink text-sm">Total browser usage</span>
            <span className="text-ink-strong font-mono text-sm tabular-nums">
              {formatBytes(stats.usageBytes)}
              {usagePct !== null ? (
                <span className="text-ink-muted ml-2 text-xs">{usagePct.toString()}% of cap</span>
              ) : null}
            </span>
          </li>
          {stats.quotaBytes !== null ? (
            <li className="flex items-baseline justify-between py-3">
              <span className="text-ink text-sm">Browser storage cap</span>
              <span className="text-ink-strong font-mono text-sm tabular-nums">
                {formatBytes(stats.quotaBytes)}
              </span>
            </li>
          ) : null}
        </ul>
      )}

      {stats && stats.audioCacheCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            void clear();
          }}
          disabled={busy}
          className="border-hairline text-mistake-error hover:border-mistake-error/40 hover:bg-mistake-error/5 mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs transition-colors disabled:opacity-50"
        >
          {busy ? 'Clearing…' : 'Clear offline content'}
        </button>
      ) : null}
    </section>
  );
}
