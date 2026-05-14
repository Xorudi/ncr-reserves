/**
 * Sign-in view — Supabase device login.
 *
 * Responsive via clamp(); same visual system as PinLockView so the two
 * screens feel like one. Card capped at 420 px on desktop, fills width
 * on mobile with safe-area padding.
 *
 * Inputs use `width: 100%; min-width: 0; box-sizing: border-box` so
 * iOS Safari's intrinsic `size=20` on `<input type="email/password">`
 * cannot push the card past the viewport.
 */
import React, { useEffect, useState } from 'react';
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
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
    <div className="sign-in-wrap">
      <form
        className={`sign-in ${mounted ? 'sign-in--in' : ''}`}
        onSubmit={handleSubmit}
        autoComplete="on"
        aria-label="Accés del dispositiu"
      >
        {/* Header */}
        <header className="sign-in__header">
          <span className="sign-in__monogram" aria-hidden="true">N</span>
          <div className="sign-in__brand">
            <span className="sign-in__title">NCR Reserves</span>
            <span className="sign-in__subtitle">Accés del dispositiu</span>
          </div>
        </header>

        {/* Body */}
        <div className="sign-in__body">
          <label className="sign-in__field">
            <span className="sign-in__label">Email del dispositiu</span>
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
              className="sign-in__input"
            />
          </label>

          <label className="sign-in__field">
            <span className="sign-in__label">Contrasenya</span>
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
              className="sign-in__input"
            />
          </label>

          {error && (
            <div className="sign-in__error" role="alert">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="sign-in__submit"
          >
            {busy ? 'Entrant…' : 'Entrar'}
          </button>

          <p className="sign-in__hint">
            Aquesta sessió quedarà recordada en aquest dispositiu. Si comparteixes
            l'iPad amb un altre local, tanca la sessió des de <em>Més → Sortir</em>
            abans d'entregar-lo.
          </p>
        </div>
      </form>

      <style>{`
        :where(.sign-in-wrap) {
          --ease-out:  cubic-bezier(0.23, 1, 0.32, 1);
          --paper:     var(--paper,        #fbf7ee);
          --cream:     var(--cream,        #fdf9f2);
          --ink-900:   var(--ink-900,      #1d1612);
          --ink-700:   var(--ink-700,      #3a2a1f);
          --ink-600:   var(--ink-600,      #5a4a3a);
          --ink-500:   var(--ink-500,      #7a6a5a);
          --terra-500: var(--terracotta-500, #c8613a);
          --terra-600: var(--terracotta-600, #a8502f);
          --terra-700: var(--terracotta-700, #923c1f);
        }

        .sign-in-wrap {
          position: fixed; inset: 0;
          display: grid; place-items: center;
          padding:
            max(20px, env(safe-area-inset-top))
            16px
            max(20px, env(safe-area-inset-bottom));
          overflow: auto;
          background: radial-gradient(ellipse at top, #f5e9d6 0%, #ebe5d8 55%, #ddd4c2 100%);
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
        }

        /* Form card — fluid width, capped on desktop. */
        .sign-in {
          width: 100%;
          max-width: 440px;
          background: var(--paper);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 28px 72px rgba(60,40,20,.18), 0 6px 18px rgba(60,40,20,.08);
          box-sizing: border-box;

          /* Entrance */
          opacity: 0;
          transform: translateY(8px);
          transition:
            opacity 320ms var(--ease-out),
            transform 320ms var(--ease-out);
        }
        .sign-in--in {
          opacity: 1;
          transform: translateY(0);
        }
        @media (min-width: 900px) {
          .sign-in { max-width: 420px; }
        }

        /* Header */
        .sign-in__header {
          padding: clamp(22px, 4.5vw, 28px) clamp(20px, 5vw, 28px) clamp(18px, 4vw, 22px);
          background: linear-gradient(180deg, #2a201a 0%, #1d1612 100%);
          color: var(--cream);
          display: flex; align-items: center; gap: 12px;
        }
        .sign-in__monogram {
          flex: none;
          width: 40px; height: 40px;
          border-radius: 9px;
          background: var(--terra-500); color: #fff;
          display: grid; place-items: center;
          font-family: var(--font-serif);
          font-weight: 500;
          font-size: 20px;
          box-shadow: 0 2px 6px rgba(0,0,0,.18);
        }
        .sign-in__brand {
          display: flex; flex-direction: column;
          line-height: 1.15;
          min-width: 0;
        }
        .sign-in__title {
          font-family: var(--font-serif);
          font-size: clamp(18px, 4vw, 22px);
          font-weight: 500;
        }
        .sign-in__subtitle {
          font-size: clamp(11.5px, 2.6vw, 12.5px);
          color: rgba(251,247,238,.7);
          margin-top: 2px;
        }

        /* Body */
        .sign-in__body {
          padding: clamp(20px, 4.5vw, 26px) clamp(20px, 5vw, 28px) clamp(20px, 4.5vw, 24px);
          display: flex; flex-direction: column;
          gap: 14px;
        }
        .sign-in__field {
          display: flex; flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .sign-in__label {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-700);
        }

        /* The key fix: inputs were overflowing the card on iPhone because
           iOS Safari gives <input> an intrinsic size of 20 chars, and
           min-width: auto refuses to shrink below that. width: 100% +
           min-width: 0 + box-sizing: border-box keeps them inside. */
        .sign-in__input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 11px 12px;
          border-radius: 10px;
          border: 1.5px solid rgba(60,40,20,.15);
          background: var(--cream);
          font-size: 16px;             /* iOS won't auto-zoom on focus when ≥16 px */
          font-family: inherit;
          color: var(--ink-900);
          outline: none;
          transition:
            border-color 160ms var(--ease-out),
            box-shadow 160ms var(--ease-out);
          -webkit-appearance: none;
        }
        .sign-in__input:focus-visible {
          border-color: var(--terra-500);
          box-shadow: 0 0 0 4px rgba(200, 97, 58, .14);
        }
        .sign-in__input:disabled {
          opacity: .65;
        }

        .sign-in__error {
          padding: 9px 12px;
          border-radius: 9px;
          background: rgba(200, 80, 60, .08);
          color: var(--terra-700);
          font-size: 13px;
          line-height: 1.4;
        }

        .sign-in__submit {
          margin-top: 4px;
          padding: 13px 0;
          border: none;
          border-radius: 12px;
          background: var(--terra-600);
          color: #fff;
          font-family: inherit;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          box-shadow: 0 1px 0 rgba(60,40,20,.04);
          transition:
            transform 140ms var(--ease-out),
            background-color 160ms var(--ease-out),
            opacity 160ms var(--ease-out);
        }
        .sign-in__submit:disabled {
          opacity: .55;
          cursor: not-allowed;
        }
        .sign-in__submit:active:not(:disabled) {
          transition: none;
          transform: scale(0.985);
          background-color: #9b482a;
        }
        .sign-in__submit:focus-visible {
          outline: 2px solid var(--terra-500);
          outline-offset: 2px;
        }
        @media (hover: hover) and (pointer: fine) {
          .sign-in__submit:not(:disabled):hover {
            background-color: #9b482a;
          }
        }

        .sign-in__hint {
          margin: 4px 0 0;
          padding: 10px 12px;
          background: rgba(60,40,20,.04);
          border-radius: 9px;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--ink-600);
        }

        @media (prefers-reduced-motion: reduce) {
          .sign-in,
          .sign-in__submit {
            transform: none !important;
            transition: opacity 200ms ease, background-color 200ms ease;
          }
          .sign-in--in { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
