/**
 * PWA icon — 192×192. Used by the manifest for Android / Chrome OS
 * home-screen and "Add to home screen" prompts.
 */
import { ImageResponse } from 'next/og';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon192(): ImageResponse {
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
        fontSize: 144,
        fontWeight: 700,
        fontFamily: 'Georgia, serif',
      }}
    >
      ك
    </div>,
    size,
  );
}
