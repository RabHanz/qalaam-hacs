/**
 * Stripe billing — checkout + webhook helpers.
 *
 * Env-flagged activation. When STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
 * are unset, every billing endpoint returns a clear 503 "billing not
 * configured" — no half-finished implementations, no silent failures.
 * When env arrives, the same code starts working without a redeploy.
 *
 * NO Stripe SDK dep on purpose. We talk to Stripe via plain fetch +
 * form-encoded bodies. node:crypto handles HMAC-SHA256 signature
 * verification (the only crypto-sensitive moment in the flow).
 *
 * Tier ↔ price mapping is also env-driven so prices can rotate without
 * a code deploy:
 *
 *   STRIPE_PRICE_PREMIUM    price_id for the Premium subscription
 *   STRIPE_PRICE_PRO        price_id for the Pro subscription
 *
 * The webhook handler resolves a Stripe price_id back to the tier on
 * every event, so a price rotation is a one-line env update.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Tier } from '../auth/features.js';

// ─── env-driven config ────────────────────────────────────────────

export interface BillingConfig {
  readonly secretKey: string;
  readonly webhookSecret: string;
  readonly publicUrl: string;
  /** Maps Stripe price_id → tier. Empty when env unset. */
  readonly priceToTier: ReadonlyMap<string, Tier>;
  /** Maps tier → Stripe price_id. Same data, inverse direction. */
  readonly tierToPrice: ReadonlyMap<Tier, string>;
}

let cached: BillingConfig | null = null;

function readEnv(): BillingConfig | null {
  const secretKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();
  const publicUrl = (process.env.BILLING_PUBLIC_URL ?? process.env.PUBLIC_WEB_URL ?? '').trim();
  if (!secretKey || !webhookSecret || !publicUrl) return null;

  const priceToTier = new Map<string, Tier>();
  const tierToPrice = new Map<Tier, string>();
  const premiumPrice = (process.env.STRIPE_PRICE_PREMIUM ?? '').trim();
  if (premiumPrice) {
    priceToTier.set(premiumPrice, 'premium');
    tierToPrice.set('premium', premiumPrice);
  }
  const proPrice = (process.env.STRIPE_PRICE_PRO ?? '').trim();
  if (proPrice) {
    priceToTier.set(proPrice, 'pro');
    tierToPrice.set('pro', proPrice);
  }
  if (priceToTier.size === 0) return null; // no real price mapping → can't transact

  return { secretKey, webhookSecret, publicUrl, priceToTier, tierToPrice };
}

export function getBillingConfig(): BillingConfig | null {
  if (cached) return cached;
  cached = readEnv();
  return cached;
}

/** Force a re-read of env. Used by tests; not by request handlers. */
export function resetBillingConfigCache(): void {
  cached = null;
}

export function isBillingConfigured(): boolean {
  return getBillingConfig() !== null;
}

// ─── webhook signature verification ───────────────────────────────

/**
 * Verify a Stripe webhook signature. Spec:
 *
 *   Stripe-Signature: t=<unix-timestamp>,v1=<hmac-sha256>
 *
 * Compute HMAC_SHA256(webhookSecret, `${t}.${rawBody}`) and compare
 * against v1. Constant-time comparison to defeat timing attacks.
 *
 * Replay defence: reject signatures older than `tolerance` seconds
 * (Stripe-recommended default is 300 / 5 minutes).
 */
export interface WebhookVerifyResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  webhookSecret: string,
  tolerance = 300,
): WebhookVerifyResult {
  if (!signatureHeader) return { ok: false, reason: 'missing-signature' };
  // Parse `t=...,v1=...,v1=...` — Stripe may include multiple v1 sigs.
  const pairs = signatureHeader.split(',');
  let timestamp = 0;
  const sigs: string[] = [];
  for (const p of pairs) {
    const [k, v] = p.split('=');
    if (!k || !v) continue;
    if (k === 't') timestamp = Number.parseInt(v, 10);
    else if (k === 'v1') sigs.push(v);
  }
  if (!timestamp || sigs.length === 0) return { ok: false, reason: 'malformed-signature' };

  // Replay window.
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > tolerance) {
    return { ok: false, reason: 'timestamp-out-of-tolerance' };
  }

  const expected = createHmac('sha256', webhookSecret)
    .update(`${timestamp.toString()}.${rawBody}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  for (const s of sigs) {
    const sBuf = Buffer.from(s, 'utf8');
    if (sBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(expectedBuf, sBuf)) return { ok: true };
  }
  return { ok: false, reason: 'signature-mismatch' };
}

// ─── Stripe REST helpers ──────────────────────────────────────────

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function formEncode(payload: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue;
    params.append(k, String(v));
  }
  return params.toString();
}

interface StripeError {
  error?: { code?: string; message?: string; type?: string };
}

interface CheckoutSessionResponse extends StripeError {
  id?: string;
  url?: string;
}

/**
 * Create a Stripe Checkout Session. Returns the hosted-checkout URL
 * the frontend should redirect to.
 *
 * `clientReferenceId` is the user_id; the webhook receives it back
 * on `checkout.session.completed` so we know which row to bump.
 */
export async function createCheckoutSession(
  cfg: BillingConfig,
  opts: {
    priceId: string;
    customerEmail: string;
    clientReferenceId: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<{ ok: true; url: string; id: string } | { ok: false; reason: string }> {
  const body = formEncode({
    mode: 'subscription',
    'line_items[0][price]': opts.priceId,
    'line_items[0][quantity]': 1,
    customer_email: opts.customerEmail,
    client_reference_id: opts.clientReferenceId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    'subscription_data[metadata][user_id]': opts.clientReferenceId,
    'metadata[user_id]': opts.clientReferenceId,
    allow_promotion_codes: 'true',
  });

  let res: Response;
  try {
    res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (!res.ok) {
    let detail: CheckoutSessionResponse = {};
    try {
      detail = (await res.json()) as CheckoutSessionResponse;
    } catch {
      /* non-JSON body — fall through */
    }
    return { ok: false, reason: detail.error?.message ?? `http-${res.status.toString()}` };
  }
  const json = (await res.json()) as CheckoutSessionResponse;
  if (!json.url || !json.id) return { ok: false, reason: 'malformed-response' };
  return { ok: true, url: json.url, id: json.id };
}
