/**
 * DashboardAmbient — quieter sibling of PremiumRestaurantAmbient, tuned for
 * the operations dashboard (TouchShell). Same "hora daurada mediterrània"
 * concept the PIN lock screen uses, but cranked down so it never competes
 * with reservation rows, KPIs or form inputs.
 *
 * Differences vs the login variant:
 *   • blob alphas roughly halved (0.34/0.26/0.22/0.28/0.42 → 0.14/0.10/0.08/0.10/0.16)
 *   • blur 24 px → 60 px (warmth, not shapes)
 *   • orbit periods 33–60s → 70–110s (near-static)
 *   • no cursor gravity (operators don't want their reservations dancing)
 *   • sun intensity capped at 0.38 (vs 1.0)
 *   • no event-driven pulse — strictly ambient
 *   • grain opacity .055 → .035
 *
 * Same time-of-day sun arc, same five base blobs anchors, same paper grain,
 * same reduced-motion fallback. Sits at z-index 0 in the shell wrapper —
 * everything else (rail, header, screenContent, side panels, FAB) renders
 * above with pointer-events intact.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** z-index of the ambient layer. Content above must use higher. Default 0. */
  zIndex?: number;
  /** Operational ambient intensity (0..1) driven by useAmbientState.
   *  Modulates blob alpha and sun strength by a small ±15% window so the
   *  warmth scales subtly with service load. Defaults to 0.5 (neutral). */
  intensity?: number;
}

/** Five base blobs — anchors and alphas calmer than the login variant.
 *  First pass was too subtle on a 1920 px screen (alphas 0.08-0.16 with
 *  60 px blur faded into the cream). Bumped up ~60% to "visibly warm"
 *  while still well below PinLock's 0.34-0.42 range. */
const BLOBS = [
  // Heavily dialled back. The previous 0.24-0.44 range overpowered the
  // dashboard once panels were given proper z-index — what looked
  // 'invisible' before (because the ambient was painting OVER the rail
  // and we were only seeing the panels' shadows) was actually a layout
  // bug. With the stacking fixed, the visible margin strips need very
  // little colour to register as warmth.
  { id: 'terra',   baseX: 0.40, baseY: 0.55, w: 820, color: '200, 97, 58',   alpha: 0.10, orbitR: 50, orbitDur: 90 },
  { id: 'ochre',   baseX: 0.78, baseY: 0.22, w: 620, color: '168, 112, 42',  alpha: 0.09, orbitR: 40, orbitDur: 78 },
  { id: 'wine',    baseX: 0.86, baseY: 0.84, w: 560, color: '125,  46, 46',  alpha: 0.07, orbitR: 56, orbitDur: 104 },
  { id: 'espresso',baseX: 0.08, baseY: 0.90, w: 640, color: ' 58,  42, 31',  alpha: 0.09, orbitR: 48, orbitDur: 110 },
  { id: 'cream',   baseX: 0.22, baseY: 0.14, w: 720, color: '251, 234, 223', alpha: 0.16, orbitR: 42, orbitDur: 70 },
] as const;

/** Sun position from the wall clock — same arc as the login screen but
 *  intensity capped (multiplied by 0.38 at render). */
function sunFromHour(h: number) {
  if (h < 6 || h >= 22) {
    return { x: 0.85, y: 0.18, visible: false, hot: '93, 34, 60', halo: '50, 28, 44' };
  }
  const t = (h - 6) / 16;
  const x = 0.08 + t * 0.84;
  const yArc = 0.85 - (1 - Math.pow(2 * t - 1, 2)) * 0.77;
  let hot: string, halo: string;
  if (h < 10)        { hot = '245, 200, 160'; halo = '232, 160, 112'; }
  else if (h < 14)   { hot = '250, 229, 176'; halo = '240, 201, 128'; }
  else if (h < 18)   { hot = '243, 197, 129'; halo = '224, 142,  64'; }
  else               { hot = '232, 136,  88'; halo = '200,  72,  56'; }
  return { x, y: yArc, visible: true, hot, halo };
}

