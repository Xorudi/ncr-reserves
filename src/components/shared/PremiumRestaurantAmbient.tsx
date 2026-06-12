/**
 * PremiumRestaurantAmbient — "Hora daurada mediterrània".
 *
 * One strong concept: warm color blobs slowly orbiting on a cream
 * surface, with a single "sun" blob that arcs across the screen
 * following the actual time of day.
 *
 * Anatomy:
 *   • 5 base blobs (terracota, ocre, vi, espresso, crema) each orbiting
 *     its own anchor point on a different period (33-60s) — none ever
 *     align. Soft radial falloff + slight blur for the "puddle of light"
 *     mesh look.
 *   • 1 sun blob — large amber gradient that lerps toward a target
 *     position computed from the real wall-clock hour:
 *         06h-10h  → bottom-left arc start (golden hour 1)
 *         10h-14h  → high-center (midday)
 *         14h-18h  → mid-right (afternoon descent)
 *         18h-22h  → bottom-right (sunset)
 *         22h-06h  → hidden — replaced by a deep wine "night" blob
 *     The sun's color also shifts with the hour (pink-amber, gold-white,
 *     warm-amber, orange-red, then absent).
 *   • Cursor gravity: each blob leans toward the cursor when nearby
 *     (falloff at 600 px). Subtle but lively.
 *   • Fine SVG grain on top.
 *
 * Performance:
 *   • CSS keyframes drive the per-blob orbit (compositor-only).
 *   • A single rAF loop handles the sun lerp + cursor attraction.
 *   • Blobs use soft radial gradients + a small blur (24 px) — much
 *     cheaper than the 100+ px blur trick used in WebGL-imitation
 *     mesh demos. Safe on iPad.
 *   • prefers-reduced-motion: blobs stop at their base positions, no
 *     rAF, no orbit.
 */

import { useEffect, useRef } from 'react';
import { IS_FAST_UI } from '@/lib/uiMode';

interface Props {
  /** z-index of the ambient layer. Content above must use higher. Default 0. */
  zIndex?: number;
}

/** Static base blobs. Position is in 0..1 viewport units. */
const BLOBS = [
  { id: 'terra',   baseX: 0.42, baseY: 0.55, w: 760, color: '200, 97, 58',   alpha: 0.34, orbitR: 60, orbitDur: 45 },
  { id: 'ochre',   baseX: 0.78, baseY: 0.20, w: 560, color: '168, 112, 42',  alpha: 0.26, orbitR: 48, orbitDur: 38 },
  { id: 'wine',    baseX: 0.86, baseY: 0.84, w: 520, color: '125,  46, 46',  alpha: 0.22, orbitR: 70, orbitDur: 52 },
  { id: 'espresso',baseX: 0.10, baseY: 0.92, w: 600, color: ' 58,  42, 31',  alpha: 0.28, orbitR: 55, orbitDur: 60 },
  { id: 'cream',   baseX: 0.22, baseY: 0.14, w: 680, color: '251, 234, 223', alpha: 0.42, orbitR: 50, orbitDur: 33 },
] as const;

/** Compute the sun's target {x,y,visible,colorHot,colorHalo,intensity}
 *  from the current hour. */
function sunFromHour(h: number) {
  // Night: 22h–6h → no sun. A deep wine "night blob" takes its place
  // (rendered via the night fallback below — we still return visible=false here).
  if (h < 6 || h >= 22) {
    return {
      x: 0.85, y: 0.18,
      visible: false,
      hot:  '93, 34, 60',
      halo: '50, 28, 44',
      intensity: 0.55,
    };
  }
  // Arc 6h → 22h, parametric t in [0, 1].
  const t = (h - 6) / 16;
  // X: linear 8% → 92%
  const x = 0.08 + t * 0.84;
  // Y: parabolic — low at edges (85%), high in middle (8%)
  const yArc = 0.85 - (1 - Math.pow(2 * t - 1, 2)) * 0.77;

  let hot:  string;
  let halo: string;
  let intensity: number;
  if (h < 10) {           // sunrise — pink-amber, soft
    hot  = '245, 200, 160';
    halo = '232, 160, 112';
    intensity = 0.75;
  } else if (h < 14) {    // midday — gold-white, brightest
    hot  = '250, 229, 176';
    halo = '240, 201, 128';
    intensity = 1.0;
  } else if (h < 18) {    // afternoon — warm amber
    hot  = '243, 197, 129';
    halo = '224, 142, 64';
    intensity = 0.90;
  } else {                 // sunset — orange-red
    hot  = '232, 136, 88';
    halo = '200,  72, 56';
    intensity = 0.78;
  }
  return { x, y: yArc, visible: true, hot, halo, intensity };
}

