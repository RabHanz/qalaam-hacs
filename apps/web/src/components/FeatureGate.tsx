'use client';

/**
 * FeatureGate — UX-only wrapper that hides or replaces children
 * based on whether the current user has access to a feature.
 *
 * SECURITY MODEL: this is **purely cosmetic**. The server gates
 * every premium endpoint via requireFeature/gateFeature in
 * apps/backend/src/auth/features.ts. Hiding a button here does not
 * prevent a crafted curl call. Anti-bypass is on the server.
 *
 * Usage:
 *
 *   <FeatureGate feature="family.heatmap">
 *     <MistakeHeatmap userId={…} />
 *   </FeatureGate>
 *
 *   <FeatureGate feature="family.khatm" fallback={<UpgradeCard feature="family.khatm" />}>
 *     <KhatmList />
 *   </FeatureGate>
 *
 * Default fallback is `null` — gated child is silently hidden.
 * Pass an explicit fallback to surface an upgrade-CTA card.
 */
import Link from 'next/link';

import { FALLBACK_CATALOG, tierLabel, type FeatureKey } from '../lib/features.js';
import { useUser } from '../lib/use-user.js';

import type { ReactNode } from 'react';

interface Props {
  readonly feature: FeatureKey;
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
  /** Skip the auto-fallback rendering when status is 'loading'. Useful
   *  when the parent component already shows its own skeleton and a
   *  child blink would be jarring. Defaults to false (renders fallback
   *  during load to fail-closed). */
  readonly hideOnLoad?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback = null,
  hideOnLoad = false,
}: Props): ReactNode {
  const { status, hasFeature } = useUser();
  if (status === 'loading' && hideOnLoad) return null;
  if (hasFeature(feature)) return <>{children}</>;
  return <>{fallback}</>;
}

/**
 * UpgradeCard — convenience fallback that surfaces a tier-aware
 * upgrade prompt. Generic enough to use anywhere a premium feature
 * is gated; the customer-voice label comes from the catalog.
 */
export function UpgradeCard({ feature }: { readonly feature: FeatureKey }): ReactNode {
  const { user } = useUser();
  const spec = FALLBACK_CATALOG[feature];
  const required = tierLabel(spec.minTier);
  const isAnon = !user;
  return (
    <div className="border-hairline bg-surface rounded-2xl border p-6">
      <p className="smallcaps text-leaf text-[10px] tracking-[0.22em]">{required} feature</p>
      <h3
        className="text-ink-strong mt-2 text-lg"
        style={{ fontFamily: 'Fraunces, Georgia, serif' }}
      >
        {spec.label}
      </h3>
      <p className="text-ink-muted mt-2 max-w-[60ch] text-sm leading-relaxed">
        {isAnon
          ? `Sign in and upgrade to ${required} to unlock ${spec.label.toLowerCase()}.`
          : `Upgrade to ${required} to unlock ${spec.label.toLowerCase()}.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/pricing" className="btn-primary text-sm">
          See plans
        </Link>
        {isAnon ? (
          <Link href="/signin" className="btn-ghost text-sm">
            Sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
