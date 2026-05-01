import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type DeviceType  = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  /** Raw viewport dimensions */
  width:  number;
  height: number;

  /** Resolved device category */
  device:    DeviceType;
  isMobile:  boolean;
  isTablet:  boolean;
  isDesktop: boolean;

  /** true when pointer is coarse (finger/stylus) — any touch device */
  isTouch: boolean;

  /** true when launched from home-screen (PWA standalone / fullscreen) */
  isStandalone: boolean;

  orientation: Orientation;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detects whether the app is running as an installed PWA */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches;
}

/** True when the primary pointer is coarse (finger / stylus) */
function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Device classification rules
 *
 *  mobile   < 768 px                              (phones)
 *  tablet   768–1099 px  OR  touch device         (tablets, iPads, touch monitors)
 *  desktop  >= 1100 px  AND  NOT touch            (mouse-driven wide screens)
 *
 * The key insight: a touch device is NEVER desktop, regardless of width.
 * A bar tablet in landscape at 1024 px has pointer:coarse → tablet shell.
 * Only a non-touch screen at 1100 px+ gets the full desktop layout.
 */
function classify(w: number, isTouch: boolean): DeviceType {
  if (w < 768)              return 'mobile';
  if (w >= 1100 && !isTouch) return 'desktop';
  return 'tablet'; // 768–1099 any pointer, OR touch at any width ≥ 768
}

function snapshot(): DeviceInfo {
  const w       = window.innerWidth;
  const h       = window.innerHeight;
  const isTouch = detectTouch();
  const device  = classify(w, isTouch);
  return {
    width:  w,
    height: h,
    device,
    isMobile:     device === 'mobile',
    isTablet:     device === 'tablet',
    isDesktop:    device === 'desktop',
    isTouch,
    isStandalone: detectStandalone(),
    orientation:  h >= w ? 'portrait' : 'landscape',
  };
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(snapshot);

  useEffect(() => {
    const update = () => setInfo(snapshot());

    window.addEventListener('resize',            update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });

    // React to PWA install (display-mode changes)
    const mqStandalone = window.matchMedia('(display-mode: standalone)');
    const mqTouch      = window.matchMedia('(pointer: coarse)');
    try {
      mqStandalone.addEventListener('change', update);
      mqTouch.addEventListener('change', update);
    } catch {
      // Safari < 14 fallback
      mqStandalone.addListener(update);
      mqTouch.addListener(update);
    }

    return () => {
      window.removeEventListener('resize',            update);
      window.removeEventListener('orientationchange', update);
      try {
        mqStandalone.removeEventListener('change', update);
        mqTouch.removeEventListener('change', update);
      } catch {
        mqStandalone.removeListener(update);
        mqTouch.removeListener(update);
      }
    };
  }, []);

  return info;
}

// ─── Convenience hooks ────────────────────────────────────────────────────────
export const useIsMobile       = () => useDevice().isMobile;
export const useIsTablet       = () => useDevice().isTablet;
export const useIsDesktop      = () => useDevice().isDesktop;
export const useIsTouch        = () => useDevice().isTouch;
export const useIsStandalonePWA = () => useDevice().isStandalone;
