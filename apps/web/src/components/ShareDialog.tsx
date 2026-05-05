'use client';

/**
 * ShareDialog — full share sheet for an ayah card.
 *
 * Two axes the user controls:
 *   - Format: card (1.91:1 OG) | square (1:1) | story (9:16)
 *   - Variant: minimal (Arabic only) | translation | wbw | advanced
 *
 * Plus toggle switches for advanced learners (transliteration, grammar,
 * tafsir snippet) that compose with any variant.
 *
 * The active mushaf layoutSlug from the parent flows in via prop so
 * the rendered card shows Indopak/Tajweed/Madani text faithfully.
 *
 * UX rules:
 *   - Modal portals to document.body (escapes overflow:hidden ancestors)
 *   - Mobile: bottom sheet ; Desktop: centered card capped at 92dvh
 *   - Visual feedback: spinner while sharing, checkmark when copied,
 *     button disables during the action
 *   - All actions reachable on mobile keyboard / desktop click-out
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ReactNode } from 'react';

interface Props {
  readonly verseKey: string;
  readonly layoutSlug?: string;
  /** Active translation slug from /read (e.g. 'pickthall', 'maududi').
   *  Defaults to saheeh-international when omitted. */
  readonly translationSlug?: string;
  readonly transliterationSlug?: string;
  readonly tafsirSlug?: string;
  readonly open: boolean;
  readonly onClose: () => void;
}

type Format = 'landscape' | 'square' | 'story';
type Variant = 'minimal' | 'translation' | 'wbw' | 'advanced';

const FORMATS: readonly { id: Format; label: string; ratio: string }[] = [
  { id: 'landscape', label: 'Card', ratio: '1.91:1' },
  { id: 'square', label: 'Square', ratio: '1:1' },
  { id: 'story', label: 'Story', ratio: '9:16' },
];

const VARIANTS: readonly { id: Variant; label: string; hint: string }[] = [
  { id: 'minimal', label: 'Verse only', hint: 'Just Arabic' },
  { id: 'translation', label: 'With translation', hint: 'Arabic + English' },
  { id: 'wbw', label: 'Word-by-word', hint: 'Per-word gloss' },
  { id: 'advanced', label: 'Advanced', hint: 'Grammar + tafsir' },
];

type ActionState = 'idle' | 'busy' | 'ok' | 'err';

