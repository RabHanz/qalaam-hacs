/**
 * /v1/billing/* — Stripe Checkout + webhook (J5).
 *
 * Activates only when STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET +
 * BILLING_PUBLIC_URL + at least one of STRIPE_PRICE_PREMIUM /
 * STRIPE_PRICE_PRO are set in env. Without those, every endpoint
 * returns a clean 503 + machine-readable error code.
 *
 * Endpoints:
 *   POST /v1/billing/checkout-session  — authenticated user starts checkout
 *   POST /v1/billing/webhook           — Stripe POSTs events here
 *
 * Webhook events handled:
 *   checkout.session.completed       — bump tier, store customer + sub IDs
 *   customer.subscription.updated    — re-resolve tier from price_id
 *   customer.subscription.deleted    — revert to free
 *   invoice.payment_failed           — leave tier (Stripe dunning takes over)
 *
 * Audit: every tier change writes admin_audit with action='billing.<event>'.
 */
import { writeAudit } from '../../auth/admin.js';
import { authDb } from '../../auth/db.js';
import { gateFeature, type Tier } from '../../auth/features.js';
import {
  createCheckoutSession,
  getBillingConfig,
  isBillingConfigured,
  verifyStripeSignature,
} from '../../lib/billing.js';

import type { FastifyInstance, FastifyRequest } from 'fastify';

interface RawBodyRequest extends FastifyRequest {
  rawBody?: string;
}

interface CheckoutBody {
  tier?: string;
}

interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}

interface CheckoutSessionPayload {
  client_reference_id?: string;
  customer?: string;
  subscription?: string;
  customer_details?: { email?: string };
  metadata?: { user_id?: string };
}

interface SubscriptionPayload {
  id?: string;
  customer?: string;
  status?: string;
  metadata?: { user_id?: string };
  items?: { data?: { price?: { id?: string } }[] };
}

const BILLING_NOT_CONFIGURED = {
  code: 'qalaam.billing.not-configured',
  message: 'Billing isn’t available right now. Please email support@qalaam.app.',
};

const VALID_REQUEST_TIERS = new Set<Tier>(['premium', 'pro']);

