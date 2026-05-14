/**
 * PIN setup — first-time configuration of the 4 local PINs.
 *
 * Steps (sequential):
 *   1. PIN for El Ganxo (4 digits, confirm)
 *   2. PIN for La Pista (4 digits, confirm)
 *   3. PIN for L'Esquitx (4 digits, confirm)
 *   4. Admin PIN (4 digits, confirm)
 *
 * Validation:
 *   • Each PIN must be 4 digits.
 *   • PINs must differ from each other (otherwise lock-time matching
 *     becomes ambiguous and a single physical PIN unlocks multiple
 *     scopes).
 *   • Trivially weak PINs (0000, 1111, 1234, 4321) are refused.
 *
 * After all 4 are set the config is persisted to localStorage (PBKDF2-
 * SHA256 hashed) and the parent re-evaluates so the lock screen appears.
 */
import React, { useState } from 'react';
import type { BusinessId } from '@/types';
import {
  buildEntry, findCollision, isValidPin,
  savePinConfig, type PinEntry, type PinConfig,
} from '@/lib/pinAuth';

interface StepConfig {
  label: string;
  scope: BusinessId[];
}

const STEPS: StepConfig[] = [
  { label: 'El Ganxo',  scope: ['ganxo']                          },
  { label: 'La Pista',  scope: ['pista']                          },
  { label: "L'Esquitx", scope: ['esquitx']                        },
  { label: 'Admin',     scope: ['ganxo', 'pista', 'esquitx']      },
];

const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555',
  '6666', '7777', '8888', '9999', '1234', '4321',
  '1212', '2121', '0123', '9876',
]);

interface Props {
  onComplete: () => void;
}

