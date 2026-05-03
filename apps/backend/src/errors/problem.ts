/**
 * RFC 9457 problem-detail response helpers.
 * Aligned with `packages/schema/schemas/api/Problem.schema.json`.
 *
 * Per CLAUDE.md §11.1: every API error has a stable `code` machine-readable
 * identifier. Catchers should branch on `code`, not on HTTP status.
 */
import { QalaamError } from '@qalaam/core';

export interface ProblemDetail {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly code?: string;
  readonly outcomeImpacted?: string;
}

export function problemFromError(
  err: unknown,
  instance: string,
): { status: number; body: ProblemDetail } {
  if (err instanceof QalaamError) {
    return {
      status: codeToStatus(err.code),
      body: {
        type: 'about:blank',
        title: err.code,
        status: codeToStatus(err.code),
        detail: err.message,
        instance,
        code: err.code,
        ...(err.outcomeImpacted ? { outcomeImpacted: err.outcomeImpacted } : {}),
      },
    };
  }
  return {
    status: 500,
    body: {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: err instanceof Error ? err.message : 'Unknown error',
      instance,
    },
  };
}

function codeToStatus(code: string): number {
  if (code.startsWith('qalaam.verse-key.')) return 400;
  if (code.startsWith('qalaam.range.')) return 400;
  if (code.startsWith('qalaam.adapter.capability-unsupported')) return 409;
  if (code === 'qalaam.data.not-loaded') return 503;
  if (code === 'qalaam.asr.privacy-boundary-violation') return 403;
  return 500;
}
