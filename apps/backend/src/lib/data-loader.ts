/**
 * Process-global QUL reader singleton. Opened lazily on first request.
 *
 * Per ADR-0002: QUL is the canonical local store; QF API is overlay.
 */
import { type QulReader, openQul } from '@qalaam/data-loader/qul';

let cached: QulReader | undefined;

export function getQul(path: string): QulReader {
  cached ??= openQul(path);
  return cached;
}

export function closeQul(): void {
  if (!cached) return;
  cached.close();
  cached = undefined;
}
