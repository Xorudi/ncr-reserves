/**
 * PremiumRestaurantAmbient — interactive warm-light background.
 *
 * Concept: "warm restaurant light on a cream surface". Three layered
 * radial glows (terracotta candle + faint copper parallax + espresso
 * floor pool) drift slowly when idle and respond to pointer movement
 * with heavy easing. A wide elliptical wash suggests the curve of a
 * lit cream wall — abstract, never literal.
 *
 * Performance:
 *   • Single absolute layer, pointer-events: none.
 *   • CSS variables (--ambient-x/y, --ambient-drift-x, --ambient-intensity)
 *     updated directly via ref.style.setProperty — no React re-renders.
 *   • requestAnimationFrame lerp with auto-stop when delta < epsilon.
 *   • prefers-reduced-motion → static gradient, no listeners, no rAF.
 *   • All layers animate only `background-position` (composited).
 *
 * Integrate behind any content with z-index ≥ 1.
 */

import { useEffect, useRef } from 'react';

interface Props {
  /** z-index of the ambient layer. Content above must use higher. Default 0. */
  zIndex?: number;
}

export default function PremiumRestaurantAmbient({ zIndex = 0 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Honour reduced motion — set static rest state and bail.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      el.style.setProperty('--ambient-x', '50%');
      el.style.setProperty('--ambient-y', '38%');
      el.style.setProperty('--ambient-drift-x', '0px');
      el.style.setProperty('--ambient-intensity', '1');
      return;
    }

    // Targets are in 0..1, mapped to % when written to CSS vars.
    const target = { x: 0.5, y: 0.38, intensity: 1 };
    const cur    = { x: 0.5, y: 0.38, intensity: 1 };

    let rafId = 0;
    let running = false;

    function apply() {
      if (!el) return;
      el.style.setProperty('--ambient-x', `${(cur.x * 100).toFixed(2)}%`);
      el.style.setProperty('--ambient-y', `${(cur.y * 100).toFixed(2)}%`);
      el.style.setProperty('--ambient-intensity', cur.intensity.toFixed(3));
      // Parallax drift for the secondary glow — opposite direction, smaller travel.
      const driftX = (0.5 - cur.x) * 40; // ±20 px
      const driftY = (0.5 - cur.y) * 28; // ±14 px
      el.style.setProperty('--ambient-drift-x', `${driftX.toFixed(2)}px`);
      el.style.setProperty('--ambient-drift-y', `${driftY.toFixed(2)}px`);
    }

    function tick() {
      const k = 0.085; // lerp factor — heavy, elegant
      const dx = target.x - cur.x;
      const dy = target.y - cur.y;
      const di = target.intensity - cur.intensity;

      cur.x += dx * k;
      cur.y += dy * k;
      cur.intensity += di * k;

      apply();

      const settled =
        Math.abs(dx) < 0.0008 &&
        Math.abs(dy) < 0.0008 &&
        Math.abs(di) < 0.0008;

      if (settled) {
        // Snap final values to exact targets to avoid drifting fractions.
        cur.x = target.x;
        cur.y = target.y;
        cur.intensity = target.intensity;
        apply();
        running = false;
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function kick() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    }

    function setFromPointer(clientX: number, clientY: number) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      target.x = Math.max(0, Math.min(1, clientX / w));
      target.y = Math.max(0, Math.min(1, clientY / h));
      kick();
    }

    function onMove(e: PointerEvent) {
      setFromPointer(e.clientX, e.clientY);
    }
    function onDown(e: PointerEvent) {
      target.intensity = 1.18;
      setFromPointer(e.clientX, e.clientY);
    }
    function onUp() {
      target.intensity = 1;
      kick();
    }
    function onLeave() {
      // Return to rest position when pointer exits the viewport.
      target.x = 0.5;
      target.y = 0.38;
      target.intensity = 1;
      kick();
    }

    window.addEventListener('pointermove',  onMove,  { passive: true });
    window.addEventListener('pointerdown',  onDown,  { passive: true });
    window.addEventListener('pointerup',    onUp,    { passive: true });
    window.addEventListener('pointercancel', onUp,   { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });

    // Initial paint with rest values.
    apply();

    return () => {
      window.removeEventListener('pointermove',  onMove);
      window.removeEventListener('pointerdown',  onDown);
      window.removeEventListener('pointerup',    onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointerleave', onLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="ambient-restaurant"
      aria-hidden="true"
      style={{ zIndex }}
    >
      <style>{`
        .ambient-restaurant {
          --ambient-x: 50%;
          --ambient-y: 38%;
          --ambient-drift-x: 0px;
          --ambient-drift-y: 0px;
          --ambient-intensity: 1;

          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          /* Layered radial washes — composited as background-position changes. */
          background:
            /* 1. Primary warm candle — follows cursor, intensity-modulated. */
            radial-gradient(
              circle 760px at var(--ambient-x) var(--ambient-y),
              rgba(200, 97, 58, calc(0.18 * var(--ambient-intensity))) 0%,
              rgba(200, 97, 58, calc(0.09 * var(--ambient-intensity))) 28%,
              rgba(200, 97, 58, 0.00) 62%
            ),
            /* 2. Secondary copper wash — parallax drift, idler. */
            radial-gradient(
              circle 980px at calc(78% + var(--ambient-drift-x))
                              calc(18% + var(--ambient-drift-y)),
              rgba(214, 138, 76, 0.13) 0%,
              rgba(214, 138, 76, 0.05) 36%,
              rgba(214, 138, 76, 0) 64%
            ),
            /* 3. Wide architectural wall-curve wash (very faint). */
            radial-gradient(
              ellipse 140% 90% at 50% -20%,
              rgba(255, 230, 196, 0.20) 0%,
              rgba(255, 230, 196, 0) 70%
            ),
            /* 4. Espresso floor pool — breathes via keyframes. */
            radial-gradient(
              ellipse 70% 50% at 14% 102%,
              rgba(40, 24, 14, 0.20) 0%,
              rgba(40, 24, 14, 0.10) 32%,
              rgba(40, 24, 14, 0) 60%
            ),
            /* 5. Subtle right-side ink shadow for asymmetric weight. */
            radial-gradient(
              ellipse 50% 80% at 108% 60%,
              rgba(30, 20, 12, 0.10) 0%,
              rgba(30, 20, 12, 0) 60%
            );
          /* Slow ambient breathing — only the espresso pool & copper wash drift. */
          animation: ambient-breathe 14s ease-in-out infinite alternate;
          will-change: background-position;
        }

        @keyframes ambient-breathe {
          0%   { background-position:
                   0 0,
                   0 0,
                   0 0,
                   0 0,
                   0 0; }
          100% { background-position:
                   0 0,
                   -18px 12px,
                   0 -10px,
                   12px -8px,
                   -10px 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ambient-restaurant {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
