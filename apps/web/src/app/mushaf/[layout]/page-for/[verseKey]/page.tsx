/**
 * /mushaf/[layout]/page-for/[verseKey] — server-side redirect to the page
 * that contains the given verse, in the chosen layout.
 */
import { redirect } from 'next/navigation';

interface PageProps {
  readonly params: Promise<{ layout: string; verseKey: string }>;
}

export default async function MushafPageForVerse({ params }: PageProps): Promise<never> {
  const { layout, verseKey: rawVk } = await params;
  // Defensive decode — Next leaves `:` percent-encoded when the upstream
  // URL had `%3A`. Then re-encode for the backend call so colons go
  // through cleanly regardless of which form the user typed.
  let verseKey = rawVk;
  try {
    verseKey = decodeURIComponent(rawVk);
  } catch {
    /* malformed escape — let the backend 404 */
  }
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
  } catch (err) {
    // `redirect()` throws a NEXT_REDIRECT digest that must propagate.
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err;
    /* otherwise fall through to page 1 */
  }
  redirect(`/mushaf/${layout}/1`);
}
