import { AuthForm } from '../../components/AuthForm.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Create account · Qalaam',
  description: 'Create a Qalaam account — family-private Quran + Hifdh.',
};

export default function SignUpPage(): ReactNode {
  return (
    <>
      <SiteNav />
      <AuthForm mode="signup" />
    </>
  );
}
