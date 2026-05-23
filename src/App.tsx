import React, { useEffect, useState } from 'react';
import TouchShell   from '@/views/touch/TouchShell';
import SignInView    from '@/views/auth/SignInView';
import PinSetupView  from '@/views/auth/PinSetupView';
import PinLockView   from '@/views/auth/PinLockView';
// Lazy-load the layout debug overlay so it only ships JS to clients that
// actually visit /?debug=1 (or have ncr.debug=1 in localStorage). Keeps
// the prod bundle clean while leaving the audit tool one URL away.
const MobileLayoutDebug = React.lazy(() =>
  import('@/components/shared/MobileLayoutDebug')
);
function debugRequested(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.search.includes('debug=1')) return true;
  try { return localStorage.getItem('ncr.debug') === '1'; } catch { return false; }
}
import { startBackupScheduler } from '@/backup/backupScheduler';
import { useBackupStore } from '@/backup/useBackupStore';
import {
  bootstrapFromCloud,
  subscribeRealtime,
  watchConnectivity,
} from '@/lib/cloudSync';
import { isAuthRequired } from '@/lib/supabase';
import {
  getSession, refreshSession, onAuthChange,
} from '@/lib/auth';
import type { AuthState } from '@/lib/auth';
import { shouldProcessAuthSession } from '@/lib/cloudSync';
import { isPinConfigured } from '@/lib/pinAuth';
import { usePinScope } from '@/store/usePinScope';
import { useAppStore } from '@/store/useAppStore';
import type { BusinessId } from '@/types';
import { SUPABASE_AUTH_ENABLED } from '@/lib/featureFlags';

/* ── Auth logging ─────────────────────────────────────────────────────────────
 * Visible in production too — these events are rare and crucial for
 * diagnosing why a device might bounce to the login screen. Tag every
 * line with `[ncr-auth]` so they're easy to grep in DevTools console.
 */
// Gated auth logger — silent in production unless the operator turned
// on profiling via /?debugPerf=1 or localStorage NCR_DEBUG_PERF=true.
// In dev it stays loud so we can see the auth state machine evolve.
function authDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('NCR_DEBUG_PERF') === 'true') return true;
    if (localStorage.getItem('NCR_DEBUG_AUTH') === 'true') return true;
  } catch { /* ignore */ }
  try {
    const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
    if (isDev) return true;
  } catch { /* ignore */ }
  return false;
}
const AUTH_LOG = authDebugEnabled();
const alog = AUTH_LOG
  // eslint-disable-next-line no-console
  ? (...args: unknown[]) => console.info('[ncr-auth]', ...args)
  : () => { /* silenced in production */ };

/**
 * Root router with a 3-layer gate:
 *
 *   1. Supabase Auth (cryptographic, device-level)
 *      → SignInView only when we are SURE there's no recoverable session
 *   2. PIN config (one-time per device)
 *      → PinSetupView until the 4 local PINs are configured
 *   3. PIN unlock (every page load / after manual lock)
 *      → PinLockView until a valid PIN is entered
 *
 * Auth-gate resilience (the important part):
 *
 *   • On mount we OPTIMISTICALLY check getSession() first. If it returns
 *     anything, we go signed-in immediately.
 *   • If getSession() is null we attempt refreshSession() before giving
 *     up. This recovers from cases where the access_token expired while
 *     the device was sleeping but the refresh_token is still valid.
 *   • When the SDK emits SIGNED_OUT, we DO NOT bounce to login unless:
 *       a) the user explicitly clicked "Sortir" (we listen for our own
 *          `ncr:manual-signout` window event dispatched by lib/auth.ts),
 *       b) OR a follow-up refreshSession() also fails (i.e. the token
 *          is genuinely invalid, not a network blip).
 *   • Going offline never kicks the user out. Cached session stays.
 */
