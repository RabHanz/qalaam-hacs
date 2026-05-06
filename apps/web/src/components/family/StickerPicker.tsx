'use client';

/**
 * StickerPicker — pick a praise sticker (Subhan-Allah, Masha-Allah,
 * Alhamdulillah, Jazak-Allah, Ahsanta, Baraka) and send to a member.
 *
 * Adab non-negotiable per CLAUDE.md: NOT trophy/XP/coin/leaderboard
 * semantics — these are explicit Islamic du'a/encouragement phrases
 * exchanged human-to-human. The UI emphasizes meaning + Arabic source,
 * not collection.
 */
import { useState } from 'react';

import { STICKER_LABELS, voiceNotes, type FamilyMember } from '../../lib/family-api.js';

import { MemberAvatar } from './MemberAvatar.js';

import type { ReactNode } from 'react';

interface Props {
  readonly recipients: readonly FamilyMember[];
  readonly defaultRecipientId?: string;
  readonly onSent?: () => void;
  readonly onCancel?: () => void;
}

const STICKERS = ['mashaallah', 'alhamdulillah', 'subhanallah', 'jazakallah', 'ahsanta', 'baraka'];

export function StickerPicker({
  recipients,
  defaultRecipientId,
  onSent,
  onCancel,
}: Props): ReactNode {
  const [recipientId, setRecipientId] = useState<string>(
    defaultRecipientId ?? recipients[0]?.userId ?? '',
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(): Promise<void> {
    if (!selected || !recipientId) return;
    setBusy(true);
    setError(null);
    try {
      await voiceNotes.send({ toUserId: recipientId, sticker: selected });
      setSent(true);
      setTimeout(() => {
        if (onSent) onSent();
      }, 700);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(e.message ?? 'Could not send right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Send praise"
      className="border-hairline bg-paper-50 rounded-xl border p-5"
    >
      <header className="mb-4">
        <h4
          className="text-ink-strong text-base"
          style={{ fontFamily: 'Fraunces, Georgia, serif' }}
        >
          Send a kind word
        </h4>
        <p className="text-ink-muted text-xs">
          A short Islamic phrase of encouragement — sent privately, not posted.
        </p>
      </header>

      <fieldset className="mb-4 flex flex-wrap gap-2" disabled={busy || sent}>
        <legend className="smallcaps text-ink-muted mb-2 block w-full text-[10px] tracking-[0.18em]">
          To
        </legend>
        {recipients.map((m) => (
          <button
            type="button"
            key={m.userId}
            aria-pressed={recipientId === m.userId}
            onClick={() => {
              setRecipientId(m.userId);
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              recipientId === m.userId
                ? 'border-leaf bg-leaf/10 text-leaf-700'
                : 'border-hairline hover:border-leaf-300 bg-white'
            }`}
          >
            <MemberAvatar
              displayName={m.displayName}
              avatarColor={m.avatarColor}
              size={20}
              subtle
            />
            <span>{m.displayName}</span>
          </button>
        ))}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3" disabled={busy || sent}>
        <legend className="smallcaps text-ink-muted mb-2 block w-full text-[10px] tracking-[0.18em]">
          Phrase
        </legend>
        {STICKERS.map((s) => {
          const meta = STICKER_LABELS[s];
          if (!meta) return null;
          const isSelected = selected === s;
          return (
            <button
              type="button"
              key={s}
              aria-pressed={isSelected}
              onClick={() => {
                setSelected(s);
              }}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all ${
                isSelected
                  ? 'border-leaf bg-leaf/10 shadow-sm'
                  : 'border-hairline hover:border-leaf-300 bg-white'
              }`}
            >
              <span
                className="font-arabic block text-[1.05rem]"
                style={{ direction: 'rtl', lineHeight: 1.6 }}
              >
                {meta.arabic}
              </span>
              <span className="text-ink-strong text-sm font-medium">{meta.label}</span>
              <span className="text-ink-muted text-[10px] leading-relaxed">{meta.meaning}</span>
            </button>
          );
        })}
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-300/40 bg-red-50/60 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-ink-muted hover:text-ink-strong rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={!selected || !recipientId || busy || sent}
          onClick={() => {
            void send();
          }}
          className="bg-leaf-500 hover:bg-leaf-700 text-paper rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sent ? 'Sent ✓' : busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
