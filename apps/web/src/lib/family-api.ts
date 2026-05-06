/**
 * family-api.ts — typed wrappers for /v1/family/*, /v1/plans/*,
 * /v1/mistakes/*, /v1/family/khatm/*, /v1/voice-notes/*.
 *
 * Every call goes through the same /api proxy so cookies flow through
 * Next's same-origin path (per ADR-0007 / I1).
 */
import { resolveApiBase } from './api-base.js';

export interface FamilyMember {
  readonly memberId: string;
  readonly userId: string;
  readonly role: 'guardian' | 'member' | 'child';
  readonly displayName: string;
  readonly email: string | null;
  readonly isShadow: boolean;
  readonly isMinor: boolean;
  readonly avatarColor: string | null;
  readonly joinedAt: string;
}

export interface FamilyPayload {
  readonly family: { id: string; name: string; maxSeats: number };
  readonly myRole: 'guardian' | 'member' | 'child';
  readonly members: readonly FamilyMember[];
}

export interface DashboardMember extends FamilyMember {
  readonly portionsLast7: number;
  readonly lastSessionDate: string | null;
  readonly openMistakes: number;
  readonly activePlan: {
    readonly id: string;
    readonly title: string;
    readonly dailyPages: number;
    readonly scopeKind: string;
    readonly scopeValue: string | null;
  } | null;
}

export interface DashboardPayload {
  readonly family: { id: string; name: string };
  readonly windowDays: number;
  readonly members: readonly DashboardMember[];
}

