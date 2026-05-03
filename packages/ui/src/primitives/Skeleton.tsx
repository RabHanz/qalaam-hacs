/**
 * Skeleton — shimmer placeholder. Per CLAUDE.md §11.3: skeletons, not spinners.
 * Reduced-motion users see a static placeholder instead of the shimmer animation.
 */
import type { CSSProperties, ReactNode } from 'react';

import { useReducedMotion } from '../hooks/index.js';
import { colors, radius } from '../tokens/index.js';

export interface SkeletonProps {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly rounded?: keyof typeof radius;
  readonly label?: string;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  rounded = 'sm',
  label = 'Loading',
}: SkeletonProps): ReactNode {
  const reduced = useReducedMotion();
  const style: CSSProperties = {
    display: 'inline-block',
    width,
    height,
    borderRadius: radius[rounded],
    background: reduced
      ? colors.cream[200]
      : `linear-gradient(90deg, ${colors.cream[200]} 0%, ${colors.cream[100]} 50%, ${colors.cream[200]} 100%)`,
    backgroundSize: reduced ? undefined : '200% 100%',
    animation: reduced ? undefined : 'qalaam-shimmer 1.5s linear infinite',
  };
  return (
    <span role="status" aria-live="polite" aria-busy="true" aria-label={label} style={style}>
      <style>{`@keyframes qalaam-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </span>
  );
}
