/**
 * MakhrajDiagram — minimal SVG anatomy of articulation points.
 *
 * Used by L2 makhraj lessons. Highlightable region prop lets a lesson page
 * focus the diagram on the specific zone the lesson covers (throat, tongue,
 * lips, nasal cavity).
 */
import type { ReactNode } from 'react';

export type MakhrajZone = 'throat' | 'tongue' | 'lips' | 'nasal' | 'all';

export interface MakhrajDiagramProps {
  readonly highlight?: MakhrajZone;
  readonly title?: string;
}

const FILL = 'var(--color-cream-200, #ece6d8)';
const ACCENT = 'var(--color-gold-500, #b6862c)';
const STROKE = 'var(--color-teal-500, #1b4d5a)';

function regionColor(zone: MakhrajZone, target: MakhrajZone | undefined): string {
  if (!target || target === 'all' || target === zone) return ACCENT;
  return FILL;
}

export function MakhrajDiagram({ highlight, title }: MakhrajDiagramProps): ReactNode {
  return (
    <svg
      role="img"
      aria-label={title ?? 'Articulation points (makhraj) diagram'}
      viewBox="0 0 320 220"
      style={{ width: '100%', maxWidth: 360, height: 'auto' }}
    >
      <title>{title ?? 'Articulation points'}</title>

      {/* Profile outline */}
      <path
        d="M 60 30 C 30 60, 30 130, 70 170 L 70 200 L 250 200 L 250 130 C 250 90, 220 60, 180 50 L 130 30 Z"
        fill={FILL}
        stroke={STROKE}
        stroke-width="2"
      />
      {/* Throat */}
      <ellipse
        cx="80" cy="150" rx="30" ry="24"
        fill={regionColor('throat', highlight)}
        stroke={STROKE} stroke-width="1.2"
      />
      <text x="80" y="153" font-size="10" fill={STROKE} text-anchor="middle">throat</text>
      {/* Tongue */}
      <path
        d="M 110 130 C 140 110, 200 110, 220 140 L 220 165 L 110 165 Z"
        fill={regionColor('tongue', highlight)}
        stroke={STROKE} stroke-width="1.2"
      />
      <text x="165" y="153" font-size="10" fill={STROKE} text-anchor="middle">tongue</text>
      {/* Lips */}
      <ellipse
        cx="245" cy="120" rx="14" ry="9"
        fill={regionColor('lips', highlight)}
        stroke={STROKE} stroke-width="1.2"
      />
      <text x="245" y="123" font-size="9" fill={STROKE} text-anchor="middle">lips</text>
      {/* Nasal */}
      <path
        d="M 165 60 C 200 50, 230 65, 230 90"
        fill="none" stroke={regionColor('nasal', highlight)} stroke-width="6"
      />
      <text x="200" y="55" font-size="10" fill={STROKE} text-anchor="middle">nasal</text>
    </svg>
  );
}
