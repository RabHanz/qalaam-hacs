'use client';

/**
 * MushafPageSwipe — wraps the server-rendered mushaf page body in a touch
 * swipe surface that navigates to the next/previous page via the Next.js
 * router. The page content (Arabic lines, surah-name lines, basmallah)
 * is rendered server-side as `children`; this client island only adds the
 * gesture layer + slide-in animation.
 *
 * Direction convention (matches Quranly + most Quran apps):
 *   - swipe-left  → next page (page n+1)
 *   - swipe-right → previous page (page n-1)
 *
 * The mushaf reads RTL but in screen-pagination terms, swipe-left to advance
 * is the universal mobile convention; users find it intuitive regardless
 * of script direction. (If we change our mind later, flip the dx sign.)
 */
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { ReactNode } from 'react';

interface Props {
  readonly layout: string;
  readonly pageNumber: number;
  readonly totalPages: number;
  readonly children: ReactNode;
}

export function MushafPageSwipe({ layout, pageNumber, totalPages, children }: Props): ReactNode {
  const router = useRouter();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lockedAxisRef = useRef<'x' | 'y' | null>(null);
  const pointerActiveRef = useRef(false);
  const THRESHOLD = 70;

  const canPrev = pageNumber > 1;
  const canNext = pageNumber < totalPages;

  function go(direction: 1 | -1): void {
    const target = pageNumber + direction;
    if (target < 1 || target > totalPages) return;
    router.push(`/mushaf/${layout}/${target.toString()}`);
  }

  function begin(x: number, y: number): void {
    startXRef.current = x;
    startYRef.current = y;
    lockedAxisRef.current = null;
    setDragging(false);
    setDx(0);
  }
  function move(x: number, y: number): boolean {
    if (startXRef.current === null || startYRef.current === null) return false;
    const ddx = x - startXRef.current;
    const ddy = y - startYRef.current;
    if (lockedAxisRef.current === null) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return false;
      lockedAxisRef.current = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
    }
    if (lockedAxisRef.current === 'y') return false;
    setDragging(true);
    setDx(ddx);
    return true;
  }
  function end(): void {
    const finalDx = dx;
    setDragging(false);
    setDx(0);
    startXRef.current = null;
    startYRef.current = null;
    lockedAxisRef.current = null;
    if (Math.abs(finalDx) < THRESHOLD) return;
    if (finalDx < 0 && canNext) go(1);
    else if (finalDx > 0 && canPrev) go(-1);
  }

  return (
    <div
      className={`${dragging ? 'swipe-drag' : 'swipe-spring-back'} touch-pan-y select-none`}
      style={{ ['--swipe-x' as string]: dragging ? `${dx.toString()}px` : '0px' }}
      onTouchStart={(e) => {
        begin(e.touches[0]?.clientX ?? 0, e.touches[0]?.clientY ?? 0);
      }}
      onTouchMove={(e) => {
        const consumed = move(e.touches[0]?.clientX ?? 0, e.touches[0]?.clientY ?? 0);
        if (consumed && e.cancelable) e.preventDefault();
      }}
      onTouchEnd={end}
      onTouchCancel={end}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') return;
        pointerActiveRef.current = true;
        begin(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!pointerActiveRef.current) return;
        move(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        if (!pointerActiveRef.current) return;
        pointerActiveRef.current = false;
        end();
      }}
      onPointerCancel={() => {
        if (!pointerActiveRef.current) return;
        pointerActiveRef.current = false;
        end();
      }}
      aria-roledescription="Swipeable mushaf page"
    >
      {children}
    </div>
  );
}
