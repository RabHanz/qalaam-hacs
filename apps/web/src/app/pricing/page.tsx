import { PricingTiers } from '../../components/PricingTiers.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Pricing — Qalaam',
  description: 'Free forever for the whole Mushaf. Premium for families. Pro for teachers.',
};

export default function PricingPage(): ReactNode {
  return (
    <main className="bg-paper-50 min-h-screen">
      <SiteNav />
      <PricingTiers />
    </main>
  );
}
