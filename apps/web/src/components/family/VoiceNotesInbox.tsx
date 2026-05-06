'use client';

/**
 * VoiceNotesInbox — list inbox / sent voice notes + stickers, with audio
 * playback for clips that include audio.
 *
 * Auth-gated. Marks inbox notes read on play.
 */
import { useEffect, useState } from 'react';

import {
  STICKER_LABELS,
  voiceNotes,
  type FamilyMember,
  type VoiceNote,
} from '../../lib/family-api.js';

import { MemberAvatar } from './MemberAvatar.js';

import type { ReactNode } from 'react';

interface Props {
  readonly currentUserId: string;
  readonly members: readonly FamilyMember[];
}

const TABS = [
  { id: 'inbox' as const, label: 'Inbox' },
  { id: 'sent' as const, label: 'Sent' },
] as const;

function formatDuration(ms: number | null): string {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60).toString()}:${(s % 60).toString().padStart(2, '0')}`;
}

function relativeTime(iso: string): string {
  const ts = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000).toString()}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000).toString()}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000).toString()}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function VoiceNotesInbox({ currentUserId, members }: Props): ReactNode {
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [notes, setNotes] = useState<VoiceNote[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    voiceNotes
      .list(tab === 'inbox' ? 'inbox' : 'sent')
      .then((data) => {
        if (!cancelled) setNotes(data.notes);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [tab]);

  const memberFor = (id: string): FamilyMember | undefined => members.find((m) => m.userId === id);

  function onPlay(note: VoiceNote): void {
    if (note.toUserId === currentUserId && note.readAt === null) {
      voiceNotes.markRead(note.id).catch(() => {
        /* harmless — best-effort */
      });
      setNotes((prev) =>
        prev
          ? prev.map((n) => (n.id === note.id ? { ...n, readAt: new Date().toISOString() } : n))
          : prev,
      );
    }
  }

  async function remove(note: VoiceNote): Promise<void> {
    try {
      await voiceNotes.remove(note.id);
      setNotes((prev) => (prev ? prev.filter((n) => n.id !== note.id) : prev));
    } catch {
      /* leave on failure — tap again if user retries */
    }
  }

  return (
    <div className="border-hairline bg-paper rounded-2xl border p-6">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-ink-strong text-lg" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          Voice notes &amp; praise
        </h3>
        <div role="tablist" className="border-hairline inline-flex gap-1 rounded-full border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
              }}
              className={`smallcaps rounded-full px-3 py-1 text-[10px] tracking-widest transition-colors ${
                tab === t.id ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <p className="text-ink-muted text-sm">Loading…</p>
      ) : notes?.length === 0 ? (
        <p className="text-ink-muted text-sm leading-relaxed">
          {tab === 'inbox'
            ? 'No voice notes yet. When a family member sends praise, it will appear here.'
            : 'You haven\'t sent anything yet. Use the "Send a kind word" button on a member.'}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {notes?.map((n) => {
            const counterpartyId = tab === 'inbox' ? n.fromUserId : n.toUserId;
            const counterparty = memberFor(counterpartyId);
            const sticker = n.sticker ? STICKER_LABELS[n.sticker] : null;
            const unread = tab === 'inbox' && n.readAt === null;
            return (
              <li
                key={n.id}
                className={`border-hairline flex items-start gap-3 rounded-xl border p-4 ${
                  unread ? 'bg-leaf/5' : 'bg-white'
                }`}
              >
                <MemberAvatar
                  displayName={counterparty?.displayName ?? '—'}
                  avatarColor={counterparty?.avatarColor ?? null}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-ink-strong truncate text-sm font-medium">
                      {tab === 'inbox' ? 'From ' : 'To '}
                      {counterparty?.displayName ?? '…'}
                    </p>
                    <span className="text-ink-muted shrink-0 text-[10px]">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>

                  {sticker ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className="font-arabic text-leaf-700 text-lg"
                        style={{ direction: 'rtl', lineHeight: 1.6 }}
                      >
                        {sticker.arabic}
                      </span>
                      <span className="text-ink-muted text-xs italic">
                        {sticker.label} — {sticker.meaning}
                      </span>
                    </div>
                  ) : null}

                  {n.hasAudio ? (
                    <div className="mt-2 flex items-center gap-2">
                      <audio
                        controls
                        preload="none"
                        src={voiceNotes.audioUrl(n.id)}
                        onPlay={() => {
                          onPlay(n);
                        }}
                        className="h-8 max-w-full"
                      />
                      {n.durationMs ? (
                        <span className="text-ink-muted text-[10px]">
                          {formatDuration(n.durationMs)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {n.transcript ? (
                    <p className="text-ink-muted mt-1.5 text-xs italic">{n.transcript}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void remove(n);
                  }}
                  aria-label="Delete"
                  className="text-ink-muted hover:text-mistake-error self-start text-xs transition-colors"
                  title="Delete"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
