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

/**
 * True when the device supports touch.
 *
 * matchMedia('(pointer: coarse)') is the canonical answer but iOS Safari has
 * known quirks where it can return false during very early page lifecycle.
 * `navigator.maxTouchPoints` is a stable structural fact about the device and
 * works as a reliable fallback. We OR them so we only return false when both
 * agree.
 */
function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(pointer: coarse)').matches;
  const maxTouch = (navigator as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  return mq || maxTouch > 0;
}

/**
 * True when the hardware itself is a tablet, independent of viewport width.
 *
 * Critical for iPad in Split View / Slide Over: the visible viewport can
 * shrink below 600 px when sharing the screen, but the user still wants
 * the tablet shell (side rail, no bottom nav) because the device IS a tablet.
 *
 * Detection sources, in order of reliability:
 *   1. Classic UA contains "iPad" (iOS < 13)
 *   2. iPadOS 13+ reports UA as Macintosh BUT has touch (Macs don't)
 *   3. Android UA without "Mobile" qualifier
 */
function detectTabletHardware(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const maxTouch = (navigator as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  if (/iPad/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && maxTouch > 1) return true;  // iPad in desktop-UA mode
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return true;
  return false;
}

/**
 * Device classification rules
 *
 *   tablet hardware                  → tablet  (forced — handles Split View)
 *   any touch device  width < 600    → mobile  (phones)
 *   any touch device  width ≥ 600    → tablet  (iPads, Android tablets)
 *   non-touch         width < 768    → mobile  (narrow browser window)
 *   non-touch         width ≥ 1100   → desktop
 *   non-touch         768–1099       → tablet  (narrow desktop window)
 *
 * Key invariant #1: an iPad in portrait at 810×1080 (or 768×1024 classic)
 *   MUST always classify as tablet.
 * Key invariant #2: an iPad in iPadOS Split View — where window.innerWidth
 *   can drop to ~507 — STILL classifies as tablet, because the device is
 *   a tablet and the operator wants the side-rail shell.
 */
function classify(w: number, isTouch: boolean, isTabletHw: boolean): DeviceType {
  if (isTabletHw) return 'tablet';
  if (isTouch) {
    return w < 600 ? 'mobile' : 'tablet';
  }
  if (w < 768) return 'mobile';
  if (w >= 1100) return 'desktop';
  return 'tablet';
}

function snapshot(): DeviceInfo {
  const w        = window.innerWidth;
  const h        = window.innerHeight;
  const isTouch  = detectTouch();
  const tabletHw = detectTabletHardware();
  const device   = classify(w, isTouch, tabletHw);
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

    // Re-evaluate once after mount — iOS Safari (especially in PWA mode) can
    // report stale viewport dimensions during the first paint, which used to
    // make the iPad briefly classify as mobile. A second rAF tick guarantees
    // the visual viewport has settled.
    const r = requestAnimationFrame(() => requestAnimationFrame(update));

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
      cancelAnimationFrame(r);
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
