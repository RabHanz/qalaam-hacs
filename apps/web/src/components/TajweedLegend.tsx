'use client';

/**
 * TajweedLegend — bottom-sheet that explains the 18-rule tajweed color
 * palette. Surfaces the INTRO promise: "Tajweed colored beautifully,
 * with a legend explaining each rule."
 *
 * Two affordances:
 *   1. Floating "Legend" pill rendered on /mushaf/tajweed + /read when
 *      the tajweed layout is active. Tap → bottom sheet with all 18
 *      rules + Arabic name + sample + 1-line explanation + link to the
 *      relevant Quranic Arabic course lesson (Level 2).
 *   2. Mini popover variant: pass `inline` prop to render as a small
 *      pill that, when tapped on a colored span, shows the matching
 *      rule explanation only.
 */
import { useEffect, useState } from 'react';

import type { ReactNode } from 'react';

interface RuleEntry {
  readonly className: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly explanation: string;
  readonly category: 'noon-meem' | 'madd' | 'qalqalah' | 'special';
  readonly lessonSlug?: string;
}

// Curated authoritative Tajweed rule set — matches the 18 .tajweed-*
// classes in the CSS palette + the cpfair/quran-tajweed annotation
// taxonomy. Explanations follow Hisham Anwar's "Tajweed Made Easy" +
// the official madhhab teachings as cross-referenced by IslamQA.
const RULES: readonly RuleEntry[] = [
  {
    className: 'tajweed-ghunnah',
    nameEn: 'Ghunnah',
    nameAr: 'غُنّة',
    explanation:
      'Nasalization held for ~2 harakāt (≈1 second) — applies to a shadda on noon (نّ) or meem (مّ).',
    category: 'noon-meem',
    lessonSlug: 'level-2/ghunnah',
  },
  {
    className: 'tajweed-idghaam_ghunnah',
    nameEn: 'Idghām with Ghunnah',
    nameAr: 'إدغام بِغُنّة',
    explanation:
      'Noon-sākin/Tanween merges into the next letter (ي ن م و) WITH nasalization for ~2 harakāt.',
    category: 'noon-meem',
    lessonSlug: 'level-2/idghaam-with-ghunnah',
  },
  {
    className: 'tajweed-idghaam_no_ghunnah',
    nameEn: 'Idghām without Ghunnah',
    nameAr: 'إدغام بِلا غُنّة',
    explanation: 'Noon-sākin/Tanween merges into the next letter (ر ل) WITHOUT nasalization.',
    category: 'noon-meem',
    lessonSlug: 'level-2/idghaam-without-ghunnah',
  },
  {
    className: 'tajweed-idghaam_shafawi',
    nameEn: 'Idghām Shafawī',
    nameAr: 'إدغام شَفَوي',
    explanation: 'Meem-sākin merges into a following meem with full ghunnah.',
    category: 'noon-meem',
  },
  {
    className: 'tajweed-idghaam_mutajanisayn',
    nameEn: 'Idghām al-Mutajānisayn',
    nameAr: 'إدغام المُتجانسين',
    explanation: 'Two letters of identical articulation point merge — e.g., د in تْ, ت in طْ.',
    category: 'noon-meem',
  },
  {
    className: 'tajweed-idghaam_mutaqaribayn',
    nameEn: 'Idghām al-Mutaqāribayn',
    nameAr: 'إدغام المُتقاربين',
    explanation: 'Two close-articulation letters merge — most commonly ث into ذْ, ل into رْ.',
    category: 'noon-meem',
  },
  {
    className: 'tajweed-ikhfa',
    nameEn: 'Ikhfā',
    nameAr: 'إخفاء',
    explanation:
      'Noon-sākin/Tanween hidden before the 15 ikhfā letters — held with light ghunnah for ~2 harakāt.',
    category: 'noon-meem',
    lessonSlug: 'level-2/ikhfa',
  },
  {
    className: 'tajweed-ikhfa_shafawi',
    nameEn: 'Ikhfā Shafawī',
    nameAr: 'إخفاء شَفَوي',
    explanation: "Meem-sākin lightly hidden before ب — lips don't fully close.",
    category: 'noon-meem',
  },
  {
    className: 'tajweed-iqlab',
    nameEn: 'Iqlāb',
    nameAr: 'إقلاب',
    explanation:
      'Noon-sākin/Tanween converts to a hidden meem before ب — held with ghunnah for ~2 harakāt. Marked in the mushaf by the small low meem (ۭ) placed on or below the tanween/nūn — visible in words like ٱنتِقَامٍۭ and شَدِيدٌۭ.',
    category: 'noon-meem',
    lessonSlug: 'level-2/iqlab',
  },
  {
    className: 'tajweed-qalqalah',
    nameEn: 'Qalqalah',
    nameAr: 'قَلْقَلة',
    explanation: 'Bouncing/echo on the 5 letters ق ط ب ج د when sākin — without adding a vowel.',
    category: 'qalqalah',
    lessonSlug: 'level-2/qalqalah',
  },
  {
    className: 'tajweed-madd_2',
    nameEn: 'Madd Ṭabīʿī',
    nameAr: 'مَدّ طَبِيعي',
    explanation:
      'Natural elongation — exactly 2 harakāt (≈1 second). The base length all other madds derive from.',
    category: 'madd',
    lessonSlug: 'level-2/madd-tabii',
  },
  {
    className: 'tajweed-madd_246',
    nameEn: 'Madd Liyn / Permissible Madd',
    nameAr: 'مَدّ ليّن',
    explanation:
      "May be elongated 2, 4, or 6 harakāt. Reciter's discretion within the permitted range.",
    category: 'madd',
  },
  {
    className: 'tajweed-madd_6',
    nameEn: 'Madd Lāzim',
    nameAr: 'مَدّ لازِم',
    explanation:
      'Required elongation — exactly 6 harakāt. Triggered by a sukoon or shadda following the madd letter.',
    category: 'madd',
    lessonSlug: 'level-2/madd-lazim',
  },
  {
    className: 'tajweed-madd_munfasil',
    nameEn: 'Madd Munfaṣil',
    nameAr: 'مَدّ مُنفَصِل',
    explanation:
      'Separated madd — when the madd letter is at the end of a word and a hamza begins the next word. 2-5 harakāt (Hafs default 4).',
    category: 'madd',
  },
  {
    className: 'tajweed-madd_muttasil',
    nameEn: 'Madd Muttaṣil',
    nameAr: 'مَدّ مُتَّصِل',
    explanation:
      'Connected madd — when the madd letter and a hamza are in the SAME word. Required 4-5 harakāt.',
    category: 'madd',
  },
  {
    className: 'tajweed-hamzat_wasl',
    nameEn: 'Hamzat al-Waṣl',
    nameAr: 'هَمزة الوَصل',
    explanation:
      'Connecting hamza — pronounced when starting, silent when continuing from the previous word.',
    category: 'special',
  },
  {
    className: 'tajweed-silent',
    nameEn: 'Silent',
    nameAr: 'حَرف ساكِن مُهمَل',
    explanation: 'Letter is written but not pronounced (e.g., the alif in أَنَا).',
    category: 'special',
  },
  {
    className: 'tajweed-lam_shamsiyyah',
    nameEn: 'Lām Shamsiyyah',
    nameAr: 'لام شَمسِيّة',
    explanation:
      'Solar lām — the ل of ال is silent and the next letter is doubled (e.g., الشَّمس).',
    category: 'special',
    lessonSlug: 'level-2/lam-shamsiyyah-qamariyyah',
  },
];

