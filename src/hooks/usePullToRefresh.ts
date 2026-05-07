/**
 * usePullToRefresh — document-level hook that adds pull-to-refresh to any
 * descendant element with className "scroll" that is currently at scrollTop 0.
 *
 * Why document-level instead of a wrapper component: the app already has many
 * `.scroll` containers nested deep in screens. A wrapper would require touching
 * every screen. The hook is mounted once at the shell, listens to touchstart
 * on capture, finds the nearest `.scroll` ancestor of the touch target, and
 * takes over the gesture only when that scroll is at the top.
 *
 * UX:
 *   - Pull down with damping (0.5×) → the .scroll element translates down
 *   - Below threshold (THRESHOLD_PX) → snap back on release in 200ms
 *   - At/above threshold → fire onRefresh and hold a "spinning" state for at
 *     least MIN_REFRESH_MS so the user has time to see it's actually doing
 *     something, then snap back
 *   - During pull, the body grain opacity rises from default to ~0.07 so
 *     the paper "absorbs" while pulling (visual cohesion with the texture)
 */
import { useEffect, useRef, useState } from 'react';

const THRESHOLD_PX   = 70;
const DAMPING        = 0.5;
const MIN_REFRESH_MS = 700;
const GRAIN_BASE     = 0.035;
const GRAIN_BOOST    = 0.07;

export interface PullState {
  /** Current pull distance in px (after damping). 0 when idle. */
  pullY: number;
  /** True while the refresh callback is in flight or holding for min time. */
  refreshing: boolean;
}

export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [state, setState] = useState<PullState>({ pullY: 0, refreshing: false });

  // Keep latest callback in a ref so listeners don't need to rebind.
  const refreshRef = useRef(onRefresh);
  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    let scrollEl: HTMLElement | null = null;
    let startY    = 0;
    let pulling   = false;
    let pullY     = 0;
    let refreshing = false;

    const findScroll = (target: EventTarget | null): HTMLElement | null => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.classList?.contains('scroll')) return el;
        el = el.parentElement;
      }
      return null;
    };

    const setGrain = (v: number) => {
      document.documentElement.style.setProperty('--grain-opacity', String(v));
    };

    const reset = (animate: boolean) => {
      if (scrollEl) {
        scrollEl.style.transition = animate ? 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1)' : '';
        scrollEl.style.transform  = '';
        const el = scrollEl;
        if (animate) {
          window.setTimeout(() => { if (el) el.style.transition = ''; }, 240);
        }
      }
      pullY = 0;
      pulling = false;
      setState({ pullY: 0, refreshing });
      setGrain(GRAIN_BASE);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      const el = findScroll(e.target);
      if (!el) return;
      if (el.scrollTop > 0) return;
      scrollEl = el;
      startY   = e.touches[0].clientY;
      pulling  = false;
      pullY    = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!scrollEl || refreshing) return;
      const dy = e.touches[0].clientY - startY;
      // Cancel if the user starts scrolling up (negative pull) past zero
      if (dy <= 0) {
        if (pulling) reset(true);
        return;
      }
      // If the scroll moved away from the top, abandon (user is scrolling normally)
      if (scrollEl.scrollTop > 0) {
        if (pulling) reset(true);
        return;
      }
      // Begin/continue the pull
      pulling = true;
      pullY   = dy * DAMPING;
      if (e.cancelable) e.preventDefault();
      scrollEl.style.transition = '';
      scrollEl.style.transform  = `translateY(${pullY}px)`;
      // Boost grain proportionally to pull
      const t = Math.min(pullY / THRESHOLD_PX, 1);
      setGrain(GRAIN_BASE + (GRAIN_BOOST - GRAIN_BASE) * t);
      setState({ pullY, refreshing: false });
    };

    const onTouchEnd = async () => {
      if (!scrollEl || !pulling || refreshing) {
        scrollEl = null;
        return;
      }
      const fire = pullY >= THRESHOLD_PX;
      const el = scrollEl;
      if (fire) {
        // Hold at the spinner's natural rest height while refreshing
        const REST = 56;
        refreshing = true;
        el.style.transition = 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1)';
        el.style.transform  = `translateY(${REST}px)`;
        pullY = REST;
        setState({ pullY: REST, refreshing: true });
        setGrain(GRAIN_BOOST);
        const start = Date.now();
        try { await refreshRef.current(); } catch {}
        const elapsed = Date.now() - start;
        if (elapsed < MIN_REFRESH_MS) {
          await new Promise(r => setTimeout(r, MIN_REFRESH_MS - elapsed));
        }
        refreshing = false;
        // Snap back
        el.style.transition = 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1)';
        el.style.transform  = '';
        setState({ pullY: 0, refreshing: false });
        setGrain(GRAIN_BASE);
        window.setTimeout(() => { el.style.transition = ''; }, 240);
      } else {
        reset(true);
      }
      scrollEl = null;
      pulling  = false;
    };

    document.addEventListener('touchstart',  onTouchStart, { passive: true });
    document.addEventListener('touchmove',   onTouchMove,  { passive: false });
    document.addEventListener('touchend',    onTouchEnd,   { passive: true });
    document.addEventListener('touchcancel', onTouchEnd,   { passive: true });

    return () => {
      document.removeEventListener('touchstart',  onTouchStart);
      document.removeEventListener('touchmove',   onTouchMove);
      document.removeEventListener('touchend',    onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      setGrain(GRAIN_BASE);
    };
  }, []);

  return state;
}

export const PULL_THRESHOLD_PX = THRESHOLD_PX;
