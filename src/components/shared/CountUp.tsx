/**
 * CountUp — animates an integer from its previous value to the next one
 * whenever `value` changes, using requestAnimationFrame (transform-free,
 * just text content). A premium touch that draws the operator's eye to a
 * KPI that just moved (covers, pax, pending…) without being distracting.
 *
 * Respects the environment:
 *   • prefers-reduced-motion → jumps straight to the final value.
 *   • First mount → shows the value immediately (no count-up from 0, which
 *     would feel like a loading flicker on every screen entry).
 *   • Tiny deltas (≤1) → no animation; not worth a frame.
 *
 * Cheap: one rAF loop for ~420ms per change, updating a single text node.
 * No layout thrash (integer text, fixed container in the caller).
 */
import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 420;
const prefersReducedMotion = (): boolean => {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }
  catch { return false; }
};
// easeOutCubic — fast start, gentle settle.
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export default function CountUp({
  value,
  className,
  style,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef  = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const from = prevRef.current;
    const to   = value;
    prevRef.current = to;

    // First render or no real change → snap.
    if (!mountedRef.current || from === to) {
      mountedRef.current = true;
      setDisplay(to);
      return;
    }
    // Reduced motion or a delta of 1 → snap (not worth animating).
    if (prefersReducedMotion() || Math.abs(to - from) <= 1) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const v = Math.round(from + (to - from) * ease(t));
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <span className={className} style={style}>{display}</span>;
}
