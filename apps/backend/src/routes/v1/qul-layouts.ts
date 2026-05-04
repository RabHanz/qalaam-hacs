/**
 * GET /v1/layouts                                  → available layout slugs (those licensed)
 * GET /v1/layouts/:layout/page-count               → total pages in a layout
 * GET /v1/layouts/:layout/page/:n                  → full page (lines + words)
 * GET /v1/layouts/:layout/by-verse/:verseKey       → reverse lookup (page + line)
 *
 * Per ADR-0020. License: per-layout (`permissive-with-credit`,
 * `kfgqpc-terms`, or `digitalkhatt-anane`). Cache: 7 days.
 *
 * Layout slugs not present in `LICENSE_METADATA.scriptsBySlug` would cause
 * the sub-reader to fall back to a permissive default — but we explicitly
 * pass the QuranMetadata `factual` license here because mushaf-layouts have
 * no per-layout map yet (followup work; see Docs/research/qul-inventory.md
 * §3 for the per-layout license breakdown).
 */
import { existsSync } from 'node:fs';

import { QalaamError } from '@qalaam/core';



import { getQul } from '../../lib/data-loader.js';
import { LICENSE_METADATA } from '../../lib/qul-license-registry.js';

import type { Config } from '../../config.js';
import type { MushafLayoutSlug } from '@qalaam/data-loader/qul';
import type { FastifyInstance } from 'fastify';

const SEVEN_DAYS_S = 60 * 60 * 24 * 7;
const VERSE_KEY_RE = /^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/;

const KNOWN_LAYOUTS: ReadonlySet<MushafLayoutSlug> = new Set<MushafLayoutSlug>([
  'madani_15',
  'madani_16',
  'indopak_9',
  'indopak_13',
  'indopak_15',
  'indopak_16',
  'kfgqpc_v1',
  'kfgqpc_v2',
  'kfgqpc_v4',
  'qatar_15',
  'nastaleeq_15',
  'digitalkhatt_v1',
  'digitalkhatt_v2',
  'ligature_svg',
]);

// Public URL aliases. Users see /mushaf/madinah/2 instead of
// /mushaf/madani_15/2 — internal storage slugs (madani_15, kfgqpc_v1,
// kfgqpc_v4) stay stable; the alias map translates pretty URLs.
const URL_ALIAS_TO_INTERNAL: Record<string, MushafLayoutSlug> = {
  madinah: 'madani_15',
  indopak: 'kfgqpc_v1',
  tajweed: 'kfgqpc_v4',
};
const INTERNAL_TO_URL_ALIAS: Record<string, string> = {
  madani_15: 'madinah',
  kfgqpc_v1: 'indopak',
  kfgqpc_v4: 'tajweed',
};

