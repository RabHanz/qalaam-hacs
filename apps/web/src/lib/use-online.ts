'use client';

/**
 * useOnline — `navigator.onLine` as a React state, with subscription
 * to `online` / `offline` window events. SSR returns `true` so the
 * server-rendered HTML never claims "you're offline" — the client
 * upgrades on first effect tick.
 */
import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(true);
  useEffect(() => {
    const update = (): void => {
      setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