export default function PremiumRestaurantAmbient({ zIndex = 0 }: Props) {
  const ref     = useRef<HTMLDivElement | null>(null);
  const sunRef  = useRef<HTMLDivElement | null>(null);
  const blobRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    // FAST_UI (touch tablets, counter PC): the animated layer isn't
    // mounted at all — no sun lerp, no cursor gravity, nothing to drive.
    if (IS_FAST_UI) return;

    const root = ref.current;
    if (!root) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Time-of-day sun position (lerped target → cur) ───────── */
    let sunTarget = sunFromHour(new Date().getHours() + new Date().getMinutes() / 60);
    const sunCur  = { x: sunTarget.x, y: sunTarget.y, intensity: sunTarget.intensity };

    function refreshSunTarget() {
      const t = sunFromHour(new Date().getHours() + new Date().getMinutes() / 60);
      sunTarget = t;
      if (sunRef.current) {
        sunRef.current.style.setProperty('--sun-hot',  t.hot);
        sunRef.current.style.setProperty('--sun-halo', t.halo);
        sunRef.current.dataset.visible = t.visible ? 'true' : 'false';
      }
      // Also expose night mode on root so the night blob can fade in.
      if (root) root.dataset.night = t.visible ? 'false' : 'true';
    }
    refreshSunTarget();
    const refreshTimer = window.setInterval(refreshSunTarget, 5 * 60 * 1000);

    /* ── Cursor position (smoothed) ───────────────────────────── */
    const cursor    = { x: 0.5, y: 0.5 };
    const cursorTgt = { x: 0.5, y: 0.5 };

    function onMove(e: PointerEvent) {
      cursorTgt.x = e.clientX / (window.innerWidth  || 1);
      cursorTgt.y = e.clientY / (window.innerHeight || 1);
    }
    function onDown() { pulse(); }
    function onPulse() { pulse(); }
    function pulse() { sunCur.intensity = Math.min(sunCur.intensity + 0.18, 1.25); }

    /** Apply cursor-attraction to each blob; lerp the sun toward target. */
    function tick() {
      // Cursor lerp
      cursor.x += (cursorTgt.x - cursor.x) * 0.08;
      cursor.y += (cursorTgt.y - cursor.y) * 0.08;

      const W = window.innerWidth, H = window.innerHeight;
      const cxPx = cursor.x * W;
      const cyPx = cursor.y * H;

      for (const b of BLOBS) {
        const el = blobRefs.current[b.id];
        if (!el) continue;
        const bxPx = b.baseX * W;
        const byPx = b.baseY * H;
        const dx = cxPx - bxPx;
        const dy = cyPx - byPx;
        const dist = Math.hypot(dx, dy);
        // Falloff: full effect at 0, none at 600 px (squared for snappier feel).
        const fall = Math.max(0, 1 - dist / 600);
        const eff  = fall * fall;
        const sx = dist > 0.01 ? (dx / dist) * 42 * eff : 0;
        const sy = dist > 0.01 ? (dy / dist) * 42 * eff : 0;
        el.style.setProperty('--cur-shift-x', `${sx.toFixed(1)}px`);
        el.style.setProperty('--cur-shift-y', `${sy.toFixed(1)}px`);
      }

      // Sun lerp toward target
      const sun = sunRef.current;
      if (sun) {
        sunCur.x += (sunTarget.x - sunCur.x) * 0.02; // very slow
        sunCur.y += (sunTarget.y - sunCur.y) * 0.02;
        sunCur.intensity += (sunTarget.intensity - sunCur.intensity) * 0.05;
        sun.style.setProperty('--sun-x', `${(sunCur.x * 100).toFixed(1)}%`);
        sun.style.setProperty('--sun-y', `${(sunCur.y * 100).toFixed(1)}%`);
        sun.style.setProperty('--sun-i', sunCur.intensity.toFixed(3));
      }

      rafId = requestAnimationFrame(tick);
    }

    let rafId = 0;
    if (!reduce) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('ncr:ambient-pulse', onPulse as EventListener);
      rafId = requestAnimationFrame(tick);
    } else {
      // Static: set sun to target instantly, blobs without cursor shift.
      const sun = sunRef.current;
      if (sun) {
        sun.style.setProperty('--sun-x', `${(sunTarget.x * 100).toFixed(1)}%`);
        sun.style.setProperty('--sun-y', `${(sunTarget.y * 100).toFixed(1)}%`);
        sun.style.setProperty('--sun-i', sunTarget.intensity.toFixed(3));
      }
    }

    return () => {
      window.clearInterval(refreshTimer);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('ncr:ambient-pulse', onPulse as EventListener);
    };
  }, []);

  return (
    <div ref={ref} className="ambient-hd" aria-hidden="true" style={{ zIndex }}>
      {/* FAST_UI: only the static cream gradient (the wrapper's own
          background) is rendered. The blurred multiply/screen blob and
          sun layers are the exact recipe that corrupts the compositor
          on Android tablet GPUs — content above them paints washed-out
          or partially blank (seen live on the restaurant's tablet,
          midday sun at full screen-blend intensity). Desktop keeps the
          full ambient untouched. */}
      {!IS_FAST_UI && BLOBS.map(b => (
        <div
          key={b.id}
          ref={el => { blobRefs.current[b.id] = el; }}
          className={`hd-blob hd-blob--${b.id}`}
          style={{
            left:   `${b.baseX * 100}%`,
            top:    `${b.baseY * 100}%`,
            width:  `${b.w}px`,
            height: `${b.w}px`,
            ['--blob-rgb' as string]: b.color,
            ['--blob-a'   as string]: b.alpha.toString(),
            ['--orbit-r'  as string]: `${b.orbitR}px`,
            ['--orbit-d'  as string]: `${b.orbitDur}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Sun — moving, brighter, time-of-day driven */}
      {!IS_FAST_UI && <div ref={sunRef} className="hd-sun" />}

      {/* Grain — fine paper texture (mix-blend multiply: desktop only) */}
      {!IS_FAST_UI && <div className="hd-grain" />}

      <style>{`
        .ambient-hd {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          background:
            radial-gradient(ellipse 130% 100% at 50% 50%, #f6ecd9 0%, #ece2c8 55%, #d6cbb1 100%);
          isolation: isolate;
        }
        .ambient-hd > * { pointer-events: none; }
        .ambient-hd[data-night="true"] {
          background:
            radial-gradient(ellipse 130% 100% at 50% 50%, #e0d4b6 0%, #c5b598 55%, #8c7a5a 100%);
        }

        /* ── Base blobs ───────────────────────────────────────────── */
        .hd-blob {
          position: absolute;
          border-radius: 50%;
          /* Anchor center on (left, top) → shift the box by half its size. */
          translate: -50% -50%;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(var(--blob-rgb), var(--blob-a)) 0%,
            rgba(var(--blob-rgb), calc(var(--blob-a) * 0.55)) 30%,
            rgba(var(--blob-rgb), 0) 70%
          );
          filter: blur(24px);
          mix-blend-mode: multiply;
          will-change: transform;
          /* Cursor shift composes on top of orbit. */
          transform: translate(var(--cur-shift-x, 0), var(--cur-shift-y, 0));
          transition: transform 380ms cubic-bezier(0.23, 1, 0.32, 1);
          animation: hd-orbit var(--orbit-d, 40s) linear infinite;
        }
        /* The "orbit" trick: outer rotate moves around the center, inner
           translateX(--orbit-r) sets the radius, inner counter-rotate
           keeps the blob "facing" forward. Net effect: smooth circle. */
        @keyframes hd-orbit {
          from { transform:
                   translate(var(--cur-shift-x, 0), var(--cur-shift-y, 0))
                   rotate(0deg)   translateX(var(--orbit-r, 50px)) rotate(0deg); }
          to   { transform:
                   translate(var(--cur-shift-x, 0), var(--cur-shift-y, 0))
                   rotate(360deg) translateX(var(--orbit-r, 50px)) rotate(-360deg); }
        }
        /* Cream blend: lighten instead of multiply for highlight feel. */
        .hd-blob--cream { mix-blend-mode: screen; }

        /* Stagger orbit phases via animation-delay so they never align. */
        .hd-blob--terra    { animation-delay:   0s; }
        .hd-blob--ochre    { animation-delay: -11s; }
        .hd-blob--wine     { animation-delay: -23s; }
        .hd-blob--espresso { animation-delay: -36s; }
        .hd-blob--cream    { animation-delay:  -7s; }

        /* ── Sun — moving warm radial ─────────────────────────────── */
        .hd-sun {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(
              circle 360px at var(--sun-x, 50%) var(--sun-y, 30%),
              rgba(var(--sun-hot, 250, 229, 176),  calc(0.42 * var(--sun-i, 1))) 0%,
              rgba(var(--sun-hot, 250, 229, 176),  calc(0.18 * var(--sun-i, 1))) 30%,
              rgba(var(--sun-hot, 250, 229, 176),  0) 64%
            ),
            radial-gradient(
              circle 900px at var(--sun-x, 50%) var(--sun-y, 30%),
              rgba(var(--sun-halo, 240, 201, 128), calc(0.20 * var(--sun-i, 1))) 0%,
              rgba(var(--sun-halo, 240, 201, 128), calc(0.08 * var(--sun-i, 1))) 38%,
              rgba(var(--sun-halo, 240, 201, 128), 0) 68%
            );
          mix-blend-mode: screen;
          transition: background 600ms ease;
        }
        .hd-sun[data-visible="false"] {
          mix-blend-mode: multiply;
          opacity: .85;
        }

        /* ── Grain — editorial paper texture ──────────────────────── */
        .hd-grain {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.30  0 0 0 0 0.20  0 0 0 0 0.10  0 0 0 0.50 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          opacity: .055;
          mix-blend-mode: multiply;
        }

        /* ── Reduced motion ───────────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .hd-blob { animation: none; transform: none; }
          .hd-sun  { transition: none; }
        }
      `}</style>
    </div>
  );
}
