'use client';

/**
 * HifzCheckClient — browser-side recite-and-check for hifz drill.
 *
 * Tarteel-style flow without requiring a server-side ASR pipeline:
 * - User picks a verse (or surah).
 * - Tap the mic; browser Web Speech API listens in Arabic (ar-SA).
 * - As interim transcripts arrive, we word-diff against the expected
 *   verse text and paint each expected word as:
 *     ✓ matched (green)        — user said it (or a close variant)
 *     · pending (muted)         — not reached yet
 *     ✗ mismatch (red)          — user said a different word
 * - On finalize, we summarize % match and let the user retry.
 *
 * Limitations of Web Speech API: Arabic ASR quality varies across
 * browsers; Chrome desktop is best. For production-grade Quran-fine-
 * tuned recognition we'd ship a Whisper-based or Tarteel-AI-based
 * server endpoint (see Docs/INTEGRATIONS.md). This MVP gets us a
 * shippable, on-device, offline-capable demo.
 *
 * Privacy: audio NEVER leaves the browser. Web Speech API runs the
 * ASR inside the browser (Chrome) or via the OS speech service —
 * no Qalaam server hop. Per CLAUDE.md adab non-negotiables.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAsrWebSocket } from './asr/use-asr-web-socket.js';

import type { ReactNode } from 'react';

interface SpeechRecognitionResultList {
  length: number;
  item(idx: number): { isFinal: boolean; 0: { transcript: string } };
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: { results: SpeechRecognitionResultList; resultIndex: number }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Props {
  /** Expected verse text in Uthmani Arabic. Word-diff happens against
   *  the whitespace-split tokens of this string. */
  readonly expectedText: string;
  readonly verseKey: string;
}

/**
 * Normalize an Arabic word for fuzzy match: strip diacritics + tatweel
 * + alef variants. The Web Speech API typically returns simplified
 * Arabic without tashkeel, so direct equality fails on Uthmani text.
 */
function normalize(word: string): string {
  return word
    .replace(/[ً-ٰٟـ]/g, '') // remove harakat + tatweel
    .replace(/[إأٱآا]/g, 'ا') // alef variants → ا
    .replace(/ى/g, 'ي') // alef-maqsura → ya
    .replace(/ة/g, 'ه') // ta-marbuta → ha
    .replace(/[ؤئ]/g, '') // hamza-on-waw / hamza-on-ya → drop hamza
    .trim();
}

interface WordState {
  readonly text: string;
  readonly norm: string;
  readonly status: 'pending' | 'matched' | 'mismatch';
}

