/**
 * Card — visual container. Token-driven; respects dark/light via inherited tokens.
 */
import type { HTMLAttributes, ReactNode } from 'react';

import { radius, space } from '../tokens/index.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly elevated?: boolean;
}

export function Card({ elevated = false, style, children, ...rest }: CardProps): ReactNode {
  return (
    <div
      style={{
        background: 'var(--color-surface-raised, #fff)',
        borderRadius: radius.md,
        padding: space[6],
        boxShadow: elevated
          ? '0 8px 24px -12px rgba(16, 56, 64, 0.18)'
          : '0 1px 2px rgba(16, 56, 64, 0.06)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