const CATEGORY_LABEL: Record<RuleEntry['category'], string> = {
  'noon-meem': 'Noon & Meem rules',
  madd: 'Madd (elongation)',
  qalqalah: 'Qalqalah',
  special: 'Special letters',
};

interface Props {
  /** When true, renders nothing visible until consumer toggles via context;
   *  used by the inline-popover pattern. Default false → render the FAB pill. */
  readonly inline?: boolean;
}

export function TajweedLegend({ inline = false }: Props): ReactNode {
  const [open, setOpen] = useState(false);

  // Body scroll lock + Esc to close — same posture as TranslationPicker
  // so all bottom sheets behave consistently on mobile.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (sbWidth > 0) document.body.style.paddingRight = `${sbWidth.toString()}px`;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  // Group rules by category for the editorial subject-index layout.
  const grouped: Record<RuleEntry['category'], RuleEntry[]> = {
    'noon-meem': [],
    madd: [],
    qalqalah: [],
    special: [],
  };
  for (const r of RULES) grouped[r.category].push(r);

  return (
    <>
      {!inline ? (
        <button
          type="button"
          aria-label="Open tajweed legend"
          onClick={() => {
            setOpen(true);
          }}
          /* Mobile: sit ABOVE the sticky player bar (bottom-24).
             Desktop: sit ALIGNED with the player's vertical centre
             (sm:bottom-4 ≈ 16px from viewport bottom puts a ~40px-tall
             FAB centred on a ~70px-tall player bar). The previous
             sm:bottom-28 was way too high. */
          className="jump-fab bg-paper text-ink border-hairline hover:bg-paper-100 fixed bottom-24 left-4 z-40 inline-flex touch-manipulation items-center gap-2 rounded-full border px-4 py-2.5 shadow-lg sm:bottom-4 sm:left-8 sm:px-5 sm:py-3"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <span className="smallcaps text-[11px] tracking-widest sm:text-xs">Tajweed legend</span>
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tajweed-legend-title"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setOpen(false);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
            }}
            className="bg-ink-900/40 absolute inset-0 backdrop-blur-sm"
          />
          <div
            className="bg-paper border-hairline sheet-rise relative w-full rounded-t-2xl border-t shadow-2xl sm:max-w-lg sm:rounded-2xl sm:border"
            style={{
              maxHeight: '92dvh',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex justify-center pb-1 pt-3 sm:hidden">
              <div className="bg-paper-300/80 h-1.5 w-12 rounded-full" aria-hidden />
            </div>

            <header className="flex items-baseline justify-between px-5 pb-3 pt-3 sm:px-6 sm:pt-6">
              <div>
                <p className="smallcaps text-leaf text-[11px] tracking-widest">Tajweed legend</p>
                <h2
                  id="tajweed-legend-title"
                  className="font-display text-ink-strong text-xl sm:text-2xl"
                >
                  18 rules · أحكام التجويد
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setOpen(false);
                }}
                className="text-ink-muted hover:text-ink -mr-1 touch-manipulation p-1"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div
              className="flex-1 overflow-y-auto px-5 pb-6 sm:px-6"
              style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
            >
              {(['noon-meem', 'madd', 'qalqalah', 'special'] as const).map((cat) => {
                const items = grouped[cat];
                if (items.length === 0) return null;
                return (
                  <section key={cat} className="mb-5 last:mb-0">
                    <h3 className="smallcaps text-leaf mb-2 text-[10px] tracking-widest">
                      {CATEGORY_LABEL[cat]}
                    </h3>
                    <ul className="m-0 list-none space-y-2.5 p-0">
                      {items.map((r) => (
                        <li key={r.className} className="flex items-start gap-3">
                          <span
                            className={`shrink-0 ${r.className} font-arabic mt-0.5 text-2xl leading-none`}
                            style={{
                              fontFamily: '"UthmanicHafs"',
                              fontWeight: 600,
                            }}
                            aria-hidden
                          >
                            {/* Sample letter colored with the rule's class. */}ا
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="font-display text-ink-strong text-[15px]">
                                {r.nameEn}
                              </span>
                              <span
                                dir="rtl"
                                lang="ar"
                                className="font-arabic text-ink-muted text-base"
                                style={{ fontFamily: '"UthmanicHafs"' }}
                              >
                                {r.nameAr}
                              </span>
                            </div>
                            <p className="text-ink/85 mt-0.5 text-[13px] leading-relaxed">
                              {r.explanation}
                            </p>
                            {r.lessonSlug ? (
                              <a
                                href={`/learn/${r.lessonSlug}`}
                                className="smallcaps text-leaf mt-1 inline-block text-[10px] tracking-widest hover:underline"
                              >
                                Lesson →
                              </a>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              <p className="text-ink-muted border-hairline/60 mt-3 border-t pt-2 text-center text-[10px] italic">
                Tajweed annotations: cpfair/quran-tajweed (MIT) · 60K char-range entries
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
