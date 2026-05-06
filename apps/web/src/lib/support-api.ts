/**
 * support-api.ts — H2 billing-support intake.
 */
import { resolveApiBase } from './api-base.js';

export type SupportKind = 'cant-afford' | 'upgrade' | 'feedback';
export type TargetTier = 'premium' | 'pro';

export interface SupportSubmitArgs {
  readonly kind: SupportKind;
  readonly message: string;
  readonly email?: string;
  readonly targetTier?: TargetTier;
}

export interface SupportResult {
  readonly ok: boolean;
  readonly id?: number | undefined;
  readonly code?: string | undefined;
  readonly message?: string | undefined;
}

export async function submitSupport(args: SupportSubmitArgs): Promise<SupportResult> {
  let res: Response;
  try {
    res = await fetch(`${resolveApiBase()}/v1/support`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    return { ok: false, code: 'qalaam.net.unreachable', message: 'Network error.' };
  }
  if (!res.ok) {
    let body: { code?: string; message?: string } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* ignore non-JSON */
    }
    return { ok: false, code: body.code, message: body.message };
  }
  const data = (await res.json()) as { id: number };
  return { ok: true, id: data.id };
}