function assertLayout(slug: string): MushafLayoutSlug {
  // Accept the public alias OR the internal slug.
  const aliased = URL_ALIAS_TO_INTERNAL[slug];
  const resolved = aliased ?? (slug as MushafLayoutSlug);
  if (!KNOWN_LAYOUTS.has(resolved)) {
    throw new QalaamError(
      'qalaam.mushaf.unknown-layout',
      `Unknown layout ${slug}. Allowed: ${Object.keys(URL_ALIAS_TO_INTERNAL).concat(Array.from(KNOWN_LAYOUTS)).join(', ')}.`,
    );
  }
  return resolved;
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function qulLayoutsRoutes(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  function reader() {
    if (!existsSync(opts.config.QUL_SQLITE_PATH)) {
      throw new QalaamError(
        'qalaam.data.not-loaded',
        `QUL SQLite not present at ${opts.config.QUL_SQLITE_PATH}.`,
      );
    }
    return getQul(opts.config.QUL_SQLITE_PATH).mushafLayouts(LICENSE_METADATA.quranMetadata);
  }

  fastify.get('/v1/layouts', { schema: { tags: ['layouts'] } }, async (_req, reply) => {
    // Only surface layouts that actually have ingested data, and dress each
    // with a human-readable label so the UI can render "Madinah Mushaf · 15 lines"
    // instead of an internal slug. The slug stays as a stable identifier
    // for deep-links + URL params.
    const r = reader();
    const labels: Record<string, { name: string; subtitle: string; sourceLabel: string }> = {
      madani_15: {
        name: 'Madinah Mushaf',
        subtitle: '15 lines · KFGQPC v2',
        sourceLabel: 'King Fahd Glorious Quran Printing Complex',
      },
      kfgqpc_v1: {
        // The kfgqpc_v1 slot is fed by the IndoPak Nastaleeq script
        // because in our QUL data the v1/v2 Uthmani text is identical
        // (deduplicated upstream). IndoPak Nastaleeq gives a genuinely
        // different reading variant — alternate alif/yaa/lam-alif
        // forms — so users see a real second mushaf when they switch.
        name: 'IndoPak (Nastaleeq)',
        subtitle: '15 lines · Sub-Continental orthography',
        sourceLabel: 'Quranic Universal Library',
      },
      kfgqpc_v4: {
        name: 'Madinah Mushaf · Tajweed',
        subtitle: '15 lines · KFGQPC v4 with tajweed colors',
        sourceLabel: 'King Fahd Glorious Quran Printing Complex',
      },
      indopak_15: { name: 'Indo-Pak Mushaf', subtitle: '15 lines · Nastaleeq', sourceLabel: 'Community-built' },
      indopak_16: { name: 'Indo-Pak Mushaf', subtitle: '16 lines', sourceLabel: 'Community-built' },
      qatar_15: { name: 'Qatar Mushaf', subtitle: '15 lines', sourceLabel: 'Qatar Religious Affairs' },
      nastaleeq_15: { name: 'Nastaleeq Mushaf', subtitle: '15 lines', sourceLabel: 'Community-built' },
      digitalkhatt_v1: { name: 'DigitalKhatt v1', subtitle: 'OpenType-shaped Uthmani', sourceLabel: 'DigitalKhatt' },
      digitalkhatt_v2: { name: 'DigitalKhatt v2', subtitle: 'OpenType-shaped Uthmani', sourceLabel: 'DigitalKhatt' },
      ligature_svg: { name: 'Ligature SVG', subtitle: 'Per-glyph SVG mushaf', sourceLabel: 'Community-built' },
      madani_16: { name: 'Madinah Mushaf · 16 lines', subtitle: '16 lines', sourceLabel: 'KFGQPC' },
      indopak_9: { name: 'Indo-Pak Mushaf', subtitle: '9 lines (large print)', sourceLabel: 'Community-built' },
      indopak_13: { name: 'Indo-Pak Mushaf', subtitle: '13 lines', sourceLabel: 'Community-built' },
    };
    const available = Array.from(KNOWN_LAYOUTS)
      .map((slug) => ({ slug, pageCount: r.pageCount(slug) }))
      .filter((row) => row.pageCount > 0)
      .map((row) => ({
        slug: row.slug,
        // Pretty URL slug — what users see in the address bar.
        // Falls back to the internal slug if no alias is registered.
        urlSlug: INTERNAL_TO_URL_ALIAS[row.slug] ?? row.slug,
        pageCount: row.pageCount,
        name: labels[row.slug]?.name ?? row.slug,
        subtitle: labels[row.slug]?.subtitle ?? '',
        sourceLabel: labels[row.slug]?.sourceLabel ?? 'Quranic Universal Library (QUL)',
      }));
    void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
    // Keep `data` as a string array for backward-compat clients; new richer
    // data lives under `layouts`.
    return {
      data: available.map((l) => l.slug),
      layouts: available,
    };
  });

  fastify.get<{ Params: { layout: string } }>(
    '/v1/layouts/:layout/page-count',
    { schema: { tags: ['layouts'] } },
    async (req, reply) => {
      const layout = assertLayout(req.params.layout);
      const total = reader().pageCount(layout);
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return { data: { layout, pageCount: total } };
    },
  );

  fastify.get<{ Params: { layout: string; n: string } }>(
    '/v1/layouts/:layout/page/:n',
    { schema: { tags: ['layouts'] } },
    async (req, reply) => {
      const layout = assertLayout(req.params.layout);
      const n = Number.parseInt(req.params.n, 10);
      if (!Number.isFinite(n) || n < 1 || n > 999) {
        throw new QalaamError(
          'qalaam.mushaf.no-coverage',
          `Page number ${req.params.n} out of plausible range.`,
        );
      }
      const r = reader();
      const page = r.page(layout, n);
      if (!page) {
        throw new QalaamError(
          'qalaam.mushaf.no-coverage',
          `Layout ${layout} has no page ${n.toString()}.`,
        );
      }
      // Hydrate per-line words inline so the renderer doesn't fan out N+1 calls.
      const lines = page.lines.map((line) => ({
        ...line,
        words: line.lineType === 'ayah' ? r.wordsOnLine(layout, n, line.lineNumber) : [],
      }));
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return {
        data: { layout, pageNumber: page.pageNumber, linesPerPage: page.linesPerPage, lines },
        attribution: LICENSE_METADATA.quranMetadata.attributionText,
        license: LICENSE_METADATA.quranMetadata.license,
      };
    },
  );

  fastify.get<{ Params: { layout: string; verseKey: string } }>(
    '/v1/layouts/:layout/by-verse/:verseKey',
    { schema: { tags: ['layouts'] } },
    async (req, reply) => {
      const layout = assertLayout(req.params.layout);
      if (!VERSE_KEY_RE.test(req.params.verseKey)) {
        throw new QalaamError(
          'qalaam.verse-key.malformed',
          `Invalid verseKey ${req.params.verseKey}`,
        );
      }
      const where = reader().pageForVerse(layout, req.params.verseKey);
      if (!where) {
        throw new QalaamError(
          'qalaam.mushaf.no-coverage',
          `Layout ${layout} does not cover ${req.params.verseKey}.`,
        );
      }
      void reply.header('cache-control', `public, max-age=${SEVEN_DAYS_S.toString()}`);
      return { data: { layout, verseKey: req.params.verseKey, ...where } };
    },
  );
}
