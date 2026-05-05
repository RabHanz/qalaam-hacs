/**
 * GET /v1/credits — every QUL attribution surfaced from the
 * `data/qul-source/raw/<category>/<file>.license.json` sidecar tree.
 *
 * Per ADR-0020 every ingested QUL resource carries a sidecar with
 * `source_url`, `source_id`, `sha256`, `license_tag`, and a human-
 * readable `attribution_text`. This route walks the sidecar tree on
 * startup, deduplicates by `source_id`, and emits a flat list grouped
 * by category. The frontend `/credits` page renders the result.
 *
 * The backend is the single source of truth for what's "in" the
 * platform — when a sidecar's `license_tag` is one of `unverified`,
 * `per-translator`, or `per-reciter` AND the corresponding ingest
 * hasn't happened yet, we exclude it from the public credits page
 * (the backend treats those as "not yet shipped to users").
 *
 * The route is read-only and cacheable for 1 day.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { FastifyInstance } from 'fastify';

interface SidecarPayload {
  readonly source_id?: string | number;
  readonly source_url?: string;
  readonly category?: string;
  readonly title?: string;
  readonly sha256?: string;
  readonly license_tag?: string;
  readonly attribution_text?: string;
  readonly attribution_required?: boolean;
}

interface CreditEntry {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly sourceUrl: string;
  readonly licenseTag: string;
  readonly attributionText: string;
  readonly attributionRequired: boolean;
  readonly sha256: string | null;
}

interface CreditsResponse {
  readonly groups: Record<string, readonly CreditEntry[]>;
  readonly summary: {
    readonly totalEntries: number;
    readonly perCategory: Record<string, number>;
    readonly perLicense: Record<string, number>;
  };
}

// Resolve to repo root: backend cwd is apps/backend, raw lives at <repo>/data/...
const RAW_DIR =
  process.env.QALAAM_RAW_QUL_DIR ?? resolve(process.cwd(), '..', '..', 'data', 'qul-source', 'raw');

function* walkSidecars(root: string): Generator<string> {
  if (!existsSync(root)) return;
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(dir, e);
      let s;
      try {
        s = statSync(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) stack.push(p);
      else if (s.isFile() && p.endsWith('.license.json')) yield p;
    }
  }
}

function loadCreditsFromSidecars(rootDir: string): CreditsResponse {
  const groups: Record<string, CreditEntry[]> = {};
  const perLicense: Record<string, number> = {};
  const seen = new Set<string>();

  for (const path of walkSidecars(rootDir)) {
    let payload: SidecarPayload;
    try {
      payload = JSON.parse(readFileSync(path, 'utf-8')) as SidecarPayload;
    } catch {
      continue;
    }

    const cat = payload.category ?? 'unknown';
    const sourceIdStr = String(payload.source_id ?? '');
    const dedupeKey = `${cat}::${sourceIdStr}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const tag = payload.license_tag ?? 'unverified';
    // Exclude not-yet-ingested per-rights-holder rows from public page —
    // those are still under manual review and not surfaced to users.
    if (tag === 'unverified' || tag === 'per-translator' || tag === 'per-reciter') {
      continue;
    }

    const entry: CreditEntry = {
      id: sourceIdStr || cat,
      category: cat,
      title: payload.title ?? 'Untitled resource',
      sourceUrl: payload.source_url ?? '',
      licenseTag: tag,
      attributionText: payload.attribution_text ?? payload.title ?? '',
      attributionRequired: payload.attribution_required ?? true,
      sha256: payload.sha256 ?? null,
    };

    (groups[cat] ??= []).push(entry);
    perLicense[tag] = (perLicense[tag] ?? 0) + 1;
  }

  // Sort each category's entries by title for stable rendering
  for (const k of Object.keys(groups)) {
    groups[k]?.sort((a, b) => a.title.localeCompare(b.title));
  }

  const perCategory: Record<string, number> = {};
  let total = 0;
  for (const [k, list] of Object.entries(groups)) {
    perCategory[k] = list.length;
    total += list.length;
  }

  return {
    groups,
    summary: { totalEntries: total, perCategory, perLicense },
  };
}

let cached: CreditsResponse | null = null;

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async even for sync init.
export async function creditsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/v1/credits',
    {
      schema: {
        description:
          'List every QUL resource credit/attribution loaded into Qalaam. ' +
          'Sourced from sidecar .license.json files staged by scripts/data/' +
          'scrape-qul-full.py + license-auto-tag.py. Excludes per-translator/' +
          'per-reciter rows pending manual review.',
        tags: ['credits'],
      },
    },
    async (_req, reply) => {
      // Cached for the lifetime of the process — sidecars only change on
      // re-ingest, which restarts the backend.
      cached ??= loadCreditsFromSidecars(RAW_DIR);
      void reply.header('cache-control', 'public, max-age=86400');
      return cached;
    },
  );
}
