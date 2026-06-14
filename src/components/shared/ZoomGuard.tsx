/**
 * ZoomGuard — recovers the app when a touch device gets stuck zoomed in.
 *
 * Why this exists
 * ───────────────
 * The app layout is fully fluid: it renders correctly at every real device
 * width (320 px through 1280 px+), so a phone's physical size is never the
 * problem. The trap is iOS Safari's accessibility behaviour — it IGNORES our
 * `user-scalable=no, maximum-scale=1` viewport meta, so a stray two-finger
 * pinch (trivially easy to trigger during a busy service) leaves the page
 * MAGNIFIED: the layout viewport stays at device-width while the *visual*
 * viewport zooms in. The result is exactly the "unusable on this one phone"
 * symptom — everything looks enlarged and the right edge is clipped off the
 * screen, even though the markup is identical to a phone that looks perfect.
 *
 * There is no reliable, supported way to programmatically reset the visual
 * viewport zoom on iOS. So instead of trying to fight it invisibly, we DETECT
 * the zoomed state and surface a calm, self-explanatory recovery hint. One
 * pinch back to 100 % and the operator is working again — on any device.
 *
 * Behaviour
 * ─────────
 *   • Touch / coarse-pointer devices only. Desktop users zoom on purpose.
 *   • Watches window.visualViewport. When the zoom scale stays above a small
 *     threshold for a beat (so it never flickers mid-pinch), a calm pill drops
 *     from the top of the screen. It removes itself the instant the scale
 *     returns to ~1.
 *   • The pill is the ONLY pointer-events surface — it never blocks the app.
 *   • Tapping it makes a best-effort attempt to re-assert the viewport meta
 *     (sometimes nudges Safari back to 1×); the copy tells the operator to
 *     pinch out, which always works.
 */
import { useEffect, useRef, useState } from 'react';

/** Zoom factor above which we consider the screen "stuck magnified". */
const SHOW_AT = 1.15;
/** Hysteresis: only hide once we're comfortably back near 1× (no flicker). */
const HIDE_AT = 1.05;
/** Sustain window before showing — ignores the transient mid-pinch state. */
const SUSTAIN_MS = 280;

function isTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const maxTouch = (navigator as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  return coarse || maxTouch > 0;
}

/** Current visual-zoom factor. visualViewport.scale is canonical on iOS; the
 *  innerWidth/visualViewport.width ratio is a robust fallback elsewhere. */
function zoomScale(): number {
  const vv = window.visualViewport;
  if (!vv) return 1;
  if (typeof vv.scale === 'number' && vv.scale > 0) return vv.scale;
  if (vv.width > 0) return window.innerWidth / vv.width;
  return 1;
}

export default function ZoomGuard() {
  const [zoomed, setZoomed] = useState(false);
  // Mirror of `zoomed` readable synchronously inside the event handler, so
  // the handler stays a pure reader and never reaches into stale closure
  // state. The sustain timer id lives here too.
  const zoomedRef = useRef(false);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTouch()) return;
    const vv = window.visualViewport;
    if (!vv) return; // no visualViewport API → nothing we can measure

    const clearPending = () => {
      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
    };
    const show = () => { zoomedRef.current = true;  setZoomed(true); };
    const hide = () => { zoomedRef.current = false; setZoomed(false); };

    const evaluate = () => {
      const scale = zoomScale();
      if (zoomedRef.current) {
        // Visible → hide only once we're safely back near 1× (hysteresis).
        if (scale <= HIDE_AT) { clearPending(); hide(); }
        return;
      }
      // Hidden → arm a sustain timer; show only if it stays zoomed, so we
      // never flash the pill during an intentional, transient pinch.
      if (scale >= SHOW_AT) {
        if (pendingRef.current === null) {
          pendingRef.current = window.setTimeout(() => {
            pendingRef.current = null;
            if (zoomScale() >= SHOW_AT) show();
          }, SUSTAIN_MS);
        }
      } else {
        clearPending();
      }
    };

    vv.addEventListener('resize', evaluate);
    vv.addEventListener('scroll', evaluate);
    evaluate();

    return () => {
      clearPending();
      vv.removeEventListener('resize', evaluate);
      vv.removeEventListener('scroll', evaluate);
    };
  }, []);

  /** Best-effort nudge: re-assert the locked viewport meta. On some iOS
   *  builds toggling initial-scale snaps the visual viewport back to 1×;
   *  when it doesn't, the pinch instruction in the copy always does. */
  function tryReset() {
    try {
      const vp = document.querySelector('meta[name="viewport"]');
      if (!vp) return;
      const locked =
        'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no';
      vp.setAttribute('content', locked + ', minimum-scale=1');
      window.setTimeout(() => vp.setAttribute('content', locked), 60);
    } catch { /* harmless */ }
  }

  if (!zoomed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={tryReset}
      style={{
        position: 'fixed',
        top: 'max(10px, env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9000, // above toasts (500) and every sheet
        maxWidth: 'calc(100vw - 24px)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 999,
        background: 'linear-gradient(180deg, #2a2018 0%, #1a120d 100%)',
        color: '#fbf7ee',
        font: '600 13px/1.3 var(--font-sans, system-ui, sans-serif)',
        letterSpacing: '-0.005em',
        boxShadow:
          '0 1px 0 rgba(255,255,255,.12) inset, 0 14px 34px -10px rgba(40,24,12,.55), 0 0 0 1px rgba(200,97,58,.35)',
        cursor: 'pointer',
        animation: 'ncr-zoomguard-in 320ms cubic-bezier(0.23,1,0.32,1)',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 15 }}>🔍</span>
      <span>
        Pantalla ampliada · <strong style={{ color: '#f3c581' }}>pessiga amb dos dits</strong> per tornar al 100%
      </span>
      <style>{`
        @keyframes ncr-zoomguard-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
