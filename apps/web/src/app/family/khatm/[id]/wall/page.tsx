import { KhatmWall } from '../../../../../components/family/KhatmWall.js';

import type { ReactNode } from 'react';

interface Params {
  readonly params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Family khatm wall — Qalaam',
};

// Wall mode is intentionally chrome-less (no SiteNav) so it works as a
// kiosk/TV display without distractions.
export default async function KhatmWallPage({ params }: Params): Promise<ReactNode> {
  const { id } = await params;
  return <KhatmWall khatmId={id} />;
}
