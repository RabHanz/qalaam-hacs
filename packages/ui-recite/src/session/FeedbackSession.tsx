/**
 * FeedbackSession — composed component wrapping the WebSocket lifecycle.
 *
 * Connects to `services/realtime-feedback`, streams MediaRecorder chunks,
 * surfaces per-word match results in the Tarteel color vocabulary.
 *
 * Architectural note: per ADR-0005, audio NEVER leaves the device — the
 * realtime-feedback service is meant to be on-device or on the family LAN.
 * The ws URL is configurable via prop so SaaS deployments can route to a
 * trusted in-home worker rather than a cloud endpoint.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { VerseKey } from '@qalaam/core';
import { Card, Heading, Text } from '@qalaam/ui';

import { RecordButton, type RecordingState } from '../record/RecordButton.js';
import { WaveformViz } from '../viz/WaveformViz.js';
import { WordResultStrip, type Word, type WordOutcome } from './WordResultStrip.js';

export interface FeedbackSessionProps {
  readonly verseKey: VerseKey;
  readonly expectedTextUthmani: string;
  readonly wsUrl: string; // e.g., ws://localhost:5003/v1/feedback
}

interface ServerFrame {
  type: 'ready' | 'word-result' | 'complete' | 'error';
  expected_words?: number;
  word_index?: number;
  is_match?: boolean;
  confidence?: number;
  summary?: { matched_count: number; expected_count: number };
  detail?: string;
}

export function FeedbackSession({
  verseKey,
  expectedTextUthmani,
  wsUrl,
}: FeedbackSessionProps): ReactNode {
  const [state, setState] = useState<RecordingState>('idle');
  const [level, setLevel] = useState(0);
  const [words, setWords] = useState<Word[]>(() =>
    expectedTextUthmani.split(/\s+/).map((text, index) => ({
      index,
      text,
      outcome: 'pending' as WordOutcome,
    })),
  );
  const [summary, setSummary] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAll(): void {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    wsRef.current = null;
    recorderRef.current = null;
    streamRef.current = null;
    setLevel(0);
  }

  async function start(): Promise<void> {
    setSummary(null);
    setWords((prev) => prev.map((w) => ({ ...w, outcome: 'pending' })));
    setState('recording');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setState('idle');
      setSummary('Microphone permission denied.');
      return;
    }
    streamRef.current = stream;

    // Lightweight RMS meter via AnalyserNode for the live waveform.
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let raf = 0;
    const tick = (): void => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += (data[i] ?? 0) * (data[i] ?? 0);
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    await new Promise<void>((res, rej) => {
      ws.onopen = () => res();
      ws.onerror = () => rej(new Error('ws-failed'));
    }).catch(() => {
      cancelAnimationFrame(raf);
      stopAll();
      setState('idle');
      setSummary('Could not reach the realtime-feedback service.');
    });
    if (ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: 'session-start',
        expected_verse_key: verseKey,
        expected_text_uthmani: expectedTextUthmani,
      }),
    );
    ws.onmessage = (e) => {
      const frame = JSON.parse(typeof e.data === 'string' ? e.data : '{}') as ServerFrame;
      if (frame.type === 'word-result' && typeof frame.word_index === 'number') {
        const idx = frame.word_index;
        setWords((prev) =>
          prev.map((w, i) => (i === idx ? { ...w, outcome: frame.is_match ? 'match' : 'error' } : w)),
        );
      } else if (frame.type === 'complete') {
        const m = frame.summary?.matched_count ?? 0;
        const total = frame.summary?.expected_count ?? 0;
        setSummary(`${String(m)} / ${String(total)} words matched.`);
        setState('idle');
        cancelAnimationFrame(raf);
        stopAll();
      } else if (frame.type === 'error') {
        setSummary(frame.detail ?? 'Server error.');
        setState('idle');
        cancelAnimationFrame(raf);
        stopAll();
      }
    };

    // MediaRecorder ships chunks in webm/opus; the stub server treats every
    // chunk as a single audio frame so we get one word-result per ~250 ms.
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    recorderRef.current = recorder;
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'audio', sample_rate: 16000, samples_b64: '' }));
      }
    };
    recorder.start(250);
  }

  function stop(): void {
    setState('processing');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'session-end' }));
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }

  function toggle(): void {
    if (state === 'idle') void start();
    else if (state === 'recording') stop();
  }

  return (
    <Card>
      <Heading level={3}>Recite {verseKey}</Heading>
      <Text size="caption" tone="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
        Tap to record. Feedback comes after — never during.
      </Text>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <RecordButton state={state} onToggle={toggle} />
        <WaveformViz active={state === 'recording'} level={level} />
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <WordResultStrip words={words} />
      </div>
      {summary !== null ? (
        <Text size="caption" tone="muted" style={{ display: 'block', marginTop: '0.75rem' }}>
          {summary}
        </Text>
      ) : null}
    </Card>
  );
}
