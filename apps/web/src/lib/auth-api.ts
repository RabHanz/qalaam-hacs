/**
 * Auth API wrappers — thin typed facade over /v1/auth/*.
 *
 * Every mutation invalidates the useUser cache so subscribed
 * components rerender with fresh state.
 */
import { resolveApiBase } from './api-base.js';
import { invalidateUserCache, type QalaamUser } from './use-user.js';

interface MutationResult {
  ok: boolean;
  user?: QalaamUser | undefined;
  code?: string | undefined;
  message?: string | undefined;
  retryAfterSeconds?: number | undefined;
}

async function postJson(path: string, body: unknown): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetch(`${resolveApiBase()}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: 'qalaam.net.unreachable', message: 'Backend unreachable.' };
  }
  if (!res.ok) {
    let err: { code?: string; message?: string; retryAfterSeconds?: number } = {};
    try {
      err = (await res.json()) as typeof err;
    } catch {
      /* non-JSON body — fall through */
    }
    return {
      ok: false,
      code: err.code ?? `qalaam.http.${res.status.toString()}`,
      message: err.message,
      retryAfterSeconds: err.retryAfterSeconds,
    };
  }
  const body204 = res.status === 204;
  if (body204) return { ok: true };
  const data = (await res.json()) as { user: QalaamUser };
  return { ok: true, user: data.user };
}

export async function signup(args: {
  email: string;
  password: string;
  displayName?: string | undefined;
}): Promise<MutationResult> {
  const result = await postJson('/v1/auth/signup', args);
  if (result.ok) invalidateUserCache();
  return result;
}

export async function signin(args: { email: string; password: string }): Promise<MutationResult> {
  const result = await postJson('/v1/auth/signin', args);
  if (result.ok) invalidateUserCache();
  return result;
}

export async function signout(): Promise<MutationResult> {
  const result = await postJson('/v1/auth/signout', {});
  invalidateUserCache(); // even on failure — drop client cache
  return result;
}