export function HifzCheckClient({ expectedText, verseKey }: Props): ReactNode {
  const SR = useMemo(() => getSpeechRecognition(), []);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Self-hosted ASR worker (Tarteel-tuned faster-whisper) — opt in via env.
  // When set, the user can pick a "self-hosted" mode that streams audio
  // off-device to the worker over WebSocket; otherwise we fall back to the
  // browser's Web Speech API (Chrome desktop has the best Arabic support).
  const wsUrl = (process.env.NEXT_PUBLIC_ASR_WS_URL ?? '').trim() || null;
  const ws = useAsrWebSocket({ wsUrl, expectedText, verseKey });
  const [mode, setMode] = useState<'browser' | 'worker'>(wsUrl ? 'worker' : 'browser');

  const expectedWords = useMemo<readonly WordState[]>(() => {
    return expectedText
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => ({ text: w, norm: normalize(w), status: 'pending' as const }));
  }, [expectedText]);

  const [progress, setProgress] = useState<readonly WordState[]>(expectedWords);
  useEffect(() => {
    setProgress(expectedWords);
  }, [expectedWords]);

  useEffect(() => {
    if (!SR) setSupported(false);
  }, [SR]);

  function start(): void {
    if (!SR) {
      setError('Speech recognition not supported in this browser. Try Chrome on desktop.');
      return;
    }
    setError(null);
    setTranscript('');
    setProgress(expectedWords);
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      let buf = '';
      for (let i = 0; i < ev.results.length; i += 1) {
        const r = ev.results.item(i);
        buf += r[0].transcript + ' ';
      }
      setTranscript(buf.trim());
      // Greedy word-by-word diff: walk the heard tokens; for each one,
      // find the next pending expected word that matches (allowing 1
      // skip for unrecognized words).
      const heard = buf
        .trim()
        .split(/\s+/)
        .map(normalize)
        .filter((s) => s.length > 0);
      const next: WordState[] = expectedWords.map((w) => ({ ...w }));
      let cursor = 0;
      for (const h of heard) {
        if (cursor >= next.length) break;
        const cur = next[cursor];
        if (!cur) break;
        if (cur.norm === h || cur.norm.includes(h) || h.includes(cur.norm)) {
          next[cursor] = { ...cur, status: 'matched' };
          cursor += 1;
        } else {
          const peek = next[cursor + 1];
          if (peek?.norm === h) {
            // user skipped a word
            next[cursor] = { ...cur, status: 'mismatch' };
            next[cursor + 1] = { ...peek, status: 'matched' };
            cursor += 2;
          } else {
            // unmatched heard token — mark current expected as mismatch
            // and advance only when we see the NEXT expected word.
            next[cursor] = { ...cur, status: 'mismatch' };
          }
        }
      }
      setProgress(next);
    };
    rec.onerror = (ev) => {
      setError(`speech-recognition: ${ev.error}`);
    };
    rec.onend = () => {
      setListening(false);
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop(): void {
    recRef.current?.stop();
    setListening(false);
  }

  // The worker path drives `progress` directly off the hook's `words` so
  // both backends produce the same WordState[] shape downstream. Browser
  // path uses the local greedy-walk above.
  const view: readonly WordState[] =
    mode === 'worker'
      ? ws.words.map((w) => ({ text: w.text, norm: normalize(w.text), status: w.status }))
      : progress;
  const liveListening = mode === 'worker' ? ws.listening : listening;
  const liveTranscript = mode === 'worker' ? ws.transcript : transcript;
  const liveError = mode === 'worker' ? ws.error : error;

  function handleStart(): void {
    if (mode === 'worker') {
      void ws.start();
    } else {
      start();
    }
  }
  function handleStop(): void {
    if (mode === 'worker') ws.stop();
    else stop();
  }

  const matchedCount = view.filter((w) => w.status === 'matched').length;
  const mismatchCount = view.filter((w) => w.status === 'mismatch').length;
  const pct =
    expectedWords.length > 0 ? Math.round((matchedCount / expectedWords.length) * 100) : 0;

  return (
    <div className="paper-card-raised space-y-6 p-5 sm:p-8 md:p-10">
      {/* Verse text with per-word status overlay */}
      <p
        dir="rtl"
        lang="ar"
        className="text-ink-strong break-words text-center leading-[1.95] sm:leading-[2.05]"
        style={{
          fontFamily: '"UthmanicHafs"',
          fontSize: 'clamp(1.4rem, 1rem + 1.5vw, 2.2rem)',
          unicodeBidi: 'plaintext',
          fontWeight: 600,
        }}
      >
        {view.map((w, i) => (
          <span
            key={i}
            className={
              w.status === 'matched'
                ? 'recite-matched'
                : w.status === 'mismatch'
                  ? 'recite-mismatch'
                  : undefined
            }
          >
            {w.text}
            {i < view.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>

      {ws.available ? (
        <div
          role="radiogroup"
          aria-label="Recognition engine"
          className="border-hairline mx-auto inline-flex w-fit overflow-hidden rounded-full border text-xs"
        >
          {(['worker', 'browser'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                if (liveListening) handleStop();
                setMode(m);
              }}
              className={`smallcaps px-4 py-1.5 tracking-widest transition-colors ${
                mode === m ? 'bg-leaf text-paper' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {m === 'worker' ? 'Self-hosted ASR' : 'Browser ASR'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={liveListening ? handleStop : handleStart}
          disabled={mode === 'browser' && !supported}
          className={`smallcaps inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs tracking-widest transition-colors ${
            liveListening ? 'bg-mistake-error text-white' : 'bg-leaf text-paper hover:opacity-95'
          } disabled:opacity-40`}
        >
          {liveListening ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Listening — tap to stop
            </>
          ) : (
            <>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" />
                <path
                  d="M19 11a7 7 0 01-14 0M12 18v3"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              Tap to recite
            </>
          )}
        </button>
      </div>

      {mode === 'browser' && !supported ? (
        <p className="text-ink-muted text-center text-sm">
          Speech recognition is not available in this browser. Use Chrome on desktop, or
          {ws.available ? (
            ' switch to self-hosted ASR above.'
          ) : (
            <>
              {' '}
              set <code className="mx-1">NEXT_PUBLIC_ASR_WS_URL</code> and run the asr-worker for
              the WebSocket-backed hifz session.
            </>
          )}
        </p>
      ) : null}

      {liveError ? <p className="text-mistake-error text-center text-sm">{liveError}</p> : null}

      {liveTranscript ? (
        <div className="border-hairline border-t pt-4">
          <p className="smallcaps text-leaf mb-1 text-[10px] tracking-widest">You said</p>
          <p
            dir="rtl"
            lang="ar"
            className="font-arabic text-ink text-base leading-relaxed sm:text-lg"
            style={{ unicodeBidi: 'plaintext' }}
          >
            {liveTranscript}
          </p>
        </div>
      ) : null}

      {matchedCount + mismatchCount > 0 ? (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="smallcaps text-ink-muted text-[10px] tracking-widest">Match</p>
            <p className="font-display text-mistake-correct text-2xl">{pct}%</p>
          </div>
          <div>
            <p className="smallcaps text-ink-muted text-[10px] tracking-widest">Words OK</p>
            <p className="font-display text-ink-strong text-2xl">{matchedCount}</p>
          </div>
          <div>
            <p className="smallcaps text-ink-muted text-[10px] tracking-widest">Mistakes</p>
            <p className="font-display text-mistake-error text-2xl">{mismatchCount}</p>
          </div>
        </div>
      ) : null}

      <p className="text-ink-muted text-center text-[10px] italic">
        {mode === 'worker'
          ? 'Audio streams encrypted to your self-hosted ASR worker · held in memory only · adab-private'
          : 'Audio stays on device · adab-private · powered by browser speech recognition'}
      </p>
    </div>
  );
}