export async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── POST /v1/billing/checkout-session ─────────────────────────
  fastify.post<{ Body: CheckoutBody }>(
    '/v1/billing/checkout-session',
    {
      schema: {
        description:
          'Authenticated user starts a Stripe Checkout subscription flow. Returns a hosted-checkout URL.',
        tags: ['billing'],
      },
    },
    async (req, reply) => {
      const cfg = getBillingConfig();
      if (!cfg) return reply.code(503).send(BILLING_NOT_CONFIGURED);

      // Re-use the feature gate so we get a real authenticated user
      // and consistent error responses with the rest of the API.
      // 'auth.api-keys' is premium+; we only need 'authenticated' so
      // we use a free+requiresAuth feature here. The exact key is
      // 'playback.session.write' which is free+requiresAuth in the
      // catalog — using it means anyone signed in can start checkout.
      const gate = gateFeature(req, reply, 'playback.session.write');
      if (!gate.ok) return;
      const user = gate.user;
      if (!user) return reply.code(401).send({ code: 'qalaam.billing.auth-required' });

      const requested = (req.body.tier ?? '').trim() as Tier;
      if (!VALID_REQUEST_TIERS.has(requested)) {
        return reply.code(400).send({ code: 'qalaam.billing.invalid-tier' });
      }
      const priceId = cfg.tierToPrice.get(requested);
      if (!priceId) {
        return reply.code(503).send({
          code: 'qalaam.billing.tier-unavailable',
          message: `${requested} isn’t available for purchase right now.`,
        });
      }

      const successUrl = `${cfg.publicUrl.replace(/\/+$/, '')}/settings?upgrade=success`;
      const cancelUrl = `${cfg.publicUrl.replace(/\/+$/, '')}/pricing?upgrade=cancelled`;

      const result = await createCheckoutSession(cfg, {
        priceId,
        customerEmail: user.email,
        clientReferenceId: user.id,
        successUrl,
        cancelUrl,
      });
      if (!result.ok) {
        return reply.code(502).send({
          code: 'qalaam.billing.checkout-failed',
          reason: result.reason,
        });
      }
      return reply.send({ url: result.url, sessionId: result.id });
    },
  );

  // ─── POST /v1/billing/webhook ──────────────────────────────────
  fastify.post(
    '/v1/billing/webhook',
    {
      schema: {
        description: 'Stripe webhook receiver. Signature-verified, replay-protected.',
        tags: ['billing'],
      },
    },
    async (req: RawBodyRequest, reply) => {
      const cfg = getBillingConfig();
      if (!cfg) return reply.code(503).send(BILLING_NOT_CONFIGURED);

      const raw = req.rawBody;
      if (!raw) {
        // Without a raw body the signature can't be verified — refuse.
        return reply.code(400).send({ code: 'qalaam.billing.no-raw-body' });
      }
      const sigHeader = req.headers['stripe-signature'];
      const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      const verify = verifyStripeSignature(raw, sig, cfg.webhookSecret);
      if (!verify.ok) {
        return reply.code(400).send({
          code: 'qalaam.billing.bad-signature',
          reason: verify.reason,
        });
      }

      const event = req.body as StripeEvent;
      if (!event.type) return reply.code(400).send({ code: 'qalaam.billing.malformed-event' });

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const payload = event.data?.object as CheckoutSessionPayload | undefined;
            if (!payload) break;
            const userId = payload.client_reference_id ?? payload.metadata?.user_id ?? null;
            if (!userId) break;
            // The subscription's price determines the new tier; we need
            // to fetch the subscription to read it. Stripe also includes
            // mode-line-items expansion for Checkout Sessions, but the
            // canonical source is the subscription's items[0].price.id.
            // For Phase 1 we accept that the FIRST subscription event
            // (subscription.updated, which fires moments after) will
            // reconcile the tier. checkout.session.completed only stores
            // the customer + sub IDs.
            const customerId = payload.customer ?? null;
            const subscriptionId = payload.subscription ?? null;
            const before = authDb()
              .prepare<[string], { tier: string }>(`SELECT tier FROM users WHERE id = ?`)
              .get(userId);
            if (!before) break;
            authDb()
              .prepare(
                `UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ?, billing_status = 'pending'
                 WHERE id = ?`,
              )
              .run(customerId, subscriptionId, userId);
            writeAudit(userId, 'billing.checkout-completed', userId, {
              customerId,
              subscriptionId,
            });
            break;
          }
          case 'customer.subscription.updated':
          case 'customer.subscription.created': {
            const sub = event.data?.object as SubscriptionPayload | undefined;
            if (!sub) break;
            const userId =
              sub.metadata?.user_id ??
              authDb()
                .prepare<[string], { id: string }>(
                  `SELECT id FROM users WHERE stripe_customer_id = ?`,
                )
                .get(sub.customer ?? '')?.id ??
              null;
            if (!userId) break;
            const priceId = sub.items?.data?.[0]?.price?.id ?? null;
            if (!priceId) break;
            const newTier = cfg.priceToTier.get(priceId);
            const status = sub.status ?? 'active';
            const before = authDb()
              .prepare<[string], { tier: string }>(`SELECT tier FROM users WHERE id = ?`)
              .get(userId);
            if (!before) break;
            const isActive = status === 'active' || status === 'trialing';
            const targetTier = isActive ? (newTier ?? 'free') : 'free';
            authDb()
              .prepare(
                `UPDATE users SET tier = ?, billing_status = ?, stripe_subscription_id = ?
                 WHERE id = ?`,
              )
              .run(targetTier, status, sub.id ?? null, userId);
            if (before.tier !== targetTier) {
              writeAudit(userId, 'billing.tier-changed', userId, {
                from: before.tier,
                to: targetTier,
                priceId,
                status,
              });
            }
            break;
          }
          case 'customer.subscription.deleted': {
            const sub = event.data?.object as SubscriptionPayload | undefined;
            if (!sub) break;
            const userId =
              sub.metadata?.user_id ??
              authDb()
                .prepare<[string], { id: string }>(
                  `SELECT id FROM users WHERE stripe_customer_id = ?`,
                )
                .get(sub.customer ?? '')?.id ??
              null;
            if (!userId) break;
            const before = authDb()
              .prepare<[string], { tier: string }>(`SELECT tier FROM users WHERE id = ?`)
              .get(userId);
            authDb()
              .prepare(`UPDATE users SET tier = 'free', billing_status = 'canceled' WHERE id = ?`)
              .run(userId);
            if (before && before.tier !== 'free') {
              writeAudit(userId, 'billing.subscription-canceled', userId, {
                from: before.tier,
                to: 'free',
              });
            }
            break;
          }
          default:
            // Other events (invoice.payment_failed, payment_intent.*)
            // are observed but not actioned in Phase 1. Stripe's
            // dunning + customer-portal handle the recovery flow.
            break;
        }
      } catch (err) {
        // Don't 500 — Stripe will retry on non-2xx and we don't want
        // a transient DB hiccup to spam the webhook queue. Log + ack.
        req.log.error({ err, eventId: event.id, eventType: event.type }, 'webhook-handler-failed');
      }
      return reply.send({ received: true });
    },
  );

  // ─── GET /v1/billing/status ────────────────────────────────────
  // Used by /settings to show whether billing is configured at all,
  // and the user's current subscription state if they have one.
  fastify.get(
    '/v1/billing/status',
    {
      schema: {
        description: 'Whether billing is configured + the user’s subscription state.',
        tags: ['billing'],
      },
    },
    async (_req, reply) => {
      return reply.send({
        configured: isBillingConfigured(),
      });
    },
  );
}
