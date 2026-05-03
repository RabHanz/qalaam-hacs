/**
 * Stable, machine-readable error codes for the Qalaam domain.
 *
 * All thrown errors inherit from `QalaamError`. Catchers should branch on
 * `error.code` (a string union), never on instanceof another concrete class.
 *
 * Per CLAUDE.md §11.1: every error has a stable code that doesn't break across
 * minor versions; renames go through deprecation in CHANGELOG.
 */

export type QalaamErrorCode =
  | 'qalaam.verse-key.invalid-format'
  | 'qalaam.verse-key.surah-out-of-range'
  | 'qalaam.verse-key.ayah-out-of-range'
  | 'qalaam.range.start-after-end'
  | 'qalaam.range.empty'
  | 'qalaam.mushaf.unknown-layout'
  | 'qalaam.mushaf.no-coverage'
  | 'qalaam.data.not-loaded'
  | 'qalaam.adapter.capability-unsupported'
  | 'qalaam.asr.privacy-boundary-violation';

export class QalaamError extends Error {
  public readonly code: QalaamErrorCode;
  /** Outcome (per STRATEGY_AND_ROADMAP.md §23.2) impacted, if known. */
  public readonly outcomeImpacted?: string;
  public readonly cause?: unknown;

  public constructor(
    code: QalaamErrorCode,
    message: string,
    options?: { outcomeImpacted?: string; cause?: unknown },
  ) {
    super(message);
    this.name = 'QalaamError';
    this.code = code;
    if (options?.outcomeImpacted !== undefined) {
      this.outcomeImpacted = options.outcomeImpacted;
    }
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    // Maintain V8 stack trace
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): { name: string; code: QalaamErrorCode; message: string; outcomeImpacted?: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.outcomeImpacted !== undefined ? { outcomeImpacted: this.outcomeImpacted } : {}),
    };
  }
}
