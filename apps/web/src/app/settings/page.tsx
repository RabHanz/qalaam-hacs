import { SettingsForm } from '../../components/SettingsForm.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Settings — Qalaam',
  description: 'Display name, Home Assistant URL, tier.',
};

export default function SettingsPage(): ReactNode {
  return (
    <main className="bg-paper-50 min-h-screen">
      <SiteNav />
      <SettingsForm />
    </main>
  );
}
