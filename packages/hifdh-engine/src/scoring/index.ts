/**
 * Two-axis (fluency × accuracy) → FSRS-6 grade derivation.
 * Per strategy §7.2.
 *
 * Mapping rationale: the FSRS-6 grade space is {1=Again, 2=Hard, 3=Good, 4=Easy}.
 * We project the 4×4 matrix conservatively — when in doubt, we drift toward
 * "Hard" rather than "Good" so unstable portions get more review (CLAUDE.md
 * Principle 06: build for foundation = retention over speed).
 */
import { QalaamError } from '@qalaam/core';

/** 0=halted, 1=hesitant, 2=mostly smooth, 3=fluent. */
export type Fluency = 0 | 1 | 2 | 3;
/** 0=major errors, 1=minor errors, 2=tajweed-only nits, 3=clean. */
export type Accuracy = 0 | 1 | 2 | 3;
/** FSRS-6 review grades. */
export type FsrsGrade = 1 | 2 | 3 | 4;

const GRADE_MATRIX: readonly (readonly FsrsGrade[])[] = [
  // accuracy →     0     1     2     3
  /* fluency 0 */ [1, 1, 1, 2],
  /* fluency 1 */ [1, 2, 2, 2],
  /* fluency 2 */ [1, 2, 3, 3],
  /* fluency 3 */ [2, 2, 3, 4],
];

export function deriveFsrsGrade(fluency: Fluency, accuracy: Accuracy): FsrsGrade {
  const row = GRADE_MATRIX[fluency];
  if (!row) {
    throw new QalaamError(
      'qalaam.range.empty',
      `deriveFsrsGrade: invalid fluency ${String(fluency)}`,
    );
  }
  const grade = row[accuracy];
  if (grade === undefined) {
    throw new QalaamError(
      'qalaam.range.empty',
      `deriveFsrsGrade: invalid accuracy ${String(accuracy)}`,
    );
  }
  return grade;
}

/**
 * Apply mutashabihat signal: if the rating event is associated with a
 * `mutashabihat-swap` mistake, drop the grade by one (capped at 1=Again).
 * This forces the FSRS scheduler to surface the portion sooner — and surfaces
 * its cluster siblings via `mutashabihat.surfaceCluster`.
 */
export function adjustForMutashabihat(grade: FsrsGrade, swapped: boolean): FsrsGrade {
  if (!swapped) return grade;
  const dropped = (grade - 1) as FsrsGrade;
  return dropped < 1 ? 1 : dropped;
}
