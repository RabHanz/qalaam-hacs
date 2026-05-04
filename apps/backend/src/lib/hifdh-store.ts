/**
 * In-memory Hifdh state, used by `/v1/hifdh/state` and the HA coordinator.
 *
 * v0.1 ships a "demo-but-plausible" payload so the dashboard reads as
 * a real practice in progress, not an empty placeholder. This satisfies
 * CLAUDE.md adab: never frame a fresh user as "you broke your streak,"
 * "0 days," or any other discouragement signal — the page should look
 * inviting from the first visit. Replaced by Postgres-backed state in
 * v0.5 (see ADR-0010 + Prisma schema).
 */

export interface DemoHifdhState {
  readonly streakDays: number;
  readonly graceDaysRemaining: number;
  readonly currentSabqi: string | null;
  readonly currentSabaq: string | null;
  readonly portionsDueToday: number;
  readonly minutesCompletedToday: number;
  readonly manzilCyclePosition: string | null;
  readonly weakestPages: readonly string[];
  readonly mutashabihatWatchlist: readonly string[];
}

const SEED: DemoHifdhState = {
  streakDays: 7,
  graceDaysRemaining: 2,
  currentSabqi: '2:255 → 2:257',
  currentSabaq: '2:258 → 2:260',
  portionsDueToday: 3,
  minutesCompletedToday: 18,
  manzilCyclePosition: 'Manzil 1 · day 4 / 7',
  weakestPages: ['p.42', 'p.106', 'p.149'],
  mutashabihatWatchlist: ['2:48', '2:107', '2:165'],
};

const store = new Map<string, DemoHifdhState>();

export function getDemoHifdhState(userId: string): DemoHifdhState {
  let s = store.get(userId);
  if (!s) {
    s = SEED;
    store.set(userId, s);
  }
  return s;
}

export function setDemoHifdhState(userId: string, patch: Partial<DemoHifdhState>): DemoHifdhState {
  const cur = getDemoHifdhState(userId);
  const next = { ...cur, ...patch };
  store.set(userId, next);
  return next;
}
