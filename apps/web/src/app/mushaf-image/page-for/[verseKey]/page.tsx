/**
 * /mushaf-image/page-for/[verseKey] — server-side redirect that resolves
 * a verse to the image-mushaf page that contains it. Backs the "Open
 * image →" pill in the /read chip-row.
 *
 * Pattern matches /mushaf/[layout]/page-for/[verseKey].
 */
import { redirect } from 'next/navigation';

import { EmptyState } from '../../../../components/EmptyState.js';
import { SiteNav } from '../../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface PageProps {
  readonly params: Promise<{ verseKey: string }>;
}

const LAYOUT_SLUG = 'madani-16';

// Always render per-request — the backend is on the Docker network at
// http://qalaam-backend:4111 and ISN'T running during `next build`,
// so static generation would bake empty/null data. Per-request
// rendering hits the live backend each time.
export const dynamic = 'force-dynamic';

export default async function PageForVerse({ params }: PageProps): Promise<ReactNode> {
  const { verseKey: raw } = await params;
  // Next.js leaves the param percent-encoded when the colon was URL-encoded
  // upstream (`1%3A1`), so decode defensively before validating.
  let verseKey = raw;
  try {
    verseKey = decodeURIComponent(raw);
  } catch {
    /* malformed escape — leave as-is so the regex below rejects it */
  }
  if (!/^[0-9]+:[0-9]+$/.test(verseKey)) {
    return (
      <>
        <SiteNav />
        <div className="mx-auto max-w-3xl px-6 py-20">
          <EmptyState
            title="Bad verse key"
            hint={`Expected format like "2:255". Got "${verseKey}".`}
          />
        </div>
      </>
    );
  }
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  // Retry once on transient (5xx, network) so a momentary backend hiccup
  // (rate limit, restart, dropped socket) doesn't surface as "not found".
  // 404 short-circuits to the empty state — that's a real "not in this
  // mushaf" answer.
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(
        `${apiBase}/v1/image-mushaf/${LAYOUT_SLUG}/page-for/${encodeURIComponent(verseKey)}`,
        { next: { revalidate: 604800 } },
      );
      lastStatus = res.status;
      if (res.ok) {
        const body = (await res.json()) as { page: number };
        redirect(`/mushaf-image/${body.page.toString()}#${verseKey}`);
      }
      if (res.status === 404) break; // legit "not in this mushaf"
      // 5xx or 429 — transient. Brief backoff then retry once.
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      // `redirect()` throws a NEXT_REDIRECT error that must propagate up
      // to Next's runtime — never swallow it.
      if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err;
      // We swallow the actual error message — surfaced as a generic "couldn't
      // reach" hint per task #200 (no internal-tooling references in user copy).
      void err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  const isTransient = lastStatus === 0 || lastStatus >= 500 || lastStatus === 429;
  return (
    <>
      <SiteNav />
      <div className="mx-auto max-w-3xl px-6 py-20">
        <EmptyState
          title={isTransient ? 'Backend not responding' : 'Verse not in this mushaf'}
          hint={
            isTransient
              ? "We couldn't reach the image-mushaf service just now. Please try again in a moment."
              : `Verse ${verseKey} isn't available in the page-image mushaf yet — please try a different verse or layout.`
          }
        />
      </div>
    </>
  );
}
