import { KhatmDetail } from '../../../../components/family/KhatmDetail.js';
import { SiteNav } from '../../../../components/SiteNav.js';

import type { ReactNode } from 'react';

interface Params {
  readonly params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Family khatm — Qalaam',
};

export default async function KhatmDetailPage({ params }: Params): Promise<ReactNode> {
  const { id } = await params;
  return (
    <main className="bg-paper-50 min-h-screen">
      <SiteNav />
      <KhatmDetail khatmId={id} />
    </main>
  );
}
