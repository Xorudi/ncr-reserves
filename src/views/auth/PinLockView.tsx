/**
 * PIN lock screen — gates the app after the Supabase device login.
 *
 * UI is fully responsive via CSS `clamp()`:
 *   • Mobile (≤480 px): keypad fills the width, big finger targets.
 *   • Tablet/iPad: card sits centered, generous spacing.
 *   • Desktop: card capped at ~420 px so it never feels empty.
 *
 * Behaviour (unchanged from previous version):
 *   • 4-digit keypad, verified against ALL stored PIN hashes
 *     (constant-time wrt which PIN matched).
 *   • Wrong PIN → shake + neutral retry message. No lockouts, no
 *     attempt counters: the cryptographic gate is Supabase Auth; the
 *     PIN is a local convenience lock, so scaring staff over mistypes
 *     hurts UX without buying security.
 *   • A page reload always returns to this screen.
 *
 * Animation tokens (canonical ease-out, ~280–320 ms range):
 *   --ease-out:   cubic-bezier(0.23, 1, 0.32, 1)
 *   Press scale on :active is instant; release is 140 ms ease-out
 *   (asymmetric: instant feedback, snappy recovery).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { verifyPin, loadPinConfig } from '@/lib/pinAuth';
import { usePinScope } from '@/store/usePinScope';
import { getSession, extractBizIds } from '@/lib/auth';
import { SUPABASE_AUTH_ENABLED } from '@/lib/featureFlags';
import type { BusinessId } from '@/types';

/** Time-aware greeting — adds a subtle Apple-lock-screen touch. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 7)  return 'Bona nit';
  if (h < 13) return 'Bon dia';
  if (h < 20) return 'Bona tarda';
  return 'Bona nit';
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
  // Memo so the greeting doesn't flicker if React re-renders mid-second.
  const hello  = useMemo(greeting, []);

  // Entrance: fade + tiny lift after first paint
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
      // Intersect PIN scope with Supabase session's biz_ids (defence
      // in depth — RLS would already reject cross-tenant queries).
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
      <div
        className={`pin-lock ${mounted ? 'pin-lock--in' : ''} ${shake ? 'pin-lock--shake' : ''}`}
        role="dialog"
        aria-label="Introdueix el PIN"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="pin-lock__header">
          <div className="pin-lock__brand">
            <span className="pin-lock__monogram" aria-hidden="true">N</span>
            <span className="pin-lock__wordmark">NCR Reserves</span>
          </div>

          <h1 className="pin-lock__title">{hello}</h1>
          <p className="pin-lock__subtitle">Introdueix el PIN per continuar</p>
        </header>

        {/* ── PIN dots ────────────────────────────────────────────────────── */}
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

        {/* ── Status / error ──────────────────────────────────────────────── */}
        <div className="pin-lock__status" aria-live="polite" data-error={!!error}>
          {error || (busy ? 'Verificant…' : ' ')}
        </div>

        {/* ── Keypad ──────────────────────────────────────────────────────── */}
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
                style={{ animationDelay: `${i * 20}ms` }}
              >
                {isDel ? '⌫' : n}
              </button>
            );
          })}
        </div>

        {/* ── Footer hint ─────────────────────────────────────────────────── */}
        <footer className="pin-lock__footer">
          {labels.length > 0 && (
            <>
              PINs disponibles:{' '}
              <span className="pin-lock__footer-strong">{labels.join(' · ')}</span>
              <br />
            </>
          )}
          Si t'equivoques no passa res — torna a teclejar.
        </footer>
      </div>

      <style>{`
        :where(.pin-lock-wrap) {
          --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
          --paper:      var(--paper,        #fbf7ee);
          --cream:      var(--cream,        #fdf9f2);
          --ink-900:    var(--ink-900,      #1d1612);
          --ink-700:    var(--ink-700,      #3a2a1f);
          --ink-600:    var(--ink-600,      #5a4a3a);
          --ink-500:    var(--ink-500,      #7a6a5a);
          --ink-400:    var(--ink-400,      #9a8a7a);
          --terra-50:   var(--terracotta-50,  #fbeadf);
          --terra-500:  var(--terracotta-500, #c8613a);
          --terra-700:  var(--terracotta-700, #923c1f);
        }

        .pin-lock-wrap {
          position: fixed; inset: 0;
          display: grid; place-items: center;
          padding: max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom));
          overflow: auto;
          background: radial-gradient(ellipse at top, #f5e9d6 0%, #ebe5d8 55%, #ddd4c2 100%);
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
        }

        .pin-lock {
          width: 100%;
          max-width: 440px;
          background: var(--paper);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 28px 72px rgba(60,40,20,.18), 0 6px 18px rgba(60,40,20,.08);

          /* Entrance: opacity + tiny lift. Strong canonical ease-out. */
          opacity: 0;
          transform: translateY(8px);
          transition:
            opacity 320ms var(--ease-out),
            transform 320ms var(--ease-out);
        }
        .pin-lock--in {
          opacity: 1;
          transform: translateY(0);
        }
        .pin-lock--shake {
          animation: pin-shake 420ms;
        }

        @media (min-width: 900px) {
          .pin-lock { max-width: 420px; }
        }

        /* ── Header ───────────────────────────────────────────────────────── */
        .pin-lock__header {
          padding: clamp(22px, 4.5vw, 28px) clamp(20px, 5vw, 28px) clamp(18px, 4vw, 22px);
          background: linear-gradient(180deg, #2a201a 0%, #1d1612 100%);
          color: var(--cream);
          text-align: center;
        }
        .pin-lock__brand {
          display: inline-flex; align-items: center; gap: 10px;
          margin-bottom: 10px;
        }
        .pin-lock__monogram {
          width: 36px; height: 36px;
          border-radius: 9px;
          background: var(--terra-500);
          color: #fff;
          display: grid; place-items: center;
          font-family: var(--font-serif);
          font-weight: 500;
          font-size: 19px;
          box-shadow: 0 2px 6px rgba(0,0,0,.18);
        }
        .pin-lock__wordmark {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          opacity: .68;
        }
        .pin-lock__title {
          margin: 0;
          font-family: var(--font-serif);
          font-weight: 500;
          font-size: clamp(22px, 4.6vw, 28px);
          line-height: 1.12;
          letter-spacing: -.005em;
        }
        .pin-lock__subtitle {
          margin: 6px 0 0;
          font-size: clamp(12.5px, 2.6vw, 13.5px);
          color: rgba(251,247,238,.72);
          line-height: 1.45;
        }

        /* ── PIN dots ─────────────────────────────────────────────────────── */
        .pin-lock__dots {
          padding: clamp(22px, 4vw, 28px) 16px 4px;
          display: flex;
          justify-content: center;
          gap: clamp(8px, 2vw, 12px);
        }
        .pin-lock__dot {
          width: clamp(46px, 12vw, 58px);
          aspect-ratio: 1 / 1.18;
          border-radius: 12px;
          background: var(--cream);
          border: 1.5px solid rgba(60,40,20,.13);
          /* Active ring done via box-shadow → no layout shift on focus. */
          box-shadow: inset 0 1px 0 rgba(60,40,20,.04);
          display: grid; place-items: center;
          transition:
            box-shadow 180ms var(--ease-out),
            border-color 180ms var(--ease-out),
            background-color 180ms var(--ease-out);
        }
        .pin-lock__dot[data-active="true"] {
          border-color: var(--terra-500);
          box-shadow:
            inset 0 1px 0 rgba(60,40,20,.04),
            0 0 0 4px rgba(200, 97, 58, .10);
        }
        .pin-lock__dot[data-error="true"] {
          border-color: var(--terra-500);
          background-color: var(--terra-50);
        }
        .pin-lock__dot-fill {
          font-family: var(--font-serif);
          font-size: clamp(26px, 7vw, 32px);
          font-weight: 600;
          color: var(--ink-900);
          /* Fill state — animate the character itself, not the frame. */
          opacity: 0;
          transform: scale(0.4);
          transition:
            opacity 180ms var(--ease-out),
            transform 180ms var(--ease-out),
            color 180ms var(--ease-out);
        }
        .pin-lock__dot[data-filled="true"] .pin-lock__dot-fill {
          opacity: 1;
          transform: scale(1);
        }
        .pin-lock__dot[data-error="true"] .pin-lock__dot-fill {
          color: var(--terra-700);
        }

        /* ── Status / error line ──────────────────────────────────────────── */
        .pin-lock__status {
          min-height: 30px;
          padding: 6px 24px 0;
          text-align: center;
          font-size: clamp(12px, 2.8vw, 13px);
          color: var(--ink-500);
          transition: color 160ms var(--ease-out);
        }
        .pin-lock__status[data-error="true"] {
          color: var(--terra-700);
          font-weight: 500;
        }

        /* ── Keypad ───────────────────────────────────────────────────────── */
        .pin-lock__keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(8px, 2vw, 12px);
          padding: 8px clamp(20px, 5vw, 28px) clamp(18px, 4vw, 24px);
        }
        .pin-lock__key {
          padding: clamp(14px, 3.4vw, 18px) 0;
          background: var(--cream);
          border: 1.5px solid rgba(60,40,20,.10);
          border-radius: 14px;
          font-family: var(--font-serif);
          font-size: clamp(22px, 5.2vw, 26px);
          font-variant-numeric: tabular-nums;
          font-weight: 500;
          color: var(--ink-900);
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          box-shadow: 0 1px 0 rgba(60,40,20,.04);

          /* Release is snappy; press is instant via :active. */
          transition:
            transform 140ms var(--ease-out),
            background-color 160ms var(--ease-out),
            box-shadow 160ms var(--ease-out);

          /* Stagger entrance — only on first mount. */
          opacity: 0;
          transform: translateY(4px);
          animation: pin-key-in 280ms var(--ease-out) forwards;
          animation-delay: var(--stagger, 0ms);
        }
        .pin-lock__key--del {
          font-size: clamp(18px, 4.6vw, 22px);
        }
        .pin-lock__key:disabled {
          opacity: .65;
          cursor: wait;
        }
        .pin-lock__key:active:not(:disabled) {
          /* Instant press feedback — no transition on the "down" stroke. */
          transition: none;
          transform: scale(0.96);
          background-color: #f7eedd;
        }
        .pin-lock__key:focus-visible {
          outline: 2px solid var(--terra-500);
          outline-offset: 2px;
        }

        /* Hover only on devices with a precise pointer (mouse / trackpad).
           Touch devices fire hover on tap, which causes a sticky highlight. */
        @media (hover: hover) and (pointer: fine) {
          .pin-lock__key:not(:disabled):hover {
            background-color: #f9f1e0;
          }
        }

        /* ── Footer hint ──────────────────────────────────────────────────── */
        .pin-lock__footer {
          padding: 2px clamp(20px, 5vw, 28px) clamp(18px, 4vw, 22px);
          text-align: center;
          font-size: clamp(10.5px, 2.4vw, 11.5px);
          color: var(--ink-400);
          letter-spacing: .04em;
          line-height: 1.5;
        }
        .pin-lock__footer-strong {
          color: var(--ink-600);
          font-weight: 500;
        }

        /* ── Animations ───────────────────────────────────────────────────── */
        @keyframes pin-shake {
          0%, 100%   { transform: translateX(0); }
          15%, 75%   { transform: translateX(-6px); }
          35%, 55%   { transform: translateX(6px); }
        }
        @keyframes pin-key-in {
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Reduced motion ───────────────────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .pin-lock,
          .pin-lock__key {
            transform: none !important;
            animation: none !important;
            transition: opacity 200ms ease, color 200ms ease, background-color 200ms ease;
          }
          .pin-lock--in { opacity: 1; }
          .pin-lock__key { opacity: 1; }
          .pin-lock__dot-fill { transform: none; }
          .pin-lock--shake { animation: none; }
        }
      `}</style>
    </div>
  );
}
