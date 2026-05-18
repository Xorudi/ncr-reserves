/**
 * PIN lock screen — gates the app after the Supabase device login.
 *
 * Visual system (Editorial Luxury / Z-Axis Cascade):
 *   • Multi-layer warm atmosphere: cream radial + terracotta glow at
 *     the top-right + espresso pool at the bottom-left, with a fine
 *     SVG paper-grain fixed overlay (mix-blend: multiply, opacity 4%).
 *   • Double-Bezel card: outer shell `.pin-lock` (translucent, hairline,
 *     padded by 8px, rounded 32px) hosts an inner core `.pin-lock__inner`
 *     (paper, rounded 26px = 32 - 8 + 2 for concentric curves).
 *   • Header: espresso plate with terracotta inner glow at the
 *     top-right + a hairline highlight on the top edge.
 *   • PIN dots: glass-like with inset highlight, soft outer halo on the
 *     active dot, character fill with slight overshoot spring.
 *   • Keypad: physical hardware feel — gradient face, inset highlights,
 *     pressed state inverts the inset and darkens the gradient.
 *   • Editorial eyebrow tag with the current day + date.
 *
 * Behaviour (unchanged):
 *   • 4-digit keypad, verified against ALL stored PIN hashes
 *     (constant-time wrt which PIN matched).
 *   • Wrong PIN → tint+shake → neutral retry message. No lockouts.
 *   • A page reload always returns to this screen.
 *
 * Animation tokens:
 *   --ease-out:    cubic-bezier(0.23, 1, 0.32, 1)
 *   --ease-cinema: cubic-bezier(0.32, 0.72, 0, 1)  ← heavier card entrance
 *   Press scale on :active is instant; release is 180 ms ease-out.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { verifyPin, loadPinConfig } from '@/lib/pinAuth';
import { usePinScope } from '@/store/usePinScope';
import { getSession, extractBizIds } from '@/lib/auth';
import { SUPABASE_AUTH_ENABLED } from '@/lib/featureFlags';
import type { BusinessId } from '@/types';
import PremiumRestaurantAmbient from '@/components/shared/PremiumRestaurantAmbient';

/** Time-aware greeting — adds a subtle Apple-lock-screen touch. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 7)  return 'Bona nit';
  if (h < 13) return 'Bon dia';
  if (h < 20) return 'Bona tarda';
  return 'Bona nit';
}

/** Editorial eyebrow context — "Divendres · 15 Maig" style. */
function dayLabel(): string {
  const days   = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
  const months = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
                  'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'];
  const d = new Date();
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]}`;
}

export default function PinLockView() {
  const [pin,        setPin]      = useState('');
  const [error,      setError]    = useState<string | null>(null);
  const [shake,      setShake]    = useState(false);
  const [errorPulse, setErrorPulse] = useState(false);
  const [busy,       setBusy]     = useState(false);
  const [mounted,    setMounted]  = useState(false);
  const [sessionBizIds, setSessionBizIds] = useState<readonly BusinessId[] | null>(null);
  const verifying = useRef(false);

  const unlock = usePinScope(s => s.unlock);
  const labels = (loadPinConfig()?.pins ?? []).map(p => p.label);
  const hello  = useMemo(greeting, []);
  const eyebrow = useMemo(dayLabel, []);

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

  // ── Keypad input ───────────────────────────────────────────────────────────
  function press(d: string) {
    if (busy || errorPulse) return;
    setError(null);
    setPin(p => (p + d).slice(0, 4));
  }
  function backspace() {
    if (busy || errorPulse) return;
    setError(null);
    setPin(p => p.slice(0, -1));
  }

  // Hardware keyboard support (desktop / Bluetooth on iPad).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (busy) return;
      if (e.key >= '0' && e.key <= '9') { press(e.key); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { backspace(); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, errorPulse]);

  // Two-step "wrong PIN" flow: tint the dots for 180 ms, then clear.
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

      unlock(match.label, effective);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="pin-lock-wrap">
      {/* Interactive ambient warmth — sits between the wrap's static gradient
          and the card. Pointer-events: none so PIN input is never blocked. */}
      <PremiumRestaurantAmbient zIndex={0} />

      <div
        className={`pin-lock ${mounted ? 'pin-lock--in' : ''} ${shake ? 'pin-lock--shake' : ''}`}
        role="dialog"
        aria-label="Introdueix el PIN"
      >
        {/* Inner core — the actual content surface (Double-Bezel). */}
        <div className="pin-lock__inner">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className="pin-lock__header">
            <span className="pin-lock__eyebrow">{eyebrow}</span>

            <div className="pin-lock__brand">
              <span className="pin-lock__monogram" aria-hidden="true">N</span>
              <span className="pin-lock__wordmark">NCR Reserves</span>
            </div>

            <h1 className="pin-lock__title">{hello}</h1>
            <p className="pin-lock__subtitle">Introdueix el PIN per continuar</p>
          </header>

          {/* ── PIN dots ────────────────────────────────────────────────── */}
          <div className="pin-lock__dots" aria-live="polite">
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

          {/* ── Status / error ──────────────────────────────────────────── */}
          <div className="pin-lock__status" aria-live="polite" data-error={!!error}>
            {error || (busy ? 'Verificant…' : ' ')}
          </div>

          {/* ── Keypad ──────────────────────────────────────────────────── */}
          <div className="pin-lock__keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((n, i) => {
              if (n === null) return <span key={i} aria-hidden="true" />;
              const isDel = n === 'del';
              return (
                <button
                  key={i}
                  type="button"
                  disabled={busy}
                  className={`pin-lock__key ${isDel ? 'pin-lock__key--del' : ''}`}
                  onClick={() => isDel ? backspace() : press(String(n))}
                  aria-label={isDel ? 'Esborrar' : `Tecla ${n}`}
                  style={{ animationDelay: `${i * 28}ms` }}
                >
                  {isDel ? '⌫' : n}
                </button>
              );
            })}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <footer className="pin-lock__footer">
            {labels.length > 0 && (
              <>
                <span className="pin-lock__footer-divider" aria-hidden="true" />
                <span className="pin-lock__footer-label">PINs disponibles</span>
                <div className="pin-lock__footer-chips">
                  {labels.map(l => (
                    <span key={l} className="pin-lock__footer-chip">{l}</span>
                  ))}
                </div>
              </>
            )}
            <p className="pin-lock__footer-reassurance">
              Si t'equivoques no passa res — torna a teclejar.
            </p>
          </footer>

        </div>{/* /.pin-lock__inner */}
      </div>

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
            max(20px, env(safe-area-inset-top))
            16px
            max(20px, env(safe-area-inset-bottom));
          overflow: auto;
          background:
            radial-gradient(ellipse 70% 55% at 78% 6%, rgba(200, 97, 58, .16) 0%, transparent 62%),
            radial-gradient(ellipse 55% 45% at 18% 96%, rgba(54, 32, 18, .14) 0%, transparent 65%),
            radial-gradient(ellipse 120% 100% at 50% 50%, #f6ecd9 0%, #ece2c8 55%, #d6cbb1 100%);
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
          isolation: isolate;
        }

        /* Fine paper grain — fixed, behind everything, GPU-friendly. */
        .pin-lock-wrap::before {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          opacity: .045;
          mix-blend-mode: multiply;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Card — Double-Bezel outer shell ─────────────────────────────── */
        .pin-lock {
          position: relative;
          width: 100%;
          max-width: 460px;
          padding: 7px;
          border-radius: 32px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.32) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.7),
            0 0 0 1px rgba(60,40,20,.05),
            0 38px 80px -22px rgba(60,40,20,.32),
            0 14px 32px -12px rgba(60,40,20,.16);
          z-index: 1;

          /* Cinematic entrance: heavier than the previous version. */
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

        @media (min-width: 900px) {
          .pin-lock { max-width: 440px; }
        }

        /* Inner core — paper surface with concentric radius. */
        .pin-lock__inner {
          position: relative;
          background: linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%);
          border-radius: 26px;
          overflow: hidden;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.55),
            inset 0 -1px 0 rgba(60,40,20,.05);
        }

        /* ── Header — espresso plate ─────────────────────────────────────── */
        .pin-lock__header {
          position: relative;
          padding:
            clamp(22px, 4.6vw, 30px)
            clamp(22px, 5.2vw, 32px)
            clamp(22px, 4.5vw, 26px);
          background:
            radial-gradient(ellipse 110% 90% at 100% 0%, rgba(200,97,58,.22) 0%, transparent 60%),
            linear-gradient(180deg, #2a2018 0%, #1a120d 100%);
          color: var(--cream);
          text-align: center;
          overflow: hidden;
        }
        /* Top-edge hairline highlight */
        .pin-lock__header::after {
          content: '';
          position: absolute;
          top: 0; left: 12%; right: 12%;
          height: 1px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(255,255,255,.20) 50%,
            transparent 100%);
        }

        .pin-lock__eyebrow {
          display: inline-block;
          padding: 5px 12px 6px;
          margin-bottom: 16px;
          border-radius: 999px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.08);
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: rgba(251,247,238,.58);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .pin-lock__brand {
          display: inline-flex; align-items: center; gap: 11px;
          margin-bottom: 16px;
        }
        .pin-lock__monogram {
          position: relative;
          width: 40px; height: 40px;
          border-radius: 12px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.20) 0%, rgba(255,255,255,0) 55%),
            linear-gradient(180deg, #d5703f 0%, var(--terra-500) 100%);
          color: #fff;
          display: grid; place-items: center;
          font-family: var(--font-serif);
          font-weight: 500;
          font-size: 21px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.4),
            inset 0 -1px 0 rgba(0,0,0,.15),
            0 4px 10px -2px rgba(146,60,31,.45),
            0 0 0 1px rgba(146,60,31,.5);
        }
        .pin-lock__wordmark {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .18em;
          text-transform: uppercase;
          opacity: .68;
        }

        .pin-lock__title {
          margin: 0;
          font-family: var(--font-serif);
          font-weight: 400;
          font-size: clamp(28px, 6.2vw, 36px);
          line-height: 1.02;
          letter-spacing: -.018em;
        }
        .pin-lock__subtitle {
          margin: 10px 0 0;
          font-size: clamp(12px, 2.5vw, 13px);
          color: rgba(251,247,238,.56);
          line-height: 1.45;
          letter-spacing: .005em;
        }

        /* ── PIN dots ────────────────────────────────────────────────────── */
        .pin-lock__dots {
          position: relative;
          padding: clamp(26px, 5vw, 34px) 16px 8px;
          display: flex;
          justify-content: center;
          gap: clamp(10px, 2.4vw, 14px);
        }
        /* Hairline accent under the dots, appears when any dot is filled */
        .pin-lock__dots::after {
          content: '';
          position: absolute;
          bottom: 0; left: 50%;
          width: 28px; height: 1px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(200,97,58,.55) 50%,
            transparent 100%);
          transform: translateX(-50%) scaleX(0);
          transition: transform 320ms var(--ease-out);
          transform-origin: center;
        }
        .pin-lock__dots:has(.pin-lock__dot[data-filled="true"])::after {
          transform: translateX(-50%) scaleX(1);
        }

        .pin-lock__dot {
          position: relative;
          width: clamp(48px, 12vw, 60px);
          aspect-ratio: 1 / 1.2;
          border-radius: 14px;
          background: linear-gradient(180deg, var(--cream) 0%, #f7ecd6 100%);
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
          background: linear-gradient(180deg, var(--terra-50) 0%, #f4d3bf 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.45),
            0 0 0 4px rgba(200, 97, 58, .18);
        }
        .pin-lock__dot-fill {
          font-family: var(--font-serif);
          font-size: clamp(28px, 7.6vw, 34px);
          font-weight: 600;
          color: var(--ink-900);
          text-shadow: 0 1px 0 rgba(255,255,255,.4);
          opacity: 0;
          transform: scale(0.35);
          /* Slight overshoot spring on fill */
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

        /* ── Status line ─────────────────────────────────────────────────── */
        .pin-lock__status {
          min-height: 30px;
          padding: 10px 24px 0;
          text-align: center;
          font-size: clamp(11.5px, 2.6vw, 12.5px);
          color: var(--ink-500);
          letter-spacing: .005em;
          transition: color 200ms var(--ease-out);
        }
        .pin-lock__status[data-error="true"] {
          color: var(--terra-700);
          font-weight: 500;
        }

        /* ── Keypad ──────────────────────────────────────────────────────── */
        .pin-lock__keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(8px, 2vw, 12px);
          padding:
            clamp(8px, 2vw, 14px)
            clamp(22px, 5.2vw, 30px)
            clamp(18px, 4vw, 22px);
        }
        .pin-lock__key {
          position: relative;
          padding: clamp(15px, 3.6vw, 19px) 0;
          background: linear-gradient(180deg, var(--cream) 0%, #f4e9d2 100%);
          border: 1px solid rgba(60,40,20,.08);
          border-radius: 14px;
          font-family: var(--font-serif);
          font-size: clamp(23px, 5.4vw, 27px);
          font-variant-numeric: tabular-nums;
          font-weight: 400;
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

          /* Stagger entrance — 28 ms per key, 360 ms duration. */
          opacity: 0;
          transform: translateY(6px);
          animation: pin-key-in 360ms var(--ease-out) forwards;
        }
        .pin-lock__key--del {
          font-size: clamp(19px, 4.8vw, 23px);
          color: var(--ink-600);
        }
        .pin-lock__key:disabled {
          opacity: .55;
          cursor: wait;
        }
        .pin-lock__key:active:not(:disabled) {
          /* Press: snappy inset state, no transition on the way down. */
          transition: none;
          transform: scale(0.96);
          background: linear-gradient(180deg, #e9dcc1 0%, #ddcca8 100%);
          box-shadow:
            inset 0 2px 4px rgba(60,40,20,.14),
            inset 0 -1px 0 rgba(255,255,255,.25);
        }
        .pin-lock__key:focus-visible {
          outline: 2px solid var(--terra-500);
          outline-offset: 2px;
        }

        /* Hover only on devices with a precise pointer. */
        @media (hover: hover) and (pointer: fine) {
          .pin-lock__key:not(:disabled):hover {
            background: linear-gradient(180deg, #fdf6e5 0%, #f1e5c9 100%);
            border-color: rgba(60,40,20,.12);
          }
        }

        /* ── Footer ──────────────────────────────────────────────────────── */
        .pin-lock__footer {
          padding: 0 clamp(20px, 5vw, 28px) clamp(20px, 4vw, 24px);
          text-align: center;
        }
        .pin-lock__footer-divider {
          display: block;
          width: 22px; height: 1px;
          margin: 4px auto 14px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(60,40,20,.16) 50%,
            transparent 100%);
        }
        .pin-lock__footer-label {
          display: block;
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: var(--ink-400);
          margin-bottom: 8px;
        }
        .pin-lock__footer-chips {
          display: inline-flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 5px;
          margin-bottom: 14px;
        }
        .pin-lock__footer-chip {
          padding: 3px 9px 4px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 500;
          color: var(--ink-600);
          background: var(--cream);
          border: 1px solid rgba(60,40,20,.10);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.6);
          letter-spacing: .015em;
        }
        .pin-lock__footer-reassurance {
          margin: 0;
          font-size: clamp(10.5px, 2.4vw, 11.5px);
          color: var(--ink-500);
          line-height: 1.55;
          letter-spacing: .015em;
          font-style: italic;
        }

        /* ── Animations ──────────────────────────────────────────────────── */
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          15%, 75% { transform: translateX(-7px); }
          35%, 55% { transform: translateX(7px); }
        }
        @keyframes pin-key-in {
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Reduced motion ──────────────────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .pin-lock,
          .pin-lock__key {
            transform: none !important;
            filter: none !important;
            animation: none !important;
            transition: opacity 200ms ease, background-color 200ms ease, color 200ms ease;
          }
          .pin-lock--in   { opacity: 1; }
          .pin-lock__key  { opacity: 1; }
          .pin-lock__dot-fill { transform: none; }
          .pin-lock--shake { animation: none; }
          .pin-lock__dots::after { transform: translateX(-50%) scaleX(1); transition: none; }
        }
      `}</style>
    </div>
  );
}
