/**
 * Favicon — 32×32. Generated at build time via Next.js's app/icon
 * convention. The glyph is "ك" (kaaf, first letter of Qalaam) in
 * leaf-gold on a deep paper background — a small homage to a
 * gold-foil-on-paper colophon rather than a generic "Q" letter.
 */
import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1b4d5a',
        color: '#b6862c',
        fontSize: 24,
        fontWeight: 700,
        fontFamily: 'Georgia, serif',
      }}
    >
      ك
    </div>,
    size,
  );
}
