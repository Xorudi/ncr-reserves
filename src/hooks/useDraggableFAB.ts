/**
 * useDraggableFAB — draggable floating action button with edge-snapping.
 *
 * Features:
 *  - Pointer-events drag (mouse + touch + stylus)
 *  - Snap to nearest horizontal edge after release (velocity-aware)
 *  - Subtle inertia before snap
 *  - Position persisted in localStorage (per storage key)
 *  - Respects safe-area-inset-* and bottom navigation height
 *  - Re-clamps on viewport resize / orientation change
 *  - Haptic feedback via Vibration API when available
 *  - Distinguishes tap (< 6 px movement) from drag
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useDevice } from './useDevice';

// ─── Constants ────────────────────────────────────────────────────────────────

const FAB_SIZE    = 50;    // button diameter in px
const MARGIN      = 16;    // min distance from viewport edges
const SNAP_MS     = 320;   // snap transition duration
const INERTIA_MS  = 60;    // velocity projection window (ms)
const MOVE_THRESH = 6;     // px of movement to classify as drag vs tap
const EASE        = 'cubic-bezier(0.25, 1, 0.5, 1)'; // --ease-ios

interface Pos { x: number; y: number }

// ─── Safe area helpers ────────────────────────────────────────────────────────

/** Read a CSS custom property as a number. */
function cssVar(name: string, fallback = 0): number {
  return parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  ) || fallback;
}

/**
 * Read an env(safe-area-inset-*) value in JS via a sentinel element.
 * This is the only reliable cross-browser technique.
 */
function safeInset(side: 'top' | 'bottom' | 'left' | 'right'): number {
  try {
    const cssProp = `padding-${side}`;
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', `${side}:0`, 'width:0', 'height:0',
      'pointer-events:none', 'visibility:hidden',
      `${cssProp}:env(safe-area-inset-${side},0px)`,
    ].join(';');
    document.body.appendChild(el);
    const val = parseFloat(getComputedStyle(el).getPropertyValue(cssProp)) || 0;
    document.body.removeChild(el);
    return val;
  } catch {
    return 0;
  }
}

// Cached safe-area values — recomputed on resize, not on every pointer move
const cache = { safeTop: 0, safeBottom: 0, safeLeft: 0, safeRight: 0, navH: 56 };

function refreshCache(isTablet: boolean) {
  cache.safeTop    = safeInset('top');
  cache.safeBottom = safeInset('bottom');
  cache.safeLeft   = safeInset('left');
  cache.safeRight  = safeInset('right');
  // On tablet the nav is a side rail → no bottom-nav height reservation
  cache.navH = isTablet ? 0 : cssVar('--mobile-nav-h', 56);
}

function getBounds(isTablet: boolean) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    minX: cache.safeLeft  + MARGIN,
    maxX: w - FAB_SIZE - cache.safeRight  - MARGIN,
    minY: cache.safeTop   + MARGIN,
    maxY: h - FAB_SIZE - cache.navH - cache.safeBottom - MARGIN,
    w, h,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function clampPos(p: Pos, isTablet: boolean): Pos {
  const b = getBounds(isTablet);
  return { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadPos(key: string): Pos | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Pos) : null;
  } catch { return null; }
}

function savePos(key: string, p: Pos) {
  try { localStorage.setItem(key, JSON.stringify(p)); } catch {}
}

// ─── Haptics ──────────────────────────────────────────────────────────────────