export default function App() {
  const [auth, setAuth] = useState<AuthState>(() =>
    SUPABASE_AUTH_ENABLED && isAuthRequired()
      ? { status: 'loading' }
      : { status: 'unconfigured' }
  );

  const unlockedBizIds = usePinScope(s => s.unlockedBizIds);
  // PIN is always required (defaults are baked into pinAuth.ts).
  const [pinConfigured, setPinConfigured] = useState<boolean>(isPinConfigured);

  // ── Auth bootstrap + subscription ──────────────────────────────────────────
  useEffect(() => {
    if (!SUPABASE_AUTH_ENABLED || !isAuthRequired()) {
      alog('Supabase auth gate disabled — running offline-mode shell');
      return;
    }

    let cancelled       = false;
    // Set to true synchronously when the user clicks "Sortir" via signOut().
    // Used to distinguish a deliberate sign-out from an SDK-emitted
    // SIGNED_OUT caused by a refresh failure.
    let manualSignOut   = false;

    function applySession(session: import('@supabase/supabase-js').Session) {
      // Dedupe: Supabase commonly echoes SIGNED_IN multiple times for the
      // same underlying session (initial restore, token refresh re-emit,
      // visibility-change re-emit). Without this guard the heavy
      // setAuth() → app re-render fires every echo, which the user saw
      // as repeated "[CloudSync] Pushing 120 tableIds" lines.
      if (!shouldProcessAuthSession(session.user.id, session.expires_at ?? null)) {
        alog('signed-in (dedup skip — same user/expiry as last event)');
        return;
      }
      const bizIds = extractBizIdsSafe(session);
      alog('signed-in', {
        user_id:   session.user.id,
        email:     session.user.email,
        biz_ids:   bizIds,
        expires_at: session.expires_at,
      });
      setAuth({ status: 'signed-in', session, bizIds });
    }

    function applySignedOut(reason: string) {
      alog('signed-out reason:', reason);
      usePinScope.getState().lock();
      setPinConfigured(isPinConfigured());
      setAuth({ status: 'signed-out' });
    }

    /**
     * Initial-load resolver. Prefers the cached session; falls back to
     * refresh; only signs out as a last resort.
     */
    async function bootstrap() {
      alog('bootstrap: looking for cached session…');
      let session = await getSession();

      if (session) {
        alog('bootstrap: found cached session, expires_at', session.expires_at);
        const nowSec = Math.floor(Date.now() / 1000);
        const expired = !!session.expires_at && session.expires_at <= nowSec;
        if (expired) {
          alog('bootstrap: cached session expired; attempting refresh');
          const refreshed = await refreshSession();
          if (refreshed) {
            alog('bootstrap: refresh OK');
            session = refreshed;
          } else if (!navigator.onLine) {
            alog('bootstrap: offline + refresh failed; keeping cached session optimistically');
            // Stay signed-in with the expired session; the SDK will retry
            // when the network returns. RLS will reject queries until
            // then, but the user keeps their app shell open.
          } else {
            alog('bootstrap: online + refresh failed for expired session; signing out');
            if (!cancelled) applySignedOut('expired-and-refresh-failed');
            return;
          }
        }
        if (!cancelled && session) applySession(session);
        return;
      }

      // No cached session — but maybe a refresh_token is still around.
      alog('bootstrap: no cached session; trying refresh as last resort');
      const recovered = await refreshSession();
      if (recovered) {
        alog('bootstrap: recovered session via refresh');
        if (!cancelled) applySession(recovered);
        return;
      }

      // Truly nothing. If offline, keep showing the loading state so a
      // mid-trip iPad doesn't see the login screen for a momentary blip.
      if (!navigator.onLine) {
        alog('bootstrap: offline and no session at all; staying in loading until back online');
        // We'll re-bootstrap on the `online` event below.
        return;
      }

      if (!cancelled) applySignedOut('no-session-and-refresh-failed');
    }

    bootstrap();

    // Listen for deliberate user-initiated sign-outs.
    const onManual = () => { manualSignOut = true; };
    window.addEventListener('ncr:manual-signout', onManual);

    // Re-attempt bootstrap when the device comes back online and we're
    // still in 'loading' or 'signed-out' but storage might have valid
    // tokens (race when the device was offline at startup).
    const onOnline = () => {
      alog('network online → re-bootstrapping if needed');
      // Only retry if we're not already signed-in.
      setAuth(prev => {
        if (prev.status === 'signed-in') return prev;
        // Kick off another bootstrap; state will be updated by applySession.
        bootstrap();
        return prev;
      });
    };
    window.addEventListener('online', onOnline);

    // SDK auth-state listener.
    const off = onAuthChange(async (event, session) => {
      alog('event:', event, 'has session?', !!session);

      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
        case 'INITIAL_SESSION': {
          if (session) {
            if (!cancelled) applySession(session);
          }
          // null on INITIAL_SESSION is OK — bootstrap() handles it.
          return;
        }
        case 'SIGNED_OUT': {
          if (manualSignOut) {
            manualSignOut = false;
            if (!cancelled) applySignedOut('manual-signout');
            return;
          }
          // The SDK can emit SIGNED_OUT due to a transient refresh
          // failure. Try once more before evicting the user.
          alog('SIGNED_OUT received without manual trigger; verifying via refreshSession()…');
          const recovered = await refreshSession();
          if (recovered) {
            alog('recovery succeeded; staying signed-in');
            if (!cancelled) applySession(recovered);
            return;
          }
          // If we're offline, hold the line. The SDK's own scheduler
          // and our `online` listener will retry.
          if (!navigator.onLine) {
            alog('SIGNED_OUT but device is offline; refusing to evict to login');
            return;
          }
          if (!cancelled) applySignedOut('refresh-failed-after-signed-out');
          return;
        }
        default: {
          alog('event ignored:', event);
        }
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener('ncr:manual-signout', onManual);
      window.removeEventListener('online', onOnline);
      off();
    };
  }, []);

  // ── Force selectedBusiness into the unlocked scope ─────────────────────────
  useEffect(() => {
    if (!unlockedBizIds || unlockedBizIds.length === 0) return;
    const current = useAppStore.getState().selectedBusiness as BusinessId;
    if (!unlockedBizIds.includes(current)) {
      useAppStore.getState().setSelectedBusiness(unlockedBizIds[0]);
    }
  }, [unlockedBizIds]);

  // ── App-wide effects (backup + cloud sync) ──────────────────────────────────
  const supabaseReady =
    !SUPABASE_AUTH_ENABLED ||
    auth.status === 'unconfigured' ||
    auth.status === 'signed-in';
  const ready = supabaseReady && pinConfigured && unlockedBizIds !== null;

  useEffect(() => {
    if (!ready) return;

    const stopBackup = startBackupScheduler();
    useBackupStore.getState().loadHistory();

    bootstrapFromCloud();
    const stopRealtime     = subscribeRealtime();
    const stopConnectivity = watchConnectivity();

    return () => {
      stopBackup();
      stopRealtime();
      stopConnectivity();
    };
  }, [ready]);

  // ── Render flow ─────────────────────────────────────────────────────────────
  if (SUPABASE_AUTH_ENABLED && isAuthRequired()) {
    if (auth.status === 'loading') return <SplashFrame />;
    if (auth.status === 'signed-out') {
      return <SignInView onSignedIn={() => { /* onAuthChange will fire */ }} />;
    }
  }

  if (!pinConfigured) {
    return <PinSetupView onComplete={() => setPinConfigured(true)} />;
  }
  if (unlockedBizIds === null) {
    return <PinLockView />;
  }

  // Single shell across all devices — the rail-icon TouchShell that runs
  // on the restaurant's touchscreen desktop and iPad. Non-touch PC
  // browsers also get this layout for visual cohesion. The previous
  // DesktopShell (3-column sidebar + main + right panel) has been
  // retired; its files were removed alongside this change.
  return (
    <>
      <TouchShell />
      {debugRequested() && (
        <React.Suspense fallback={null}>
          <MobileLayoutDebug />
        </React.Suspense>
      )}
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractBizIdsSafe(s: import('@supabase/supabase-js').Session): readonly string[] {
  const meta = (s.user.app_metadata ?? {}) as { biz_ids?: unknown };
  const raw  = meta.biz_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

function SplashFrame() {
  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #f5e9d6 0%, #ebe5d8 60%, #ddd4c2 100%)',
      display: 'grid', placeItems: 'center',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid rgba(60,40,20,.12)',
        borderTopColor: 'var(--terracotta-500,#c8613a)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
