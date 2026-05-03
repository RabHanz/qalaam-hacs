/**
 * /listen — ambient passive playback (Listen Mode).
 *
 * Per strategy §10.1: low-volume loop of the user's current memorization
 * portion (sabaq + sabqi). Strong evidence-backed Hifdh technique that no
 * existing app does home-wide.
 *
 * v0.5: shows the current now-playing on the qalaam virtual speaker, the
 * configured reciter, and basic transport hints. Real Speaker selection
 * lands when the device-bridge is wired into the backend (Phase 10 closure).
 */
import { Suspense } from 'react';

import { EmptyState } from '../../components/EmptyState.js';
import { LoadingState } from '../../components/LoadingState.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Listen Mode',
  description: 'Ambient low-volume playback of your current memorization portion.',
};

interface NowPlayingPayload {
  speaker_id: string;
  verse_key: string | null;
  reciter_slug: string | null;
  position_ms: number;
  is_playing: boolean;
  updated_at?: string;
}

interface Reciter {
  id: string;
  slug: string;
  name: { en: string; ar: string };
  style: string;
  riwayah: string;
}

async function fetchNowPlaying(baseUrl: string): Promise<NowPlayingPayload | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/now-playing/qalaam`, {
      next: { revalidate: 5 },
    });
    if (!res.ok) return null;
    return (await res.json()) as NowPlayingPayload;
  } catch {
    return null;
  }
}

async function fetchReciters(baseUrl: string): Promise<readonly Reciter[]> {
  try {
    const res = await fetch(`${baseUrl}/v1/reciters`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { reciters?: Reciter[] };
    return body.reciters ?? [];
  } catch {
    return [];
  }
}

async function ListenContent({ baseUrl }: { baseUrl: string }): Promise<ReactNode> {
  const [np, reciters] = await Promise.all([fetchNowPlaying(baseUrl), fetchReciters(baseUrl)]);

  if (!np) {
    return (
      <EmptyState
        title="Backend unreachable"
        hint="Could not reach the Qalaam backend. Listen Mode reads the qalaam virtual speaker over /v1/now-playing/qalaam."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <article
        style={{
          background: 'var(--color-surface-raised, #fff)',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
          display: 'grid',
          gap: '0.5rem',
        }}
        aria-label="Now playing"
      >
        <span
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            opacity: 0.7,
          }}
        >
          Now playing on qalaam virtual speaker
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.5rem', lineHeight: 1.2 }}>{np.verse_key ?? '—'}</strong>
          <span style={{ opacity: 0.7 }}>
            {np.is_playing ? '▶ playing' : '⏸ idle'}{' '}
            {np.position_ms > 0 ? `· ${(np.position_ms / 1000).toFixed(1)}s` : ''}
          </span>
        </div>
        <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>
          Reciter: <strong>{np.reciter_slug ?? 'not set'}</strong>
        </span>
      </article>

      <article
        style={{
          background: 'var(--color-surface-raised, #fff)',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
        }}
        aria-label="Available reciters"
      >
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Reciter catalog</h2>
        <p style={{ marginTop: '0.4rem', opacity: 0.75, fontSize: '0.875rem' }}>
          Listen Mode plays your current sabaq + sabqi quietly across any speaker connected via
          Cast, Sonos, AirPlay, MQTT, Home Assistant, or this browser tab. Speaker pick lands when
          Phase 10 device-bridge integration tests close.
        </p>
        {reciters.length === 0 ? (
          <p style={{ marginTop: '0.75rem', opacity: 0.7, fontSize: '0.875rem' }}>
            No reciters available.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: '1rem 0 0',
              padding: 0,
              display: 'grid',
              gap: '0.5rem',
            }}
          >
            {reciters.map((r) => {
              const active = r.slug === np.reciter_slug;
              return (
                <li
                  key={r.slug}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.625rem',
                    background: active ? 'rgba(182,134,44,0.10)' : 'transparent',
                  }}
                >
                  <span style={{ fontWeight: active ? 600 : 500 }}>
                    {r.name.en}
                    {active ? <span aria-hidden> · current</span> : null}
                  </span>
                  <span style={{ opacity: 0.6, fontSize: '0.875rem' }}>
                    {r.style} · {r.riwayah}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}

export default function ListenPage(): ReactNode {
  const baseUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4100';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Listen Mode</h1>
        <p className="text-sm opacity-70">
          Plays your current memorization portion at low volume around the home. Adhan-aware —
          pauses for prayer windows.
        </p>
      </header>
      <Suspense fallback={<LoadingState label="Loading Listen Mode…" lines={4} />}>
        <ListenContent baseUrl={baseUrl} />
      </Suspense>
    </div>
  );
}
