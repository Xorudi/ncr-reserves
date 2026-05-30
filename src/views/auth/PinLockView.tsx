/**
 * PIN lock screen v2 — three lit windows + book-opening sequence.
 *
 * Layout:
 *   • Lock card on the left (compact), three informational business
 *     doors on the right at desktop ≥ 1000 px. Single-column stack
 *     on tablet / phone.
 *   • Each door is read-only: monogram in the local's own style,
 *     name, kind, and live "cobertes avui · capacity" KPI from the
 *     store. Cards never act as buttons — the PIN is what chooses.
 *
 * Visual identity per business:
 *   • El Ganxo  — carbó-coure (night-life). Serif italic.
 *   • La Pista  — verd bosc (sports terrace). Sans condensat UPPERCASE.
 *   • L'Esquitx — blau piscina (summer poolside). Sans clean.
 *
 * Book-opening sequence (when PIN matches):
 *   t=0     PIN verified; openingBiz state set.
 *   0-180   Chosen card lifts its "cover" (rotateX -9°).
 *   180-900 Card migrates to viewport center + scales up.
 *           Surrounding UI dims with blur(8px) + opacity 0.
 *   400-1100 Card content (state, sub, KPI) fades; mono and name remain.
 *   400-1200 Atmosphere flood fades in (biz-colored radial backdrop).
 *   1100-1500 Card itself fades out; bookplate (centered mono + name)
 *             fades in.
 *   1500    `unlock()` is called → app mounts behind the bookplate,
 *           PinLockView unmounts cleanly.
 *
 * The animation only runs when match found. Wrong PIN keeps the
 * existing shake + retry behaviour — no animation, no penalty.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { verifyPin, loadPinConfig } from '@/lib/pinAuth';
import { usePinScope } from '@/store/usePinScope';
import { getSession, extractBizIds } from '@/lib/auth';
import { SUPABASE_AUTH_ENABLED } from '@/lib/featureFlags';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES } from '@/data/mockData';
import PremiumRestaurantAmbient from '@/components/shared/PremiumRestaurantAmbient';
import type { BusinessId } from '@/types';

/* ── Helpers ───────────────────────────────────────────────────────── */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 7)  return 'Bona nit';
  if (h < 13) return 'Bon dia';
  if (h < 20) return 'Bona tarda';
  return 'Bona nit';
}

function dayLabel(): string {
  const days   = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
  const months = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
                  'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'];
  const d = new Date();
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** Per-business visual identity. Distinct worlds for the three locals. */
const BIZ_THEME: Record<BusinessId, {
  bg: string;
  accent: string;
  accent2: string;
  fg: string;
  fgDim: string;
  monoStyle: 'serif-italic' | 'sans-bold' | 'sans-clean';
  nameStyle: 'serif-italic' | 'sans-upper' | 'sans-clean';
  sub: string;
  state: string;
  stateClosed?: boolean;
}> = {
  ganxo: {
    bg:         'linear-gradient(180deg, #1a110a 0%, #0e0a08 100%)',
    accent:     '#d4843d',
    accent2:    '#f3c581',
    fg:         '#f5ede0',
    fgDim:      'rgba(245,237,224,.55)',
    monoStyle:  'serif-italic',
    nameStyle:  'serif-italic',
    sub:        'Pub musical · nit',
    state:      'obre 22:00',
    stateClosed: true,
  },
  pista: {
    bg:         'linear-gradient(180deg, #2a4d38 0%, #1f3a2a 100%)',
    accent:     '#79b46a',
    accent2:    '#c8a04a',
    fg:         '#f7f4ea',
    fgDim:      'rgba(247,244,234,.55)',
    monoStyle:  'sans-bold',
    nameStyle:  'sans-upper',
    sub:        'Restaurant · pavelló hoquei',
    state:      'obert',
  },
  esquitx: {
    bg:         'linear-gradient(180deg, #3a7282 0%, #2d5e6b 100%)',
    accent:     '#6ec3d4',
    accent2:    '#e8b54a',
    fg:         '#f7f4ea',
    fgDim:      'rgba(247,244,234,.55)',
    monoStyle:  'sans-clean',
    nameStyle:  'sans-clean',
    sub:        'Restaurant · piscines i camp de futbol',
    state:      'obert',
  },
};

/** Card atmosphere — radial glows + base gradient per biz. */
function doorBackground(b: BusinessId): string {
  if (b === 'ganxo') return `
    radial-gradient(ellipse 90% 60% at 100% 0%, rgba(212,132,61,.35), transparent 60%),
    radial-gradient(ellipse 60% 50% at 0% 100%, rgba(212,132,61,.10), transparent 60%),
    ${BIZ_THEME.ganxo.bg}`;
  if (b === 'pista') return `
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(121,180,106,.30), transparent 60%),
    radial-gradient(ellipse 60% 50% at 100% 100%, rgba(200,160,74,.12), transparent 60%),
    ${BIZ_THEME.pista.bg}`;
  return `
    radial-gradient(ellipse 80% 70% at 50% 0%, rgba(110,195,212,.28), transparent 65%),
    radial-gradient(ellipse 50% 50% at 90% 100%, rgba(232,181,74,.18), transparent 60%),
    ${BIZ_THEME.esquitx.bg}`;
}