function vibrate(ms: number) {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface Options {
  /** localStorage key — change to get separate positions per user/device */
  storageKey?: string;
  /** Called when the user taps (no significant drag movement) */
  onTap?: () => void;
}

export function useDraggableFAB({
  storageKey = 'ncr-fab-pos-v2',
  onTap,
}: Options = {}) {
  const { isTablet } = useDevice();

  // pos === null → not yet mounted (button hidden until position is resolved)
  const [pos, _setPos]       = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);

  const posRef   = useRef<Pos | null>(null);
  const onTapRef = useRef(onTap);
  useEffect(() => { onTapRef.current = onTap; });

  function setPos(p: Pos) {
    posRef.current = p;
    _setPos(p);
  }

  // ── Mount: load / default position, refresh safe-area cache ──────────────
  useEffect(() => {
    refreshCache(isTablet);
    const stored = loadPos(storageKey);
    const initial = stored
      ? clampPos(stored, isTablet)
      : (() => { const b = getBounds(isTablet); return { x: b.maxX, y: b.maxY }; })();
    setPos(initial);

    const onResize = () => {
      refreshCache(isTablet);
      if (posRef.current) setPos(clampPos(posRef.current, isTablet));
    };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [isTablet, storageKey]);

  // ── Drag state (kept in a ref to avoid stale closures in handlers) ────────
  const drag = useRef({
    active: false, moved: false,
    sx: 0, sy: 0,   // pointer start coords
    fx: 0, fy: 0,   // FAB pos at drag start
    lx: 0, ly: 0,   // last pointer coords (for velocity)
    vx: 0, vy: 0,   // velocity px/ms
    lt: 0,          // last timestamp
  });

  // ── Snap to nearest horizontal edge ──────────────────────────────────────
  const snap = useCallback((p: Pos, velX: number) => {
    const b = getBounds(isTablet);
    // Velocity > 0.3 px/ms → follow throw direction; otherwise nearest edge
    const goRight = Math.abs(velX) > 0.3 ? velX > 0 : (p.x + FAB_SIZE / 2) >= b.w / 2;
    const snapped: Pos = {
      x: goRight ? b.maxX : b.minX,
      y: clamp(p.y, b.minY, b.maxY),
    };
    setPos(snapped);
    savePos(storageKey, snapped);
    vibrate(10);
  }, [isTablet, storageKey]);

  // ── Pointer handlers ──────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!posRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      active: true, moved: false,
      sx: e.clientX, sy: e.clientY,
      fx: posRef.current.x, fy: posRef.current.y,
      lx: e.clientX, ly: e.clientY,
      vx: 0, vy: 0, lt: performance.now(),
    };
    vibrate(6);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d.active) return;
    e.preventDefault();

    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;

    if (!d.moved && (Math.abs(dx) > MOVE_THRESH || Math.abs(dy) > MOVE_THRESH)) {
      d.moved = true;
      setDragging(true);
    }
    if (!d.moved) return;

    const now = performance.now();
    const dt  = now - d.lt;
    if (dt > 0) {
      d.vx = (e.clientX - d.lx) / dt;
      d.vy = (e.clientY - d.ly) / dt;
    }
    d.lx = e.clientX; d.ly = e.clientY; d.lt = now;

    const b = getBounds(isTablet);
    setPos({
      x: clamp(d.fx + dx, b.minX, b.maxX),
      y: clamp(d.fy + dy, b.minY, b.maxY),
    });
  }, [isTablet]);

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);

    if (d.moved) {
      d.moved = false;
      if (!posRef.current) return;
      // Project brief inertia forward, then snap
      const b = getBounds(isTablet);
      const withInertia: Pos = {
        x: clamp(posRef.current.x + d.vx * INERTIA_MS, b.minX, b.maxX),
        y: clamp(posRef.current.y + d.vy * INERTIA_MS, b.minY, b.maxY),
      };
      setPos(withInertia);
      requestAnimationFrame(() => snap(withInertia, d.vx));
    } else {
      // Clean tap — no meaningful movement
      onTapRef.current?.();
    }
  }, [isTablet, snap]);

  const onPointerCancel = useCallback(() => {
    if (!drag.current.active) return;
    drag.current.active = false;
    drag.current.moved  = false;
    setDragging(false);
    if (posRef.current) snap(posRef.current, 0);
  }, [snap]);

  // ── Computed style ────────────────────────────────────────────────────────
  const mounted = pos !== null;

  const baseStyle: CSSProperties = {
    position:  'fixed',
    left:      pos?.x ?? -999,
    top:       pos?.y ?? -999,
    width:     FAB_SIZE,
    height:    FAB_SIZE,
    visibility: mounted ? 'visible' : 'hidden',
    touchAction: 'none',         // prevent browser scroll-hijack during drag
    userSelect: 'none',
    WebkitUserSelect: 'none',
    willChange: 'left, top, transform',
  };

  const draggingStyle: CSSProperties = {
    transform:  'scale(1.12)',
    boxShadow:  '0 8px 28px rgba(160,60,20,.55), 0 3px 10px rgba(0,0,0,.22)',
    transition: `transform 110ms cubic-bezier(0.4,1,0.6,1),
                 box-shadow 110ms ease`,
    zIndex: 200,
    cursor: 'grabbing',
  };

  const restingStyle: CSSProperties = {
    transform:  'scale(1)',
    transition: `transform ${SNAP_MS}ms ${EASE},
                 box-shadow ${SNAP_MS}ms ease,
                 left   ${SNAP_MS}ms ${EASE},
                 top    ${SNAP_MS}ms ${EASE}`,
    zIndex: 40,
    cursor: 'pointer',
  };

  return {
    /** Spread onto the FAB button as base styles (position, size, visibility, drag utils) */
    fabBaseStyle: { ...baseStyle, ...(dragging ? draggingStyle : restingStyle) },
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    } as const,
  };
}
