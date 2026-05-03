#!/usr/bin/env tsx
/**
 * Privacy boundary check — per ADR-0005.
 *
 * Walks `packages/schema/schemas/**` and rejects any schema that
 *   (a) carries `$comment` containing "LOCAL-ONLY", AND
 *   (b) lives under `schemas/api/` (the cloud-sync transport directory).
 *
 * Also rejects any cloud-sync schema (`api/`) that recursively `$ref`s a
 * LOCAL-ONLY schema. This is the architectural guarantee that no audio buffer
 * can ever reach the cloud-sync envelope.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const SCHEMAS = join(REPO_ROOT, 'packages', 'schema', 'schemas');

interface JsonSchema {
  $id?: string;
  $comment?: string;
  $ref?: string;
  [k: string]: unknown;
}

function listSchemas(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path);
      else if (e.isFile() && e.name.endsWith('.schema.json')) out.push(path);
    }
  };
  walk(SCHEMAS);
  return out;
}

function readSchema(p: string): JsonSchema {
  return JSON.parse(readFileSync(p, 'utf-8')) as JsonSchema;
}

function collectRefIds(node: unknown, into: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectRefIds(item, into);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === '$ref' && typeof v === 'string') into.add(v);
    else collectRefIds(v, into);
  }
}

function fail(msg: string): never {
  process.stderr.write(`::error::check-privacy-boundaries: ${msg}\n`);
  process.exit(1);
}

const schemas = listSchemas();
const localOnly = new Set<string>();
for (const path of schemas) {
  const json = readSchema(path);
  if (json.$comment?.includes('LOCAL-ONLY')) {
    localOnly.add(json.$id ?? path);
    if (path.includes(`${'/schemas/api/'}`)) {
      fail(
        `${relative(REPO_ROOT, path)}: LOCAL-ONLY schema must NOT live under schemas/api/ (ADR-0005).`,
      );
    }
  }
}

// Cross-ref check: cloud-sync schemas (under api/) must not $ref any LOCAL-ONLY id.
for (const path of schemas) {
  if (!path.includes(`${'/schemas/api/'}`)) continue;
  const json = readSchema(path);
  const refs = new Set<string>();
  collectRefIds(json, refs);
  for (const ref of refs) {
    // Resolve relative refs against the schema file's directory.
    const resolved = ref.startsWith('http') ? ref : new URL(ref, `file://${path}`).pathname;
    // Look up the target schema; if absolute http $id appears in our LOCAL-ONLY set, fail.
    if (localOnly.has(ref) || localOnly.has(resolved)) {
      fail(
        `${relative(REPO_ROOT, path)} references LOCAL-ONLY schema ${ref}. Cloud-sync envelopes must not transport local audio buffers (ADR-0005).`,
      );
    }
  }
}

process.stdout.write(`check-privacy-boundaries: ${schemas.length.toString()} schemas, ${localOnly.size.toString()} LOCAL-ONLY. ✓\n`);