/** Single name (UPPERCASE for Pista). */
function displayName(b: BusinessId): string {
  const biz = BUSINESSES.find(x => x.id === b);
  return biz?.name ?? b;
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function PinLockView() {
  const [pin,           setPin]           = useState('');
  const [error,         setError]         = useState<string | null>(null);
  const [shake,         setShake]         = useState(false);
  const [errorPulse,    setErrorPulse]    = useState(false);
  const [busy,          setBusy]          = useState(false);
  const [mounted,       setMounted]       = useState(false);
  const [sessionBizIds, setSessionBizIds] = useState<readonly BusinessId[] | null>(null);

  /** When set, the book-opening sequence plays for this biz. */
  const [openingBiz, setOpeningBiz] = useState<BusinessId | null>(null);
  /** Coordinates (in viewport space) of the chosen door for the FLIP. */
  const [flip, setFlip] = useState<{ dx: number; dy: number; scale: number } | null>(null);

  /** State machine for the mobile keypad:
   *    closed  → only brand + dots + 'Toca per teclejar ↑' visible.
   *               Lets the BUSINESS CARDS lead the screen.
   *    open    → keypad slides up from below, reassurance fades in,
   *               cards dim/blur subtly so the focus shifts.
   *  Desktop and tablet ≥ 720 px default to OPEN — no collapse.
   *  Hardware keyboard auto-opens the keypad on the first digit. */
  const [keypadOpen, setKeypadOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 720px)').matches;
  });
  // Switch to open when the viewport leaves mobile (orientation change, etc.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 720px)');
    function onChange() { if (!mq.matches) setKeypadOpen(true); }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const verifying    = useRef(false);
  const doorRefs     = useRef<Record<BusinessId, HTMLDivElement | null>>({
    ganxo: null, pista: null, esquitx: null,
  });

  const unlock       = usePinScope(s => s.unlock);
  const reservations = useAppStore(s => s.reservations);

  const pinConfig    = loadPinConfig();
  const allLabels    = (pinConfig?.pins ?? []).map(p => p.label);
  const hello        = useMemo(greeting, []);
  const eyebrow      = useMemo(dayLabel, []);

  /** Compute "covers today" KPI per biz from the live reservations array. */
  const coversToday = useMemo<Record<BusinessId, number>>(() => {
    const iso = todayIso();
    const acc: Record<BusinessId, number> = { ganxo: 0, pista: 0, esquitx: 0 };
    for (const r of reservations) {
      if (r.date !== iso) continue;
      if (r.status === 'cancelled' || r.status === 'noshow') continue;
      acc[r.bizId] = (acc[r.bizId] ?? 0) + r.pax;
    }
    return acc;
  }, [reservations]);

  /** System-level snapshot for the editorial top strip. */
  const systemSnapshot = useMemo(() => {
    const covers = coversToday.ganxo + coversToday.pista + coversToday.esquitx;
    return { covers };
  }, [coversToday]);

  // Entrance: fade + lift + blur clear after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Read the Supabase session once to know which biz_ids this device can see.
  useEffect(() => {
    if (!SUPABASE_AUTH_ENABLED) return;
    getSession().then(s => {
      if (!s) return;
      setSessionBizIds(extractBizIds(s) as readonly BusinessId[]);
    });
  }, []);

  // ── Keypad input ───────────────────────────────────────────────────
  function press(d: string) {
    if (busy || errorPulse || openingBiz) return;
    setError(null);
    setPin(p => (p + d).slice(0, 4));
    // Warm the room — ambient catches the tap.
    try { window.dispatchEvent(new Event('ncr:ambient-pulse')); } catch {}
  }
  function backspace() {
    if (busy || errorPulse || openingBiz) return;
    setError(null);
    setPin(p => p.slice(0, -1));
    try { window.dispatchEvent(new Event('ncr:ambient-pulse')); } catch {}
  }

  // Hardware keyboard support. Also auto-opens the collapsed keypad on
  // the first digit so PC/Bluetooth-keyboard users never see the
  // mobile-collapsed state.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (busy || openingBiz) return;
      if (e.key >= '0' && e.key <= '9') {
        if (!keypadOpen) setKeypadOpen(true);
        press(e.key); return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') { backspace(); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, errorPulse, openingBiz, keypadOpen]);

  function flashErrorAndClear(message: string) {
    setShake(true);
    setErrorPulse(true);
    window.setTimeout(() => {
      setPin('');
      setErrorPulse(false);
    }, 180);
    window.setTimeout(() => setShake(false), 420);
    setError(message);
  }

  /** Compute FLIP geometry from the chosen door to the viewport center. */
  function computeFlip(biz: BusinessId): { dx: number; dy: number; scale: number } {
    const el = doorRefs.current[biz];
    if (!el) return { dx: 0, dy: 0, scale: 1.8 };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    const dx = (window.innerWidth  / 2) - cx;
    const dy = (window.innerHeight / 2) - cy;
    const scale = Math.min(
      (window.innerHeight * 0.50) / r.height,
      (window.innerWidth  * 0.42) / r.width,
      2.6,
    );
    return { dx, dy, scale };
  }

  /** Pick which biz to animate. Single-scope PIN → that one. Admin /
   *  multi-scope → fall back to the first available (Ganxo by default
   *  if it's in scope, else first). */
  function pickAnimBiz(scope: readonly BusinessId[]): BusinessId | null {
    if (scope.length === 0) return null;
    if (scope.length === 1) return scope[0];
    // Multi-biz: prefer the one whose door is visible (ganxo first).
    const order: BusinessId[] = ['ganxo', 'pista', 'esquitx'];
    return order.find(id => scope.includes(id)) ?? scope[0];
  }

  // Auto-verify when 4 digits typed
  useEffect(() => {
    if (pin.length !== 4 || verifying.current) return;
    verifying.current = true;
    setBusy(true);

    verifyPin(pin).then(match => {
      verifying.current = false;
      setBusy(false);
      if (!match) {
        flashErrorAndClear('Aquest PIN no coincideix. Torna-ho a provar.');
        return;
      }
      const effective = sessionBizIds
        ? match.scope.filter(id => sessionBizIds.includes(id))
        : match.scope;

      if (effective.length === 0) {
        flashErrorAndClear('Aquest dispositiu no té accés a aquest llibre.');
        return;
      }

      // Trigger the book-opening sequence.
      const animBiz = pickAnimBiz(effective);
      if (animBiz) {
        setFlip(computeFlip(animBiz));
        setOpeningBiz(animBiz);
        // After the cinematic finishes, actually unlock — which unmounts us.
        window.setTimeout(() => {
          unlock(match.label, effective);
        }, 1500);
      } else {
        unlock(match.label, effective);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  /* ── Render ──────────────────────────────────────────────────────── */

  const bookOpening = openingBiz !== null;
  const flipVars: React.CSSProperties = flip
    ? ({
        '--flip-dx':    `${flip.dx}px`,
        '--flip-dy':    `${flip.dy}px`,
        '--flip-scale': flip.scale.toFixed(3),
      } as unknown as React.CSSProperties)
    : {};

  // Show only businesses that have a configured PIN scope. If pinConfig
  // is missing (shouldn't happen at this stage), fall back to all three.
  const visibleBizs: BusinessId[] = useMemo(() => {
    if (!pinConfig) return ['ganxo', 'pista', 'esquitx'];
    const set = new Set<BusinessId>();
    for (const p of pinConfig.pins) for (const id of p.scope) set.add(id);
    const ordered: BusinessId[] = ['ganxo', 'pista', 'esquitx'];
    return ordered.filter(id => set.has(id));
  }, [pinConfig]);

  return (
    <div
      className={`pin-lock-wrap ${bookOpening ? 'pin-lock-wrap--opening' : ''}`}
      data-open-biz={openingBiz ?? ''}
      data-keypad={keypadOpen ? 'open' : 'closed'}
    >
      {/* Interactive ambient warmth — sits between the wrap's static gradient
          and the card. Pointer-events: none so PIN input is never blocked. */}
      <PremiumRestaurantAmbient zIndex={0} />

      {/* Atmosphere flood — colored backdrop that fades in during book-opening. */}
      <div className="pin-atmosphere" data-biz={openingBiz ?? ''} aria-hidden="true" />

      <div className="pin-stage">
        {/* ── TOP STRIP — mobile-only editorial greeting + date.
              On desktop the lock card's espresso header carries this
              content; on phones the strip lives outside the panel so
              the PIN can be a true floating element of secondary
              visual weight. Reordered via CSS `order: -2`. */}
        <div className="pin-top-strip" aria-hidden="true">
          <div className="pin-top-strip__greeting">{hello}</div>
          <div className="pin-top-strip__meta">
            <span className="pin-top-strip__date">{eyebrow}</span>
            {visibleBizs.length > 0 && (
              <>
                <span className="pin-top-strip__sep" />
                <span className="pin-top-strip__stat">
                  {visibleBizs.length} locals
                </span>
                {systemSnapshot.covers > 0 && (
                  <>
                    <span className="pin-top-strip__sep" />
                    <span className="pin-top-strip__stat">
                      {systemSnapshot.covers} coberts
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── LOCK CARD (left on desktop, bottom on mobile) ─────── */}
        <div
          className={`pin-lock ${mounted ? 'pin-lock--in' : ''} ${shake ? 'pin-lock--shake' : ''}`}
          role="dialog"
          aria-label="Introdueix el PIN"
        >
          <div className="pin-lock__inner">

            <header className="pin-lock__header">
              <span className="pin-lock__eyebrow">{eyebrow}</span>
              <div className="pin-lock__brand">
                <span className="pin-lock__monogram" aria-hidden="true">N</span>
                <span className="pin-lock__wordmark">NCR Reserves</span>
              </div>
              <h1 className="pin-lock__title">{hello}</h1>
              <p className="pin-lock__subtitle">Introdueix el PIN per continuar</p>
            </header>

            {/* Dots are tap-to-open on mobile when keypad is collapsed.
                On desktop / when already open they're not interactive. */}
            <div
              className="pin-lock__dots"
              aria-live="polite"
              role={!keypadOpen ? 'button' : undefined}
              tabIndex={!keypadOpen ? 0 : undefined}
              onClick={!keypadOpen ? () => setKeypadOpen(true) : undefined}
            >
              {[0, 1, 2, 3].map(i => (
                <span
                  key={i}
                  className="pin-lock__dot"
                  data-active={pin.length === i}
                  data-filled={i < pin.length}
                  data-error={errorPulse}
                >
                  <span className="pin-lock__dot-fill" aria-hidden="true">●</span>
                </span>
              ))}
            </div>

            {/* CTA — only visible when the keypad is collapsed on mobile.
                Tapping expands the keypad with a buttery cinema curve. */}
            <button
              type="button"
              className="pin-lock__cta"
              onClick={() => setKeypadOpen(true)}
              aria-label="Obrir el teclat"
            >
              <span className="pin-lock__cta-label">Toca per teclejar el PIN</span>
              <span className="pin-lock__cta-arrow" aria-hidden="true">▲</span>
            </button>

            <div className="pin-lock__status" aria-live="polite" data-error={!!error}>
              {error || (busy ? 'Verificant…' : ' ')}
            </div>

            <div className="pin-lock__keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((n, i) => {
                if (n === null) return <span key={i} aria-hidden="true" />;
                const isDel = n === 'del';
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={busy || bookOpening}
                    className={`pin-lock__key ${isDel ? 'pin-lock__key--del' : ''}`}
                    // Use onPointerDown for touch/pen so the digit registers
                    // at finger contact instead of waiting for the full
                    // tap-release click event. On mouse we still fall through
                    // to onClick (mousedown->click is ~instant). preventDefault
                    // on pointerdown stops the synthesized click from firing
                    // a second press a few ms later.
                    onPointerDown={(e) => {
                      if (e.pointerType === 'mouse') return;
                      // Touch / pen: instant press + suppress the click echo.
                      e.preventDefault();
                      if (isDel) backspace(); else press(String(n));
                    }}
                    onClick={(e) => {
                      // Mouse path only. If a touch already handled it,
                      // preventDefault on pointerdown suppressed this click.
                      if (e.detail === 0) {
                        // Activated by keyboard (Enter/Space). The global
                        // keydown handler already routes 0-9; just no-op here
                        // for digit keys, but still allow ⌫ via keyboard.
                        if (isDel) backspace();
                        return;
                      }
                      if (isDel) backspace(); else press(String(n));
                    }}
                    aria-label={isDel ? 'Esborrar' : `Tecla ${n}`}
                    style={{ animationDelay: `${i * 28}ms` }}
                  >
                    {isDel ? '⌫' : n}
                  </button>
                );
              })}
            </div>

            <p className="pin-lock__reassurance">
              Si t'equivoques no passa res — torna a teclejar.
            </p>

          </div>
        </div>

        {/* ── BUSINESS DOORS (right on desktop, below on mobile) ── */}
        <div className="pin-doors-wrap">
          <div className="pin-doors-eyebrow">— Estat dels locals avui —</div>
          <div className="pin-doors">
            {visibleBizs.map(id => {
              const theme = BIZ_THEME[id];
              const biz   = BUSINESSES.find(b => b.id === id);
              const covers   = coversToday[id] ?? 0;
              const capacity = biz?.capacity ?? 0;
              const isOpening = openingBiz === id;
              return (
                <div
                  key={id}
                  ref={el => { doorRefs.current[id] = el; }}
                  className={`pin-door pin-door--${id} ${isOpening ? 'pin-door--opening' : ''}`}
                  style={isOpening ? flipVars : undefined}
                  aria-label={biz?.name ?? id}
                >
                  <div className="pin-door__inner" style={{ background: doorBackground(id), color: theme.fg }}>
                    <div className={`pin-door__mono pin-door__mono--${theme.monoStyle}`}>
                      {biz?.monogram?.[0] ?? id[0].toUpperCase()}
                    </div>
                    <div className="pin-door__heading">
                      <h3 className={`pin-door__name pin-door__name--${theme.nameStyle}`}>{biz?.name ?? id}</h3>
                      <div className="pin-door__sub" style={{ color: theme.fgDim }}>{theme.sub}</div>
                    </div>
                    <span
                      className="pin-door__state"
                      data-closed={theme.stateClosed ? 'true' : 'false'}
                      style={{ color: theme.accent2 }}
                    >
                      <span className="pin-door__pulse" /> {theme.state}
                    </span>
                    <div className="pin-door__kpi" style={{ color: theme.accent }}>
                      <span className="pin-door__kpi-big">{covers}<span className="pin-door__kpi-frac">/{capacity}</span></span>
                      <span className="pin-door__kpi-label" style={{ color: theme.fgDim }}>cobertes avui</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {allLabels.length > 0 && (
            <p className="pin-doors-foot">
              PINs disponibles · {allLabels.join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* ── BOOKPLATE (centered mono + name during book-opening) ─── */}
      {bookOpening && (
        <div className="pin-bookplate" data-biz={openingBiz} aria-hidden="true">
          <div>
            <div className={`pin-bookplate__mono pin-bookplate__mono--${BIZ_THEME[openingBiz!].monoStyle}`}>
              {BUSINESSES.find(b => b.id === openingBiz)?.monogram?.[0] ?? openingBiz![0].toUpperCase()}
            </div>
            <h2 className={`pin-bookplate__title pin-bookplate__title--${BIZ_THEME[openingBiz!].nameStyle}`}>
              {displayName(openingBiz!)}
            </h2>
            <p className="pin-bookplate__sub">
              Obrint el llibre · {displayName(openingBiz!)}
            </p>
          </div>
        </div>
      )}

      <style>{`
        :where(.pin-lock-wrap) {
          --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
          --ease-cinema: cubic-bezier(0.32, 0.72, 0, 1);
          --ease-spring: cubic-bezier(0.34, 1.52, 0.64, 1);

          --paper:      var(--paper,           #fbf7ee);
          --paper-warm: #f7eedb;
          --cream:      var(--cream,           #fdf9f2);
          --espresso:   #1a120d;
          --ink-900:    var(--ink-900,         #1d1612);
          --ink-700:    var(--ink-700,         #3a2a1f);
          --ink-600:    var(--ink-600,         #5a4a3a);
          --ink-500:    var(--ink-500,         #7a6a5a);
          --ink-400:    var(--ink-400,         #9a8a7a);
          --terra-50:   var(--terracotta-50,   #fbeadf);
          --terra-500:  var(--terracotta-500,  #c8613a);
          --terra-600:  var(--terracotta-600,  #a8502f);
          --terra-700:  var(--terracotta-700,  #923c1f);
        }

        /* ── Atmosphere ──────────────────────────────────────────────────── */
        .pin-lock-wrap {
          position: fixed; inset: 0;
          display: grid; place-items: center;
          padding:
            max(16px, env(safe-area-inset-top))
            16px
            max(16px, env(safe-area-inset-bottom));
          overflow: auto;
          background:
            radial-gradient(ellipse 70% 55% at 78% 6%, rgba(200, 97, 58, .16) 0%, transparent 62%),
            radial-gradient(ellipse 55% 45% at 18% 96%, rgba(54, 32, 18, .14) 0%, transparent 65%),
            radial-gradient(ellipse 120% 100% at 50% 50%, #f6ecd9 0%, #ece2c8 55%, #d6cbb1 100%);
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
          isolation: isolate;
        }

        /* Fine paper grain */
        .pin-lock-wrap::before {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          opacity: .045;
          mix-blend-mode: multiply;
          pointer-events: none;
          z-index: 0;
        }

        /* Atmosphere flood — backdrop inside the wrap. */
        .pin-atmosphere {
          position: absolute; inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 700ms var(--ease-cinema) 380ms;
        }
        .pin-atmosphere[data-biz="ganxo"] {
          background:
            radial-gradient(ellipse 90% 65% at 50% 42%, rgba(212,132,61,.38), rgba(14,10,8,0) 60%),
            linear-gradient(180deg, #1a110a 0%, #0e0a08 100%);
        }
        .pin-atmosphere[data-biz="pista"] {
          background:
            radial-gradient(ellipse 90% 65% at 50% 42%, rgba(121,180,106,.32), rgba(31,58,42,0) 60%),
            linear-gradient(180deg, #2a4d38 0%, #1f3a2a 100%);
        }
        .pin-atmosphere[data-biz="esquitx"] {
          background:
            radial-gradient(ellipse 90% 65% at 50% 42%, rgba(110,195,212,.30), rgba(45,94,107,0) 60%),
            linear-gradient(180deg, #3a7282 0%, #2d5e6b 100%);
        }
        .pin-lock-wrap--opening .pin-atmosphere { opacity: 1; }

        /* ── Stage (responsive: column → 2-col) ──────────────────── */
        .pin-stage {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr;
          align-items: center;
          justify-items: center;
          gap: 22px;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 8px 0 4px;
        }
        @media (max-width: 720px) {
          .pin-stage { gap: 14px; padding: 4px 0 2px; }
        }
        @media (min-width: 1000px) {
          .pin-stage {
            grid-template-columns: minmax(380px, 440px) minmax(380px, 520px);
            justify-items: stretch;
            gap: 36px;
            padding: 0;
          }
        }

        /* Dim everything during book-opening except the chosen door.
           Specificity is intentionally bumped via the chained-class
           selector (pin-lock-wrap + pin-lock-wrap--opening on the same
           element) so this rule beats the mobile [data-keypad=open]
           pin-door opacity:.55 override later in the stylesheet —
           without the bump, the two non-opening business cards stay
           visible at half opacity during the entire book-opening
           animation on phones. */
        .pin-lock-wrap.pin-lock-wrap--opening .pin-lock,
        .pin-lock-wrap.pin-lock-wrap--opening .pin-doors-eyebrow,
        .pin-lock-wrap.pin-lock-wrap--opening .pin-doors-foot,
        .pin-lock-wrap.pin-lock-wrap--opening .pin-door:not(.pin-door--opening) {
          opacity: 0;
          filter: blur(8px);
          transform: scale(0.96);
          pointer-events: none;
          transition:
            opacity   420ms var(--ease-cinema),
            filter    420ms var(--ease-cinema),
            transform 420ms var(--ease-cinema);
        }

        /* ── Lock card — Double-Bezel ─────────────────────────────── */
        .pin-lock {
          position: relative;
          width: 100%;
          max-width: 420px;
          padding: 6px;
          border-radius: 30px;
          background: linear-gradient(180deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.32) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.7),
            0 0 0 1px rgba(60,40,20,.05),
            0 38px 80px -22px rgba(60,40,20,.32),
            0 14px 32px -12px rgba(60,40,20,.16);
          opacity: 0;
          transform: translateY(14px) scale(0.985);
          filter: blur(8px);
          transition:
            opacity   560ms var(--ease-cinema),
            transform 560ms var(--ease-cinema),
            filter    560ms var(--ease-cinema);
        }
        .pin-lock--in {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }
        .pin-lock--shake { animation: pin-shake 460ms; }

        .pin-lock__inner {
          position: relative;
          background: linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%);
          border-radius: 24px;
          overflow: hidden;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.55),
            inset 0 -1px 0 rgba(60,40,20,.05);
        }

        /* Header — espresso plate, vertical flex stack */
        .pin-lock__header {
          position: relative;
          padding: 26px 26px 22px;
          background:
            radial-gradient(ellipse 110% 90% at 100% 0%, rgba(200,97,58,.22) 0%, transparent 60%),
            linear-gradient(180deg, #2a2018 0%, #1a120d 100%);
          color: var(--cream);
          overflow: hidden;
          /* Vertical stack — each child sits on its own row, centered. */
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .pin-lock__header::after {
          content: '';
          position: absolute; top: 0; left: 12%; right: 12%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.20), transparent);
        }
        .pin-lock__eyebrow {
          padding: 4px 12px 5px;
          border-radius: 999px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.08);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: rgba(251,247,238,.62);
        }

        /* Brand: monogram centered, wordmark below as a small caps line. */
        .pin-lock__brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .pin-lock__monogram {
          width: 44px; height: 44px;
          border-radius: 13px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.20) 0%, rgba(255,255,255,0) 55%),
            linear-gradient(180deg, #d5703f 0%, var(--terra-500) 100%);
          color: #fff;
          display: grid; place-items: center;
          font-family: var(--font-serif);
          font-weight: 500;
          font-size: 22px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.4),
            inset 0 -1px 0 rgba(0,0,0,.15),
            0 6px 14px -3px rgba(146,60,31,.55),
            0 0 0 1px rgba(146,60,31,.5);
        }
        .pin-lock__wordmark {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .32em;
          text-transform: uppercase;
          color: rgba(251,247,238,.45);
        }

        /* Title block: tight stack with a hairline divider above. */
        .pin-lock__title {
          margin: 6px 0 0;
          font-family: var(--font-serif);
          font-weight: 400;
          font-size: clamp(26px, 5.6vw, 30px);
          line-height: 1.02;
          letter-spacing: -.018em;
          text-align: center;
          position: relative;
        }
        .pin-lock__title::before {
          content: '';
          position: absolute;
          left: 50%; top: -10px;
          width: 22px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          transform: translateX(-50%);
        }
        .pin-lock__subtitle {
          margin: 6px 0 0;
          font-size: clamp(11px, 2.2vw, 12px);
          color: rgba(251,247,238,.56);
          line-height: 1.45;
          text-align: center;
        }

        /* PIN dots */
        .pin-lock__dots {
          position: relative;
          padding: 20px 16px 6px;
          display: flex;
          justify-content: center;
          gap: 11px;
        }
        .pin-lock__dots::after {
          content: '';
          position: absolute;
          bottom: 0; left: 50%;
          width: 28px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(200,97,58,.55), transparent);
          transform: translateX(-50%) scaleX(0);
          transition: transform 320ms var(--ease-out);
        }
        .pin-lock__dots:has(.pin-lock__dot[data-filled="true"])::after {
          transform: translateX(-50%) scaleX(1);
        }

        .pin-lock__dot {
          position: relative;
          width: clamp(40px, 10vw, 46px);
          aspect-ratio: 1 / 1.2;
          border-radius: 13px;
          background: linear-gradient(180deg, var(--cream), #f7ecd6);
          border: 1px solid rgba(60,40,20,.10);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.7),
            inset 0 -1px 0 rgba(60,40,20,.05),
            0 1px 2px rgba(60,40,20,.05);
          display: grid; place-items: center;
          transition:
            border-color  220ms var(--ease-out),
            box-shadow    220ms var(--ease-out),
            background    220ms var(--ease-out);
        }
        .pin-lock__dot[data-active="true"] {
          border-color: var(--terra-500);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.7),
            inset 0 -1px 0 rgba(60,40,20,.05),
            0 0 0 4px rgba(200, 97, 58, .12),
            0 0 28px -4px rgba(200, 97, 58, .42);
        }
        .pin-lock__dot[data-error="true"] {
          border-color: var(--terra-500);
          background: linear-gradient(180deg, var(--terra-50), #f4d3bf);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.45),
            0 0 0 4px rgba(200, 97, 58, .18);
        }
        .pin-lock__dot-fill {
          font-family: var(--font-serif);
          font-size: clamp(22px, 6vw, 26px);
          font-weight: 600;
          color: var(--ink-900);
          text-shadow: 0 1px 0 rgba(255,255,255,.4);
          opacity: 0;
          transform: scale(0.35);
          transition:
            opacity   220ms var(--ease-out),
            transform 320ms var(--ease-spring),
            color     220ms var(--ease-out);
        }
        .pin-lock__dot[data-filled="true"] .pin-lock__dot-fill {
          opacity: 1;
          transform: scale(1);
        }
        .pin-lock__dot[data-error="true"] .pin-lock__dot-fill {
          color: var(--terra-700);
        }

        .pin-lock__status {
          min-height: 22px;
          padding: 6px 24px 0;
          text-align: center;
          font-size: clamp(10.5px, 2.4vw, 11.5px);
          color: var(--ink-500);
          transition: color 200ms var(--ease-out);
        }
        .pin-lock__status[data-error="true"] {
          color: var(--terra-700);
          font-weight: 500;
        }

        .pin-lock__keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          padding: 8px 22px 16px;
        }
        .pin-lock__key {
          padding: clamp(11px, 2.4vw, 13px) 0;
          background: linear-gradient(180deg, var(--cream), #f4e9d2);
          border: 1px solid rgba(60,40,20,.08);
          border-radius: 13px;
          font-family: var(--font-serif);
          font-size: clamp(20px, 4.6vw, 22px);
          font-variant-numeric: tabular-nums;
          color: var(--ink-900);
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.7),
            inset 0 -1px 0 rgba(60,40,20,.05),
            0 1px 2px rgba(60,40,20,.04);
          transition:
            transform   180ms var(--ease-out),
            background  220ms var(--ease-out),
            box-shadow  220ms var(--ease-out);
          opacity: 0;
          transform: translateY(6px);
          animation: pin-key-in 360ms var(--ease-out) forwards;
        }
        .pin-lock__key--del { font-size: clamp(17px, 4vw, 19px); color: var(--ink-600); }
        .pin-lock__key:disabled { opacity: .55; cursor: wait; }
        .pin-lock__key:active:not(:disabled) {
          transition: none;
          transform: scale(0.96);
          background: linear-gradient(180deg, #e9dcc1, #ddcca8);
          box-shadow:
            inset 0 2px 4px rgba(60,40,20,.14),
            inset 0 -1px 0 rgba(255,255,255,.25);
        }
        .pin-lock__key:focus-visible {
          outline: 2px solid var(--terra-500);
          outline-offset: 2px;
        }
        @media (hover: hover) and (pointer: fine) {
          .pin-lock__key:not(:disabled):hover {
            background: linear-gradient(180deg, #fdf6e5, #f1e5c9);
            border-color: rgba(60,40,20,.12);
          }
        }

        .pin-lock__reassurance {
          margin: 0;
          padding: 0 24px 18px;
          text-align: center;
          font-size: clamp(10px, 2.2vw, 11px);
          color: var(--ink-500);
          line-height: 1.5;
          font-style: italic;
        }

        /* ── Business doors ───────────────────────────────────────── */
        .pin-doors-wrap {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pin-doors-eyebrow {
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .26em;
          text-transform: uppercase;
          color: var(--ink-400);
        }
        .pin-doors {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        @media (max-width: 560px) { .pin-doors { grid-template-columns: 1fr; } }
        @media (min-width: 1000px) {
          .pin-doors { grid-template-columns: 1fr; gap: 12px; }
        }

        .pin-door {
          position: relative;
          padding: 6px;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.25));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.7),
            0 0 0 1px rgba(60,40,20,.05),
            0 18px 30px -16px rgba(60,40,20,.20),
            0 5px 12px -8px rgba(60,40,20,.10);
          transition:
            transform   720ms var(--ease-cinema),
            opacity     380ms var(--ease-cinema),
            filter      380ms var(--ease-cinema),
            box-shadow  720ms var(--ease-cinema);
        }
        @media (hover: hover) and (pointer: fine) {
          .pin-door:hover {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.7),
              0 0 0 1px rgba(60,40,20,.06),
              0 24px 42px -18px rgba(60,40,20,.24),
              0 7px 16px -10px rgba(60,40,20,.12);
          }
        }

        .pin-door__inner {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          padding: 14px 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          min-height: 150px;
        }

        @media (min-width: 1000px) {
          .pin-door__inner {
            display: grid;
            grid-template-columns: auto 1fr auto;
            grid-template-rows: auto auto;
            column-gap: 14px;
            row-gap: 4px;
            padding: 14px 16px;
            min-height: 0;
            align-items: center;
          }
          .pin-door__mono     { grid-row: 1 / span 2; }
          .pin-door__heading  { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
          .pin-door__state    { grid-column: 3; grid-row: 1; align-self: start; justify-self: end; }
          .pin-door__kpi      {
            grid-column: 3; grid-row: 2;
            padding-top: 0; border-top: none;
            gap: 6px; justify-content: flex-end; align-items: baseline;
            flex-direction: row;
          }
          .pin-door__kpi-label { display: none; }
        }

        .pin-door__mono {
          width: 38px; height: 38px;
          border-radius: 11px;
          display: grid; place-items: center;
          font-size: 19px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px -2px rgba(0,0,0,.35);
        }
        .pin-door--ganxo .pin-door__mono {
          background: linear-gradient(180deg, #e09454, #d4843d);
          color: #2a1a0e;
        }
        .pin-door--pista .pin-door__mono {
          background: linear-gradient(180deg, #8cc97c, #79b46a);
          color: #122a1c;
        }
        .pin-door--esquitx .pin-door__mono {
          background: linear-gradient(180deg, #82d2e2, #6ec3d4);
          color: #0e3540;
        }
        .pin-door__mono--serif-italic {
          font-family: var(--font-serif); font-style: italic; font-weight: 500;
        }
        .pin-door__mono--sans-bold {
          font-family: var(--font-sans); font-weight: 800; letter-spacing: -.02em;
        }
        .pin-door__mono--sans-clean {
          font-family: var(--font-sans); font-weight: 600;
        }

        .pin-door__heading {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pin-door__name {
          margin: 0;
          line-height: 1;
        }
        .pin-door__name--serif-italic {
          font-family: var(--font-serif);
          font-style: italic;
          font-weight: 500;
          font-size: 22px;
          letter-spacing: -.01em;
        }
        .pin-door__name--sans-upper {
          font-family: var(--font-sans);
          font-weight: 800;
          font-size: 20px;
          letter-spacing: -.02em;
          text-transform: uppercase;
        }
        .pin-door__name--sans-clean {
          font-family: var(--font-sans);
          font-weight: 500;
          font-size: 21px;
          letter-spacing: -.01em;
        }
        .pin-door__sub {
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: .03em;
          margin: 0;
        }

        .pin-door__state {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px 4px;
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.10);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .12em;
          text-transform: uppercase;
          white-space: nowrap;
          align-self: flex-start;
        }
        .pin-door__pulse {
          width: 5px; height: 5px;
          border-radius: 999px;
          background: currentColor;
          animation: pin-door-pulse 2.4s ease-in-out infinite;
        }
        .pin-door__state[data-closed="true"] .pin-door__pulse {
          animation: none; opacity: .35;
        }
        @keyframes pin-door-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,.45); }
          50%      { box-shadow: 0 0 0 5px rgba(255,255,255,0); }
        }

        .pin-door__kpi {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,.10);
        }
        .pin-door__kpi-big {
          font-family: var(--font-sans);
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          font-size: 20px;
          letter-spacing: -.01em;
          line-height: 1;
        }
        .pin-door__kpi-frac {
          font-size: 12px;
          opacity: .55;
          margin-left: 1px;
        }
        .pin-door__kpi-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .2em;
          text-transform: uppercase;
        }

        .pin-doors-foot {
          margin: 6px 0 0;
          text-align: center;
          font-size: 10.5px;
          color: var(--ink-500);
          font-style: italic;
        }

        /* ── BOOK-OPENING — chosen card animation ─────────────────── */
        .pin-door--opening {
          position: relative;
          z-index: 220;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.7),
            0 0 0 1px rgba(60,40,20,.06),
            0 80px 140px -20px rgba(0,0,0,.55),
            0 28px 56px -12px rgba(0,0,0,.32) !important;
          animation: pin-book-open 900ms var(--ease-cinema) forwards;
        }
        @keyframes pin-book-open {
          0% {
            transform: perspective(1200px) rotateX(0deg) translate(0, 0) scale(1);
          }
          18% {
            transform: perspective(1200px) rotateX(-9deg) translateY(-6px) scale(1.02);
          }
          100% {
            transform:
              perspective(1200px)
              rotateX(0deg)
              translate(var(--flip-dx, 0px), var(--flip-dy, 0px))
              scale(var(--flip-scale, 1.6));
          }
        }
        .pin-door--opening .pin-door__state,
        .pin-door--opening .pin-door__sub,
        .pin-door--opening .pin-door__kpi {
          opacity: 0;
          transition: opacity 320ms var(--ease-out) 360ms;
        }
        /* After the centered moment, the card fades out so the bookplate takes the stage. */
        .pin-lock-wrap--opening .pin-door--opening {
          animation: pin-book-open-out 1500ms var(--ease-cinema) forwards;
        }
        @keyframes pin-book-open-out {
          0% {
            transform: perspective(1200px) rotateX(0deg) translate(0, 0) scale(1);
            opacity: 1;
          }
          12% {
            transform: perspective(1200px) rotateX(-9deg) translateY(-6px) scale(1.02);
            opacity: 1;
          }
          60% {
            transform:
              perspective(1200px) rotateX(0deg)
              translate(var(--flip-dx, 0px), var(--flip-dy, 0px))
              scale(var(--flip-scale, 1.6));
            opacity: 1;
          }
          100% {
            transform:
              perspective(1200px) rotateX(0deg)
              translate(var(--flip-dx, 0px), calc(var(--flip-dy, 0px) - 12px))
              scale(var(--flip-scale, 1.6));
            opacity: 0;
          }
        }

        /* ── Bookplate (centered mono + name) ────────────────────── */
        .pin-bookplate {
          position: fixed; inset: 0;
          z-index: 240;
          pointer-events: none;
          display: grid;
          place-items: center;
          text-align: center;
          opacity: 0;
          transform: scale(0.96);
          animation: pin-bookplate-in 700ms var(--ease-cinema) forwards;
          animation-delay: 1000ms;
        }
        @keyframes pin-bookplate-in {
          to { opacity: 1; transform: scale(1); }
        }
        .pin-bookplate__mono {
          display: inline-grid; place-items: center;
          width: 88px; height: 88px;
          border-radius: 22px;
          margin: 0 auto 24px;
          font-size: 46px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.25),
            0 22px 50px -10px rgba(0,0,0,.55);
        }
        .pin-bookplate[data-biz="ganxo"] .pin-bookplate__mono {
          background: linear-gradient(180deg, #e09454, #d4843d);
          color: #2a1a0e;
        }
        .pin-bookplate[data-biz="pista"] .pin-bookplate__mono {
          background: linear-gradient(180deg, #8cc97c, #79b46a);
          color: #122a1c;
        }
        .pin-bookplate[data-biz="esquitx"] .pin-bookplate__mono {
          background: linear-gradient(180deg, #82d2e2, #6ec3d4);
          color: #0e3540;
        }
        .pin-bookplate__mono--serif-italic { font-family: var(--font-serif); font-style: italic; font-weight: 500; }
        .pin-bookplate__mono--sans-bold    { font-family: var(--font-sans);  font-weight: 800; }
        .pin-bookplate__mono--sans-clean   { font-family: var(--font-sans);  font-weight: 600; }

        .pin-bookplate__title {
          margin: 0;
          color: #f7f4ea;
          font-size: clamp(34px, 6vw, 44px);
          line-height: 1;
          letter-spacing: -.01em;
        }
        .pin-bookplate__title--serif-italic { font-family: var(--font-serif); font-style: italic; font-weight: 500; }
        .pin-bookplate__title--sans-upper   { font-family: var(--font-sans);  font-weight: 800; text-transform: uppercase; }
        .pin-bookplate__title--sans-clean   { font-family: var(--font-sans);  font-weight: 500; }

        .pin-bookplate__sub {
          margin: 16px 0 0;
          font-size: 10.5px;
          letter-spacing: .3em;
          text-transform: uppercase;
          color: rgba(247,244,234,.55);
          font-weight: 600;
        }

        /* ─── Top strip — editorial greeting + date (mobile only) ─────
              Renders only at narrow viewports; on desktop the same
              content lives inside the lock card's espresso header. */
        .pin-top-strip { display: none; }

        /* CTA — collapsed-state trigger that invites the user to tap. */
        .pin-lock__cta { display: none; }

        /* ─── MOBILE REDESIGN (≤ 720 px) ──────────────────────────────
              Two-state experience that prioritises the BUSINESS state
              of the system, with the PIN as a secondary action that
              expands on tap.

              State 1 (data-keypad="closed"):
                Top strip → 3 live cards → minimal PIN panel
                (brand row + dots + 'Toca per teclejar ↑').
                The keypad + reassurance are collapsed via max-height.

              State 2 (data-keypad="open"):
                Same hierarchy but the PIN panel expands smoothly:
                cards remain visible (slightly dimmed), keypad slides
                in from below, reassurance fades in last.

              The hardware keyboard auto-opens the state, so the
              collapse is mobile-touch-only. */
        @media (max-width: 720px) {
          .pin-stage {
            gap: 12px;
            padding: 0;
            justify-items: stretch;
            grid-template-columns: 1fr;
          }

          /* Reorder: greeting → snapshots → lock panel. */
          .pin-top-strip {
            display: block;
            order: -2;
            width: 100%;
            padding: 8px 8px 0;
          }
          .pin-doors-wrap { order: -1; width: 100%; gap: 8px; padding: 0 8px; }
          .pin-lock      { order:  1; }

          /* Top strip typography — editorial. */
          .pin-top-strip__greeting {
            font-family: var(--font-serif);
            font-weight: 400;
            font-size: clamp(30px, 8vw, 36px);
            line-height: 1;
            letter-spacing: -.02em;
            color: var(--ink-900);
          }
          .pin-top-strip__meta {
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .pin-top-strip__date,
          .pin-top-strip__stat {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: .14em;
            text-transform: uppercase;
            color: var(--ink-500);
            font-family: var(--font-mono);
          }
          .pin-top-strip__stat { color: var(--ink-600); font-weight: 700; }
          .pin-top-strip__sep {
            width: 3px; height: 3px;
            border-radius: 999px;
            background: var(--ink-300, #c5b8a8);
            display: inline-block;
            opacity: .7;
          }

          /* Cards have a slow, almost imperceptible breathing animation —
             a 6-second opacity drift that signals 'the system is alive'
             without distracting the eye. Reduced-motion respected later. */
          .pin-door {
            animation: pin-door-breathe 6.2s ease-in-out infinite;
            animation-delay: var(--pulse-delay, 0s);
          }
          .pin-door:nth-of-type(1) { --pulse-delay: 0s; }
          .pin-door:nth-of-type(2) { --pulse-delay: -2.1s; }
          .pin-door:nth-of-type(3) { --pulse-delay: -4.2s; }
          @keyframes pin-door-breathe {
            0%, 100% { opacity: 1; }
            50%      { opacity: .92; }
          }

          /* When keypad opens, cards dim slightly — focus shifts to the
             keypad without losing context. */
          .pin-lock-wrap[data-keypad="open"] .pin-door {
            opacity: .55;
            filter: saturate(.85);
            transition: opacity 340ms var(--ease-cinema), filter 340ms var(--ease-cinema);
          }
          .pin-lock-wrap[data-keypad="closed"] .pin-door {
            transition: opacity 340ms var(--ease-cinema), filter 340ms var(--ease-cinema);
          }

          /* ── Business snapshots — compact stacked cards, premium glass.
                Each row reads as "[mono] name+sub  ●state  kpi" in a
                tight 60-66 px tile. The "Estat dels locals avui"
                eyebrow becomes a small caps hairline marker. */
          .pin-doors-eyebrow {
            font-size: 9px;
            letter-spacing: .26em;
            padding: 0 6px 2px;
            color: var(--ink-400);
          }
          .pin-doors {
            display: flex;
            flex-direction: column;
            grid-template-columns: none;
            gap: 8px;
            /* Undo carousel from previous iteration */
            overflow: visible;
            scroll-snap-type: none;
            -webkit-overflow-scrolling: auto;
            margin-left: 0;
            margin-right: 0;
            scroll-padding-left: 0;
            padding: 0;
          }
          .pin-door {
            flex: 1 1 auto;
            max-width: none;
            scroll-snap-align: none;
            padding: 4px;
            border-radius: 16px;
          }
          .pin-door__inner {
            min-height: 0;
            padding: 11px 13px;
            display: grid;
            grid-template-columns: auto 1fr auto;
            grid-template-rows: auto auto;
            column-gap: 11px;
            row-gap: 1px;
            align-items: center;
            border-radius: 12px;
          }
          .pin-door__mono {
            grid-row: 1 / span 2;
            width: 36px; height: 36px;
            font-size: 17px;
            border-radius: 10px;
          }
          .pin-door__heading {
            grid-column: 2; grid-row: 1 / span 2;
            align-self: center;
            gap: 1px;
          }
          .pin-door__name--serif-italic { font-size: 17px; }
          .pin-door__name--sans-upper   { font-size: 15px; }
          .pin-door__name--sans-clean   { font-size: 16px; }
          .pin-door__sub                { font-size: 10px; }
          .pin-door__state {
            grid-column: 3; grid-row: 1;
            align-self: start; justify-self: end;
            font-size: 8px;
            padding: 2px 7px 3px;
            letter-spacing: .10em;
          }
          .pin-door__kpi {
            grid-column: 3; grid-row: 2;
            padding-top: 0;
            border-top: none;
            flex-direction: row;
            gap: 4px;
            justify-content: flex-end;
            align-items: baseline;
          }
          .pin-door__kpi-big   { font-size: 16px; }
          .pin-door__kpi-frac  { font-size: 10px; }
          .pin-door__kpi-label { display: none; }

          /* "PINs disponibles · El Ganxo · La Pista · L'Esquitx · Admin"
             is redundant on mobile — snapshots already enumerate the locals. */
          .pin-doors-foot { display: none; }

          /* ── PIN panel — floating, compact, premium.
                The editorial greeting and date are already in the top
                strip. Hide the eyebrow + big title here so the panel
                becomes a tight "brand + subtitle + dots + keypad". */
          .pin-lock {
            max-width: 100%;
            padding: 5px;
            border-radius: 24px;
          }
          .pin-lock__inner { border-radius: 19px; }
          .pin-lock__eyebrow,
          .pin-lock__title,
          .pin-lock__title::before { display: none; }
          .pin-lock__header {
            padding: 14px 22px 12px;
            gap: 6px;
          }
          .pin-lock__brand { gap: 8px; flex-direction: row; }
          .pin-lock__monogram {
            width: 30px; height: 30px;
            font-size: 16px;
            border-radius: 9px;
          }
          .pin-lock__wordmark {
            font-size: 9px;
            letter-spacing: .28em;
          }
          .pin-lock__subtitle {
            font-size: 12px;
            margin-top: 0;
            opacity: .72;
          }

          .pin-lock__dots {
            padding: 14px 16px 6px;
            gap: 11px;
          }
          .pin-lock__dot {
            width: clamp(40px, 10.5vw, 46px);
            border-radius: 12px;
          }
          .pin-lock__dot-fill { font-size: 22px; }
          .pin-lock__status {
            min-height: 16px;
            padding: 4px 24px 0;
            font-size: 11px;
          }
          .pin-lock__keypad {
            gap: 9px;
            padding: 6px 22px 14px;
            overflow: hidden;
          }
          .pin-lock__key {
            padding: 11px 0;
            font-size: 20px;
            border-radius: 14px;
          }
          .pin-lock__reassurance {
            padding: 0 24px 14px;
            font-size: 10.5px;
            opacity: .65;
            overflow: hidden;
          }

          /* ─── COLLAPSED STATE (data-keypad="closed") ─────────────────
                Keypad and reassurance shrink to 0; CTA appears below
                the dots; cards remain at full intensity. */
          .pin-lock-wrap[data-keypad="closed"] .pin-lock__keypad {
            max-height: 0;
            opacity: 0;
            padding-top: 0;
            padding-bottom: 0;
            pointer-events: none;
            transition:
              max-height     280ms var(--ease-cinema),
              opacity        180ms ease,
              padding-top    200ms var(--ease-cinema),
              padding-bottom 200ms var(--ease-cinema);
          }
          .pin-lock-wrap[data-keypad="closed"] .pin-lock__reassurance {
            max-height: 0;
            opacity: 0;
            padding-top: 0;
            padding-bottom: 0;
            margin: 0;
            transition:
              max-height 220ms var(--ease-cinema),
              opacity    160ms ease;
          }
          .pin-lock-wrap[data-keypad="closed"] .pin-lock__dots {
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }
          .pin-lock-wrap[data-keypad="closed"] .pin-lock__cta {
            display: inline-flex;
          }

          /* ─── OPEN STATE (data-keypad="open") ────────────────────────
                Keypad slides up, reassurance fades in. */
          .pin-lock-wrap[data-keypad="open"] .pin-lock__keypad {
            max-height: 360px;
            opacity: 1;
            transition:
              max-height 380ms var(--ease-cinema),
              opacity    260ms ease 80ms,
              padding-top    320ms var(--ease-cinema),
              padding-bottom 320ms var(--ease-cinema);
          }
          .pin-lock-wrap[data-keypad="open"] .pin-lock__reassurance {
            max-height: 60px;
            opacity: .65;
            transition:
              max-height 280ms var(--ease-cinema) 180ms,
              opacity    220ms ease 280ms;
          }
          .pin-lock-wrap[data-keypad="open"] .pin-lock__cta {
            display: none;
          }

          /* CTA — minimal pill below the dots when collapsed. */
          .pin-lock__cta {
            align-self: center;
            margin: 4px auto 12px;
            padding: 6px 14px 7px;
            border: 1px solid rgba(60,40,20,.10);
            background: linear-gradient(180deg,
                          rgba(255,255,255,.55) 0%,
                          rgba(255,255,255,.30) 100%);
            border-radius: 999px;
            cursor: pointer;
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            -webkit-tap-highlight-color: transparent;
            transition:
              transform   180ms var(--ease-out),
              background  220ms var(--ease-out),
              box-shadow  220ms var(--ease-out);
            box-shadow: 0 1px 2px rgba(60,40,20,.04);
          }
          .pin-lock__cta:active {
            transform: scale(0.97);
            background: linear-gradient(180deg, rgba(255,255,255,.7), rgba(255,255,255,.4));
          }
          .pin-lock__cta-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--ink-700);
            letter-spacing: .015em;
          }
          .pin-lock__cta-arrow {
            font-size: 8px;
            color: var(--terra-600);
            animation: pin-cta-bounce 2.6s ease-in-out infinite;
          }
          @keyframes pin-cta-bounce {
            0%, 100% { transform: translateY(0); opacity: .7; }
            50%      { transform: translateY(-2px); opacity: 1; }
          }
        }

        /* Disable breathing + pulse animations under reduced motion. */
        @media (prefers-reduced-motion: reduce) {
          .pin-door { animation: none !important; }
          .pin-lock__cta-arrow { animation: none !important; }
        }

        /* ── Touch performance mode ───────────────────────────────
           When body[data-fast-ui="1"] is set (touch screens, tablets,
           the restaurant counter PC), strip every effect that delays
           the first paint of the keypad or wastes a frame on idle
           animation. The PIN screen is THE first interaction — it has
           to feel instant. */
        body[data-fast-ui="1"] .pin-lock__key {
          /* Skip the staggered fade-in entirely — keys visible the
             instant the keypad renders. */
          opacity: 1 !important;
          transform: none !important;
          animation: none !important;
          /* Bigger, tap-friendly target on the touch PC. */
          padding: clamp(16px, 2.8vw, 22px) 0;
          font-size: clamp(22px, 4.8vw, 26px);
          /* Single-frame press feedback. */
          transition:
            transform 80ms var(--ease-out),
            background 120ms var(--ease-out);
        }
        body[data-fast-ui="1"] .pin-lock__keypad {
          /* Slightly tighter gap so the larger keys still fit. */
          gap: 10px;
        }
        body[data-fast-ui="1"] .pin-door {
          /* Disable the slow breathing on the business cards while
             the keypad is the focus. */
          animation: none !important;
        }
        body[data-fast-ui="1"] .pin-lock__cta-arrow {
          animation: none !important;
        }

        /* ── Animations ──────────────────────────────────────────── */
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          15%, 75% { transform: translateX(-7px); }
          35%, 55% { transform: translateX(7px); }
        }
        @keyframes pin-key-in {
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Reduced motion ──────────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .pin-lock,
          .pin-lock__key,
          .pin-door,
          .pin-door--opening,
          .pin-bookplate {
            transform: none !important;
            filter: none !important;
            animation: none !important;
            transition: opacity 200ms ease;
          }
          .pin-lock--in           { opacity: 1; }
          .pin-lock__key          { opacity: 1; }
          .pin-lock__dot-fill     { transform: none; }
          .pin-lock--shake        { animation: none; }
          .pin-lock__dots::after  { transform: translateX(-50%) scaleX(1); transition: none; }
          .pin-lock-wrap--opening .pin-bookplate { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
