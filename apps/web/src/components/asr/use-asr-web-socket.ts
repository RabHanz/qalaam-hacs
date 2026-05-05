'use client';

/**
 * useAsrWebSocket — opt-in upgrade from browser Web Speech API to the
 * self-hosted Tarteel-tuned ASR worker.
 *
 * Wire protocol (must match `services/asr-worker/src/qalaam_asr_worker/server.py`):
 *   → init    {type:"init", expected_verse_key, expected_text_uthmani, sample_rate, audio_format}
 *   → audio   binary chunks (MediaRecorder webm/opus is what the browser produces)
 *   → end     {type:"end"}
 *   ← partial {type:"partial", transcript, word_results}
 *   ← final   {type:"final", result:{transcript, word_results, ...}}
 *   ← error   {type:"error", code, message}
 *
 * Privacy posture (ADR-0005): audio leaves the browser only over the
 * WebSocket and only to the user-configured worker host. The worker holds
 * the buffer in process memory; nothing is persisted server-side.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type AsrWordStatus = 'pending' | 'matched' | 'mismatch';

export interface AsrWord {
  readonly text: string;
  readonly status: AsrWordStatus;
}

interface RemoteWordResult {
  readonly word_index: number;
  readonly is_match: boolean;
  readonly confidence: number;
}

interface PartialFrame {
  readonly type: 'partial';
  readonly transcript: string;
  readonly word_results: readonly RemoteWordResult[];
}
interface FinalFrame {
  readonly type: 'final';
  readonly result: {
    readonly transcript: string;
    readonly word_results: readonly RemoteWordResult[];
  };
}
interface ErrorFrame {
  readonly type: 'error';
  readonly code: string;
  readonly message: string;
}
type ServerFrame = PartialFrame | FinalFrame | ErrorFrame;

export interface UseAsrWebSocketOpts {
  readonly wsUrl: string | null; // undefined → not configured, hook is dormant
  readonly expectedText: string;
  readonly verseKey: string;
}

export interface UseAsrWebSocketHandle {
  readonly available: boolean;
  readonly listening: boolean;
  readonly transcript: string;
  readonly words: readonly AsrWord[];
  readonly error: string | null;
  readonly start: () => Promise<void>;
  readonly stop: () => void;
}

const MEDIA_RECORDER_TIMESLICE_MS = 750;

export function useAsrWebSocket({
  wsUrl,
  expectedText,
  verseKey,
}: UseAsrWebSocketOpts): UseAsrWebSocketHandle {
  const expectedWords = expectedText.split(/\s+/).filter((w) => w.length > 0);
  const initialWords: readonly AsrWord[] = expectedWords.map((text) => ({
    text,
    status: 'pending' as const,
  }));

  const [words, setWords] = useState<readonly AsrWord[]>(initialWords);
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Re-seed pending state when the verse changes. `initialWords` is
  // recomputed every render off `expectedText`; reseed only on text change
  // so we don't reset progress on every state update.
  useEffect(() => {
    setWords(initialWords);
    setTranscript('');
    setError(null);
  }, [expectedText, initialWords]);

  const cleanup = useCallback(() => {
    try {
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
    } catch {
      /* ignore — recorder may already be inactive */
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => {
      t.stop();
    });
    streamRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'end' }));
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  const applyWordResults = useCallback((results: readonly RemoteWordResult[]) => {
    setWords((prev) => {
      const next = prev.map((w) => ({ ...w }));
      // Mark every expected word that the worker has classified.
      for (const r of results) {
        if (r.word_index < 0 || r.word_index >= next.length) continue;
        const slot = next[r.word_index];
        if (!slot) continue;
        next[r.word_index] = {
          ...slot,
          status: r.is_match ? 'matched' : 'mismatch',
        };
      }
      return next;
    });
  }, []);

  const handleFrame = useCallback(
    (frame: ServerFrame) => {
      if (frame.type === 'partial') {
        setTranscript(frame.transcript);
        applyWordResults(frame.word_results);
      } else if (frame.type === 'final') {
        setTranscript(frame.result.transcript);
        applyWordResults(frame.result.word_results);
        cleanup();
      } else {
        setError(`${frame.code}: ${frame.message}`);
        cleanup();
      }
    },
    [applyWordResults, cleanup],
  );

  const start = useCallback(async () => {
    if (!wsUrl) {
      setError('ASR worker not configured (NEXT_PUBLIC_ASR_WS_URL)');
      return;
    }
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      setError('MediaRecorder is not available in this browser');
      return;
    }
    setError(null);
    setTranscript('');
    setWords(initialWords);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(`microphone permission denied: ${(err as Error).message}`);
      return;
    }
    streamRef.current = stream;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'init',
          expected_verse_key: verseKey,
          expected_text_uthmani: expectedText,
          sample_rate: 16000,
          audio_format: 'webm',
        }),
      );
      // Start MediaRecorder only after init lands so the worker has the
      // expected text by the time the first audio chunk arrives.
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          void ev.data.arrayBuffer().then((buf) => {
            try {
              ws.send(buf);
            } catch {
              /* socket closed mid-flight */
            }
          });
        }
      };
      recorder.onstop = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'end' }));
        }
      };
      recorder.start(MEDIA_RECORDER_TIMESLICE_MS);
      setListening(true);
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      try {
        const frame = JSON.parse(ev.data) as ServerFrame;
        handleFrame(frame);
      } catch {
        /* ignore non-JSON frames */
      }
    };

    ws.onerror = () => {
      setError('asr worker websocket error');
    };
    ws.onclose = () => {
      cleanup();
    };
  }, [wsUrl, expectedText, verseKey, handleFrame, cleanup, initialWords]);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // On unmount: ensure mic + ws are released.
  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup],
  );

  return {
    available: typeof wsUrl === 'string' && wsUrl.length > 0,
    listening,
    transcript,
    words,
    error,
    start,
    stop,
  };
}
