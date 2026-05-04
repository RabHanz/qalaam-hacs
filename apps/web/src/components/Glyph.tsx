/**
 * Hand-drawn geometric glyph set used throughout Qalaam.
 *
 * No emoji, no Material icons, no Lucide. Custom inline SVG that fits the
 * editorial-scripture aesthetic. Each glyph is monochromatic (currentColor)
 * so it inherits whatever color the surrounding text uses.
 */
import type { ReactNode } from 'react';

interface GlyphProps {
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
  readonly title?: string;
}

/**
 * Eight-pointed rosette — used as ayah-end marker. Inspired by manuscript
 * illumination but reduced to a hairline glyph.
 */
export function RosetteGlyph({ size = 22, strokeWidth = 1, className, title }: GlyphProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth={strokeWidth} />
      <path
        d="M12 2.5 L13.4 9.4 L20.5 8.4 L15.6 13.6 L20.5 18.8 L13.4 17.8 L12 24.7 L10.6 17.8 L3.5 18.8 L8.4 13.6 L3.5 8.4 L10.6 9.4 Z"
        stroke="currentColor"
        strokeWidth={strokeWidth * 0.7}
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

/** A small pestle / lozenge mark — used as section divider. */
export function LozengeGlyph({ size = 12, className }: GlyphProps): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden className={className}>
      <path d="M6 1 L11 6 L6 11 L1 6 Z" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M6 4 L8 6 L6 8 L4 6 Z" fill="currentColor" />
    </svg>
  );
}

/** Open-book glyph — for "Read" navigation, etc. */
export function BookGlyph({ size = 18, strokeWidth = 1.4, className }: GlyphProps): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M3 5 C 6 4 10 4.5 12 6 C 14 4.5 18 4 21 5 L 21 19 C 18 18 14 18.5 12 20 C 10 18.5 6 18 3 19 Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M12 6 V 20"
        stroke="currentColor"
        strokeWidth={strokeWidth * 0.7}
        opacity="0.5"
      />
    </svg>
  );
}

/** Crescent waxing — used for "Listen" / night mode. */
export function CrescentGlyph({ size = 18, strokeWidth = 1.4, className }: GlyphProps): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M16 4 A 9 9 0 1 0 16 20 A 7 7 0 1 1 16 4 Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
      />
    </svg>
  );
}

/** Thread / ribbon — for "Hifdh" (literally a thread of memorization). */
export function ThreadGlyph({ size = 18, strokeWidth = 1.4, className }: GlyphProps): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M3 12 C 6 8 9 16 12 12 C 15 8 18 16 21 12"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="3" cy="12" r="1.6" fill="currentColor" />
      <circle cx="21" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** Lantern / lamp — for "Learn" (illumination). */
export function LanternGlyph({ size = 18, strokeWidth = 1.4, className }: GlyphProps): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M9 4 H 15 L 18 8 V 17 C 18 18.5 16.5 20 12 20 C 7.5 20 6 18.5 6 17 V 8 Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path d="M10 12 V 16" stroke="currentColor" strokeWidth={strokeWidth * 0.7} />
      <path d="M14 12 V 16" stroke="currentColor" strokeWidth={strokeWidth * 0.7} />
    </svg>
  );
}

/** Tiny arabic-style hairline rule — used as section divider. */
export function HairlineDivider({ className }: { className?: string }): ReactNode {
  return (
    <div
      role="presentation"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        margin: '1rem 0',
        color: 'var(--color-leaf-500)',
        opacity: 0.7,
      }}
    >
      <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.35 }} />
      <LozengeGlyph size={10} />
      <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.35 }} />
    </div>
  );
}
