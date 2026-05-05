/**
 * /grammar — primer page introducing the I'rab (إعراب) system + the
 * 128K-row Quranic Arabic Corpus that powers it. Surfaces the most
 * useful entry points: case explainer, POS legend, root concordance,
 * and a "browse by frequency" jump.
 *
 * The morphology data itself is exposed via /v1/morphology/:verseKey
 * (used by the MorphologyPane on /study/:s/:a) and
 * /v1/morphology/root/:root (used by /concordance/root/:root). This
 * page is the editorial "front door" so learners discover the system
 * instead of stumbling on it in /study.
 */
import Link from 'next/link';

import { SiteNav } from '../../components/SiteNav.js';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Grammar primer · Qalaam',
  description:
    "I'rab — the Arabic system of grammatical case, mood, and morphology — applied to every word of the Quran via the Quranic Arabic Corpus.",
};

interface CaseRow {
  abbr: string;
  ar: string;
  en: string;
  hint: string;
}
const CASES: readonly CaseRow[] = [
  {
    abbr: 'NOM',
    ar: 'مرفوع',
    en: 'Nominative',
    hint: 'Subject of a verbal sentence; the first noun of a nominal sentence (mubtada). Marker: ḍammah on the last consonant.',
  },
  {
    abbr: 'ACC',
    ar: 'منصوب',
    en: 'Accusative',
    hint: 'Direct object; predicate of kāna; circumstantial (ḥāl). Marker: fatḥah.',
  },
  {
    abbr: 'GEN',
    ar: 'مجرور',
    en: 'Genitive',
    hint: 'After a preposition; second term of an iḍāfah (possessive construction). Marker: kasrah.',
  },
];

interface MoodRow {
  abbr: string;
  ar: string;
  en: string;
  hint: string;
}
const MOODS: readonly MoodRow[] = [
  {
    abbr: 'IND',
    ar: 'مرفوع',
    en: 'Indicative',
    hint: 'Default verbal mood (yaktubu — he writes / is writing).',
  },
  {
    abbr: 'SUB',
    ar: 'منصوب',
    en: 'Subjunctive',
    hint: 'After particles like an, lan, kay (he wants to write — yurīdu an yaktuba).',
  },
  {
    abbr: 'JUS',
    ar: 'مجزوم',
    en: 'Jussive',
    hint: 'After lam, lammā, conditional particles (he did not write — lam yaktub).',
  },
];

interface PosRow {
  tag: string;
  en: string;
  ar: string;
  example: string;
  exampleVerse: string;
}
const POS_GUIDE: readonly PosRow[] = [
  { tag: 'V', en: 'Verb', ar: 'فعل', example: 'يَخْلُقُ', exampleVerse: '2:21' },
  { tag: 'N', en: 'Noun', ar: 'اسم', example: 'بِسْمِ', exampleVerse: '1:1' },
  { tag: 'PN', en: 'Proper noun', ar: 'علم', example: 'ٱللَّهِ', exampleVerse: '1:1' },
  { tag: 'ADJ', en: 'Adjective', ar: 'صفة', example: 'رَّحْمَٰنِ', exampleVerse: '1:1' },
  { tag: 'P', en: 'Preposition', ar: 'حرف جر', example: 'بِ', exampleVerse: '1:1' },
  { tag: 'CONJ', en: 'Conjunction', ar: 'حرف عطف', example: 'وَ', exampleVerse: '2:3' },
  { tag: 'PRON', en: 'Pronoun', ar: 'ضمير', example: 'هُوَ', exampleVerse: '112:1' },
  { tag: 'REL', en: 'Relative pronoun', ar: 'اسم موصول', example: 'ٱلَّذِي', exampleVerse: '2:1' },
  { tag: 'DEM', en: 'Demonstrative', ar: 'اسم إشارة', example: 'ذَٰلِكَ', exampleVerse: '2:2' },
  { tag: 'DET', en: 'Determiner', ar: 'تعريف', example: 'ٱل', exampleVerse: '1:2' },
  { tag: 'NEG', en: 'Negation', ar: 'حرف نفي', example: 'لَا', exampleVerse: '2:2' },
  { tag: 'INL', en: 'Quranic initials', ar: 'حروف مقطعة', example: 'الٓمٓ', exampleVerse: '2:1' },
];

// Five most prevalent roots in the corpus — entry points for browse.
const STARTER_ROOTS: readonly { bw: string; ar: string; en: string; count: number }[] = [
  { bw: 'Alh', ar: 'ا ل ه', en: 'God / divinity', count: 2851 },
  { bw: 'rb', ar: 'ر ب ب', en: 'Lord / nurturer', count: 980 },
  { bw: 'qwl', ar: 'ق و ل', en: 'Saying', count: 1722 },
  { bw: 'kwn', ar: 'ك و ن', en: 'Being / becoming', count: 1361 },
  { bw: 'Eml', ar: 'ع م ل', en: 'Action / deed', count: 359 },
];

