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

  /** true when launched from home-screen (PWA standalone / fullscreen) */
  isStandalone: boolean;

  orientation: Orientation;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detects whether the app is running as an installed PWA */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari sets this proprietary flag when running from the home screen
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  // All other platforms (Android Chrome, Edge, etc.)
  return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches;
}

/**
 * Breakpoints
 *   mobile   < 768 px  (phones)
 *   tablet   768–1024 px in portrait  (iPad, etc.)
 *   desktop  > 1024 px  OR  tablet landscape  (wider surface, desktop)
 *
 * Rationale: a landscape tablet at 1024 px has enough width for the desktop
 * sidebar layout; forcing the tablet shell there would waste horizontal space.
 */
function classify(w: number, h: number): DeviceType {
  if (w < 768) return 'mobile';
  if (w <= 1024 && h > w) return 'tablet';   // portrait-only tablet treatment
  return 'desktop';
}

function snapshot(): DeviceInfo {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const device = classify(w, h);
  return {
    width:  w,
    height: h,
    device,
    isMobile:     device === 'mobile',
    isTablet:     device === 'tablet',
    isDesktop:    device === 'desktop',
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
    const mq = window.matchMedia('(display-mode: standalone)');
    try { mq.addEventListener('change', update); }
    catch { mq.addListener(update); } // Safari < 14 fallback

    return () => {
      window.removeEventListener('resize',            update);
      window.removeEventListener('orientationchange', update);
      try { mq.removeEventListener('change', update); }
      catch { mq.removeListener(update); }
    };
  }, []);

  return info;
}

// ─── Convenience hooks ────────────────────────────────────────────────────────
export const useIsMobile       = () => useDevice().isMobile;
export const useIsTablet        = () => useDevice().isTablet;
export const useIsDesktop       = () => useDevice().isDesktop;
export const useIsStandalonePWA = () => useDevice().isStandalone;