export function ShareDialog({
  verseKey,
  layoutSlug,
  translationSlug,
  transliterationSlug,
  tafsirSlug,
  open,
  onClose,
}: Props): ReactNode {
  const [format, setFormat] = useState<Format>('landscape');
  const [variant, setVariant] = useState<Variant>('translation');
  const [showTransliteration, setShowTransliteration] = useState(false);
  const [showGrammar, setShowGrammar] = useState(false);
  const [showTafsir, setShowTafsir] = useState(false);
  const [shareState, setShareState] = useState<ActionState>('idle');
  const [downloadState, setDownloadState] = useState<ActionState>('idle');
  const [linkState, setLinkState] = useState<ActionState>('idle');
  const [imgState, setImgState] = useState<ActionState>('idle');

  // Reset action states when the user changes any composition control
  useEffect(() => {
    setShareState('idle');
    setDownloadState('idle');
    setLinkState('idle');
    setImgState('idle');
  }, [format, variant, showTransliteration, showGrammar, showTafsir]);

  // Esc + body-scroll-lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Build the OG card URL whenever inputs change
  const cardUrls = useMemo(() => {
    const params = new URLSearchParams();
    params.set('format', format);
    params.set('variant', variant);
    if (layoutSlug) params.set('layout', layoutSlug);
    if (translationSlug) params.set('translation', translationSlug);
    if (transliterationSlug) params.set('transliterationSlug', transliterationSlug);
    if (tafsirSlug) params.set('tafsirSlug', tafsirSlug);
    if (showTransliteration) params.set('transliteration', '1');
    if (showGrammar) params.set('grammar', '1');
    if (showTafsir) params.set('tafsir', '1');
    // Prefer the Puppeteer-screenshot route — it reuses /share-card so
    // Arabic joins, tafsir HTML renders, tajweed CSS applies. The
    // Satori route at /og/ayah remains as a hot-cache fallback.
    const path = `/og/ayah-pp/${encodeURIComponent(verseKey)}?${params.toString()}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      path,
      abs: `${origin}${path}`,
      study:
        typeof window !== 'undefined'
          ? `${origin}/read/${verseKey.split(':')[0] ?? '1'}#${verseKey}`
          : '',
    };
  }, [
    verseKey,
    layoutSlug,
    translationSlug,
    transliterationSlug,
    tafsirSlug,
    format,
    variant,
    showTransliteration,
    showGrammar,
    showTafsir,
  ]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  async function nativeShare(): Promise<void> {
    setShareState('busy');
    try {
      interface NavWithShare extends Navigator {
        share?: (d: ShareData & { files?: File[] }) => Promise<void>;
        canShare?: (d: ShareData & { files?: File[] }) => boolean;
      }
      const nav = navigator as NavWithShare;
      if (nav.share) {
        try {
          const res = await fetch(cardUrls.path);
          if (res.ok) {
            const blob = await res.blob();
            const file = new File([blob], `qalaam-${verseKey}.png`, { type: 'image/png' });
            const data = { title: `Quran ${verseKey}`, text: cardUrls.study, files: [file] };
            if (!nav.canShare || nav.canShare(data)) {
              await nav.share(data);
              setShareState('ok');
              setTimeout(() => {
                setShareState('idle');
              }, 1600);
              return;
            }
          }
        } catch {
          /* fall through to URL share */
        }
        try {
          await nav.share({ title: `Quran ${verseKey}`, url: cardUrls.study });
          setShareState('ok');
          setTimeout(() => {
            setShareState('idle');
          }, 1600);
          return;
        } catch {
          /* user cancelled — treat as idle */
        }
      }
      // No native share — copy the link as a graceful fallback
      await copyLink();
      setShareState('idle');
    } catch {
      setShareState('err');
      setTimeout(() => {
        setShareState('idle');
      }, 2000);
    }
  }

  async function copyLink(): Promise<void> {
    setLinkState('busy');
    if (await writeClipboard(cardUrls.study)) {
      setLinkState('ok');
      setTimeout(() => {
        setLinkState('idle');
      }, 1600);
    } else {
      setLinkState('err');
      setTimeout(() => {
        setLinkState('idle');
      }, 2000);
    }
  }

  async function copyImageUrl(): Promise<void> {
    setImgState('busy');
    if (await writeClipboard(cardUrls.abs)) {
      setImgState('ok');
      setTimeout(() => {
        setImgState('idle');
      }, 1600);
    } else {
      setImgState('err');
      setTimeout(() => {
        setImgState('idle');
      }, 2000);
    }
  }

  async function downloadPng(): Promise<void> {
    setDownloadState('busy');
    try {
      const res = await fetch(cardUrls.path);
      if (!res.ok) throw new Error('fetch');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qalaam-${verseKey}-${variant}-${format}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloadState('ok');
      setTimeout(() => {
        setDownloadState('idle');
      }, 1600);
    } catch {
      setDownloadState('err');
      setTimeout(() => {
        setDownloadState('idle');
      }, 2000);
    }
  }

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
        className="bg-paper border-hairline sheet-rise relative flex w-full flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl sm:max-w-3xl sm:rounded-2xl sm:border"
        style={{ maxHeight: '92dvh' }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="bg-paper-300/80 h-1.5 w-12 rounded-full" aria-hidden />
        </div>

        <header className="flex items-baseline justify-between px-5 pb-3 pt-3 sm:px-6 sm:pt-6">
          <div>
            <p className="smallcaps text-leaf text-[11px] tracking-widest">Share ayah</p>
            <h2
              id="share-title"
              className="font-display text-ink-strong font-mono text-2xl tabular-nums sm:text-3xl"
            >
              {verseKey}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-ink-muted hover:text-ink -mr-1 p-2"
          >
            <svg
              width={20}
              height={20}
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

        {/* Composition controls */}
        <div className="border-hairline flex shrink-0 flex-col gap-4 border-b px-5 py-4 sm:px-6">
          {/* Format pill row */}
          <ChipRow label="Format">
            {FORMATS.map((f) => (
              <ChipToggle
                key={f.id}
                active={format === f.id}
                onClick={() => {
                  setFormat(f.id);
                }}
                label={
                  <>
                    {f.label}
                    <span className="text-ink-muted/70 ml-1.5 text-[9px] normal-case tracking-tight">
                      {f.ratio}
                    </span>
                  </>
                }
              />
            ))}
          </ChipRow>

          {/* Variant pill row */}
          <ChipRow label="Content">
            {VARIANTS.map((v) => (
              <ChipToggle
                key={v.id}
                active={variant === v.id}
                onClick={() => {
                  setVariant(v.id);
                }}
                label={v.label}
                title={v.hint}
              />
            ))}
          </ChipRow>

          {/* Toggle switches — show inline only when adding makes sense */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="smallcaps text-ink-muted shrink-0 text-[10px] tracking-widest">
              Insights
            </span>
            <Switch
              label="Transliteration"
              checked={showTransliteration}
              onChange={setShowTransliteration}
            />
            <Switch label="Grammar" checked={showGrammar} onChange={setShowGrammar} />
            <Switch label="Tafsir" checked={showTafsir} onChange={setShowTafsir} />
          </div>
        </div>

        {/* Live preview */}
        <div className="bg-paper-100 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div
            className="bg-paper-200 mx-auto overflow-hidden rounded-md shadow-sm"
            style={{
              maxWidth: format === 'story' ? 320 : 600,
            }}
          >
            <img
              key={cardUrls.path}
              src={cardUrls.path}
              alt={`Shareable card for ${verseKey}`}
              className="block w-full"
              style={{ background: '#1b4d5a' }}
            />
          </div>
          <p className="text-ink-muted/70 mt-2 text-center text-[10px] italic">{cardUrls.path}</p>
        </div>

        {/* Action row */}
        <div className="border-hairline grid shrink-0 grid-cols-2 gap-2 border-t px-5 py-4 sm:grid-cols-4 sm:px-6">
          <ActionButton
            primary
            state={shareState}
            label={{
              idle: 'Share →',
              busy: 'Sharing…',
              ok: 'Shared',
              err: 'Try again',
            }}
            onClick={() => {
              void nativeShare();
            }}
          />
          <ActionButton
            state={downloadState}
            label={{
              idle: 'Download',
              busy: 'Building…',
              ok: 'Saved',
              err: 'Try again',
            }}
            onClick={() => {
              void downloadPng();
            }}
          />
          <ActionButton
            state={linkState}
            label={{
              idle: 'Copy link',
              busy: 'Copying…',
              ok: 'Copied!',
              err: 'Blocked',
            }}
            onClick={() => {
              void copyLink();
            }}
          />
          <ActionButton
            state={imgState}
            label={{
              idle: 'Copy image URL',
              busy: 'Copying…',
              ok: 'Copied!',
              err: 'Blocked',
            }}
            onClick={() => {
              void copyImageUrl();
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ----- Helpers --------------------------------------------------------

async function writeClipboard(text: string): Promise<boolean> {
  // Try the modern API first; fall back to a hidden textarea for
  // older browsers / non-secure contexts where clipboard is undefined.
  try {
    if (window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy execCommand path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    // execCommand('copy') is deprecated but is the only synchronous
    // path that works in non-secure contexts (LAN dev IPs). Suppress
    // the lint warning here only.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function ChipRow({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="smallcaps text-ink-muted w-[68px] shrink-0 text-[10px] tracking-widest">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ChipToggle({
  active,
  onClick,
  label,
  title,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: ReactNode;
  readonly title?: string;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`smallcaps inline-flex items-center rounded-full px-3 py-1.5 text-[11px] tracking-widest transition-colors ${
        active
          ? 'bg-leaf text-paper'
          : 'border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 border'
      }`}
    >
      {label}
    </button>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (b: boolean) => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={() => {
        onChange(!checked);
      }}
      role="switch"
      aria-checked={checked}
      className="group inline-flex items-center gap-2 text-[11px]"
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-leaf' : 'bg-paper-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span
        className={`smallcaps tracking-widest ${
          checked ? 'text-ink' : 'text-ink-muted group-hover:text-leaf'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function ActionButton({
  state,
  label,
  primary,
  onClick,
}: {
  readonly state: ActionState;
  readonly label: { idle: string; busy: string; ok: string; err: string };
  readonly primary?: boolean;
  readonly onClick: () => void;
}): ReactNode {
  const text =
    state === 'busy'
      ? label.busy
      : state === 'ok'
        ? label.ok
        : state === 'err'
          ? label.err
          : label.idle;
  // Visual cue per state: spinner in busy, check in ok, alert in err.
  const icon: ReactNode =
    state === 'busy' ? (
      <SpinnerIcon />
    ) : state === 'ok' ? (
      <CheckIcon />
    ) : state === 'err' ? (
      <AlertIcon />
    ) : null;
  const baseCls =
    'smallcaps inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[11px] tracking-widest transition-all duration-200 disabled:opacity-60';
  const okCls = state === 'ok' ? 'ring-2 ring-leaf/40' : '';
  const errCls = state === 'err' ? 'ring-2 ring-rose-400/60' : '';
  const cls = primary
    ? `${baseCls} bg-leaf text-paper hover:opacity-95 ${okCls} ${errCls}`
    : `${baseCls} border-hairline text-ink-muted hover:text-leaf hover:border-leaf/40 border ${okCls} ${errCls}`;
  return (
    <button type="button" onClick={onClick} disabled={state === 'busy'} className={cls}>
      {icon}
      <span>{text}</span>
    </button>
  );
}

function SpinnerIcon(): ReactNode {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="animate-spin"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon(): ReactNode {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7" x2="12" y2="13" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
    </svg>
  );
}
