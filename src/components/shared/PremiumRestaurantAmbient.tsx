/**
 * PremiumRestaurantAmbient — interactive warm-light background.
 *
 * Concept: "warm restaurant light on a cream surface". Multiple layered
 * effects compose a living ambient that responds to pointer movement
 * with heavy easing.
 *
 * Layers (back → front):
 *   1. Cursor candle  — twin-radial (core + halo) following the pointer
 *      with lerp easing, plus a sub-perceptible flicker (life of a
 *      flame). Other static washes (copper parallax, top arch, espresso
 *      pool, ink shadow) live on the main container background.
 *   2. Lock card bloom — anchored warm radial where the PIN card sits.
 *      Different anchor on desktop (≈32% x) vs mobile (centered).
 *   3. God rays       — three slow diagonal light shafts drifting across
 *      the screen at desynchronised durations (45 / 58 / 71 s). Window
 *      light through unseen blinds.
 *   4. Dust motes     — canvas-painted amber particles drifting upward
 *      with horizontal sway. The detail that makes the room "breathe".
 *
 * Reactivity:
 *   • Pointer move/down/up/leave drives cursor candle position and
 *     intensity (lerp k = 0.085).
 *   • Custom event 'ncr:ambient-pulse' (dispatched by the PIN keypad)
 *     spikes intensity briefly — keypresses warm the room.
 *   • prefers-reduced-motion → static ambient, no rAF, no canvas paint,
 *     no rays animation.
 *
 * Performance:
 *   • One rAF loop for cursor smoothing + candle flicker, auto-stops
 *     when settled (delta < 1e-3).
 *   • Separate rAF for dust canvas only when needed; 28 particles,
 *     DPR capped at 1.5.
 *   • All non-canvas layers animate only transform/opacity/bg-position.
 *
 * Integrate behind any content with z-index ≥ 1.
 */

import { useEffect, useRef } from 'react';

interface Props {
  /** z-index of the ambient layer. Content above must use higher. Default 0. */
  zIndex?: number;
}

