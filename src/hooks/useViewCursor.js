import { useRef, useEffect } from 'react';

/**
 * Adds the "VIEW" custom cursor to any container.
 * Returns { containerRef, cursorRef } — attach both to your JSX.
 * The cursor appears when hovering over the container and trails the mouse.
 */
export function useViewCursor() {
  const containerRef = useRef(null);
  const cursorRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const cursor = cursorRef.current;
    if (!container || !cursor) return;

    let raf;
    let cx = 0, cy = 0, tx = 0, ty = 0;
    let initialized = false;

    const animate = () => {
      cx += (tx - cx) * 0.25;
      cy += (ty - cy) * 0.25;
      cursor.style.left = cx + 'px';
      cursor.style.top = cy + 'px';
      raf = requestAnimationFrame(animate);
    };

    const move = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!initialized) {
        cx = tx;
        cy = ty;
        cursor.style.left = cx + 'px';
        cursor.style.top = cy + 'px';
        initialized = true;
      }
    };

    const enter = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      cx = tx;
      cy = ty;
      cursor.style.left = cx + 'px';
      cursor.style.top = cy + 'px';
      initialized = true;
      cursor.classList.add('vis');
      raf = requestAnimationFrame(animate);
    };

    const leave = () => {
      cursor.classList.remove('vis');
      cancelAnimationFrame(raf);
      initialized = false;
    };

    container.addEventListener('mousemove', move);
    container.addEventListener('mouseenter', enter);
    container.addEventListener('mouseleave', leave);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('mousemove', move);
      container.removeEventListener('mouseenter', enter);
      container.removeEventListener('mouseleave', leave);
    };
  });

  return { containerRef, cursorRef };
}
