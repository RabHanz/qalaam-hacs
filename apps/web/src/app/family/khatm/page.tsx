import { KhatmList } from '../../../components/family/KhatmList.js';
import { SiteNav } from '../../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Family khatm — Qalaam',
  description: 'Multi-user family reading of the entire mushaf.',
};

export default function KhatmListPage(): ReactNode {
  return (
    <main className="bg-paper-50 min-h-screen">
      <SiteNav />
      <KhatmList />
    </main>
  );
}
