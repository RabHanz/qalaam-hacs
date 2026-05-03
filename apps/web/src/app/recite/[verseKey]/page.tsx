/**
 * /recite/[verseKey] — verse-pause Hifdh drill.
 *
 * RSC fetches the expected Arabic text; renders client-side FeedbackSession
 * which handles mic capture + WS to services/realtime-feedback. Per strategy §8.7.
 *
 * Privacy posture: per ADR-0005, the realtime-feedback service is on-device or
 * on the family LAN. The default WS URL points at localhost; SaaS users with
 * a self-hosted bridge can configure their own.
 */
import type { ReactNode } from 'react';

import { QalaamError, parseVerseKey } from '@qalaam/core';
import { FeedbackSession } from '@qalaam/ui-recite';

import { EmptyState } from '../../../components/EmptyState.js';
import { ErrorState } from '../../../components/ErrorState.js';
import { qalaamClient } from '../../../lib/qalaam-client.js';

interface PageProps {
  readonly params: Promise<{ verseKey: string }>;
}

const DEFAULT_WS_URL =
  process.env['NEXT_PUBLIC_REALTIME_FEEDBACK_WS_URL'] ?? 'ws://localhost:5003/v1/feedback';

export default async function RecitePage({ params }: PageProps): Promise<ReactNode> {
  const { verseKey: rawKey } = await params;
  let key;
  try {
    key = parseVerseKey(rawKey);
  } catch {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState title="Invalid verse" hint={`Got "${rawKey}" — expected "surah:ayah".`} />
      </div>
    );
  }

  let arabic: string;
  try {
    arabic = (await qalaamClient.getVerseByKey(key)).textUthmani;
  } catch (err) {
    if (err instanceof QalaamError && err.code === 'qalaam.data.not-loaded') {
      return (
        <EmptyState
          title="Verse not bundled yet"
          hint="v0.1 ships Al-Fatiha (1:1 - 1:7) only. Run `make data-fetch` for full QUL coverage."
        />
      );
    }
    return <ErrorState message={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Recite — {key}</h1>
        <p className="text-sm opacity-70">
          Verse-pause drill. Audio stays on this device — feedback only flows back from your local
          realtime-feedback worker.
        </p>
      </header>
      <FeedbackSession
        verseKey={key}
        expectedTextUthmani={arabic}
        wsUrl={DEFAULT_WS_URL}
      />
    </div>
  );
}
