'use client';

/**
 * ShareDialog — bottom-sheet share modal for an ayah.
 *
 * Features:
 *   - Live preview of the OG card (via /og/ayah/[vk])
 *   - Variant tabs: card · full · wbw · advanced · story
 *   - Layout slug is forwarded so the active mushaf shows on the card
 *   - Actions: native share, download PNG, copy link, copy image URL
 *
 * Mobile-first: rounded top bottom-sheet, Esc/backdrop closes,
 * body scroll locked while open.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ReactNode } from 'react';

interface Props {
  readonly verseKey: string;
  readonly layoutSlug?: string;
  readonly open: boolean;
  readonly onClose: () => void;
}

const VARIANTS = [
  { id: 'default', label: 'Card' },
  { id: 'full', label: 'Full text' },
  { id: 'wbw', label: 'Word-by-word' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'story', label: 'Story · 9:16' },
] as const;
type VariantId = (typeof VARIANTS)[number]['id'];

export function ShareDialog({ verseKey, layoutSlug, open, onClose }: Props): ReactNode {
  const [variant, setVariant] = useState<VariantId>('default');
  const [copyState, setCopyState] = useState<'idle' | 'link' | 'image'>('idle');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const params = new URLSearchParams();
  if (variant !== 'default') params.set('variant', variant);
  if (layoutSlug) params.set('layout', layoutSlug);
  const qs = params.toString();
  const cardPath = `/og/ayah/${encodeURIComponent(verseKey)}${qs ? `?${qs}` : ''}`;
  const cardAbs = typeof window !== 'undefined' ? `${window.location.origin}${cardPath}` : cardPath;
  const studyAbs =
    typeof window !== 'undefined'
      ? `${window.location.origin}/read/${verseKey.split(':')[0] ?? '1'}#${verseKey}`
      : '';

  async function nativeShare(): Promise<void> {
    interface NavWithShare extends Navigator {
      share?: (d: ShareData & { files?: File[] }) => Promise<void>;
      canShare?: (d: ShareData & { files?: File[] }) => boolean;
    }
    const nav: NavWithShare = navigator as NavWithShare;
    if (!nav.share) {
      // Fall back to copy-link
      await copyLink();
      return;
    }
    try {
      const res = await fetch(cardPath);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], `qalaam-${verseKey}.png`, { type: 'image/png' });
        const data = { title: `Quran ${verseKey}`, text: studyAbs, files: [file] };
        if (!nav.canShare || nav.canShare(data)) {
          await nav.share(data);
          return;
        }
      }
      await nav.share({ title: `Quran ${verseKey}`, url: studyAbs });
    } catch {
      /* user cancelled */
    }
  }

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(studyAbs);
      setCopyState('link');
      setTimeout(() => {
        setCopyState('idle');
      }, 1500);
    } catch {
      /* ignore */
    }
  }

  async function copyImageUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(cardAbs);
      setCopyState('image');
      setTimeout(() => {
        setCopyState('idle');
      }, 1500);
    } catch {
      /* ignore */
    }
  }

  function downloadPng(): void {
    const a = document.createElement('a');
    a.href = cardPath;
    a.download = `qalaam-${verseKey}-${variant}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Portal to document.body so the modal escapes the AyahCard's
  // overflow-hidden clip and any transformed ancestor that would
  // otherwise turn position:fixed into containing-block-relative.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="bg-ink-900/40 absolute inset-0 backdrop-blur-sm"
      />
      <div
        className="bg-paper border-hairline sheet-rise relative flex w-full flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:border"
        style={{ maxHeight: '92dvh', minHeight: '60dvh' }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="bg-paper-300/80 h-1.5 w-12 rounded-full" aria-hidden />
        </div>

        <header className="flex items-baseline justify-between px-5 pb-3 pt-3 sm:px-6 sm:pt-6">
          <div>
            <p className="smallcaps text-leaf text-[11px] tracking-widest">Share</p>
            <h2 id="share-title" className="font-display text-ink-strong text-xl sm:text-2xl">
              {verseKey}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-ink-muted hover:text-ink -mr-1 p-1"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Variant tabs */}
        <div className="border-hairline scrollbar-thin flex shrink-0 gap-1 overflow-x-auto border-b px-5 py-3 sm:px-6">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setVariant(v.id);
              }}
              className={`smallcaps shrink-0 rounded-full px-3 py-1.5 text-[11px] tracking-widest transition-colors ${
                variant === v.id
                  ? 'bg-leaf text-paper'
                  : 'border-hairline text-ink-muted hover:text-leaf border'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Card preview — keys on cardPath so the <img> remounts when
            variant or layout changes; loading state via CSS only. */}
        <div className="bg-paper-100 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="bg-paper-200 mx-auto max-w-xl overflow-hidden rounded-md shadow-sm">
            <img
              key={cardPath}
              src={cardPath}
              alt={`Shareable card for ${verseKey}`}
              className="w-full"
              style={{
                aspectRatio: variant === 'story' ? '9 / 16' : 'auto',
                background: '#1b4d5a',
              }}
            />
          </div>
          <p className="text-ink-muted/70 mt-2 text-center text-[10px] italic">
            {variant === 'story'
              ? 'Portrait 1080×1920 — IG / WhatsApp status'
              : 'Landscape 1200×* — OG / Twitter / iMessage'}
          </p>
        </div>

        {/* Actions */}
        <div className="border-hairline grid shrink-0 grid-cols-2 gap-2 border-t px-5 py-4 sm:grid-cols-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              void nativeShare();
            }}
            className="bg-leaf text-paper smallcaps inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[11px] tracking-widest hover:opacity-95"
          >
            Share →
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 smallcaps inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-[11px] tracking-widest"
          >
            Download PNG
          </button>
          <button
            type="button"
            onClick={() => {
              void copyLink();
            }}
            className="border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 smallcaps inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-[11px] tracking-widest"
          >
            {copyState === 'link' ? 'Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => {
              void copyImageUrl();
            }}
            className="border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 smallcaps inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-[11px] tracking-widest"
          >
            {copyState === 'image' ? 'Copied' : 'Copy image URL'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
