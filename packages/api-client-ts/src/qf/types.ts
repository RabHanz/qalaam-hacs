/**
 * Subset of QF response shapes that Qalaam consumes. We intentionally do NOT
 * model the entire QF API surface — only what we need, with `unknown` escape
 * hatches for fields we don't use today. This keeps the contract narrow and the
 * package small.
 */

export interface QfChapter {
  readonly id: number;
  readonly revelation_place: 'makkah' | 'madinah';
  readonly revelation_order: number;
  readonly bismillah_pre: boolean;
  readonly name_simple: string;
  readonly name_complex: string;
  readonly name_arabic: string;
  readonly verses_count: number;
  readonly pages: readonly [number, number];
  readonly translated_name?: { language_name: string; name: string };
}

export interface QfVerse {
  readonly id: number;
  readonly verse_key: string;
  readonly verse_number: number;
  readonly chapter_id: number;
  readonly text_uthmani?: string;
  readonly text_uthmani_tajweed?: string;
  readonly text_indopak?: string;
  readonly text_imlaei?: string;
  readonly juz_number?: number;
  readonly hizb_number?: number;
  readonly rub_el_hizb_number?: number;
  readonly ruku_number?: number;
  readonly manzil_number?: number;
  readonly page_number?: number;
  readonly sajdah_type?: string | null;
  readonly translations?: readonly { id: number; resource_id: number; text: string }[];
  readonly words?: readonly QfWord[];
}

export interface QfWord {
  readonly id: number;
  readonly position: number;
  readonly text_uthmani?: string;
  readonly text_indopak?: string;
  readonly text_qpc_hafs?: string;
  readonly char_type_name: 'word' | 'end';
  readonly line_number?: number;
  readonly page_number?: number;
  readonly translation?: { text: string; language_name: string };
  readonly transliteration?: { text: string; language_name: string };
}

export interface QfRecitation {
  readonly id: number;
  readonly reciter_name: string;
  readonly style: 'Murattal' | 'Mujawwad' | string;
  readonly translated_name?: { language_name: string; name: string };
  readonly qirat_type?: string;
}

export interface QfAudioFile {
  readonly id: number;
  readonly chapter_id: number;
  readonly file_size: number;
  readonly format: string;
  readonly audio_url: string;
  readonly verse_timings?: readonly QfVerseTiming[];
}

export interface QfVerseTiming {
  readonly verse_key: string;
  readonly timestamp_from: number;
  readonly timestamp_to: number;
  readonly duration: number;
  readonly segments?: readonly (readonly [number, number, number])[]; // [word_index, start_ms, end_ms]
}

export interface QfPagination {
  readonly per_page: number;
  readonly current_page: number;
  readonly next_page?: number | null;
  readonly total_pages: number;
  readonly total_records: number;
}

export interface QfVersesResponse {
  readonly verses: readonly QfVerse[];
  readonly pagination: QfPagination;
}
