/**
 * /listen — ambient passive playback (Listen Mode).
 *
 * Per strategy §10.1: low-volume loop of the user's current memorization
 * portion (sabaq + sabqi). Strong evidence-backed Hifdh technique that no
 * existing app does home-wide.
 */
import type { ReactNode } from 'react';

import { EmptyState } from '../../components/EmptyState.js';

export const metadata = {
  title: 'Listen Mode',
  description: 'Ambient low-volume playback of your current memorization portion.',
};

export default function ListenPage(): ReactNode {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Listen Mode</h1>
        <p className="text-sm opacity-70">
          Plays your current memorization portion at low volume around the home. Adhan-aware —
          pauses for prayer windows.
        </p>
      </header>
      <EmptyState
        title="Pick a speaker to start"
        hint="Listen Mode plays your current sabaq + sabqi quietly across any speaker connected via Cast, Sonos, AirPlay, MQTT, Home Assistant, or this browser tab. Setup lands in v1.0."
      />
    </div>
  );
}
