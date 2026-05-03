import type { HTMLAttributes, ReactNode } from 'react';

import { fonts, text } from '../tokens/index.js';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  readonly level: 1 | 2 | 3 | 4;
}

const SIZE: Record<HeadingProps['level'], string> = {
  1: text.display,
  2: text.heading,
  3: '1.25rem',
  4: '1rem',
};

export function Heading({ level, style, children, ...rest }: HeadingProps): ReactNode {
  const Tag = (`h${String(level)}` as 'h1' | 'h2' | 'h3' | 'h4');
  return (
    <Tag
      style={{
        fontFamily: fonts.sans,
        fontWeight: 600,
        margin: 0,
        fontSize: SIZE[level],
        lineHeight: 1.3,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