export interface Plan {
  readonly id: string;
  readonly familyId: string;
  readonly ownerUserId: string;
  readonly assigneeUserId: string;
  readonly title: string;
  readonly scopeKind: 'juz' | 'surah' | 'range' | 'full';
  readonly scopeValue: string | null;
  readonly dailyPages: number;
  readonly startDate: string;
  readonly targetDate: string | null;
  readonly status: 'active' | 'paused' | 'done' | 'abandoned';
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProgressEntry {
  readonly id: number;
  readonly planId: string | null;
  readonly userId: string;
  readonly reviewerUserId: string | null;
  readonly date: string;
  readonly kind: 'sabaq' | 'sabqi' | 'manzil' | 'review';
  readonly pageNumber: number | null;
  readonly versesCompleted: number | null;
  readonly quality: number | null;
  readonly notes: string | null;
  readonly ts: string;
}

export interface HeatmapPage {
  readonly page: number;
  readonly total: number;
  readonly open: number;
  readonly intensity: number;
}

export interface HeatmapPayload {
  readonly userId: string;
  readonly windowDays: number;
  readonly totalMistakes: number;
  readonly openMistakes: number;
  readonly maxPageCount: number;
  readonly pages: readonly HeatmapPage[];
}

export interface Mistake {
  readonly id: number;
  readonly userId: string;
  readonly ts: string;
  readonly verseKey: string;
  readonly pageNumber: number | null;
  readonly wordIndex: number | null;
  readonly kind: string;
  readonly source: string;
  readonly context: string | null;
  readonly resolved: boolean;
}

export interface Khatm {
  readonly id: string;
  readonly familyId: string;
  readonly title: string;
  readonly mode: 'sequential' | 'distributed' | 'by-juz';
  readonly startDate: string;
  readonly targetDate: string | null;
  readonly status: 'active' | 'done' | 'abandoned';
  readonly createdBy: string;
  readonly createdAt: string;
  readonly finishedAt: string | null;
}

export interface KhatmDetailPayload {
  readonly khatm: Khatm;
  readonly pageCount: number;
  readonly roster: readonly { userId: string; displayName: string; avatarColor: string | null }[];
  readonly totalClaimed: number;
  readonly pageOwnership: Record<string, string>;
  readonly juzCounts: Record<string, number>;
  readonly recent?: readonly {
    page: number;
    ts: string;
    displayName: string;
    avatarColor: string | null;
  }[];
}

export interface VoiceNote {
  readonly id: string;
  readonly familyId: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly contextKind: string | null;
  readonly contextId: string | null;
  readonly hasAudio: boolean;
  readonly mimeType: string | null;
  readonly durationMs: number | null;
  readonly transcript: string | null;
  readonly sticker: string | null;
  readonly createdAt: string;
  readonly readAt: string | null;
}

interface FetchOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

async function call<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  };
  if (opts.signal) init.signal = opts.signal;
  if (opts.body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${resolveApiBase()}${path}`, init);
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  if (!res.ok) {
    let payload: { code?: string; message?: string } = {};
    try {
      payload = (await res.json()) as typeof payload;
    } catch {
      /* ignore non-JSON body */
    }
    const err = new Error(
      payload.message ?? payload.code ?? `HTTP ${res.status.toString()}`,
    ) as Error & {
      code?: string;
      status?: number;
    };
    err.code = payload.code ?? `qalaam.http.${res.status.toString()}`;
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

// ───────────────────── family ─────────────────────
export const family = {
  get: () => call<FamilyPayload>('/v1/family'),
  dashboard: () => call<DashboardPayload>('/v1/family/dashboard'),
  addMember: (args: { displayName: string; isMinor?: boolean; role?: string }) =>
    call<{ member: FamilyMember }>('/v1/family/members', { method: 'POST', body: args }),
  updateMember: (
    id: string,
    args: { displayName?: string | null; avatarColor?: string | null; consentShareStats?: boolean },
  ) =>
    call<{ member: FamilyMember }>(`/v1/family/members/${id}`, {
      method: 'PATCH',
      body: args,
    }),
  removeMember: (id: string) => call<undefined>(`/v1/family/members/${id}`, { method: 'DELETE' }),
};

// ───────────────────── plans ─────────────────────
export const plans = {
  list: () => call<{ plans: Plan[] }>('/v1/plans'),
  get: (id: string) => call<{ plan: Plan; progress: ProgressEntry[] }>(`/v1/plans/${id}`),
  create: (args: {
    assigneeUserId?: string;
    title: string;
    scopeKind: Plan['scopeKind'];
    scopeValue?: string | null;
    dailyPages?: number;
    startDate?: string;
    targetDate?: string | null;
    notes?: string | null;
  }) => call<{ plan: Plan }>('/v1/plans', { method: 'POST', body: args }),
  update: (
    id: string,
    args: Partial<
      Omit<Plan, 'id' | 'familyId' | 'ownerUserId' | 'assigneeUserId' | 'createdAt' | 'updatedAt'>
    >,
  ) => call<{ plan: Plan }>(`/v1/plans/${id}`, { method: 'PATCH', body: args }),
  remove: (id: string) => call<undefined>(`/v1/plans/${id}`, { method: 'DELETE' }),
  recordProgress: (
    id: string,
    args: {
      kind?: ProgressEntry['kind'];
      pageNumber?: number;
      versesCompleted?: number;
      quality?: number;
      notes?: string;
      date?: string;
    },
  ) =>
    call<{ progress: ProgressEntry }>(`/v1/plans/${id}/progress`, {
      method: 'POST',
      body: args,
    }),
};

// ───────────────────── mistakes ─────────────────────
export const mistakes = {
  record: (args: {
    verseKey: string;
    kind: string;
    source?: 'asr' | 'parent-mark' | 'self-mark';
    wordIndex?: number;
    context?: string;
    pageNumber?: number;
    forUserId?: string;
  }) => call<{ mistake: Mistake }>('/v1/mistakes', { method: 'POST', body: args }),
  heatmap: (args?: { days?: number; userId?: string }) => {
    const q = new URLSearchParams();
    if (args?.days) q.set('days', args.days.toString());
    if (args?.userId) q.set('userId', args.userId);
    const qs = q.toString();
    return call<HeatmapPayload>(`/v1/mistakes/heatmap${qs ? `?${qs}` : ''}`);
  },
  byPage: (page: number, args?: { userId?: string; days?: number }) => {
    const q = new URLSearchParams();
    if (args?.userId) q.set('userId', args.userId);
    if (args?.days) q.set('days', args.days.toString());
    const qs = q.toString();
    return call<{ page: number; mistakes: Mistake[] }>(
      `/v1/mistakes/by-page/${page.toString()}${qs ? `?${qs}` : ''}`,
    );
  },
  resolve: (id: number) =>
    call<undefined>(`/v1/mistakes/${id.toString()}/resolve`, { method: 'POST' }),
  resolvePage: (args: { pageNumber: number; forUserId?: string }) =>
    call<{ resolved: number }>('/v1/mistakes/resolve-page', { method: 'POST', body: args }),
};

// ───────────────────── khatm ─────────────────────
export const khatm = {
  list: () => call<{ khatms: Khatm[] }>('/v1/family/khatm'),
  start: (args: {
    title: string;
    mode?: Khatm['mode'];
    startDate?: string;
    targetDate?: string | null;
  }) => call<{ khatm: Khatm }>('/v1/family/khatm', { method: 'POST', body: args }),
  get: (id: string) => call<KhatmDetailPayload>(`/v1/family/khatm/${id}`),
  wall: (id: string) => call<KhatmDetailPayload>(`/v1/family/khatm/${id}/wall`),
  claimPage: (id: string, args: { pageNumber: number; forUserId?: string }) =>
    call<KhatmDetailPayload>(`/v1/family/khatm/${id}/page`, { method: 'POST', body: args }),
  update: (
    id: string,
    args: { status?: Khatm['status']; title?: string; targetDate?: string | null },
  ) => call<{ khatm: Khatm }>(`/v1/family/khatm/${id}`, { method: 'PATCH', body: args }),
  remove: (id: string) => call<undefined>(`/v1/family/khatm/${id}`, { method: 'DELETE' }),
};

// ───────────────────── voice notes ─────────────────────
export const voiceNotes = {
  list: (box?: 'inbox' | 'sent' | 'unread' | 'all', limit?: number) => {
    const q = new URLSearchParams();
    if (box) q.set('box', box);
    if (limit) q.set('limit', limit.toString());
    const qs = q.toString();
    return call<{ notes: VoiceNote[] }>(`/v1/voice-notes${qs ? `?${qs}` : ''}`);
  },
  send: (args: {
    toUserId: string;
    sticker?: string;
    audioBase64?: string;
    mimeType?: string;
    durationMs?: number;
    transcript?: string;
    contextKind?: 'progress' | 'khatm' | 'adhoc';
    contextId?: string;
  }) => call<{ note: VoiceNote }>('/v1/voice-notes', { method: 'POST', body: args }),
  audioUrl: (id: string) => `${resolveApiBase()}/v1/voice-notes/${id}/audio`,
  markRead: (id: string) => call<undefined>(`/v1/voice-notes/${id}/read`, { method: 'POST' }),
  remove: (id: string) => call<undefined>(`/v1/voice-notes/${id}`, { method: 'DELETE' }),
};

export const STICKER_LABELS: Record<string, { label: string; arabic: string; meaning: string }> = {
  subhanallah: { label: 'Subhan-Allah', arabic: 'سُبْحَانَ ٱللَّٰه', meaning: 'Glory be to Allah' },
  mashaallah: { label: 'Masha-Allah', arabic: 'مَا شَاءَ ٱللَّٰه', meaning: 'What Allah willed' },
  alhamdulillah: {
    label: 'Alhamdulillah',
    arabic: 'ٱلْحَمْدُ لِلَّٰه',
    meaning: 'Praise be to Allah',
  },
  jazakallah: { label: 'Jazak-Allah', arabic: 'جَزَاكَ ٱللَّٰه', meaning: 'May Allah reward you' },
  ahsanta: { label: 'Ahsanta', arabic: 'أَحْسَنْتَ', meaning: 'You did well' },
  baraka: {
    label: 'Barak-Allahu feek',
    arabic: 'بَارَكَ ٱللَّٰهُ فِيكَ',
    meaning: 'May Allah bless you',
  },
};
