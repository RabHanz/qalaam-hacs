/**
 * Button — token-driven, accessible, RTL-friendly.
 *
 * Variants:
 *  - primary (teal, white text)
 *  - secondary (cream, teal text)
 *  - ghost (transparent, teal text)
 *  - danger (mistake-error)
 *
 * Loading state per CLAUDE.md §11.3: button stays the same size; spinner replaces label;
 * `aria-busy` set for screen readers; click is suppressed.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

import { colors, fonts, radius, space } from '../tokens/index.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: colors.teal[500], color: '#fff' },
  secondary: { background: colors.cream[100], color: colors.teal[500] },
  ghost: { background: 'transparent', color: colors.teal[500] },
  danger: { background: colors.mistake.error, color: '#fff' },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: `${space[2]} ${space[3]}`, fontSize: '0.875rem' },
  md: { padding: `${space[3]} ${space[6]}`, fontSize: '1rem' },
  lg: { padding: `${space[4]} ${space[8]}`, fontSize: '1.125rem' },
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leadingIcon,
    trailingIcon,
    disabled,
    children,
    style,
    type = 'button',
    ...rest
  }: ButtonProps,
  ref: Ref<HTMLButtonElement>,
): ReactNode {
  const isDisabled = disabled === true || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        borderRadius: radius.md,
        fontFamily: fonts.sans,
        fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled && !loading ? 0.6 : 1,
        border: 'none',
        transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1)',
        ...SIZE_STYLES[size],
        ...VARIANT_STYLES[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span aria-hidden="true">…</span>
      ) : (
        <>
          {leadingIcon !== undefined ? <span aria-hidden="true">{leadingIcon}</span> : null}
          <span>{children}</span>
          {trailingIcon !== undefined ? <span aria-hidden="true">{trailingIcon}</span> : null}
        </>
      )}
    </button>
  );
});
