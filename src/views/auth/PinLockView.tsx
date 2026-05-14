/**
 * PIN lock screen — gates the app after the Supabase device login.
 *
 * Behaviour:
 *   • 4-digit keypad (matches the existing in-app PIN aesthetic).
 *   • On every 4th digit, the input is verified against ALL stored PIN
 *     hashes (constant-time wrt which PIN matches).
 *   • Wrong PIN → shake animation + clear input + neutral retry message.
 *   • No lockouts, no attempt counters. A mistyped PIN is a non-event —
 *     the screen just asks for the PIN again. The real cryptographic
 *     gate is Supabase Auth; the PIN is only a local convenience lock,
 *     so making it scary about mistakes would only hurt staff UX.
 *
 * Persistence: NONE. A page reload always returns here.
 */
import React, { useEffect, useRef, useState } from 'react';
import { verifyPin, loadPinConfig } from '@/lib/pinAuth';
import { usePinScope } from '@/store/usePinScope';

export default function PinLockView() {
  const [pin,    setPin]    = useState('');
  const [error,  setError]  = useState<string | null>(null);
  const [shake,  setShake]  = useState(false);
  const [busy,   setBusy]   = useState(false);
  const verifying = useRef(false);

  const unlock = usePinScope(s => s.unlock);
  const labels = (loadPinConfig()?.pins ?? []).map(p => p.label);

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

  // Auto-verify when 4 digits typed
  useEffect(() => {
    if (pin.length !== 4 || verifying.current) return;
    verifying.current = true;
    setBusy(true);

    verifyPin(pin).then(match => {
      verifying.current = false;
      setBusy(false);
      if (match) {
        // Success — unlock the session.
        unlock(match.label, match.scope);
      } else {
        // Wrong PIN: gentle shake + clear input. No counters, no lockout.
        // A mistype should feel like nothing happened — the app simply
        // doesn't open until the PIN is right.
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setPin('');
        setError('Aquest PIN no coincideix. Torna-ho a provar.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #f5e9d6 0%, #ebe5d8 60%, #ddd4c2 100%)',
      display: 'grid', placeItems: 'center', padding: 24,
      fontFamily: 'var(--font-sans, system-ui)',
    }}>
      <div
        style={{
          width: 380, maxWidth: '100%',
          background: 'var(--paper, #fbf7ee)',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(60,40,20,.18), 0 4px 12px rgba(60,40,20,.08)',
          overflow: 'hidden',
          transform: shake ? 'translateX(-4px)' : 'none',
          animation: shake ? 'pin-shake .4s' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(180deg, #2a201a 0%, #1d1612 100%)',
          color: 'var(--cream, #fbf7ee)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .08, textTransform: 'uppercase', opacity: .65 }}>
            NCR Reserves
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500,
            marginTop: 2,
          }}>
            Introdueix el teu PIN
          </div>
        </div>

        {/* PIN display */}
        <div style={{
          padding: '24px 24px 6px',
          display: 'flex', justifyContent: 'center', gap: 10,
        }}>
          {[0, 1, 2, 3].map(i => (
            <span key={i} style={{
              width: 44, height: 52, borderRadius: 10,
              background: 'var(--cream, #fdf9f2)',
              border: pin.length === i
                ? '2px solid var(--terracotta-500, #c8613a)'
                : '1.5px solid rgba(60,40,20,.12)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 600,
              color: 'var(--ink-900, #1d1612)',
            }}>
              {pin[i] ? '●' : ''}
            </span>
          ))}
        </div>

        {/* Status / error — neutral wording, never alarming */}
        <div style={{
          minHeight: 28, padding: '4px 24px 0',
          textAlign: 'center', fontSize: 12.5,
          color: error ? 'var(--ink-600, #5a4a3a)' : 'var(--ink-500, #7a6a5a)',
        }}>
          {error || (busy ? 'Verificant…' : ' ')}
        </div>

        {/* Numpad */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: 8, padding: '6px 28px 18px',
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((n, i) => {
            if (n === null) return <span key={i} />;
            const isDel = n === 'del';
            return (
              <button
                key={i}
                disabled={busy}
                onClick={() => isDel ? backspace() : press(String(n))}
                style={{
                  padding: '14px 0',
                  background: 'var(--cream, #fdf9f2)',
                  border: '1.5px solid rgba(60,40,20,.1)',
                  borderRadius: 11,
                  fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
                  color: 'var(--ink-900, #1d1612)',
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? .65 : 1,
                  userSelect: 'none',
                  transition: 'opacity .15s',
                }}
              >
                {isDel ? '⌫' : n}
              </button>
            );
          })}
        </div>

        {/* Hint — reassures staff that mistyping is harmless */}
        <div style={{
          padding: '2px 24px 16px',
          textAlign: 'center', fontSize: 10.5,
          color: 'var(--ink-400, #9a8a7a)',
          letterSpacing: .04, lineHeight: 1.45,
        }}>
          {labels.length > 0 && <>PINs disponibles: {labels.join(' · ')}<br /></>}
          Si t'equivoques no passa res — torna a teclejar.
        </div>
      </div>

      <style>{`
        @keyframes pin-shake {
          0%, 100%   { transform: translateX(0); }
          15%, 75%   { transform: translateX(-6px); }
          35%, 55%   { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
