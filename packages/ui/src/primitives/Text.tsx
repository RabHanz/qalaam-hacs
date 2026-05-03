import type { HTMLAttributes, ReactNode } from 'react';

import { fonts, text as textScale } from '../tokens/index.js';

export interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  readonly size?: 'caption' | 'body';
  readonly tone?: 'default' | 'muted' | 'error';
  readonly arabic?: boolean;
}

export function Text({
  size = 'body',
  tone = 'default',
  arabic = false,
  style,
  children,
  ...rest
}: TextProps): ReactNode {
  return (
    <span
      style={{
        fontFamily: arabic ? fonts.arabicUthmani : fonts.sans,
        fontSize: arabic ? textScale.arabic : textScale[size],
        opacity: tone === 'muted' ? 0.7 : 1,
        color: tone === 'error' ? 'var(--color-mistake-error)' : undefined,
        direction: arabic ? 'rtl' : undefined,
        unicodeBidi: arabic ? 'plaintext' : undefined,
        lineHeight: arabic ? 1.9 : 1.5,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
