import { EditorialErrorPage } from '../components/EditorialErrorPage.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Page not found · Qalaam',
};

/**
 * 404 — the page the user reached doesn't exist. Composed as an
 * editorial artifact: a verse on guidance from Sūrat al-Fātiḥa, an
 * italic translation, and one calm CTA back home. Mirrors the rest
 * of Qalaam's typographic register so even an error feels considered.
 */
export default function NotFound(): ReactNode {
  return (
    <EditorialErrorPage
      tag="404"
      arabicTag="ضَلَال"
      arabic="ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ"
      translation="Guide us to the straight path."
      reference="Sūrat al-Fātiḥa · 1:6"
      body="The page you were looking for isn’t here. Open the index, or pick up where you left off."
    />
  );
}
