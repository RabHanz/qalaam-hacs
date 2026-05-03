/**
 * /learn/[level]/[slug] — single-lesson view.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { lessonById } from '@qalaam/curriculum';
import { LessonView, MakhrajDiagram } from '@qalaam/ui-learn';

import { EmptyState } from '../../../../components/EmptyState.js';

interface PageProps {
  readonly params: Promise<{ level: string; slug: string }>;
}

export default async function LearnLessonPage({ params }: PageProps): Promise<ReactNode> {
  const { level, slug } = await params;
  let lesson;
  try {
    lesson = lessonById(`${level}/${slug}`);
  } catch {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState
          title="Lesson not found"
          hint={`Got "/learn/${level}/${slug}". Run the lesson list to find a valid slug.`}
        />
      </div>
    );
  }

  // Lesson body — for makhraj lessons (Level 2) we show the diagram with the
  // appropriate zone highlighted. The body Markdown comes in v0.5.
  const isMakhraj = lesson.slug.startsWith('makhraj-');
  let zone: 'throat' | 'tongue' | 'lips' | 'nasal' | 'all' | undefined;
  if (lesson.slug === 'makhraj-throat') zone = 'throat';
  else if (lesson.slug === 'makhraj-tongue') zone = 'tongue';
  else if (lesson.slug === 'makhraj-lips') zone = 'lips';
  else if (lesson.slug === 'makhraj-nasal') zone = 'nasal';
  else if (isMakhraj) zone = 'all';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <nav className="text-sm opacity-70">
        <Link href={`/learn/${level}`} className="hover:underline">
          ← Level {level}
        </Link>
      </nav>
      <LessonView lesson={lesson}>
        {isMakhraj && zone !== undefined ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <MakhrajDiagram highlight={zone} />
          </div>
        ) : (
          <p className="text-sm opacity-80">
            Lesson body coming in v0.5 — Markdown content with embedded audio prompts and
            mushaf snippets where the lesson references a verse range.
          </p>
        )}
      </LessonView>
    </div>
  );
}
