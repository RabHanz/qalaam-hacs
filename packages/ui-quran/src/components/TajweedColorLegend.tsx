/**
 * Legend modal — explains the Qalaam tajweed palette.
 * Per strategy §11.4: a legend ships with the renderer; never assume users know the colors.
 */
import type { ReactNode } from 'react';

import { TAJWEED_COLORS, TAJWEED_LABELS } from '../tajweed/colors.js';

export function TajweedColorLegend(): ReactNode {
  const rules = Object.keys(TAJWEED_LABELS) as (keyof typeof TAJWEED_LABELS)[];
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
      {rules.map((rule) => (
        <li key={rule} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '999px',
              background: TAJWEED_COLORS[rule],
            }}
          />
          <span>{TAJWEED_LABELS[rule]}</span>
        </li>
      ))}
    </ul>
  );
}
