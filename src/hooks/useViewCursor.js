import { useRef, useEffect } from 'react';

/**
 * Adds the "VIEW" custom cursor to any container.
 * Returns { containerRef, cursorRef } — attach both to your JSX.
 * The cursor appears when hovering over the container and trails the mouse.
 *
 * Animation state is stored in a ref so re-renders (e.g. from sibling hover
 * state changes) don't interrupt the cursor animation loop.
 */
export function useViewCursor() {
  const containerRef = useRef(null);
  const cursorRef = useRef(null);
  const state = useRef({ raf: 0, cx: 0, cy: 0, tx: 0, ty: 0, active: false });

  useEffect(() => {
    const container = containerRef.current;
    const cursor = cursorRef.current;
    if (!container || !cursor) return;

    const s = state.current;

    /* Position via transform (composited) — left/top would force layout
       every frame, which stutters while card hover transitions paint. */
    const place = () => {
      cursor.style.transform = `translate3d(${s.cx}px, ${s.cy}px, 0) translate(-50%, -50%)`;
    };

    const animate = () => {
      s.cx += (s.tx - s.cx) * 0.25;
      s.cy += (s.ty - s.cy) * 0.25;
      place();
      s.raf = requestAnimationFrame(animate);
    };

    const ensureRunning = () => {
      if (!s.active) {
        s.active = true;
        cursor.classList.add('vis');
        cancelAnimationFrame(s.raf);
        s.raf = requestAnimationFrame(animate);
      }
    };

    const move = (e) => {
      s.tx = e.clientX;
      s.ty = e.clientY;
      // On first move (or after re-attach), snap position to avoid jump
      if (!s.active) {
        s.cx = s.tx;
        s.cy = s.ty;
        place();
      }
      // Restart loop if effect cleanup killed it mid-hover
      ensureRunning();
    };

    const enter = (e) => {
      s.tx = e.clientX;
      s.ty = e.clientY;
      s.cx = s.tx;
      s.cy = s.ty;
      place();
      ensureRunning();
    };

    const leave = () => {
      cursor.classList.remove('vis');
      cancelAnimationFrame(s.raf);
      s.active = false;
    };

    container.addEventListener('mousemove', move);
    container.addEventListener('mouseenter', enter);
    container.addEventListener('mouseleave', leave);

    return () => {
      cancelAnimationFrame(s.raf);
      s.active = false;
      container.removeEventListener('mousemove', move);
      container.removeEventListener('mouseenter', enter);
      container.removeEventListener('mouseleave', leave);
    };
  });

  return { containerRef, cursorRef };
}