export default function PinSetupView({ onComplete }: Props) {
  const [stepIdx,  setStepIdx]  = useState(0);
  const [phase,    setPhase]    = useState<'enter' | 'confirm'>('enter');
  const [pin,      setPin]      = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [entries,  setEntries]  = useState<PinEntry[]>([]);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);

  const step = STEPS[stepIdx];

  // ── Keypad input handlers ──────────────────────────────────────────────────
  function press(digit: string) {
    setError(null);
    if (phase === 'enter') {
      setPin(p => (p + digit).slice(0, 4));
    } else {
      setConfirmPin(p => (p + digit).slice(0, 4));
    }
  }
  function backspace() {
    setError(null);
    if (phase === 'enter')   setPin(p => p.slice(0, -1));
    else                     setConfirmPin(p => p.slice(0, -1));
  }

  // ── Step advancement ───────────────────────────────────────────────────────
  async function commitStep() {
    if (!isValidPin(pin) || !isValidPin(confirmPin)) {
      setError('Has d\'introduir 4 dígits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('Les dues entrades no coincideixen.');
      setConfirmPin('');
      setPhase('enter');
      setPin('');
      return;
    }
    if (WEAK_PINS.has(pin)) {
      setError('PIN massa fàcil. Tria una combinació menys evident.');
      setConfirmPin('');
      setPhase('enter');
      setPin('');
      return;
    }
    // Refuse duplicates across scopes — otherwise the lock screen would
    // be ambiguous about which scope the PIN unlocks.
    const collisionIdx = await findCollision(pin, entries);
    if (collisionIdx !== -1) {
      setError(`Aquest PIN ja l'has utilitzat per "${entries[collisionIdx].label}". Tria'n un altre.`);
      setConfirmPin('');
      setPhase('enter');
      setPin('');
      return;
    }

    setSaving(true);
    const newEntry = await buildEntry(step.label, step.scope, pin);
    const nextEntries = [...entries, newEntry];
    setEntries(nextEntries);
    setPin('');
    setConfirmPin('');
    setSaving(false);

    if (stepIdx + 1 < STEPS.length) {
      setStepIdx(stepIdx + 1);
      setPhase('enter');
    } else {
      // All 4 done — persist and exit.
      const cfg: PinConfig = { version: 1, pins: nextEntries };
      savePinConfig(cfg);
      onComplete();
    }
  }

  // Auto-advance from "enter" → "confirm" when 4 digits typed
  React.useEffect(() => {
    if (phase === 'enter' && pin.length === 4) {
      setPhase('confirm');
    }
  }, [phase, pin]);

  // Auto-commit when confirm reaches 4 digits
  React.useEffect(() => {
    if (phase === 'confirm' && confirmPin.length === 4 && !saving) {
      commitStep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin, phase]);

  const activePin = phase === 'enter' ? pin : confirmPin;

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #f5e9d6 0%, #ebe5d8 60%, #ddd4c2 100%)',
      display: 'grid', placeItems: 'center', padding: 24,
      fontFamily: 'var(--font-sans, system-ui)',
    }}>
      <div style={{
        width: 420, maxWidth: '100%',
        background: 'var(--paper, #fbf7ee)',
        borderRadius: 18,
        boxShadow: '0 24px 60px rgba(60,40,20,.18), 0 4px 12px rgba(60,40,20,.08)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px 18px',
          background: 'linear-gradient(180deg, #2a201a 0%, #1d1612 100%)',
          color: 'var(--cream, #fbf7ee)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .08, textTransform: 'uppercase', opacity: .65 }}>
            Configuració inicial · pas {stepIdx + 1} de {STEPS.length}
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
            marginTop: 4,
          }}>
            PIN per a {step.label}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 4, opacity: .75 }}>
            {phase === 'enter'
              ? 'Introdueix un PIN de 4 dígits.'
              : 'Repeteix el PIN per confirmar-lo.'}
          </div>
        </div>

        {/* PIN display */}
        <div style={{ padding: '24px 24px 6px', display: 'flex', justifyContent: 'center', gap: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <span key={i} style={{
              width: 44, height: 52, borderRadius: 10,
              background: 'var(--cream, #fdf9f2)',
              border: activePin.length === i
                ? '2px solid var(--terracotta-500, #c8613a)'
                : '1.5px solid rgba(60,40,20,.12)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 600,
              color: 'var(--ink-900, #1d1612)',
            }}>
              {activePin[i] ? '●' : ''}
            </span>
          ))}
        </div>

        {/* Error */}
        <div style={{
          minHeight: 28, padding: '4px 24px 0',
          textAlign: 'center', fontSize: 12.5,
          color: error ? 'var(--terracotta-700, #923c1f)' : 'transparent',
        }}>
          {error || ' '}
        </div>

        {/* Numpad */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: 8, padding: '6px 28px 22px',
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((n, i) => {
            if (n === null) return <span key={i} />;
            const isDel = n === 'del';
            return (
              <button
                key={i}
                disabled={saving}
                onClick={() => isDel ? backspace() : press(String(n))}
                style={{
                  padding: '14px 0',
                  background: 'var(--cream, #fdf9f2)',
                  border: '1.5px solid rgba(60,40,20,.1)',
                  borderRadius: 11,
                  fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
                  color: 'var(--ink-900, #1d1612)',
                  cursor: saving ? 'wait' : 'pointer',
                  userSelect: 'none',
                }}
              >
                {isDel ? '⌫' : n}
              </button>
            );
          })}
        </div>

        {/* Progress chips */}
        <div style={{
          padding: '0 24px 18px',
          display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          {STEPS.map((s, i) => (
            <span key={s.label} style={{
              padding: '4px 10px', borderRadius: 999,
              fontSize: 10.5, fontWeight: 600,
              background: i < stepIdx ? 'var(--olive-100, #d4dfa8)'
                        : i === stepIdx ? 'var(--terracotta-100, #f7d8c8)'
                        : 'var(--ink-50, rgba(60,40,20,.05))',
              color:      i < stepIdx ? 'var(--olive-700, #3d5022)'
                        : i === stepIdx ? 'var(--terracotta-700, #923c1f)'
                        : 'var(--ink-500, #7a6a5a)',
            }}>
              {i < stepIdx ? '✓ ' : ''}{s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
