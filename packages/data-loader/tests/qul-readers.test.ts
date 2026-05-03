/**
 * Sub-reader behavioural tests.
 *
 * The QUL SQLite file isn't bundled (it's downloaded by `make data-fetch`
 * per ADR-0002), so these tests build an ephemeral in-memory DB with the
 * `qalaam_v1_qul_*` table shapes the readers expect, seed minimal rows, and
 * verify the reader contracts (license-gate refusal, decoded shape, query
 * paths).
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import {
  type LicenseMetadata,
  type ScriptSlug,
  buildMushafLayoutsReader,
  buildMutashabihatExtendedReader,
  buildQuranMetadataReader,
  buildQuranScriptsReader,
  buildRecitationSegmentsReader,
  buildSurahInfoReader,
  buildWordByWordReader,
} from '../src/qul/index.js';

function newDb(): Database.Database {
  return new Database(':memory:');
}

const FACTUAL_META: LicenseMetadata = {
  sourceId: 'test',
  sourceUrl: 'https://qul.tarteel.ai/x',
  license: 'factual',
  attributionRequired: true,
  attributionText: 'QUL test',
};

const PERMISSIVE_META: LicenseMetadata = { ...FACTUAL_META, license: 'permissive-with-credit' };

const GPL_META: LicenseMetadata = { ...FACTUAL_META, license: 'gpl-derivative' };

describe('quran-metadata sub-reader', () => {
  it('decodes surah / juz / hizb / ruku / sajda from the qalaam_v1_qul_metadata_* tables', () => {
    const db = newDb();
    db.exec(`
      CREATE TABLE qalaam_v1_qul_metadata_surahs (
        surah INTEGER PRIMARY KEY, name_arabic TEXT, name_transliteration TEXT,
        name_english TEXT, verse_count INTEGER, revelation_place TEXT,
        revelation_order INTEGER, bismillah_pre INTEGER);
      CREATE TABLE qalaam_v1_qul_metadata_juz (
        juz INTEGER PRIMARY KEY, first_verse_key TEXT, last_verse_key TEXT, verse_count INTEGER);
      CREATE TABLE qalaam_v1_qul_metadata_hizb (
        hizb INTEGER PRIMARY KEY, juz INTEGER, first_verse_key TEXT, last_verse_key TEXT);
      CREATE TABLE qalaam_v1_qul_metadata_rub (
        rub INTEGER PRIMARY KEY, hizb INTEGER, first_verse_key TEXT);
      CREATE TABLE qalaam_v1_qul_metadata_manzil (
        manzil INTEGER PRIMARY KEY, first_verse_key TEXT, last_verse_key TEXT);
      CREATE TABLE qalaam_v1_qul_metadata_ruku (
        ruku INTEGER PRIMARY KEY, surah INTEGER, first_verse_key TEXT, last_verse_key TEXT);
      CREATE TABLE qalaam_v1_qul_metadata_sajda (verse_key TEXT PRIMARY KEY, type TEXT);
      INSERT INTO qalaam_v1_qul_metadata_surahs VALUES
        (1, 'الفاتحة', 'al-fatihah', 'The Opening', 7, 'makkah', 5, 0);
      INSERT INTO qalaam_v1_qul_metadata_juz VALUES (1, '1:1', '2:141', 148);
      INSERT INTO qalaam_v1_qul_metadata_ruku VALUES (1, 1, '1:1', '1:7');
      INSERT INTO qalaam_v1_qul_metadata_sajda VALUES ('7:206', 'recommended');
    `);
    const r = buildQuranMetadataReader(db, FACTUAL_META);
    expect(r.surahInfo(1)?.nameEnglish).toBe('The Opening');
    expect(r.juzBoundary(1)?.verseCount).toBe(148);
    expect(r.rukusInSurah(1)).toHaveLength(1);
    expect(r.sajdaAyahs()[0]?.type).toBe('recommended');
    db.close();
  });
});

describe('mutashabihat-extended sub-reader', () => {
  it('returns clusters whose member set contains the verseKey + watchlist by score desc', () => {
    const db = newDb();
    db.exec(`
      CREATE TABLE qalaam_v1_qul_mutashabihat_v2_clusters (
        cluster_id TEXT PRIMARY KEY, shared_phrase TEXT,
        member_verse_keys TEXT, member_offsets TEXT);
      CREATE TABLE qalaam_v1_qul_mutashabihat_v2_pairs (
        left_verse_key TEXT, right_verse_key TEXT, score REAL, note TEXT);
      INSERT INTO qalaam_v1_qul_mutashabihat_v2_clusters VALUES
        ('c1', 'فبأي آلاء ربكما تكذبان', '["55:13","55:16"]', NULL);
      INSERT INTO qalaam_v1_qul_mutashabihat_v2_pairs VALUES
        ('2:48', '2:123', 0.92, 'shifted intercession clause'),
        ('2:48', '2:254', 0.7, NULL);
    `);
    const r = buildMutashabihatExtendedReader(db, PERMISSIVE_META);
    expect(r.clustersForAyah('55:13')).toHaveLength(1);
    expect(r.pairsForAyah('2:48')).toHaveLength(2);
    const watchlist = r.watchlistFor('2:48', 1);
    expect(watchlist).toHaveLength(1);
    expect(watchlist[0]?.score).toBe(0.92);
    db.close();
  });
});

describe('word-by-word sub-reader', () => {
  it('returns translation rows; refuses morphology unless enableMorphology=true', () => {
    const db = newDb();
    db.exec(`
      CREATE TABLE qalaam_v1_qul_wbw_translations (
        verse_key TEXT, word_index INTEGER, text_arabic TEXT,
        translation TEXT, language_code TEXT);
      CREATE TABLE qalaam_v1_qul_morphology (
        verse_key TEXT, word_index INTEGER, root TEXT, lemma TEXT,
        stem TEXT, pos TEXT, irab TEXT);
      INSERT INTO qalaam_v1_qul_wbw_translations VALUES
        ('1:1', 0, 'بِسْمِ', 'In (the) name', 'en'),
        ('1:1', 1, 'ٱللَّهِ', 'of Allah', 'en');
      INSERT INTO qalaam_v1_qul_morphology VALUES
        ('1:1', 0, 'سمو', 'اسم', 'سمو', 'N', 'مجرور');
    `);
    const refused = buildWordByWordReader(db, PERMISSIVE_META, GPL_META, {
      enableMorphology: false,
    });
    expect(refused.wordsForAyah('1:1', 'en')).toHaveLength(2);
    expect(refused.morphologyForAyah('1:1')).toBeNull();

    const allowed = buildWordByWordReader(db, PERMISSIVE_META, GPL_META, {
      enableMorphology: true,
    });
    const morph = allowed.morphologyForAyah('1:1');
    expect(morph).not.toBeNull();
    expect(morph?.[0]?.root).toBe('سمو');
    db.close();
  });
});

describe('mushaf-layouts sub-reader', () => {
  it('reads pages, words on a line, and pageForVerse reverse lookup', () => {
    const db = newDb();
    db.exec(`
      CREATE TABLE qalaam_v1_qul_layouts_pages (
        layout TEXT, page_number INTEGER, line_number INTEGER, line_type TEXT,
        alignment TEXT, first_word_id INTEGER, last_word_id INTEGER, surah INTEGER,
        lines_per_page INTEGER);
      CREATE TABLE qalaam_v1_qul_layouts_words (
        layout TEXT, page_number INTEGER, line_number INTEGER,
        word_id INTEGER, word_index INTEGER, verse_key TEXT, text TEXT);
      INSERT INTO qalaam_v1_qul_layouts_pages VALUES
        ('madani_15', 1, 1, 'surah_name', 'center', NULL, NULL, 1, 15),
        ('madani_15', 1, 2, 'basmallah', 'center', NULL, NULL, NULL, 15),
        ('madani_15', 1, 3, 'ayah', 'justify', 1, 4, NULL, 15);
      INSERT INTO qalaam_v1_qul_layouts_words VALUES
        ('madani_15', 1, 3, 1, 0, '1:1', 'بِسْمِ'),
        ('madani_15', 1, 3, 2, 1, '1:1', 'ٱللَّهِ');
    `);
    const r = buildMushafLayoutsReader(db, PERMISSIVE_META);
    expect(r.pageCount('madani_15')).toBe(1);
    const page = r.page('madani_15', 1);
    expect(page?.lines).toHaveLength(3);
    expect(page?.linesPerPage).toBe(15);
    expect(r.wordsOnLine('madani_15', 1, 3)).toHaveLength(2);
    expect(r.pageForVerse('madani_15', '1:1')).toEqual({ page: 1, line: 3 });
    db.close();
  });
});

describe('recitation-segments sub-reader', () => {
  it('refuses to surface segments for unlicensed reciters', () => {
    const db = newDb();
    db.exec(`
      CREATE TABLE qalaam_v1_qul_recitations_reciters (
        reciter_id TEXT PRIMARY KEY, name_arabic TEXT, name_english TEXT,
        style TEXT, riwayah TEXT, segment_coverage INTEGER);
      CREATE TABLE qalaam_v1_qul_recitations_segments (
        reciter_id TEXT, verse_key TEXT, word_index INTEGER, start_ms INTEGER, end_ms INTEGER);
      INSERT INTO qalaam_v1_qul_recitations_reciters VALUES
        ('husary', 'الحصري', 'Mahmoud Khalil Al-Husary', 'murattal', 'hafs', 6236),
        ('unlicensed', 'X', 'X', 'murattal', 'hafs', 0);
      INSERT INTO qalaam_v1_qul_recitations_segments VALUES
        ('husary', '1:1', 0, 0, 1200),
        ('husary', '1:1', 1, 1200, 2300);
    `);
    const licenses = new Map<string, LicenseMetadata>([
      ['husary', { ...PERMISSIVE_META, license: 'per-reciter' }],
    ]);
    const r = buildRecitationSegmentsReader(db, licenses);
    expect(r.reciters().map((x) => x.reciterId)).toEqual(['husary']);
    expect(r.segmentsForAyah('husary', '1:1')).toHaveLength(2);
    expect(r.wordAtPosition('husary', '1:1', 1500)).toBe(1);
    expect(() => r.segmentsForAyah('unlicensed', '1:1')).toThrow(/unlicensed-reciter/);
    db.close();
  });
});

describe('surah-info sub-reader', () => {
  it('decodes themes JSON, returns by-language', () => {
    const db = newDb();
    db.exec(`
      CREATE TABLE qalaam_v1_qul_surah_info (
        surah INTEGER, language_code TEXT, name_arabic TEXT, name_translated TEXT,
        name_meaning TEXT, revelation_place TEXT, revelation_order INTEGER,
        verse_count INTEGER, summary TEXT, themes_json TEXT, asbab_al_nuzul TEXT);
      INSERT INTO qalaam_v1_qul_surah_info VALUES
        (1, 'en', 'الفاتحة', 'The Opening', 'The Opening', 'makkah', 5, 7,
         'The Opening — recited in every prayer.', '["tawhid","du''a","guidance"]', NULL);
    `);
    const langMap = new Map<string, LicenseMetadata>([['en', PERMISSIVE_META]]);
    const r = buildSurahInfoReader(db, langMap);
    expect(r.availableLanguages()).toEqual(['en']);
    const card = r.card(1, 'en');
    expect(card?.themes).toEqual(['tawhid', "du'a", 'guidance']);
  });
});

describe('quran-scripts sub-reader', () => {
  it('refuses unlicensed scripts; decodes bbox JSON when present', () => {
    const db = newDb();
    db.exec(`
      CREATE TABLE qalaam_v1_qul_scripts_ayahs (script TEXT, verse_key TEXT, text TEXT);
      CREATE TABLE qalaam_v1_qul_scripts_words (
        script TEXT, verse_key TEXT, word_index INTEGER, text TEXT, bbox_json TEXT);
      INSERT INTO qalaam_v1_qul_scripts_ayahs VALUES
        ('indopak_nastaleeq', '1:1', 'بسم اللہ');
      INSERT INTO qalaam_v1_qul_scripts_words VALUES
        ('indopak_nastaleeq', '1:1', 0, 'بسم', '{"x":10,"y":20,"w":40,"h":30}');
    `);
    const licenses = new Map<ScriptSlug, LicenseMetadata>([['indopak_nastaleeq', PERMISSIVE_META]]);
    const r = buildQuranScriptsReader(db, licenses);
    expect(r.ayah('indopak_nastaleeq', '1:1')?.text).toBe('بسم اللہ');
    expect(r.wordsForAyah('indopak_nastaleeq', '1:1')[0]?.bbox).toEqual({
      x: 10,
      y: 20,
      w: 40,
      h: 30,
    });
    expect(() => r.ayah('kfgqpc_v4', '1:1')).toThrow(/unlicensed-script/);
  });
});
