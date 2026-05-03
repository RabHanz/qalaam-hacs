/**
 * FSRS-6 thin adapter over `ts-fsrs`.
 *
 * Maps Qalaam's `ReviewStateLike` shape to/from the algorithm's internal state.
 * Per ADR-0004: locked to FSRS-6.0; bumping requires explicit migration.
 *
 * Determinism: `now` is always injected — never call `Date.now()` directly.
 */
import { type Card, type FSRS, Rating, State, generatorParameters, fsrs } from 'ts-fsrs';

import { type FsrsGrade } from '../scoring/index.js';

export interface ReviewStateLike {
  readonly fsrsVersion: '6.0';
  readonly stability: number;
  readonly difficulty: number;
  readonly lastReviewed: string; // ISO-8601
  readonly due: string;
  readonly lapses: number;
  readonly reps: number;
  readonly elapsedDays?: number;
  readonly scheduledDays?: number;
  readonly retrievabilityAtDue?: number;
}

export interface FsrsApplyArgs {
  readonly now: Date;
  readonly review: ReviewStateLike;
  readonly grade: FsrsGrade;
}

export interface FsrsInitArgs {
  readonly now: Date;
}

const PARAMS = generatorParameters({
  enable_fuzz: false, // determinism for tests; toggle on in prod via constructor
  request_retention: 0.9,
});

const ENGINE: FSRS = fsrs(PARAMS);

function reviewToCard(review: ReviewStateLike): Card {
  return {
    due: new Date(review.due),
    stability: review.stability,
    difficulty: review.difficulty,
    elapsed_days: review.elapsedDays ?? 0,
    scheduled_days: review.scheduledDays ?? 0,
    reps: review.reps,
    lapses: review.lapses,
    state: review.reps === 0 ? State.New : State.Review,
    last_review: new Date(review.lastReviewed),
  } satisfies Card;
}

function cardToReview(card: Card): ReviewStateLike {
  return {
    fsrsVersion: '6.0',
    stability: card.stability,
    difficulty: card.difficulty,
    lastReviewed: card.last_review?.toISOString() ?? new Date().toISOString(),
    due: card.due.toISOString(),
    lapses: card.lapses,
    reps: card.reps,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    retrievabilityAtDue: PARAMS.request_retention,
  };
}

export function initialReviewState(args: FsrsInitArgs): ReviewStateLike {
  return {
    fsrsVersion: '6.0',
    stability: 0,
    difficulty: 0,
    lastReviewed: args.now.toISOString(),
    due: args.now.toISOString(),
    lapses: 0,
    reps: 0,
  };
}

export function applyGrade({ now, review, grade }: FsrsApplyArgs): ReviewStateLike {
  const card = reviewToCard(review);
  const ratingMap = {
    1: Rating.Again,
    2: Rating.Hard,
    3: Rating.Good,
    4: Rating.Easy,
  } as const;
  const result = ENGINE.next(card, now, ratingMap[grade]);
  return cardToReview(result.card);
}

/** True if the review is due at or before `now`. */
export function isDue(review: ReviewStateLike, now: Date): boolean {
  return new Date(review.due).getTime() <= now.getTime();
}
