'use client';

/**
 * MemberAvatar — initial-circle for a family member.
 *
 * Uses the avatar_color from the user row when available, else falls
 * back to a stable hash of the displayName so the same person renders
 * the same hue across surfaces. Sizes scale via prop.
 */
import type { ReactNode } from 'react';

interface Props {
  readonly displayName: string;
  readonly avatarColor?: string | null;
  readonly size?: number;
  readonly subtle?: boolean;
}

const FALLBACK_PALETTE = ['c8a04a', '6b8e8a', 'a35a3b', '4a6b8a', '8a6b4a', '6b4a8a'];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickColor(name: string, supplied: string | null | undefined): string {
  if (supplied && /^[0-9a-fA-F]{6}$/.test(supplied)) return supplied;
  return FALLBACK_PALETTE[hashName(name) % FALLBACK_PALETTE.length] ?? 'c8a04a';
}

function initial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Q';
  const cp = trimmed.codePointAt(0);
  return cp === undefined ? 'Q' : String.fromCodePoint(cp).toUpperCase();
}

export function MemberAvatar({
  displayName,
  avatarColor,
  size = 40,
  subtle = false,
}: Props): ReactNode {
  const hex = pickColor(displayName, avatarColor);
  const bg = subtle ? `#${hex}22` : `#${hex}33`;
  const fg = `#${hex}`;
  const border = `1px solid #${hex}55`;
  const fontSize = Math.round(size * 0.42);
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        border,
        fontFamily: 'Fraunces, Georgia, serif',
        fontWeight: 600,
        fontSize,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {initial(displayName)}
    </span>
  );
}
