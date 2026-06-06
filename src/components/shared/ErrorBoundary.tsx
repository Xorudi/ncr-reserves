/**
 * ErrorBoundary — last line of defence against a white screen.
 *
 * A render/runtime error anywhere below this boundary is caught here and
 * replaced with a calm, on-brand recovery screen instead of an unmounted
 * (blank) DOM. Critical for a restaurant tool: an operator mid-service must
 * never be left staring at a white page with no way forward.
 *
 * Data safety: all app state is persisted to localStorage and Supabase, so
 * a reload recovers the full session. The "Recarrega" button does a hard
 * reload; "Reinicia l'app" additionally clears only the volatile UI flags
 * (never the data) in case a corrupt transient value caused the crash.
 *
 * The error is logged to the console (always — a crash is actionable, not
 * noise) with a stack so it can be diagnosed from DevTools after the fact.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Always log — a crash is actionable, not noise. Bypasses the perf gate.
    // eslint-disable-next-line no-console
    console.error('[NCR crash]', error, info);
  }

  private handleReload = () => {
    try { window.location.reload(); } catch { /* ignore */ }
  };

  private handleSoftReset = () => {
    // Clear ONLY volatile UI flags that could re-trigger the crash on reload.
    // Never touch the data keys (reservations/customers live in
    // `ncr-reserves-storage`, session in `ncr-reserves-auth`).
    try {
      localStorage.removeItem('NCR_DEBUG_PERF');
      localStorage.removeItem('ncr.debug');
    } catch { /* ignore */ }
    this.handleReload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          position: 'fixed', inset: 0,
          display: 'grid', placeItems: 'center',
          padding: 24,
          background: 'radial-gradient(ellipse at top, #f5e9d6 0%, #ebe5d8 60%, #ddd4c2 100%)',
          fontFamily: 'Inter Tight, system-ui, sans-serif',
          color: '#3a2e24',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 380, width: '100%' }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 20px',
            borderRadius: 16, display: 'grid', placeItems: 'center',
            background: 'linear-gradient(180deg, #e09454, #d4843d)',
            color: '#2a1a0e', fontSize: 28, fontWeight: 800,
            boxShadow: '0 10px 24px -8px rgba(60,40,20,.35)',
          }}>!</div>

          <h1 style={{
            margin: '0 0 8px', fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 24, fontWeight: 500,
          }}>
            Alguna cosa ha fallat
          </h1>
          <p style={{ margin: '0 0 22px', fontSize: 14, lineHeight: 1.5, color: '#766251' }}>
            Les teves dades estan segures. Recarrega per continuar el servei.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: 'white',
                background: '#c8613a',
              }}
            >
              Recarrega
            </button>
            <button
              onClick={this.handleSoftReset}
              style={{
                padding: '12px', borderRadius: 12, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                color: '#766251', background: 'transparent',
                border: '1px solid rgba(60,40,20,.18)',
              }}
            >
              Reinicia l'app
            </button>
          </div>

          {this.state.message && (
            <p style={{
              margin: '20px 0 0', fontSize: 11, color: '#9a866f',
              fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-word',
            }}>
              {this.state.message.slice(0, 160)}
            </p>
          )}
        </div>
      </div>
    );
  }
}