export default function DashboardAmbient({ zIndex = 0, intensity = 0.5 }: Props) {
  // Map intensity (0..1) to a small ±15% multiplier centred on 1.0:
  // intensity 0.0 → 0.85, intensity 0.5 → 1.00, intensity 1.0 → 1.15.
  // Stays in CSS variable land so we don't need to touch the keyframes.
  const ambientAmp = 0.85 + Math.max(0, Math.min(1, intensity)) * 0.30;
  const ref    = useRef<HTMLDivElement | null>(null);
  const sunRef = useRef<HTMLDivElement | null>(null);

  // Pause ambient motion while ANY sheet is open. AnimatedSheet already
  // dispatches paired app:sheet:opened / app:sheet:closed events with
  // cleanup balancing, so a simple counter is enough. While sheets are
  // open the operator is focused on the form / detail; the blob orbit
  // and CSS keyframe loop is wasted GPU time that competes with the
  // sheet's slide-up animation. Counter (not a boolean) handles nested
  // sheets and rapid toggles correctly.
  const [openSheets, setOpenSheets] = useState(0);
  useEffect(() => {
    const onOpen  = () => setOpenSheets(n => n + 1);
    const onClose = () => setOpenSheets(n => Math.max(0, n - 1));
    window.addEventListener('app:sheet:opened', onOpen);
    window.addEventListener('app:sheet:closed', onClose);
    return () => {
      window.removeEventListener('app:sheet:opened', onOpen);
      window.removeEventListener('app:sheet:closed', onClose);
    };
  }, []);
  const paused = openSheets > 0;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Time-of-day sun position + colour. Refreshed every 5 minutes — the
    // operator might be on the dashboard for a whole service, the sun
    // should follow the real hour.
    // Capture root once so TS narrowing survives across the closure that
    // setInterval may call hours later (TS can't otherwise prove that
    // ref.current is still the same element by then).
    const rootEl = root;
    function refreshSun() {
      const t = sunFromHour(new Date().getHours() + new Date().getMinutes() / 60);
      if (sunRef.current) {
        sunRef.current.style.setProperty('--sun-x', `${(t.x * 100).toFixed(1)}%`);
        sunRef.current.style.setProperty('--sun-y', `${(t.y * 100).toFixed(1)}%`);
        sunRef.current.style.setProperty('--sun-hot',  t.hot);
        sunRef.current.style.setProperty('--sun-halo', t.halo);
        sunRef.current.dataset.visible = t.visible ? 'true' : 'false';
      }
      rootEl.dataset.night = t.visible ? 'false' : 'true';
    }
    refreshSun();
    const timer = window.setInterval(refreshSun, 5 * 60 * 1000);

    // No rAF loop here — the dashboard variant has no cursor gravity and
    // no event-driven pulse. The blobs orbit purely via CSS keyframes.
    // Reduced-motion users see the static base layout (orbits disabled
    // through the CSS @media block).
    void reduce; // intentional: branching happens in CSS only

    return () => { window.clearInterval(timer); };
  }, []);

  return (
    <div ref={ref} className="dashboard-ambient" aria-hidden="true"
      data-paused={paused ? 'true' : 'false'}
      style={{ zIndex, ['--ambient-amp' as string]: ambientAmp.toFixed(3) } as React.CSSProperties}>
      {/* Base blobs — each anchored by absolute position, orbiting on a
          long period. Anchors are 0..1 viewport units so the layout
          adapts to window resizes without a JS listener. */}
      {BLOBS.map(b => (
        <div
          key={b.id}
          className={`da-blob da-blob--${b.id}`}
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

      {/* Sun — moving warm radial, capped intensity. */}
      <div ref={sunRef} className="da-sun" />

      {/* Grain — fine paper texture, lighter than login (0.035 vs 0.055). */}
      <div className="da-grain" />

      <style>{`
        .dashboard-ambient {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          /* Base canvas: cream centre that fades into deeper amber at the
             edges. The wrap underneath is solid var(--cream), so the
             outer rim of this gradient is what gives the side margins
             their visible warmth. */
          background:
            /* Almost imperceptible warmth. The centre stays the cream
               canvas; the rim shifts toward a very soft cream-amber
               that gives depth without saturation. */
            radial-gradient(ellipse 120% 100% at 50% 40%, #fbf6ec 0%, #f4ecd6 60%, #e6dbbe 100%);
          isolation: isolate;
        }
        .dashboard-ambient > * { pointer-events: none; }
        /* Night mode (22h–6h): a very subtle dusk tilt, still calm. */
        .dashboard-ambient[data-night="true"] {
          background:
            radial-gradient(ellipse 120% 100% at 50% 40%, #f1e8d2 0%, #d8c8a6 60%, #a8946a 100%);
        }

        /* ── Base blobs ───────────────────────────────────────────── */
        .da-blob {
          position: absolute;
          border-radius: 50%;
          translate: -50% -50%;
          /* --ambient-amp comes from JS (0.85..1.15) and modulates blob
             opacity in lock-step with service load — calm shifts darken,
             busy shifts warm up. Falls back to 1 when the prop is absent. */
          background: radial-gradient(
            circle at 50% 50%,
            rgba(var(--blob-rgb), calc(var(--blob-a) * var(--ambient-amp, 1))) 0%,
            rgba(var(--blob-rgb), calc(var(--blob-a) * 0.55 * var(--ambient-amp, 1))) 30%,
            rgba(var(--blob-rgb), 0) 70%
          );
          transition: background 1200ms var(--ease-ios, ease-out);
          /* Back to a soft 48 px blur — blobs read as ambient warmth at
             the margins, never as discrete shapes. The tighter 28 px
             tried earlier turned the rim into visible patches. */
          filter: blur(48px);
          mix-blend-mode: multiply;
          will-change: transform;
          animation: da-orbit var(--orbit-d, 80s) linear infinite;
        }
        @keyframes da-orbit {
          from { transform: rotate(0deg)   translateX(var(--orbit-r, 50px)) rotate(0deg);   }
          to   { transform: rotate(360deg) translateX(var(--orbit-r, 50px)) rotate(-360deg); }
        }
        /* Cream blob lightens — pulls a highlight, not a shadow. */
        .da-blob--cream { mix-blend-mode: screen; }
        /* Staggered start phases so the five blobs never line up. */
        .da-blob--terra    { animation-delay:   0s; }
        .da-blob--ochre    { animation-delay: -18s; }
        .da-blob--wine     { animation-delay: -42s; }
        .da-blob--espresso { animation-delay: -65s; }
        .da-blob--cream    { animation-delay: -11s; }

        /* ── Sun — moving warm radial, capped 0.38 intensity ──────── */
        .da-sun {
          position: absolute;
          inset: 0;
          /* Hot core + halo. Bumped from 0.16/0.08 -> 0.26/0.14 so the
             "warm light source" is actually felt, not just measurable. */
          background:
            radial-gradient(
              circle 380px at var(--sun-x, 50%) var(--sun-y, 30%),
              rgba(var(--sun-hot, 250, 229, 176),  0.10) 0%,
              rgba(var(--sun-hot, 250, 229, 176),  0.04) 30%,
              rgba(var(--sun-hot, 250, 229, 176),  0) 64%
            ),
            radial-gradient(
              circle 1000px at var(--sun-x, 50%) var(--sun-y, 30%),
              rgba(var(--sun-halo, 240, 201, 128), 0.06) 0%,
              rgba(var(--sun-halo, 240, 201, 128), 0.02) 38%,
              rgba(var(--sun-halo, 240, 201, 128), 0) 68%
            );
          mix-blend-mode: screen;
          transition: background 1200ms ease;
        }
        .da-sun[data-visible="false"] {
          mix-blend-mode: multiply;
          opacity: .6;
        }

        /* ── Grain ────────────────────────────────────────────────── */
        .da-grain {
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.30  0 0 0 0 0.20  0 0 0 0 0.10  0 0 0 0.50 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          opacity: .035;
          mix-blend-mode: multiply;
        }

        /* ── Mode vespre — the room after dark ─────────────────────
           Espresso base wash instead of cream; blobs flip from
           multiply (which goes black on dark) to screen so they read
           as warm light sources; sun becomes a low ember; grain flips
           to screen so the speckle stays perceptible. */
        html[data-theme="vespre"] .dashboard-ambient {
          /* Floor lifted (v2): the rim stays warm espresso instead of
             collapsing toward black — less harsh against cream text. */
          background:
            radial-gradient(ellipse 120% 100% at 50% 40%, #221910 0%, #1b140c 60%, #150f08 100%);
        }
        html[data-theme="vespre"] .dashboard-ambient[data-night="true"] {
          background:
            radial-gradient(ellipse 120% 100% at 50% 40%, #1f160e 0%, #181009 60%, #120c06 100%);
        }
        html[data-theme="vespre"] .da-blob {
          mix-blend-mode: screen;
          opacity: .5;
        }
        html[data-theme="vespre"] .da-sun {
          opacity: .45;
        }
        html[data-theme="vespre"] .da-sun[data-visible="false"] {
          mix-blend-mode: screen;
          opacity: .25;
        }
        html[data-theme="vespre"] .da-grain {
          mix-blend-mode: screen;
          opacity: .022;
        }

        /* ── Paused state — any AnimatedSheet open. The orbit CSS
              keyframe still consumes GPU compositing cycles even when
              the user is focused on a sheet, so we pause it. The
              ambient stays visible at the current frame (we use
              animation-play-state: paused, NOT display:none) so the
              page doesn't flash when the sheet closes. */
        .dashboard-ambient[data-paused="true"] .da-blob {
          animation-play-state: paused;
        }
        .dashboard-ambient[data-paused="true"] .da-sun {
          transition: none;
        }

        /* ── Reduced motion — stop all motion, keep the warm wash. ─── */
        @media (prefers-reduced-motion: reduce) {
          .da-blob { animation: none; }
          .da-sun  { transition: none; }
        }

        /* ── FAST-UI (touch / restaurant counter PC / modest GPU) ─────
           The blob orbit re-rasterizes a 48px gaussian blur + blend mode
           on five large layers EVERY frame, forever — the single biggest
           sustained compositor cost in the whole app, and it runs on the
           exact devices least able to afford it. The orbit period is
           70-110s (visually near-static), so freezing it is imperceptible
           while it eliminates the continuous GPU load. The warm blobs
           stay (painted once); only the animation stops. Premium desktops
           (data-fast-ui="0") keep the live orbit. */
        body[data-fast-ui="1"] .da-blob {
          animation: none !important;
          will-change: auto;
        }
        /* A static blur layer is painted once and cached; we can even
           soften it a touch to cut the one-time raster cost without
           changing the look. */
        body[data-fast-ui="1"] .da-blob { filter: blur(40px); }
      `}</style>
    </div>
  );
}
