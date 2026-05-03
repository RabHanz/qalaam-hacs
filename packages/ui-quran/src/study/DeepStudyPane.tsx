/**
 * DeepStudyPane — 3-pane layout for serious reading.
 *
 * Per strategy §11.3 + §21.4: Arabic + translations stack + tafsir scroll.
 * Mobile collapses to tabbed view (CSS-driven; no JS state).
 *
 * Sync: pane content shares the same `verseKey` so scroll position can sync
 * by anchor in v0.5; v0.1 ships single-ayah deep-study which doesn't need sync.
 */
import type { ReactNode } from 'react';

import type { VerseKey } from '@qalaam/core';

export interface DeepStudyPaneProps {
  readonly verseKey: VerseKey;
  readonly arabic: string;
  /** Translation entries already resolved at the route layer. */
  readonly translations: ReadonlyArray<{
    readonly slug: string;
    readonly translatorName: string;
    readonly text: string;
  }>;
  /** Tafsir entries already resolved at the route layer. */
  readonly tafsirs: ReadonlyArray<{
    readonly slug: string;
    readonly scholarName: string;
    readonly language: string;
    readonly text: string;
  }>;
}

export function DeepStudyPane({
  verseKey,
  arabic,
  translations,
  tafsirs,
}: DeepStudyPaneProps): ReactNode {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1.5rem',
        gridTemplateColumns: 'minmax(0, 1fr)',
        // 3-pane on wide screens via CSS-only — no JS responsive logic.
      }}
      className="qalaam-deep-study"
    >
      <style>{`
        @media (min-width: 1024px) {
          .qalaam-deep-study {
            grid-template-columns: 1.1fr 1fr 1.4fr !important;
            gap: 1.5rem;
          }
        }
      `}</style>

      {/* PANE 1 — Arabic */}
      <section
        aria-label={`Arabic text of ${verseKey}`}
        style={{
          background: 'var(--color-surface-raised, #fff)',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
        }}
      >
        <header style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.6, letterSpacing: '0.05em' }}>
            VERSE {verseKey}
          </span>
        </header>
        <p
          dir="rtl"
          style={{
            fontFamily: "'KFGQPC HAFS Uthmanic Script V2', 'Amiri Quran', serif",
            fontSize: '2.5rem',
            lineHeight: 2,
            margin: 0,
            unicodeBidi: 'plaintext',
            textAlign: 'right',
          }}
        >
          {arabic}
        </p>
      </section>

      {/* PANE 2 — translations stack */}
      <section
        aria-label={`Translations of ${verseKey}`}
        style={{
          background: 'var(--color-surface-raised, #fff)',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
        }}
      >
        <header style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.6, letterSpacing: '0.05em' }}>
            TRANSLATIONS
          </span>
        </header>
        {translations.length === 0 ? (
          <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
            No translations bundled for this verse yet.
          </p>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1rem' }}>
            {translations.map((t) => (
              <li key={t.slug}>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{t.text}</p>
                <footer
                  style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}
                >
                  — {t.translatorName}
                </footer>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* PANE 3 — tafsir scroll */}
      <section
        aria-label={`Tafsir of ${verseKey}`}
        style={{
          background: 'var(--color-surface-raised, #fff)',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 1px 2px rgba(16,56,64,0.06)',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}
      >
        <header style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.6, letterSpacing: '0.05em' }}>
            TAFSIR
          </span>
        </header>
        {tafsirs.length === 0 ? (
          <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
            No tafsir bundled for this verse yet.
          </p>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1.25rem' }}>
            {tafsirs.map((t) => (
              <li key={t.slug}>
                <p
                  dir={t.language === 'ar' ? 'rtl' : 'ltr'}
                  style={{
                    margin: 0,
                    lineHeight: 1.7,
                    fontFamily:
                      t.language === 'ar'
                        ? "'KFGQPC HAFS Uthmanic Script V2', serif"
                        : 'inherit',
                    fontSize: t.language === 'ar' ? '1.125rem' : '0.95rem',
                    unicodeBidi: 'plaintext',
                  }}
                >
                  {t.text}
                </p>
                <footer
                  style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem' }}
                >
                  — {t.scholarName}
                </footer>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
