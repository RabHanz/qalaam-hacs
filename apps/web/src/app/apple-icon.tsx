/**
 * Apple touch icon — 180×180. iOS home-screen + Safari pin.
 * Same composition as the favicon at higher fidelity, with a tiny
 * gold-foil dot in the upper-right corner — the colophon mark.
 */
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1b4d5a',
        color: '#b6862c',
        fontSize: 132,
        fontWeight: 700,
        fontFamily: 'Georgia, serif',
      }}
    >
      ك
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: '#b6862c',
          opacity: 0.7,
        }}
      />
    </div>,
    size,
  );
}
