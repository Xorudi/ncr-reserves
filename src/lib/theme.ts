/**
 * Theme manager — "mode vespre" (evening service mode).
 *
 * Three user-facing modes, persisted in localStorage:
 *   • 'auto'   — follow the service clock: vespre from 19:00 to 06:59,
 *                day theme otherwise. Default. Restaurants live at night;
 *                the app dims itself when the dining room does.
 *   • 'llum'   — always the warm cream day theme.
 *   • 'vespre' — always the espresso evening theme.
 *
 * The resolved theme lands as `data-theme="vespre"` on <html> (absent for
 * the day theme), which activates the token override block in index.css.
 * Every component that uses var(--token) switches automatically; the
 * PIN lock screen keeps its own self-contained atmosphere and is not
 * affected by design.
 *
 * The browser theme-color meta is kept in sync so the iOS status bar /
 * PWA chrome matches the canvas.
 *
 * Self-initializing on import (same pattern as lib/uiMode.ts) so the
 * theme is correct before React's first paint — no light flash.
 */

import { useSyncExternalStore } from 'react';

export type ThemeMode = 'auto' | 'llum' | 'vespre';

const STORAGE_KEY = 'ncr-theme-mode';
const EVENT = 'ncr:theme-change';

/** Vespre window for 'auto': 19:00 → 06:59. */
const VESPRE_FROM_H = 19;
const VESPRE_TO_H   = 7;

const THEME_COLOR_DAY    = '#F5EFE4';
const THEME_COLOR_VESPRE = '#211811';

export function getThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'llum' || raw === 'vespre' || raw === 'auto') return raw;
  } catch { /* ignore */ }
  return 'auto';
}

export function setThemeMode(mode: ThemeMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
  applyTheme();
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* ignore */ }
}

/** The theme that is live right now, after resolving 'auto'. */
export function resolveTheme(mode: ThemeMode = getThemeMode()): 'llum' | 'vespre' {
  if (mode !== 'auto') return mode;
  const h = new Date().getHours();
  return (h >= VESPRE_FROM_H || h < VESPRE_TO_H) ? 'vespre' : 'llum';
}

function syncThemeColorMeta(theme: 'llum' | 'vespre'): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'vespre' ? THEME_COLOR_VESPRE : THEME_COLOR_DAY;
}

export function applyTheme(): void {
  const theme = resolveTheme();
  const root = document.documentElement;
  if (theme === 'vespre') root.setAttribute('data-theme', 'vespre');
  else root.removeAttribute('data-theme');
  syncThemeColorMeta(theme);
}

/** Subscribe to mode changes (manual toggle or auto crossover). */
export function onThemeChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** React hook — re-renders when the RESOLVED theme flips (manual toggle
 *  or the 19:00 auto crossover). Use for inline styles that can't read
 *  CSS variables, e.g. per-business brand tints. */
export function useResolvedTheme(): 'llum' | 'vespre' {
  return useSyncExternalStore(
    onThemeChange,
    resolveTheme,
    () => 'llum' as const,
  );
}

// ── Self-init ────────────────────────────────────────────────────────────────
// Apply before first paint, then re-check every minute so an 'auto' device
// crosses into vespre mid-evening without anyone touching it. The check is
// idempotent and costs nothing when the resolved theme hasn't changed.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  applyTheme();
  let last = resolveTheme();
  window.setInterval(() => {
    const now = resolveTheme();
    if (now !== last) {
      last = now;
      applyTheme();
      try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* ignore */ }
    }
  }, 60_000);
}
