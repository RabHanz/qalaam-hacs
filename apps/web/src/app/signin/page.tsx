import { AuthForm } from '../../components/AuthForm.js';
import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Sign in · Qalaam',
  description: 'Sign in to Qalaam — family-private Quran + Hifdh.',
};

export default function SignInPage(): ReactNode {
  return (
    <>
      <SiteNav />
      <AuthForm mode="signin" />
    </>
  );
}
