/**
 * PWA icon — 512×512 maskable. The manifest declares purpose:
 * 'maskable' so Android can crop this into circle / squircle / rounded-
 * square home-screen variants without clipping the glyph. Maskable
 * icons need a "safe zone" — the meaningful content lives in the
 * inner 80% so the OS-imposed mask never crops the kaaf.
 */
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon512Maskable(): ImageResponse {
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
        fontSize: 280,
        fontWeight: 700,
        fontFamily: 'Georgia, serif',
      }}
    >
      ك
    </div>,
    size,
  );
}
