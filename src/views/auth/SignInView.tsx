/**
 * Sign-in view — one credential per device/venue.
 *
 * This is the *real* authentication gate (vs. the decorative PIN flow in
 * views/desktop/LoginView.tsx which still exists for in-shift staff
 * attribution). After a successful sign-in the Supabase SDK persists the
 * session, so the user only sees this screen on first launch (or after an
 * explicit log-out).
 */
import React, { useState } from 'react';
import { signIn } from '@/lib/auth';

interface Props {
  /** Called after a successful sign-in. Parent re-evaluates the session. */
  onSignedIn: () => void;
}

export default function SignInView({ onSignedIn }: Props) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onSignedIn();
  }

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #f5e9d6 0%, #ebe5d8 60%, #ddd4c2 100%)',
      display: 'grid', placeItems: 'center', padding: 24,
      fontFamily: 'var(--font-sans, system-ui)',
    }}>
      <form
        onSubmit={handleSubmit}
        autoComplete="on"
        style={{
          width: 420, maxWidth: '100%',
          background: 'var(--paper, #fbf7ee)',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(60,40,20,.18), 0 4px 12px rgba(60,40,20,.08)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          background: 'linear-gradient(180deg, #2a201a 0%, #1d1612 100%)',
          color: 'var(--cream, #fbf7ee)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: 'var(--terracotta-500, #c8613a)', color: '#fff',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 20,
          }}>N</div>
          <div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500,
              lineHeight: 1.1,
            }}>NCR Reserves</div>
            <div style={{
              fontSize: 12, color: 'rgba(251,247,238,.7)', marginTop: 2,
            }}>Accés del dispositiu</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700,#3a2a1f)' }}>Email del dispositiu</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              maxLength={320}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
              style={{
                padding: '10px 12px', borderRadius: 9,
                border: '1.5px solid rgba(60,40,20,.15)',
                background: 'var(--cream,#fdf9f2)', fontSize: 14,
                fontFamily: 'inherit', color: 'var(--ink-900,#1d1612)',
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700,#3a2a1f)' }}>Contrasenya</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              minLength={8}
              maxLength={200}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy}
              style={{
                padding: '10px 12px', borderRadius: 9,
                border: '1.5px solid rgba(60,40,20,.15)',
                background: 'var(--cream,#fdf9f2)', fontSize: 14,
                fontFamily: 'inherit', color: 'var(--ink-900,#1d1612)',
                outline: 'none',
              }}
            />
          </label>

          {error && (
            <div role="alert" style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(200,80,60,.08)',
              color: 'var(--terracotta-700,#923c1f)',
              fontSize: 13,
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            style={{
              marginTop: 4, padding: 12,
              background: 'var(--terracotta-600,#a8502f)', color: '#fff',
              border: 'none', borderRadius: 11, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              opacity: (busy || !email || !password) ? .55 : 1,
              transition: 'opacity .12s',
            }}
          >
            {busy ? 'Entrant…' : 'Entrar'}
          </button>

          <div style={{
            marginTop: 6, padding: '10px 12px',
            background: 'var(--ink-50, rgba(60,40,20,.04))',
            borderRadius: 8, fontSize: 11.5,
            color: 'var(--ink-600,#5a4a3a)', lineHeight: 1.45,
          }}>
            Aquesta sessió quedarà recordada en aquest dispositiu. Si comparteixes l'iPad amb un altre local, tanca la sessió des de <em>Més → Sortir</em> abans d'entregar-lo.
          </div>
        </div>
      </form>
    </div>
  );
}