export default function GrammarPrimerPage(): ReactNode {
  return (
    <>
      <SiteNav />
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
          <p className="smallcaps text-leaf text-[11px] tracking-widest">I&apos;rab · إعراب</p>
          <h1 className="font-display text-ink-strong mt-3 text-3xl font-light tracking-tight sm:text-5xl">
            Read every word as the grammar reveals it.
          </h1>
          <p className="text-ink-muted mt-4 max-w-prose text-sm leading-relaxed sm:text-base">
            I&apos;rab is the Arabic system of <em>case</em>, <em>mood</em>, and <em>morphology</em>{' '}
            that decides how each word relates to every other word in its sentence. We&apos;ve
            mapped 128,219 tokens of the Quran to their full grammatical analysis — case, gender,
            number, root, lemma, prefix/stem/suffix decomposition — using the open Quranic Arabic
            Corpus.
          </p>
          <p className="text-ink-muted mt-2 max-w-prose text-sm leading-relaxed sm:text-base">
            Open any verse on{' '}
            <Link href="/study/1/1" className="text-leaf underline-offset-2 hover:underline">
              /study
            </Link>{' '}
            and the Morphology pane shows it ayah-by-ayah, word-by-word.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-12 px-4 py-8 sm:px-6 sm:py-12">
        {/* Case */}
        <section>
          <h2 className="font-display text-ink-strong text-xl sm:text-2xl">Case · إعراب الاسم</h2>
          <p className="text-ink-muted mt-1.5 max-w-prose text-sm">
            Every noun in Arabic carries one of three cases. The case ending tells you the
            word&apos;s grammatical role — without it, the sentence is ambiguous.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CASES.map((c) => (
              <div key={c.abbr} className="paper-card flex flex-col gap-1.5 px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="smallcaps text-leaf text-[10px] tracking-widest">{c.abbr}</span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-ink text-base"
                    style={{ unicodeBidi: 'plaintext' }}
                  >
                    {c.ar}
                  </span>
                </div>
                <p className="font-display text-ink-strong text-base">{c.en}</p>
                <p className="text-ink-muted/90 text-xs leading-relaxed">{c.hint}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mood */}
        <section>
          <h2 className="font-display text-ink-strong text-xl sm:text-2xl">Mood · إعراب الفعل</h2>
          <p className="text-ink-muted mt-1.5 max-w-prose text-sm">
            The imperfect verb (mudāri&apos;) takes one of three moods, marked on its last letter.
            Particles before the verb decide which.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {MOODS.map((m) => (
              <div key={m.abbr} className="paper-card flex flex-col gap-1.5 px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="smallcaps text-leaf text-[10px] tracking-widest">{m.abbr}</span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-ink text-base"
                    style={{ unicodeBidi: 'plaintext' }}
                  >
                    {m.ar}
                  </span>
                </div>
                <p className="font-display text-ink-strong text-base">{m.en}</p>
                <p className="text-ink-muted/90 text-xs leading-relaxed">{m.hint}</p>
              </div>
            ))}
          </div>
        </section>

        {/* POS legend */}
        <section>
          <h2 className="font-display text-ink-strong text-xl sm:text-2xl">Parts of speech</h2>
          <p className="text-ink-muted mt-1.5 max-w-prose text-sm">
            The Quranic Arabic Corpus uses a 45-tag set. The most common ones — open any of these to
            land on a verse where it appears.
          </p>
          <ul className="border-hairline divide-hairline/60 mt-4 divide-y rounded-md border">
            {POS_GUIDE.map((p) => (
              <li key={p.tag}>
                <Link
                  href={`/study/${p.exampleVerse.split(':')[0] ?? '1'}/${p.exampleVerse.split(':')[1] ?? '1'}`}
                  className="hover:bg-paper-100 flex items-baseline justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span className="smallcaps text-leaf w-12 shrink-0 font-mono text-[10px] tabular-nums tracking-widest">
                      {p.tag}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-ink-strong text-sm">{p.en}</p>
                      <p
                        dir="rtl"
                        lang="ar"
                        className="font-arabic text-ink-muted text-xs"
                        style={{ unicodeBidi: 'plaintext' }}
                      >
                        {p.ar}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3">
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-ink-strong text-base sm:text-lg"
                      style={{
                        unicodeBidi: 'plaintext',
                        fontFamily: '"UthmanicHafs"',
                      }}
                    >
                      {p.example}
                    </span>
                    <span className="text-ink-muted/70 font-mono text-[10px] tabular-nums">
                      {p.exampleVerse}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Roots */}
        <section>
          <h2 className="font-display text-ink-strong text-xl sm:text-2xl">Roots · جذور</h2>
          <p className="text-ink-muted mt-1.5 max-w-prose text-sm">
            Arabic builds families of words from a triliteral root. The root carries the base
            meaning; vowel patterns + affixes give the specific word. Tap to see every Quranic
            occurrence.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STARTER_ROOTS.map((r) => (
              <li key={r.bw}>
                <Link
                  href={`/concordance/root/${encodeURIComponent(r.bw)}`}
                  className="paper-card hover-rise flex items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-ink-strong shrink-0 text-lg sm:text-xl"
                      style={{ unicodeBidi: 'plaintext' }}
                    >
                      {r.ar}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-ink-strong text-sm">{r.en}</p>
                      <p className="text-ink-muted/70 font-mono text-[10px] tabular-nums">
                        root <code>{r.bw}</code>
                      </p>
                    </div>
                  </div>
                  <span className="smallcaps text-leaf shrink-0 font-mono text-[10px] tabular-nums tracking-widest">
                    {r.count.toString()}×
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Attribution */}
        <p className="text-ink-muted/80 mt-12 text-center text-[11px] italic">
          Morphological data: Quranic Arabic Corpus (Kais Dukes, 2011) ·{' '}
          <a
            href="https://corpus.quran.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-leaf underline-offset-2 hover:underline"
          >
            corpus.quran.com
          </a>{' '}
          · GPLv3
        </p>
      </main>
    </>
  );
}
