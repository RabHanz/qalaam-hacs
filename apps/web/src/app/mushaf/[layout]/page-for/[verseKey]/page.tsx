/**
 * /mushaf/[layout]/page-for/[verseKey] — server-side redirect to the page
 * that contains the given verse, in the chosen layout.
 */
import { redirect } from 'next/navigation';

interface PageProps {
  readonly params: Promise<{ layout: string; verseKey: string }>;
}

export default async function MushafPageForVerse({ params }: PageProps): Promise<never> {
  const { layout, verseKey } = await params;
  const apiBase = process.env.PUBLIC_API_URL ?? 'http://localhost:4111';
  try {
    const res = await fetch(
      `${apiBase}/v1/layouts/${encodeURIComponent(layout)}/by-verse/${encodeURIComponent(verseKey)}`,
      { next: { revalidate: 86400 } },
    );
    if (res.ok) {
      const body = (await res.json()) as { data: { page: number } };
      redirect(`/mushaf/${layout}/${body.data.page.toString()}`);
    }
  } catch {
    /* fall through to page 1 */
  }
  redirect(`/mushaf/${layout}/1`);
}
