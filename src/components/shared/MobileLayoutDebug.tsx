/**
 * MobileLayoutDebug — temporary instrumentation for the bottom-nav gap bug.
 *
 * Mounts only when the URL contains ?debug=1 (or localStorage has
 * ncr.debug=1). Does three things:
 *
 *   1. Outlines every key layout element with a distinct color so we
 *      can see at a glance which one ends where.
 *   2. Logs a `console.table` row per element with: tag, class, top,
 *      bottom, height, clientHeight, scrollHeight, position, overflow,
 *      paddingBottom, marginBottom. Re-runs the table 200 ms and 1 s
 *      after mount (catches late layout settle).
 *   3. Renders a fixed overlay at the bottom-right of the screen with
 *      live values for window.innerHeight, visualViewport.height,
 *      shell.bottom, nav.bottom and the delta between them — so we can
 *      read the gap WITHOUT opening dev tools.
 *
 * Activation:
 *   • Add ?debug=1 to the URL
 *   • or run `localStorage.setItem('ncr.debug', '1')` in the console
 *   • or remove `debug=1` from the URL to deactivate.
 *
 * Targets (any of these may be missing on certain screens — that's fine):
 *   [data-mobile-shell]      the TouchShell root flex column
 *   [data-mobile-main]       the <main> flex:1 area
 *   [data-mobile-scroll]     the scrollable canvas inside Reserves
 *   [data-bottom-nav]        the in-flow bottom nav
 *
 * Remove this component once the bug is fixed.
 */

import { useEffect, useState } from 'react';

function debugOn(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.search.includes('debug=1')) return true;
  try { return localStorage.getItem('ncr.debug') === '1'; } catch { return false; }
}

const TARGETS: Array<[string, string]> = [
  ['html',                  '#e02020'], // red
  ['body',                  '#1e6cf0'], // blue
  ['#root',                 '#22a722'], // green
  ['[data-mobile-shell]',   '#a020c0'], // purple
  ['[data-mobile-main]',    '#0bb6b6'], // teal
  ['[data-mobile-scroll]',  '#e57b00'], // orange
  ['[data-bottom-nav]',     '#ff1493'], // magenta
];

function snapshot() {
  // eslint-disable-next-line no-console
  console.group(`[ncr-debug] layout @ ${new Date().toLocaleTimeString()}`);
  const rows: Array<Record<string, unknown>> = [];
  for (const [sel, color] of TARGETS) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) { rows.push({ selector: sel, color, error: 'NOT FOUND' }); continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    rows.push({
      selector: sel,
      color,
      tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === 'string')
        ? el.className.slice(0, 40)
        : '',
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
      position: cs.position,
      overflow: cs.overflow,
      pb: cs.paddingBottom,
      mb: cs.marginBottom,
      transform: cs.transform === 'none' ? '' : cs.transform,
      filter:    cs.filter === 'none'    ? '' : cs.filter,
    });
  }
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log({
    'window.innerWidth':            window.innerWidth,
    'window.innerHeight':           window.innerHeight,
    'visualViewport.width':         window.visualViewport?.width  ?? null,
    'visualViewport.height':        window.visualViewport?.height ?? null,
    'visualViewport.offsetTop':     window.visualViewport?.offsetTop ?? null,
    'visualViewport.pageTop':       window.visualViewport?.pageTop ?? null,
    'document.documentElement.clientHeight': document.documentElement.clientHeight,
    'document.body.clientHeight':            document.body.clientHeight,
    'env(safe-area-inset-bottom)':  getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom'),
  });
  // eslint-disable-next-line no-console
  console.groupEnd();
}

export default function MobileLayoutDebug() {
  const [active, setActive] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!debugOn()) return;
    setActive(true);
    snapshot();
    const t1 = window.setTimeout(snapshot, 250);
    const t2 = window.setTimeout(snapshot, 1000);
    const t3 = window.setTimeout(snapshot, 3000);
    const onResize = () => snapshot();
    const onVV = () => snapshot();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onVV);
    window.visualViewport?.addEventListener('scroll', onVV);

    // Live overlay refresh
    const interval = window.setInterval(() => setPulse(p => p + 1), 500);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearInterval(interval);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onVV);
      window.visualViewport?.removeEventListener('scroll', onVV);
    };
  }, []);

  if (!active) return null;

  // Read current values for the overlay (deps on pulse so it re-renders).
  void pulse;
  const shell = document.querySelector('[data-mobile-shell]') as HTMLElement | null;
  const nav   = document.querySelector('[data-bottom-nav]')   as HTMLElement | null;
  const main  = document.querySelector('[data-mobile-main]')  as HTMLElement | null;
  const shellR = shell?.getBoundingClientRect();
  const navR   = nav?.getBoundingClientRect();
  const mainR  = main?.getBoundingClientRect();
  const innerH = window.innerHeight;
  const vvH    = window.visualViewport?.height ?? innerH;
  const navBottomGap = navR ? (vvH - navR.bottom) : 0;
  const shellBottomGap = shellR ? (vvH - shellR.bottom) : 0;

  return (
    <>
      <style>{`
        html { outline: 3px solid #e02020 !important; outline-offset: -3px; }
        body { outline: 3px solid #1e6cf0 !important; outline-offset: -6px; }
        #root { outline: 3px solid #22a722 !important; outline-offset: -9px; }
        [data-mobile-shell] { outline: 3px solid #a020c0 !important; outline-offset: -12px; }
        [data-mobile-main]  { outline: 3px solid #0bb6b6 !important; outline-offset: -15px; }
        [data-mobile-scroll]{ outline: 3px solid #e57b00 !important; outline-offset: -18px; }
        [data-bottom-nav]   { outline: 3px solid #ff1493 !important; outline-offset: -3px; }
      `}</style>
      <div style={{
        position: 'fixed',
        top: 4, left: 4,
        zIndex: 999999,
        background: 'rgba(0,0,0,.85)',
        color: '#fff',
        font: '10px/1.35 Menlo, monospace',
        padding: '6px 8px',
        borderRadius: 6,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}>
{`innerH:   ${innerH}
vv.h:     ${Math.round(vvH)}
shell.b:  ${shellR ? Math.round(shellR.bottom) : '?'}
main.b:   ${mainR  ? Math.round(mainR.bottom)  : '?'}
nav.t:    ${navR   ? Math.round(navR.top)      : '?'}
nav.b:    ${navR   ? Math.round(navR.bottom)   : '?'}
nav.h:    ${navR   ? Math.round(navR.height)   : '?'}
gap-shell:${Math.round(shellBottomGap)}
gap-nav:  ${Math.round(navBottomGap)}`}
      </div>
      {/* Legend */}
      <div style={{
        position: 'fixed',
        top: 4, right: 4,
        zIndex: 999999,
        background: 'rgba(0,0,0,.85)',
        color: '#fff',
        font: '10px/1.45 Menlo, monospace',
        padding: '6px 8px',
        borderRadius: 6,
        pointerEvents: 'none',
      }}>
        <div><span style={{ color: '#e02020' }}>━━</span> html</div>
        <div><span style={{ color: '#1e6cf0' }}>━━</span> body</div>
        <div><span style={{ color: '#22a722' }}>━━</span> #root</div>
        <div><span style={{ color: '#a020c0' }}>━━</span> shell</div>
        <div><span style={{ color: '#0bb6b6' }}>━━</span> main</div>
        <div><span style={{ color: '#e57b00' }}>━━</span> scroll</div>
        <div><span style={{ color: '#ff1493' }}>━━</span> nav</div>
      </div>
    </>
  );
}
