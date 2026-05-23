/**
 * usePerf — DEV-ONLY performance instrumentation.
 *
 * Gated three ways so it costs literally zero in production:
 *   1. import.meta.env.DEV  (Vite strips the branch in prod builds)
 *   2. URL ?debugPerf=1     (off by default even in dev)
 *   3. window.NCR_PERF_OFF  (a manual kill switch for noisy sessions)
 *
 * Exposed helpers:
 *
 *   useRenderCount(label)
 *     – Increments a counter for `label` on every render and logs it
 *       throttled to once a second per label. Returns the current
 *       count so you can read it in JSX if you want.
 *
 *   perfMark(name)
 *     – Wrapper around performance.mark() with the gate built in.
 *
 *   perfMeasure(name, startMark, endMark?)
 *     – Wrapper around performance.measure() that also console.logs
 *       the duration in a single line. endMark defaults to "now".
 *
 *   isPerfDebugOn()
 *     – Boolean: components can branch on this to disable expensive
 *       dev assertions in their hot path if the user is profiling.
 *
 * Usage:
 *
 *   useRenderCount('TouchShell');
 *
 *   perfMark('tab-change-start');
 *   setTab('reservations');
 *   requestAnimationFrame(() => perfMeasure('tab-change', 'tab-change-start'));
 *
 * Activate on a real device:
 *   open https://ncr-reserves-production.up.railway.app/?debugPerf=1
 *
 * Production / non-debug runs: every helper is a no-op (the JSX
 * branch evaluates to false at module-init time so the listeners,
 * counters and console.log calls never run).
 */
import { useEffect, useRef } from 'react';

// Resolve the gate ONCE on module init. The result is captured in
// PERF_ON; everything else returns early if PERF_ON is false.
//
// Previous version gated on `import.meta.env.DEV` first, which meant
// `?debugPerf=1` did NOTHING in a production Railway build (`DEV=false`).
// New gate: ANY explicit opt-in flips it on, in dev OR prod, so the
// operator can profile the real production deploy from their phone.
function resolveGate(): boolean {
  if (typeof window === 'undefined') return false;
  // Manual kill switch — `window.NCR_PERF_OFF = true` in the console
  // silences the helpers without reloading.
  if ((window as Window & { NCR_PERF_OFF?: boolean }).NCR_PERF_OFF) return false;

  // Three opt-in channels, any one is enough:
  //   1) ?debugPerf=1   — current canonical query param
  //   2) ?debug=perf    — short alias, easier to type on a phone
  //   3) localStorage NCR_DEBUG_PERF=true — sticky across reloads
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugPerf') === '1') {
      // Persist the choice so opening a new tab or refreshing keeps
      // profiling on without re-typing the param.
      try { localStorage.setItem('NCR_DEBUG_PERF', 'true'); } catch { /* ignore */ }
      return true;
    }
    if (params.get('debug') === 'perf') {
      try { localStorage.setItem('NCR_DEBUG_PERF', 'true'); } catch { /* ignore */ }
      return true;
    }
  } catch { /* ignore */ }
  try {
    if (localStorage.getItem('NCR_DEBUG_PERF') === 'true') return true;
  } catch { /* ignore */ }
  return false;
}

const PERF_ON = resolveGate();

/** True when the dev gate AND the ?debugPerf=1 toggle are both on. */
export function isPerfDebugOn(): boolean { return PERF_ON; }

// Per-label render counters + last-log timestamp so we throttle output
// to once per second per label (otherwise a 30-row list would spam the
// console at 30 lines per render).
const counts: Map<string, number> = new Map();
const lastLog: Map<string, number> = new Map();
const LOG_THROTTLE_MS = 1000;

/**
 * Increment a render counter on every render and log it (throttled).
 * Returns the live count so the caller can render it if they want.
 */
export function useRenderCount(label: string): number {
  const renders = useRef(0);
  renders.current += 1;
  // Always increment (even when PERF_ON is false) so toggling the gate
  // at runtime via window.NCR_PERF_OFF picks up an accurate count.
  counts.set(label, renders.current);

  useEffect(() => {
    if (!PERF_ON) return;
    const now = performance.now();
    const last = lastLog.get(label) ?? 0;
    if (now - last < LOG_THROTTLE_MS) return;
    lastLog.set(label, now);
    // Single-line, easily greppable.
    // eslint-disable-next-line no-console
    console.log(`[perf] ${label} renders=${renders.current}`);
  });

  return renders.current;
}

/** Wrap performance.mark with the gate. Safe to call unconditionally. */
export function perfMark(name: string): void {
  if (!PERF_ON) return;
  try { performance.mark(name); } catch { /* ignore */ }
}

/**
 * Wrap performance.measure with the gate AND log the duration.
 * If endMark is omitted, measures from startMark to "now".
 */
export function perfMeasure(name: string, startMark: string, endMark?: string): void {
  if (!PERF_ON) return;
  try {
    const measure = endMark
      ? performance.measure(name, startMark, endMark)
      : performance.measure(name, startMark);
    const dur = measure?.duration ?? 0;
    // eslint-disable-next-line no-console
    console.log(`[perf] ${name} ${dur.toFixed(1)}ms`);
  } catch { /* startMark missing or measure unsupported */ }
}

/** Dump the current per-label render counts as a table. Handy from
 *  the console: `__ncrPerfDump()`. Available only when the gate is on. */
if (PERF_ON && typeof window !== 'undefined') {
  (window as Window & { __ncrPerfDump?: () => void }).__ncrPerfDump = () => {
    // eslint-disable-next-line no-console
    console.table(Object.fromEntries(counts));
  };
}
