'use client';

/**
 * Tiny client island whose only job is to register the service
 * worker once on mount. Mounted in RootLayout. Renders nothing.
 */
import { useEffect } from 'react';

import { registerServiceWorker } from '../lib/register-sw.js';

import type { ReactNode } from 'react';

export function ServiceWorkerLifecycle(): ReactNode {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
