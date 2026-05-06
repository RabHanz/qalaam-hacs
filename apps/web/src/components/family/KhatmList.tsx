'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { khatm as khatmApi, type Khatm } from '../../lib/family-api.js';
import { useUser } from '../../lib/use-user.js';
import { UpgradeCard } from '../FeatureGate.js';

import type { ReactNode } from 'react';

const MODE_LABELS: Record<Khatm['mode'], string> = {
  sequential: 'Sequential',
  distributed: 'Distributed',
  'by-juz': 'By juz',
};

export function KhatmList(): ReactNode {
  const { status } = useUser();
  const [khatms, setKhatms] = useState<readonly Khatm[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('Family khatm');
  const [mode, setMode] = useState<Khatm['mode']>('distributed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    setNeedsUpgrade(false);
    khatmApi
      .list()
      .then((data) => {
        if (!cancelled) setKhatms(data.khatms);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { status?: number };
        if (e.status === 403) {
          setNeedsUpgrade(true);
        } else {
          setKhatms([]);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [status]);

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const data = await khatmApi.start({ title: title.trim(), mode });
      setKhatms((prev) => [data.khatm, ...(prev ?? [])]);
      setCreating(false);
      setTitle('Family khatm');
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message ?? 'Could not start khatm.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'anonymous') {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1
          className="text-ink-strong"
          style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '2rem', fontWeight: 600 }}
        >
          Family khatm
        </h1>
        <p className="text-ink-muted mt-3 text-sm leading-relaxed">
          Sign in to start or join a family khatm.
        </p>
        <Link href="/signin" className="btn-primary mt-6 inline-flex text-sm">
          Sign in
        </Link>
      </div>
    );
  }
  if (needsUpgrade) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <UpgradeCard feature="family.khatm" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <header>
        <p className="smallcaps text-leaf text-[10px] tracking-[0.22em]">Family-private</p>
        <h1
          className="text-ink-strong"
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(1.75rem, 4vw, 2.4rem)',
            fontWeight: 600,
          }}
        >
          Family khatm
        </h1>
        <p className="text-ink-muted mt-2 max-w-[60ch] text-sm leading-relaxed">
          A multi-user reading of all 604 pages of the mushaf, claimed page-by-page by family
          members. Choose <em>sequential</em> for strict order, <em>distributed</em> for any
          unclaimed page, or <em>by-juz</em> to assign a juz to each member.
        </p>
      </header>

      {creating ? (
        <div className="border-hairline bg-surface rounded-2xl border p-6">
          <h3
            className="text-ink-strong mb-3 text-base"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            New khatm
          </h3>
          <label className="flex flex-col gap-1.5">
            <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.currentTarget.value);
              }}
              maxLength={120}
              className="border-hairline focus:border-leaf focus:ring-leaf/30 bg-surface rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </label>
          <fieldset className="mt-3 grid grid-cols-3 gap-2">
            <legend className="smallcaps text-ink-muted mb-2 block w-full text-[10px] tracking-[0.18em]">
              Mode
            </legend>
            {(Object.keys(MODE_LABELS) as Khatm['mode'][]).map((m) => (
              <button
                type="button"
                key={m}
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                }}
                className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                  mode === m ? 'border-leaf bg-leaf/10 text-leaf-700' : 'border-hairline bg-surface'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </fieldset>
          {error ? (
            <p role="alert" className="text-mistake-error mt-2 text-sm">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
              }}
              className="text-ink-muted hover:text-ink-strong rounded-lg px-4 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || title.trim().length === 0}
              onClick={() => {
                void start();
              }}
              className="bg-ink hover:bg-ink-strong text-paper rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {busy ? 'Starting…' : 'Start khatm'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setCreating(true);
            }}
            className="bg-ink hover:bg-ink-strong text-paper rounded-lg px-5 py-2 text-sm font-medium transition-colors"
          >
            Start a new khatm
          </button>
        </div>
      )}

      {khatms === null ? (
        <p className="text-ink-muted text-sm">Loading…</p>
      ) : khatms.length === 0 ? (
        <div className="border-hairline bg-surface rounded-2xl border p-8 text-center">
          <p className="text-ink-muted text-sm leading-relaxed">
            No khatms yet. Start one to track your family's reading together.
          </p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {khatms.map((k) => (
            <li key={k.id}>
              <Link
                href={`/family/khatm/${k.id}`}
                className="border-hairline hover:border-leaf bg-surface flex flex-col gap-1 rounded-xl border p-4 transition-all hover:shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className="text-ink-strong text-base"
                    style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                  >
                    {k.title}
                  </h3>
                  <span
                    className={`smallcaps rounded-full px-2 py-0.5 text-[10px] tracking-widest ${
                      k.status === 'active'
                        ? 'bg-leaf/15 text-leaf-700'
                        : k.status === 'done'
                          ? 'bg-mistake-correct/15 text-mistake-correct'
                          : 'bg-paper-200 text-ink-muted'
                    }`}
                  >
                    {k.status}
                  </span>
                </div>
                <p className="text-ink-muted text-xs">
                  {MODE_LABELS[k.mode]} · started {k.startDate}
                  {k.targetDate ? ` · target ${k.targetDate}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
