/**
 * PWA icon — 512×512. Used by the manifest for splash screens and
 * larger home-screen tiles (Android / Chrome OS).
 */
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon512(): ImageResponse {
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
        fontSize: 384,
        fontWeight: 700,
        fontFamily: 'Georgia, serif',
      }}
    >
      ك
    </div>,
    size,
  );
}
