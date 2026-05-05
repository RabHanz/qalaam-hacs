/**
 * HighlightedSnippet — renders FTS5 snippet() output as React nodes.
 *
 * SQLite's snippet() returns plain text with `<mark>…</mark>` markers
 * around matched runs. We parse those markers ourselves rather than
 * dangerouslySetInnerHTML so the result is XSS-safe even if the FTS5
 * tokenizer ever leaks something unexpected through.
 *
 * Markers are case-insensitive and may nest impossibly (e.g., overlapping
 * matches in Arabic with combining marks); we tolerate any odd input by
 * falling back to the raw text on parse failure.
 */
import type { ReactNode } from 'react';

const TOKEN_RE = /<mark>(.*?)<\/mark>/gis;

interface Props {
  readonly text: string;
  readonly className?: string;
  readonly fallback?: string;
}

export function HighlightedSnippet({ text, className, fallback }: Props): ReactNode {
  const source = text.length > 0 ? text : (fallback ?? '');
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push(source.slice(lastIndex, match.index));
    }
    parts.push(
      <mark key={`m${(key++).toString()}`} className="bg-leaf/20 text-leaf rounded-sm px-0.5">
        {match[1]}
      </mark>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }
  return parts.length > 0 ? (
    <span className={className}>{parts}</span>
  ) : (
    <span className={className}>{source}</span>
  );
}
