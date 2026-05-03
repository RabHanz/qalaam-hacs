import { describe, expect, it } from 'vitest';

import {
  BUNDLE_SAFE_LICENSES,
  attributionLine,
  isBundleSafe,
} from '../src/qul/license.js';

describe('@qalaam/data-loader QUL license', () => {
  it('public-domain + factual + permissive-with-credit are bundle-safe', () => {
    expect(isBundleSafe('public-domain')).toBe(true);
    expect(isBundleSafe('factual')).toBe(true);
    expect(isBundleSafe('permissive-with-credit')).toBe(true);
  });

  it('GPL-derivative is NOT bundle-safe', () => {
    expect(isBundleSafe('gpl-derivative')).toBe(false);
  });

  it('KFGQPC + DigitalKhatt + per-translator + per-reciter need explicit handling per call site', () => {
    expect(isBundleSafe('kfgqpc-terms')).toBe(false);
    expect(isBundleSafe('digitalkhatt-anane')).toBe(false);
    expect(isBundleSafe('per-translator')).toBe(false);
    expect(isBundleSafe('per-reciter')).toBe(false);
  });

  it('unverified MUST never be bundle-safe', () => {
    expect(isBundleSafe('unverified')).toBe(false);
    expect(BUNDLE_SAFE_LICENSES.has('unverified')).toBe(false);
  });

  it('attribution line includes attribution text when required', () => {
    const line = attributionLine({
      sourceId: 'qul-metadata-63',
      sourceUrl: 'https://qul.tarteel.ai/resources/quran-metadata/63',
      license: 'factual',
      attributionRequired: true,
      attributionText: 'Quranic Universal Library (QUL) by Tarteel AI',
    });
    expect(line).toContain('Quranic Universal Library (QUL)');
    expect(line).toContain('https://qul.tarteel.ai');
  });

  it('attribution line skips text when attribution not required', () => {
    const line = attributionLine({
      sourceId: 'fact',
      sourceUrl: 'https://qul.tarteel.ai/x',
      license: 'public-domain',
      attributionRequired: false,
      attributionText: 'should not appear',
    });
    expect(line).not.toContain('should not appear');
    expect(line).toContain('via QUL: https://qul.tarteel.ai/x');
  });
});