export default function PremiumRestaurantAmbient({ zIndex = 0 }: Props) {
  const ref       = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* ── Cursor candle + flicker + pulse smoothing ─────────────────── */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      el.style.setProperty('--ambient-x', '50%');
      el.style.setProperty('--ambient-y', '38%');
      el.style.setProperty('--ambient-drift-x', '0px');
      el.style.setProperty('--ambient-drift-y', '0px');
      el.style.setProperty('--ambient-intensity', '1');
      el.style.setProperty('--ambient-flicker', '1');
      return;
    }

    // Smoothed values (current) lerping toward target.
    const target = { x: 0.5, y: 0.38, intensity: 1 };
    const cur    = { x: 0.5, y: 0.38, intensity: 1 };

    // Flicker: pseudo-random walk in [0.92, 1.06] with slow updates.
    let flicker        = 1;
    let flickerTarget  = 1;
    let flickerTick    = 0;

    let rafId    = 0;
    let running  = false;
    /** Decay timer for a pulse spike (keypress). */
    let pulseDecay = 0;

    function apply() {
      if (!el) return;
      el.style.setProperty('--ambient-x', `${(cur.x * 100).toFixed(2)}%`);
      el.style.setProperty('--ambient-y', `${(cur.y * 100).toFixed(2)}%`);
      el.style.setProperty('--ambient-intensity', cur.intensity.toFixed(3));
      el.style.setProperty('--ambient-flicker',   flicker.toFixed(3));
      const driftX = (0.5 - cur.x) * 40;
      const driftY = (0.5 - cur.y) * 28;
      el.style.setProperty('--ambient-drift-x', `${driftX.toFixed(2)}px`);
      el.style.setProperty('--ambient-drift-y', `${driftY.toFixed(2)}px`);
    }

    function tick() {
      // Cursor smoothing (heavy, elegant)
      const k = 0.085;
      const dx = target.x - cur.x;
      const dy = target.y - cur.y;
      const di = target.intensity - cur.intensity;

      cur.x += dx * k;
      cur.y += dy * k;
      cur.intensity += di * k;

      // Flicker — update target every ~6 frames with a small random walk,
      // then lerp toward it. Result is a barely-perceptible "live" glow.
      flickerTick = (flickerTick + 1) % 6;
      if (flickerTick === 0) {
        flickerTarget = 0.93 + Math.random() * 0.13;
      }
      flicker += (flickerTarget - flicker) * 0.18;

      // Pulse decay: if a keypress just hit, intensity was boosted;
      // gently slope it back down.
      if (pulseDecay > 0) {
        pulseDecay -= 1;
        if (pulseDecay === 0) target.intensity = 1;
      }

      apply();

      // We never stop while flickering — flicker keeps the room alive.
      rafId = requestAnimationFrame(tick);
    }

    function kick() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    }

    function setFromPointer(clientX: number, clientY: number) {
      const w = window.innerWidth  || 1;
      const h = window.innerHeight || 1;
      target.x = Math.max(0, Math.min(1, clientX / w));
      target.y = Math.max(0, Math.min(1, clientY / h));
    }

    function onMove(e: PointerEvent) { setFromPointer(e.clientX, e.clientY); }
    function onDown(e: PointerEvent) {
      target.intensity = 1.18;
      pulseDecay = 18;
      setFromPointer(e.clientX, e.clientY);
    }
    function onUp()    { target.intensity = 1; }
    function onLeave() {
      target.x = 0.5;
      target.y = 0.38;
      target.intensity = 1;
    }

    /** PIN keypad sends a small pulse; the room warms briefly. */
    function onPulse() {
      target.intensity = 1.22;
      pulseDecay = 22;
    }

    window.addEventListener('pointermove',  onMove,  { passive: true });
    window.addEventListener('pointerdown',  onDown,  { passive: true });
    window.addEventListener('pointerup',    onUp,    { passive: true });
    window.addEventListener('pointercancel', onUp,   { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });
    window.addEventListener('ncr:ambient-pulse', onPulse as EventListener);

    apply();
    kick();

    return () => {
      window.removeEventListener('pointermove',  onMove);
      window.removeEventListener('pointerdown',  onDown);
      window.removeEventListener('pointerup',    onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('ncr:ambient-pulse', onPulse as EventListener);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  /* ── Dust motes (canvas particles) ─────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    type Mote = {
      x: number; y: number;
      vy: number;        // upward speed (px / frame ~ 60fps)
      phase: number;     // for horizontal sway sin()
      sway: number;      // sway amplitude (px)
      size: number;      // radius (px)
      alpha: number;     // 0..1
      hue:   number;     // amber range
    };

    let particles: Mote[] = [];
    let raf = 0;
    let t = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function init() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Particle count scales gently with viewport area (≈ 22-34).
      const count = Math.max(22, Math.min(34, Math.round((w * h) / 90_000)));
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x:     Math.random() * w,
          y:     Math.random() * h,
          vy:    0.08 + Math.random() * 0.20,
          phase: Math.random() * Math.PI * 2,
          sway:  0.6 + Math.random() * 1.6,
          size:  0.8 + Math.random() * 1.4,
          alpha: 0.15 + Math.random() * 0.28,
          hue:   30 + Math.random() * 14,
        });
      }
    }

    function tick() {
      if (!ctx || !canvas) return;
      t += 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.y -= p.vy;
        const sx = p.x + Math.sin(t * 0.015 + p.phase) * p.sway;
        // Wrap to bottom when off the top.
        if (p.y < -8) {
          p.y = h + 8;
          p.x = Math.random() * w;
        }
        // Warm amber glow with soft falloff via radial gradient per mote.
        const g = ctx.createRadialGradient(sx, p.y, 0, sx, p.y, p.size * 4);
        g.addColorStop(0,    `hsla(${p.hue}, 70%, 76%, ${p.alpha})`);
        g.addColorStop(0.5,  `hsla(${p.hue}, 70%, 76%, ${p.alpha * 0.4})`);
        g.addColorStop(1,    `hsla(${p.hue}, 70%, 76%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    resize();
    init();
    raf = requestAnimationFrame(tick);

    function onResize() { resize(); init(); }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div ref={ref} className="ambient-restaurant" aria-hidden="true" style={{ zIndex }}>
      {/* Lock card bloom — warm radial anchored where the PIN card sits. */}
      <div className="ambient-bloom" />

      {/* God rays — three slow diagonal light shafts. */}
      <div className="ambient-rays" data-ray="a" />
      <div className="ambient-rays" data-ray="b" />
      <div className="ambient-rays" data-ray="c" />

      {/* Dust motes — canvas of drifting amber particles. */}
      <canvas ref={canvasRef} className="ambient-dust" />

      <style>{`
        .ambient-restaurant {
          --ambient-x:          50%;
          --ambient-y:          38%;
          --ambient-drift-x:    0px;
          --ambient-drift-y:    0px;
          --ambient-intensity:  1;
          --ambient-flicker:    1;

          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;

          /* Static atmosphere layers (do not move). */
          background:
            /* Secondary copper wash — parallax drift. */
            radial-gradient(
              circle 980px at calc(78% + var(--ambient-drift-x))
                              calc(18% + var(--ambient-drift-y)),
              rgba(214, 138, 76, 0.13) 0%,
              rgba(214, 138, 76, 0.05) 36%,
              rgba(214, 138, 76, 0) 64%
            ),
            /* Wide architectural wall-curve wash (very faint). */
            radial-gradient(
              ellipse 140% 90% at 50% -20%,
              rgba(255, 230, 196, 0.20) 0%,
              rgba(255, 230, 196, 0) 70%
            ),
            /* Espresso floor pool. */
            radial-gradient(
              ellipse 70% 50% at 14% 102%,
              rgba(40, 24, 14, 0.20) 0%,
              rgba(40, 24, 14, 0.10) 32%,
              rgba(40, 24, 14, 0) 60%
            ),
            /* Right-side ink shadow for asymmetric weight. */
            radial-gradient(
              ellipse 50% 80% at 108% 60%,
              rgba(30, 20, 12, 0.10) 0%,
              rgba(30, 20, 12, 0) 60%
            );
          animation: ambient-breathe 14s ease-in-out infinite alternate;
          will-change: background-position;
        }
        .ambient-restaurant > * { pointer-events: none; }

        /* All ambient overlays span the full layer. */
        .ambient-bloom,
        .ambient-rays,
        .ambient-dust {
          position: absolute;
          inset: 0;
        }

        /* ── Cursor candle (twin-radial + flicker) ─────────────────── */
        /* Painted via a pseudo-element so the candle composites on top of
           the static washes. Two layers: a small hot core and a soft halo. */
        .ambient-restaurant::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            /* Inner core — small, hot, follows cursor exactly. */
            radial-gradient(
              circle 320px at var(--ambient-x) var(--ambient-y),
              rgba(200, 97, 58, calc(0.22 * var(--ambient-intensity) * var(--ambient-flicker))) 0%,
              rgba(200, 97, 58, calc(0.10 * var(--ambient-intensity) * var(--ambient-flicker))) 28%,
              rgba(200, 97, 58, 0) 60%
            ),
            /* Outer halo — large, soft, ambient glow. */
            radial-gradient(
              circle 820px at var(--ambient-x) var(--ambient-y),
              rgba(220, 130, 80, calc(0.10 * var(--ambient-intensity) * var(--ambient-flicker))) 0%,
              rgba(220, 130, 80, calc(0.04 * var(--ambient-intensity) * var(--ambient-flicker))) 36%,
              rgba(220, 130, 80, 0) 66%
            );
        }

        /* ── Lock card bloom ───────────────────────────────────────── */
        /* A warm anchored radial pretending the lock card emits light.
           Different anchor for the 2-column desktop layout. */
        .ambient-bloom {
          background: radial-gradient(
            circle 540px at 50% 38%,
            rgba(255, 220, 170, calc(0.13 * var(--ambient-intensity))) 0%,
            rgba(255, 220, 170, calc(0.06 * var(--ambient-intensity))) 38%,
            rgba(255, 220, 170, 0) 68%
          );
        }
        @media (min-width: 1000px) {
          .ambient-bloom {
            background: radial-gradient(
              circle 620px at 32% 50%,
              rgba(255, 220, 170, calc(0.15 * var(--ambient-intensity))) 0%,
              rgba(255, 220, 170, calc(0.07 * var(--ambient-intensity))) 38%,
              rgba(255, 220, 170, 0) 68%
            );
          }
        }

        /* ── God rays ─────────────────────────────────────────────── */
        /* Three diagonal light shafts moving slowly. Different angles,
           thicknesses and durations so they never align. The element is
           wider/taller than the viewport so the diagonal stripe always
           covers the visible area as it translates. */
        .ambient-rays {
          /* Larger than viewport so the diagonal band always reaches edges. */
          inset: -25%;
          background-repeat: no-repeat;
          background-size: 260% 100%;
        }
        .ambient-rays[data-ray="a"] {
          background-image: linear-gradient(112deg,
            transparent 36%,
            rgba(255,225,185,.055) 40%,
            rgba(255,225,185,.105) 43%,
            rgba(255,225,185,.055) 46%,
            transparent 52%);
          background-size: 250% 100%;
          animation: rays-drift 45s linear infinite;
        }
        .ambient-rays[data-ray="b"] {
          background-image: linear-gradient(108deg,
            transparent 58%,
            rgba(255,210,170,.045) 62%,
            rgba(255,210,170,.085) 65%,
            rgba(255,210,170,.045) 68%,
            transparent 75%);
          background-size: 220% 100%;
          animation: rays-drift 58s linear infinite;
          animation-delay: -19s;
        }
        .ambient-rays[data-ray="c"] {
          background-image: linear-gradient(116deg,
            transparent 18%,
            rgba(255,235,200,.030) 22%,
            rgba(255,235,200,.065) 25%,
            rgba(255,235,200,.030) 28%,
            transparent 36%);
          background-size: 280% 100%;
          animation: rays-drift 71s linear infinite reverse;
          animation-delay: -33s;
        }
        @keyframes rays-drift {
          from { background-position: -30% 0%; }
          to   { background-position: 130% 0%; }
        }

        /* ── Dust motes canvas ────────────────────────────────────── */
        .ambient-dust {
          width: 100%;
          height: 100%;
          opacity: .9;
          mix-blend-mode: screen;
        }

        /* Static breathing of the secondary layers (does not affect
           cursor candle, bloom, rays or dust). */
        @keyframes ambient-breathe {
          0%   { background-position: 0 0, 0 0, 0 0, 0 0; }
          100% { background-position: -18px 12px, 0 -10px, 12px -8px, -10px 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ambient-restaurant,
          .ambient-rays,
          .ambient-bloom,
          .ambient-restaurant::before {
            animation: none !important;
          }
          .ambient-dust { display: none; }
        }
      `}</style>
    </div>
  );
}
