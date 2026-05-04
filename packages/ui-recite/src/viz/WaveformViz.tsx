'use client';

/**
 * WaveformViz — compact bar visualizer.
 *
 * During recording: bars animate driven by live RMS values.
 * After: bars settle into a static low-amplitude state.
 *
 * Reduced-motion users see a static, single-bar fill instead.
 */
import { useReducedMotion } from '@qalaam/ui';
import { useEffect, useRef } from 'react';

import type { ReactNode } from 'react';


export interface WaveformVizProps {
  readonly active: boolean;
  /** Current RMS level [0..1]. Pull from a parent that wraps an AudioWorklet. */
  readonly level: number;
  readonly bars?: number;
}

export function WaveformViz({ active, level, bars = 24 }: WaveformVizProps): ReactNode {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Maintain a small ring buffer of recent levels so bars look like a waveform.
  const historyRef = useRef<number[]>(Array.from({ length: bars }, () => 0));

  useEffect(() => {
    historyRef.current.shift();
    historyRef.current.push(level);
    const el = containerRef.current;
    if (!el) return;
    const children = el.children;
    for (let i = 0; i < children.length; i += 1) {
      const v = historyRef.current[i] ?? 0;
      const h = Math.max(2, Math.round((reduced ? level : v) * 36));
      const child = children[i];
      if (child instanceof HTMLElement) child.style.height = `${h.toString()}px`;
    }
  }, [level, reduced]);

  return (
    <div
      ref={containerRef}
      role="presentation"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '3px',
        height: '40px',
        padding: '0.5rem 0',
        opacity: active ? 1 : 0.5,
      }}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
           
          key={i}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '4px',
            height: '4px',
            background: 'var(--color-teal-500, #1b4d5a)',
            borderRadius: '2px',
            transition: reduced ? 'none' : 'height 80ms ease-out',
          }}
        />
      ))}
    </div>
  );
}
