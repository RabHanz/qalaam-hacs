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

export default async function PageForVerse({ params }: PageProps): Promise<ReactNode> {
  const { verseKey } = await params;
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
  try {
    const res = await fetch(
      `${apiBase}/v1/image-mushaf/${LAYOUT_SLUG}/page-for/${encodeURIComponent(verseKey)}`,
      { next: { revalidate: 604800 } },
    );
    if (res.ok) {
      const body = (await res.json()) as { page: number };
      redirect(`/mushaf-image/${body.page.toString()}#${verseKey}`);
    }
  } catch {
    /* fall through to empty state */
  }
  return (
    <>
      <SiteNav />
      <div className="mx-auto max-w-3xl px-6 py-20">
        <EmptyState
          title="Verse not found in this mushaf"
          hint={`Could not resolve ${verseKey} to a page. Run the image-mushaf ingest if you haven't yet.`}
        />
      </div>
    </>
  );
}
