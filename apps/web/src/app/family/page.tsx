/**
 * /family — parent dashboard.
 *
 * Mostly delegates to FamilyDashboard (client). The shell is RSC for
 * SiteNav + initial markup.
 */
import { FamilyDashboard } from '../../components/family/FamilyDashboard.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Family — Qalaam',
  description: 'Family-private Hifdh: child profiles, plans, mistake heatmap, voice notes.',
};

export default function FamilyPage(): ReactNode {
  return (
    <main className="bg-paper-50 min-h-screen">
      <SiteNav />
      <FamilyDashboard />
    </main>
  );
}
