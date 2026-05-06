'use client';

/**
 * ApiKeysSection — Premium/Pro tier surface in /settings for minting,
 * listing, and revoking programmatic-access keys.
 *
 * Wires the J1 backend (`/v1/auth/api-keys`) into the settings form
 * so Premium/Pro users can self-serve a key for the Home Assistant
 * integration, MCP clients, and third-party automations.
 *
 * Adab + UX:
 *   - The plaintext key is shown ONCE on mint, in a copy-now panel.
 *     We do NOT store it client-side after dismissal — refresh, no key.
 *   - Locked tiers see the section but with a "Premium / Pro" pill
 *     and a deep-link to /pricing instead of the form.
 *   - Revoke is a soft delete (sets revoked_at). Revoked rows stay
 *     on screen but greyed so the audit trail is visible.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import type { ReactNode } from 'react';

interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

interface MintResponse extends ApiKey {
  key: string;
}

interface Props {
  readonly tier: string;
}

function formatDate(ms: number | null): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}

function formatRelative(ms: number | null): string {
  if (!ms) return 'never';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m.toString()}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h.toString()}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d.toString()}d ago`;
  return formatDate(ms);
}

export function ApiKeysSection({ tier }: Props): ReactNode {
  const apiBase = resolveApiBase();
  const unlocked = tier === 'premium' || tier === 'pro';
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [minting, setMinting] = useState(false);
  const [justMinted, setJustMinted] = useState<MintResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!unlocked) return;
    const lifecycle = { cancelled: false };
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/auth/api-keys`, { credentials: 'include' });
        if (!res.ok) {
          if (!lifecycle.cancelled) setError('Could not load your API keys.');
          return;
        }
        const body = (await res.json()) as { keys: ApiKey[] };
        if (!lifecycle.cancelled) {
          setKeys(body.keys);
          setError(null);
        }
      } catch {
        if (!lifecycle.cancelled) setError('Network error loading API keys.');
      }
    })();
    return () => {
      lifecycle.cancelled = true;
    };
  }, [apiBase, unlocked, reloadTick]);

  async function mint(): Promise<void> {
    setMinting(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`${apiBase}/v1/auth/api-keys`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Untitled key' }),
      });
      if (!res.ok) {
        setError('Could not mint a new key.');
        return;
      }
      const body = (await res.json()) as MintResponse;
      setJustMinted(body);
      setName('');
      setReloadTick((n) => n + 1);
    } catch {
      setError('Network error minting key.');
    } finally {
      setMinting(false);
    }
  }

  async function revoke(id: string): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Revoke this key? Anything using it will stop working immediately.')
    ) {
      return;
    }
    try {
      const res = await fetch(`${apiBase}/v1/auth/api-keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        setError('Could not revoke the key.');
        return;
      }
      setReloadTick((n) => n + 1);
    } catch {
      setError('Network error revoking key.');
    }
  }

  function copyKey(): void {
    if (!justMinted) return;
    void navigator.clipboard.writeText(justMinted.key).then(
      () => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 1500);
      },
      () => {
        setError('Could not copy — select the text manually.');
      },
    );
  }

  return (
    <section className="bg-surface border-hairline rounded-2xl border p-6">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2
          className="text-ink-strong text-base"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          API keys
        </h2>
        {!unlocked ? (
          <span className="border-leaf/40 text-leaf rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest">
            Premium / Pro
          </span>
        ) : null}
      </div>
      <p className="text-ink-muted mb-4 text-xs leading-relaxed">
        Programmatic access for the Home Assistant integration, MCP clients, and any third-party
        automation. Each key carries your tier; revoke any time.
      </p>

      {!unlocked ? (
        <Link href="/pricing" className="btn-ghost text-sm">
          See plans
        </Link>
      ) : (
        <>
          {/* Just-minted reveal — only place the plaintext key is shown. */}
          {justMinted ? (
            <div className="border-leaf bg-leaf-50 mb-4 rounded-lg border p-3">
              <p className="text-leaf-700 text-[11px] uppercase tracking-widest">Copy now</p>
              <p className="text-ink-muted mt-1 text-xs leading-relaxed">
                This is the only time you’ll see the full key. Store it somewhere safe.
              </p>
              <div className="mt-2 flex items-stretch gap-2">
                <code className="border-hairline bg-paper text-ink-strong min-w-0 flex-1 truncate rounded-md border px-3 py-2 font-mono text-xs">
                  {justMinted.key}
                </code>
                <button
                  type="button"
                  onClick={copyKey}
                  className="border-leaf text-leaf hover:bg-leaf/10 smallcaps shrink-0 rounded-md border px-3 text-[11px] tracking-widest"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJustMinted(null);
                    setCopied(false);
                  }}
                  className="text-ink-muted hover:text-ink-strong smallcaps shrink-0 px-2 text-[11px] tracking-widest"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder="Name (e.g. Home Assistant)"
              className="border-hairline bg-paper text-ink placeholder:text-ink-muted focus:border-leaf min-w-0 flex-1 rounded-full border px-4 py-1.5 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                void mint();
              }}
              disabled={minting}
              className="bg-leaf text-paper smallcaps shrink-0 rounded-full px-4 py-1.5 text-[11px] tracking-widest hover:opacity-90 disabled:opacity-50"
            >
              {minting ? 'Minting…' : 'Mint key'}
            </button>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-300/40 bg-red-50/60 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          ) : null}

          {keys === null ? (
            <p className="text-ink-muted mt-4 text-sm italic">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="text-ink-muted mt-4 text-sm italic">No keys yet.</p>
          ) : (
            <ul className="divide-hairline mt-4 divide-y" role="list">
              {keys.map((k) => {
                const revoked = Boolean(k.revokedAt);
                return (
                  <li
                    key={k.id}
                    className={`flex flex-wrap items-baseline gap-3 py-3 ${
                      revoked ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-sm">{k.name}</p>
                      <p className="text-ink-muted mt-0.5 truncate font-mono text-[11px] tabular-nums">
                        created {formatDate(k.createdAt)}
                        <span className="mx-1.5 opacity-60">·</span>
                        last used {formatRelative(k.lastUsedAt)}
                        {revoked ? (
                          <>
                            <span className="mx-1.5 opacity-60">·</span>
                            <span className="text-mistake-error">
                              revoked {formatDate(k.revokedAt)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {!revoked ? (
                      <button
                        type="button"
                        onClick={() => {
                          void revoke(k.id);
                        }}
                        className="text-mistake-error hover:bg-paper-100 smallcaps shrink-0 rounded-full border border-red-300/30 px-3 py-1 text-[11px] tracking-widest"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
