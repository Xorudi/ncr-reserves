/**
 * PIN lock screen — gates the app after the Supabase device login.
 *
 * UI is fully responsive via CSS `clamp()`:
 *   • Mobile (≤480 px): keypad fills the width, big finger targets.
 *   • Tablet/iPad: card sits centered, generous spacing.
 *   • Desktop: card capped at ~440 px so it never feels empty.
 *
 * Behaviour (unchanged):
 *   • 4-digit keypad, verified against ALL stored PIN hashes (constant-
 *     time wrt which PIN matched).
 *   • Wrong PIN → shake + neutral retry message. No lockouts, no
 *     attempt counters: the cryptographic gate is Supabase Auth; the
 *     PIN is a local convenience lock, so scaring staff over mistypes
 *     hurts UX without buying security.
 *   • A page reload always returns to this screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import { verifyPin, loadPinConfig } from '@/lib/pinAuth';
import { usePinScope } from '@/store/usePinScope';

export default function PinLockView() {
  const [pin,     setPin]   = useState('');
  const [error,   setError] = useState<string | null>(null);
  const [shake,   setShake] = useState(false);
  const [busy,    setBusy]  = useState(false);
  const [mounted, setMounted] = useState(false);   // entrance animation
  const verifying = useRef(false);

  const unlock = usePinScope(s => s.unlock);
  const labels = (loadPinConfig()?.pins ?? []).map(p => p.label);

  // Entrance: trigger fade/slide after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Keypad input ───────────────────────────────────────────────────────────
  function press(d: string) {
    if (busy) return;
    setError(null);
    setPin(p => (p + d).slice(0, 4));
  }
  function backspace() {
    if (busy) return;
    setError(null);
    setPin(p => p.slice(0, -1));
  }

  // Hardware keyboard support (handy on desktop / tablets with bluetooth kb).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (busy) return;
      if (e.key >= '0' && e.key <= '9') { press(e.key); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { backspace(); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // Auto-verify when 4 digits typed
  useEffect(() => {
    if (pin.length !== 4 || verifying.current) return;
    verifying.current = true;
    setBusy(true);

    verifyPin(pin).then(match => {
      verifying.current = false;
      setBusy(false);
      if (match) {
        unlock(match.label, match.scope);
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 420);
        setPin('');
        setError('Aquest PIN no coincideix. Torna-ho a provar.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // ─── Layout tokens ─────────────────────────────────────────────────────────
  // `clamp(min, preferred, max)` scales smoothly between phone and tablet.
  // Desktop caps at the max (card-width 440 px) so it never goes huge.
  const dotSize  = 'clamp(44px, 12vw, 56px)';
  const dotGap   = 'clamp(8px, 2vw, 12px)';
  const keyFont  = 'clamp(22px, 5.2vw, 26px)';
  const keyPadV  = 'clamp(14px, 3.4vw, 18px)';
  const cardPadX = 'clamp(20px, 5vw, 28px)';
  const headFont = 'clamp(20px, 4.5vw, 26px)';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        background:
          'radial-gradient(ellipse at top, #f5e9d6 0%, #ebe5d8 55%, #ddd4c2 100%)',
        display: 'grid', placeItems: 'center',
        padding: 'max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))',
        overflow: 'auto',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      }}
    >
      <div
        role="dialog"
        aria-label="Introdueix el PIN"
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--paper, #fbf7ee)',
          borderRadius: 20,
          boxShadow:
            '0 28px 72px rgba(60,40,20,.18), 0 6px 18px rgba(60,40,20,.08)',
          overflow: 'hidden',
          // Entrance: fade + tiny lift. Shake animation overrides transform.
          opacity: mounted ? 1 : 0,
          transform: shake
            ? undefined
            : (mounted ? 'translateY(0)' : 'translateY(12px)'),
          transition: 'opacity .42s ease, transform .42s cubic-bezier(0.25,1,0.5,1)',
          animation: shake ? 'pin-shake .42s' : 'none',
        }}
      >
        {/* ── Header (welcome) ───────────────────────────────────────────── */}
        <div
          style={{
            padding: `clamp(20px, 4.5vw, 26px) ${cardPadX} clamp(18px, 4vw, 22px)`,
            background: 'linear-gradient(180deg, #2a201a 0%, #1d1612 100%)',
            color: 'var(--cream, #fbf7ee)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              marginBottom: 10,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 36, height: 36, borderRadius: 9,
                background: 'var(--terracotta-500, #c8613a)', color: '#fff',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 19,
                boxShadow: '0 2px 6px rgba(0,0,0,.18)',
              }}
            >N</span>
            <span
              style={{
                fontSize: 11, fontWeight: 700, letterSpacing: .12,
                textTransform: 'uppercase', opacity: .68,
              }}
            >NCR Reserves</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontWeight: 500,
              fontSize: headFont,
              lineHeight: 1.15,
              letterSpacing: -.005,
            }}
          >
            Benvingut/da
          </h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 'clamp(12.5px, 2.6vw, 13.5px)',
              color: 'rgba(251,247,238,.72)',
              lineHeight: 1.45,
            }}
          >
            Introdueix el PIN per continuar
          </p>
        </div>

        {/* ── PIN dots ───────────────────────────────────────────────────── */}
        <div
          aria-live="polite"
          style={{
            padding: 'clamp(20px, 4vw, 26px) 16px 4px',
            display: 'flex', justifyContent: 'center', gap: dotGap,
          }}
        >
          {[0, 1, 2, 3].map(i => (
            <span
              key={i}
              style={{
                width: dotSize, height: `calc(${dotSize} * 1.18)`,
                borderRadius: 12,
                background: 'var(--cream, #fdf9f2)',
                border: pin.length === i
                  ? '2px solid var(--terracotta-500, #c8613a)'
                  : '1.5px solid rgba(60,40,20,.13)',
                boxShadow: pin.length === i
                  ? '0 0 0 4px rgba(200,97,58,.10)'
                  : 'inset 0 1px 0 rgba(60,40,20,.04)',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(26px, 7vw, 32px)', fontWeight: 600,
                color: 'var(--ink-900, #1d1612)',
                transition: 'border-color .18s, box-shadow .18s',
              }}
            >
              {pin[i] ? '●' : ''}
            </span>
          ))}
        </div>

        {/* ── Status / error (neutral, never alarming) ──────────────────── */}
        <div
          style={{
            minHeight: 30, padding: '6px 24px 0',
            textAlign: 'center',
            fontSize: 'clamp(12px, 2.8vw, 13px)',
            color: error
              ? 'var(--terracotta-700, #923c1f)'
              : 'var(--ink-500, #7a6a5a)',
            fontWeight: error ? 500 : 400,
            transition: 'color .15s',
          }}
        >
          {error || (busy ? 'Verificant…' : ' ')}
        </div>

        {/* ── Keypad ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'clamp(8px, 2vw, 12px)',
            padding: `8px ${cardPadX} clamp(18px, 4vw, 24px)`,
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((n, i) => {
            if (n === null) return <span key={i} aria-hidden="true" />;
            const isDel = n === 'del';
            return (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => isDel ? backspace() : press(String(n))}
                aria-label={isDel ? 'Esborrar' : `Tecla ${n}`}
                style={{
                  padding: `${keyPadV} 0`,
                  background: 'var(--cream, #fdf9f2)',
                  border: '1.5px solid rgba(60,40,20,.10)',
                  borderRadius: 14,
                  fontFamily: 'var(--font-serif)',
                  fontSize: isDel ? 'clamp(18px, 4.6vw, 22px)' : keyFont,
                  fontWeight: 500,
                  color: 'var(--ink-900, #1d1612)',
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? .65 : 1,
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  // Modest press feedback — restraint per design system.
                  transition: 'transform .08s ease, background .15s, box-shadow .15s',
                  boxShadow: '0 1px 0 rgba(60,40,20,.04)',
                  touchAction: 'manipulation',
                }}
                onMouseEnter={e => {
                  if (busy) return;
                  (e.currentTarget as HTMLButtonElement).style.background = '#f9f1e0';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--cream, #fdf9f2)';
                }}
                onPointerDown={e => {
                  if (busy) return;
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)';
                }}
                onPointerUp={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
                onPointerLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
              >
                {isDel ? '⌫' : n}
              </button>
            );
          })}
        </div>

        {/* ── Footer hint ────────────────────────────────────────────────── */}
        <div
          style={{
            padding: `2px ${cardPadX} clamp(18px, 4vw, 22px)`,
            textAlign: 'center',
            fontSize: 'clamp(10.5px, 2.4vw, 11.5px)',
            color: 'var(--ink-400, #9a8a7a)',
            letterSpacing: .04,
            lineHeight: 1.5,
          }}
        >
          {labels.length > 0 && (
            <>
              PINs disponibles:{' '}
              <span style={{ color: 'var(--ink-600, #5a4a3a)', fontWeight: 500 }}>
                {labels.join(' · ')}
              </span>
              <br />
            </>
          )}
          Si t'equivoques no passa res — torna a teclejar.
        </div>
      </div>

      <style>{`
        @keyframes pin-shake {
          0%, 100%   { transform: translateX(0); }
          15%, 75%   { transform: translateX(-6px); }
          35%, 55%   { transform: translateX(6px); }
        }
        @media (min-width: 900px) {
          /* Slightly tighter on desktop so the card never feels gigantic. */
          [role="dialog"] { max-width: 420px; }
        }
        @media (hover: none) and (pointer: coarse) {
          /* Mobile/tablet: drop the hover background swap so a tap doesn't
             leave a sticky highlight. */
          [role="dialog"] button:hover { background: var(--cream, #fdf9f2) !important; }
        }
      `}</style>
    </div>
  );
}
