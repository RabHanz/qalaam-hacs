import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { QalaamError, parseVerseKey } from '@qalaam/core';

import {
  getQuranAlignSegments,
  loadQuranAlignFile,
} from '../src/quran-align/index.js';

const TMP = '/tmp/qalaam-data-loader-tests';

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('quran-align loader', () => {
  it('loads a well-formed file and serves segments', () => {
    const path = join(TMP, 'alafasy.json');
    writeFileSync(
      path,
      JSON.stringify({
        '1:1': [
          [0, 850],
          [851, 1500],
          [1501, 2200],
          [2201, 3100],
        ],
      }),
    );
    const index = loadQuranAlignFile('alafasy', path);
    expect(index.reciterId).toBe('alafasy');
    const segs = getQuranAlignSegments(index, parseVerseKey('1:1'));
    expect(segs).toHaveLength(4);
    expect(segs[0]?.startMs).toBe(0);
    expect(segs[3]?.endMs).toBe(3100);
  });

  it('throws on missing file', () => {
    expect(() => loadQuranAlignFile('x', '/no/such/file.json')).toThrowError(QalaamError);
  });

  it('throws on malformed tuple', () => {
    const path = join(TMP, 'broken.json');
    writeFileSync(path, JSON.stringify({ '1:1': [[0]] }));
    expect(() => loadQuranAlignFile('broken', path)).toThrowError(QalaamError);
  });

  it('throws on invalid verse key', () => {
    const path = join(TMP, 'bad-key.json');
    writeFileSync(path, JSON.stringify({ '999:99': [[0, 1]] }));
    expect(() => loadQuranAlignFile('bad', path)).toThrowError(QalaamError);
  });
});
