/**
 * Password hashing — scrypt (Node built-in) at OWASP 2026-recommended
 * parameters. No external deps; argon2 / bcrypt would need a native
 * binding that breaks on aarch64 + alpine container builds.
 *
 * Format on disk:  scrypt$N$r$p$<salt-b64>$<hash-b64>
 *
 * Verification is timing-safe via crypto.timingSafeEqual.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// OWASP 2024-recommended scrypt: N=2^14 (16384), r=8, p=1. Node's
// default scrypt memory ceiling is 32MB which N=32768 blows; keeping
// N=16384 gives us ~16MB peak per hash, safely within budget.
// `maxmem: 64 * 1024 * 1024` is set explicitly so we have headroom
// for verification of legacy hashes if we bump params later.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function hashPassword(password: string): string {
  if (!password || password.length < 8) {
    throw new Error('password too short (min 8 chars)');
  }
  if (password.length > 256) {
    // Defence against scrypt-resource-exhaustion via giant inputs.
    throw new Error('password too long (max 256 chars)');
  }
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password.normalize('NFKC'), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    'scrypt',
    N.toString(),
    R.toString(),
    P.toString(),
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!password || !stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  // Defence-in-depth: type assertions narrowed via length check above.
  if (!nStr || !rStr || !pStr || !saltB64 || !hashB64) return false;
  const n = Number.parseInt(nStr, 10);
  const r = Number.parseInt(rStr, 10);
  const p = Number.parseInt(pStr, 10);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  // Hard caps so a malicious stored hash can't trigger DoS during
  // verification. Max N=2^17, r=16, p=4 — generous bounds for future
  // params upgrades.
  if (n > 1 << 17 || r > 16 || p > 4) return false;
  let salt: Buffer;
  let target: Buffer;
  try {
    salt = Buffer.from(saltB64, 'base64');
    target = Buffer.from(hashB64, 'base64');
  } catch {
    return false;
  }
  const computed = scryptSync(password.normalize('NFKC'), salt, target.length, {
    N: n,
    r,
    p,
    maxmem: SCRYPT_MAXMEM,
  });
  if (computed.length !== target.length) return false;
  return timingSafeEqual(computed, target);
}
