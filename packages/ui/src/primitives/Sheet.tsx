/**
 * Sheet — bottom-sheet on mobile, dialog on desktop.
 * Implements focus-trap + escape-to-close + reduced-motion-aware enter/exit.
 *
 * Built on the native <dialog> element for correct accessibility.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { useReducedMotion } from '../hooks/index.js';
import { radius, space } from '../tokens/index.js';

export interface SheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function Sheet({ open, onOpenChange, title, children, footer }: SheetProps): ReactNode {
  const ref = useRef<HTMLDialogElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        // Close on backdrop click only.
        const target = e.target as HTMLElement;
        if (target === ref.current) onOpenChange(false);
      }}
      style={{
        border: 'none',
        borderRadius: radius.lg,
        padding: 0,
        maxWidth: 'min(560px, 92vw)',
        width: '100%',
        boxShadow: '0 24px 60px -16px rgba(16, 56, 64, 0.35)',
        animation: reduced ? undefined : 'qalaam-sheet-in 220ms cubic-bezier(0.2, 0, 0, 1)',
      }}
      aria-labelledby="qalaam-sheet-title"
    >
      <style>{`
        @keyframes qalaam-sheet-in {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);  opacity: 1; }
        }
      `}</style>
      <header style={{ padding: space[6], borderBottom: '1px solid rgba(16,56,64,0.08)' }}>
        <h2 id="qalaam-sheet-title" style={{ margin: 0, fontSize: '1.125rem' }}>
          {title}
        </h2>
      </header>
      <div style={{ padding: space[6] }}>{children}</div>
      {footer ? (
        <footer
          style={{
            padding: space[4],
            borderTop: '1px solid rgba(16,56,64,0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: space[2],
          }}
        >
          {footer}
        </footer>
      ) : null}
    </dialog>
  );
}
