'use client';

/**
 * ShazamClient — voice-search via Web Speech API + /v1/search.
 *
 * Pipeline:
 *   1. User taps the mic (push-to-talk; we never stay listening).
 *   2. Browser SpeechRecognition transcribes Arabic in-browser.
 *   3. Each interim transcript → debounced /v1/search call.
 *   4. Top-5 verse hits render as paper-cards.
 *
 * Privacy: audio NEVER leaves the browser. Web Speech API runs the ASR
 * inside the browser (Chrome) or the OS speech service. Per ADR-0005.
 *
 * Fallback: when SpeechRecognition is unavailable, exposes a manual
 * Arabic input that hits the same search route.
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveApiBase } from '../lib/api-base.js';

import { HighlightedSnippet } from './HighlightedSnippet.js';

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

interface SearchHit {
  readonly verseKey: string;
  readonly surah: number;
  readonly ayah: number;
  readonly text: string;
  readonly snippet: string;
  readonly score: number;
}

export function ShazamClient(): ReactNode {
  const apiBase = resolveApiBase();
  const SR = useMemo(() => getSpeechRecognition(), []);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState<readonly SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!SR) setSupported(false);
  }, [SR]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const url = new URL(`${apiBase}/v1/search`);
        url.searchParams.set('q', trimmed);
        url.searchParams.set('limit', '5');
        const res = await fetch(url.toString());
        if (!res.ok) {
          setResults([]);
          return;
        }
        const body = (await res.json()) as { verses: readonly SearchHit[] };
        setResults(body.verses);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [apiBase],
  );

  function start(): void {
    if (!SR) return;
    setTranscript('');
    setResults([]);
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      let buf = '';
      for (let i = 0; i < ev.results.length; i += 1) {
        const r = ev.results.item(i);
        buf += `${r[0].transcript} `;
      }
      const final = buf.trim();
      setTranscript(final);
      // Debounce search calls — fire once user has been silent for ~600ms.
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        void runSearch(final);
      }, 600);
    };
    rec.onerror = () => {
      setListening(false);
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

  function manualSubmit(e: React.SyntheticEvent<HTMLFormElement>): void {
    e.preventDefault();
    void runSearch(manualQuery);
  }

  return (
    <div className="space-y-6">
      <section className="paper-card-raised p-6 text-center sm:p-8">
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={!supported}
          className={`smallcaps inline-flex touch-manipulation items-center justify-center gap-3 rounded-full px-7 py-4 text-sm tracking-widest transition-colors ${
            listening ? 'bg-mistake-error text-white' : 'bg-leaf text-paper hover:opacity-95'
          } disabled:opacity-40`}
        >
          {listening ? (
            <>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
              Listening — tap to stop
            </>
          ) : (
            <>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
        {!supported ? (
          <p className="text-ink-muted mt-4 text-xs">
            Speech recognition is unavailable in this browser. Type a phrase below instead.
          </p>
        ) : null}
        {transcript ? (
          <p
            dir="rtl"
            lang="ar"
            className="text-ink-strong mt-4 text-lg leading-relaxed sm:text-xl"
            style={{
              fontFamily: '"UthmanicHafs"',
              unicodeBidi: 'plaintext',
              fontWeight: 600,
            }}
          >
            {transcript}
          </p>
        ) : null}
      </section>

      <form onSubmit={manualSubmit} className="paper-card flex items-center gap-2 p-4 sm:p-5">
        <input
          type="search"
          value={manualQuery}
          onChange={(e) => {
            setManualQuery(e.target.value);
          }}
          placeholder="Or type any Arabic phrase…"
          dir="rtl"
          lang="ar"
          className="border-hairline bg-paper-100 text-ink placeholder:text-ink-muted focus:border-leaf flex-1 rounded-full border px-4 py-2 text-base focus:outline-none"
        />
        <button
          type="submit"
          className="bg-leaf text-paper smallcaps rounded-full px-4 py-2 text-xs tracking-widest hover:opacity-95"
        >
          Find
        </button>
      </form>

      {searching ? <p className="text-ink-muted text-center text-sm italic">Searching…</p> : null}

      {results.length > 0 ? (
        <section aria-labelledby="shazam-results">
          <div className="border-hairline mb-4 flex items-baseline justify-between border-b pb-2">
            <h2 id="shazam-results" className="font-display text-ink-strong text-lg">
              Top matches
            </h2>
            <p className="smallcaps text-ink-muted text-[10px] tracking-widest">
              {results.length.toString()} verses
            </p>
          </div>
          <ol className="m-0 list-none space-y-3 p-0">
            {results.map((r) => (
              <li key={r.verseKey}>
                <Link
                  href={`/study/${r.surah.toString()}/${r.ayah.toString()}`}
                  className="paper-card hover-rise block px-5 py-4"
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="smallcaps text-ink-muted font-mono text-[10px] tabular-nums tracking-widest">
                      {r.verseKey}
                    </span>
                    <span className="smallcaps text-leaf text-[10px] tracking-widest">study →</span>
                  </div>
                  <p
                    dir="rtl"
                    lang="ar"
                    className="text-ink-strong leading-[1.95]"
                    style={{
                      fontFamily: '"UthmanicHafs"',
                      fontSize: 'clamp(1.05rem, 0.85rem + 0.6vw, 1.35rem)',
                      unicodeBidi: 'plaintext',
                      fontWeight: 600,
                    }}
                  >
                    <HighlightedSnippet text={r.snippet} fallback={r.text} />
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="text-ink-muted text-center text-[10px] italic">
        Audio stays on device · adab-private · powered by browser speech recognition + FTS5 BM25
      </p>
    </div>
  );
}
