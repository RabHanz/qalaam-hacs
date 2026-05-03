/**
 * `@qalaam/schema` — JSON Schema source of truth (per ADR-0008).
 *
 * Exports:
 *  - `validators` — pre-compiled Ajv validators per schema, keyed by `$id`.
 *  - `schemaIds` — convenience constants for the canonical `$id` strings.
 *
 * For TypeScript types, import from `@qalaam/types-ts` (codegenerated).
 * For runtime schema files, import from `@qalaam/schema/schemas/...`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const SCHEMAS_DIR = new URL('../schemas/', import.meta.url).pathname;

interface JsonSchema {
  $id: string;
  $schema?: string;
  [k: string]: unknown;
}

/**
 * Recursively load every `*.schema.json` under `schemas/`.
 * Schemas are registered into a single shared Ajv instance so cross-file `$ref` works.
 */
function loadAllSchemas(): JsonSchema[] {
  const out: JsonSchema[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile() && entry.name.endsWith('.schema.json')) {
        const raw = readFileSync(path, 'utf-8');
        out.push(JSON.parse(raw) as JsonSchema);
      }
    }
  };
  walk(SCHEMAS_DIR);
  return out;
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateSchema: false,
  loadSchema: undefined,
});
addFormats(ajv);

const allSchemas = loadAllSchemas();
for (const s of allSchemas) {
  ajv.addSchema(s, s.$id);
}

export const validators = Object.freeze(
  Object.fromEntries(allSchemas.map((s) => [s.$id, ajv.getSchema(s.$id)])),
);

export const schemaIds = Object.freeze(
  Object.fromEntries(
    allSchemas.map((s) => {
      const segments = s.$id.split('/');
      const filename = segments[segments.length - 1] ?? '';
      const key = filename.replace(/\.schema\.json$/, '');
      return [key, s.$id];
    }),
  ),
);

export type SchemaId = keyof typeof schemaIds;

/** Validate `data` against the schema with the given `$id`. Throws on unknown id. */
export function validate(schemaId: string, data: unknown): { valid: boolean; errors: unknown } {
  const v = ajv.getSchema(schemaId);
  if (!v) {
    throw new Error(`Unknown schema id: ${schemaId}`);
  }
  const valid = v(data);
  return { valid: valid as boolean, errors: v.errors };
}
