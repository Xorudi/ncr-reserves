/**
 * uiMode — operative fast-UI gate.
 *
 * The restaurant counter PC and tablets are graphics-modest by laptop
 * standards: a single GPU pipeline trying to composite live `backdrop-filter`
 * over an ambient gradient + sheet panel is the slowest path on every
 * frame an overlay is open. Operationally, blur is luxury — speed is the
 * job.
 *
 * We resolve ONCE at module init:
 *
 *   FAST_UI = true when ANY of:
 *     • coarse pointer (touchscreen / tablet)
 *     • viewport < 1280 px
 *     • prefers-reduced-motion: reduce
 *     • navigator.hardwareConcurrency <= 4 (low-core CPU)
 *     • localStorage NCR_FAST_UI === 'true'  (manual force-on)
 *
 *   FAST_UI = false  → desktop with a real pointer, ≥1280 px, ≥5 cores,
 *                      no reduced motion. Premium glass stays.
 *
 * We mirror the flag onto `document.body.dataset.fastUi = '1'` so CSS can
 * gate expensive declarations without JS-per-component checks. Components
 * that set `backdrop-filter` inline should read the flag once and skip it.
 *
 * MANUAL OVERRIDE:
 *   `localStorage.NCR_FAST_UI = 'false'`  → force premium glass back on
 *   `localStorage.NCR_FAST_UI = 'true'`   → force fast UI on
 */

function resolve(): boolean {
  if (typeof window === 'undefined') return true; // SSR: assume fast.

  // Manual override always wins.
  try {
    const forced = localStorage.getItem('NCR_FAST_UI');
    if (forced === 'true')  return true;
    if (forced === 'false') return false;
  } catch { /* ignore */ }

  // Coarse pointer = touchscreen or tablet.
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  } catch { /* ignore */ }

  // Reduced motion = user explicitly opted out of fanciness.
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  } catch { /* ignore */ }

  // Hybrid touchscreen PCs report mouse as primary pointer but expose
  // maxTouchPoints. Treat any touch capability as a vote for fast-UI.
  try {
    if ((navigator.maxTouchPoints ?? 0) > 0) return true;
  } catch { /* ignore */ }

  // Modest CPU.
  try {
    const cores = navigator.hardwareConcurrency ?? 8;
    if (cores <= 4) return true;
  } catch { /* ignore */ }

  // Small viewport.
  if (window.innerWidth < 1280) return true;

  return false;
}

export const IS_FAST_UI: boolean = resolve();

// Mirror onto <body> so CSS rules can switch without a JS bridge.
// Wait one tick if body isn't ready yet (very early imports during SSR-ish
// hydration on slow phones).
if (typeof document !== 'undefined') {
  const apply = () => {
    if (!document.body) return;
    document.body.dataset.fastUi = IS_FAST_UI ? '1' : '0';
  };
  if (document.body) apply();
  else document.addEventListener('DOMContentLoaded', apply, { once: true });
}
