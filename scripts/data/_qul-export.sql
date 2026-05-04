-- Export QUL Postgres tables as a single JSON document. The companion
-- python script splits the doc into per-resource files matching the
-- shapes our ingest scripts expect (see scripts/data/ingest-qul-*.ts).
--
-- Shapes pinned to QUL upstream schema as of 2026-05 (mini_quran_dev.sql
-- from static-cdn.tarteel.ai). Defensive against missing tables: every
-- subquery is gated on `to_regclass()` so the absence of mutashabihat /
-- similar_ayahs (not in the mini dump) yields an empty array, not an error.

\set ON_ERROR_STOP off
SET search_path = quran, public;

SELECT json_build_object(
  'tables', (
    SELECT json_agg(t.table_name)
    FROM information_schema.tables t
    WHERE t.table_schema = 'quran'
  ),
  'chapters', COALESCE((
    SELECT json_agg(row_to_json(c)) FROM (
      SELECT id AS surah, name_arabic, name_simple, name_complex,
             verses_count, revelation_place, revelation_order,
             COALESCE(bismillah_pre, true) AS bismillah_pre
      FROM quran.chapters
      ORDER BY id
    ) c
  ), '[]'::json),
  'juzs', COALESCE((
    SELECT json_agg(row_to_json(j)) FROM (
      SELECT juz_number AS juz, first_verse_id, last_verse_id, verses_count
      FROM quran.juzs
      ORDER BY juz_number
    ) j
  ), '[]'::json),
  'hizbs', COALESCE((
    SELECT json_agg(row_to_json(h)) FROM (
      SELECT hizb_number AS hizb, first_verse_id, last_verse_id, verses_count
      FROM quran.hizbs
      ORDER BY hizb_number
    ) h
  ), '[]'::json),
  'rub_el_hizbs', COALESCE((
    SELECT json_agg(row_to_json(r)) FROM (
      SELECT rub_el_hizb_number AS rub, first_verse_id, last_verse_id
      FROM quran.rub_el_hizbs
      ORDER BY rub_el_hizb_number
    ) r
  ), '[]'::json),
  'manzils', COALESCE((
    SELECT json_agg(row_to_json(m)) FROM (
      SELECT manzil_number AS manzil, first_verse_id, last_verse_id, verses_count
      FROM quran.manzils
      ORDER BY manzil_number
    ) m
  ), '[]'::json),
  'rukus', COALESCE((
    SELECT json_agg(row_to_json(rk)) FROM (
      SELECT ruku_number AS ruku, first_verse_id, last_verse_id, verses_count
      FROM quran.rukus
      ORDER BY ruku_number
    ) rk
  ), '[]'::json),
  'sajda_verses', COALESCE((
    SELECT json_agg(row_to_json(s)) FROM (
      SELECT verse_key, sajdah_type AS type
      FROM quran.verses
      WHERE sajdah_type IS NOT NULL
      ORDER BY verse_key
    ) s
  ), '[]'::json),
  'verses_keys', COALESCE(
    (SELECT json_object_agg(id, verse_key) FROM quran.verses),
    '{}'::json
  ),
  'verses_basic', COALESCE((
    SELECT json_agg(row_to_json(v)) FROM (
      SELECT id, verse_key, chapter_id, verse_number,
             text_uthmani, text_indopak, text_imlaei,
             juz_number, hizb_number, rub_el_hizb_number, page_number
      FROM quran.verses
      ORDER BY id
    ) v
  ), '[]'::json),
  -- mutashabihat + similar_ayahs are NOT in the mini dump. Emit empty
  -- arrays here; the full set requires the production dump or a
  -- license-reviewed scrape per ADR-0020.
  'mutashabihat_phrases', '[]'::json,
  'similar_ayah_pairs', '[]'::json,
  'wbw_translations', COALESCE((
    SELECT json_agg(row_to_json(w)) FROM (
      SELECT
        words.verse_id,
        words.position,
        words.text_uthmani,
        words.text_indopak,
        wt.text AS en_translation,
        wt.language_name
      FROM quran.words AS words
      JOIN quran.word_translations AS wt ON wt.word_id = words.id
      WHERE wt.language_name = 'english'
      LIMIT 80000
    ) w
  ), '[]'::json)
) AS qul_export;
