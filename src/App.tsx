import React, { useEffect, useState } from 'react';
import { useDevice } from '@/hooks/useDevice';
import DesktopShell from '@/views/desktop/DesktopShell';
import TouchShell   from '@/views/touch/TouchShell';
import SignInView    from '@/views/auth/SignInView';
import PinSetupView  from '@/views/auth/PinSetupView';
import PinLockView   from '@/views/auth/PinLockView';
import { startBackupScheduler } from '@/backup/backupScheduler';
import { useBackupStore } from '@/backup/useBackupStore';
import {
  bootstrapFromCloud,
  subscribeRealtime,
  watchConnectivity,
} from '@/lib/cloudSync';
import { isAuthRequired } from '@/lib/supabase';
import { getSession, onAuthChange } from '@/lib/auth';
import type { AuthState } from '@/lib/auth';
import { isPinConfigured } from '@/lib/pinAuth';
import { usePinScope } from '@/store/usePinScope';
import { useAppStore } from '@/store/useAppStore';
import type { BusinessId } from '@/types';

import { SUPABASE_AUTH_ENABLED } from '@/lib/featureFlags';

/**
 * Root router with a 3-layer gate:
 *
 *   1. Supabase Auth (cryptographic, device-level)
 *      → SignInView until a session exists
 *   2. PIN config (one-time per device)
 *      → PinSetupView until the 4 local PINs are configured
 *   3. PIN unlock (every page load / after manual lock)
 *      → PinLockView until a valid PIN is entered, which sets the
 *        active business scope
 *
 * Then the device/shell renders normally.
 *
 * If Supabase env vars are absent (offline dev mode), the Supabase gate
 * is skipped — but the PIN gates still apply so the device still has a
 * lock. To run truly unlocked in dev, clear `ncr-reserves-pin-config`
 * from localStorage and the Setup screen will not appear because
 * `isAuthRequired()` short-circuits it (see below).
 */
export default function App() {
  const { isMobile, isTablet } = useDevice();
  const [auth, setAuth] = useState<AuthState>(() =>
    SUPABASE_AUTH_ENABLED && isAuthRequired()
      ? { status: 'loading' }
      : { status: 'unconfigured' }
  );

  const unlockedBizIds = usePinScope(s => s.unlockedBizIds);
  // PIN is always required (defaults are baked into pinAuth.ts).
  const [pinConfigured, setPinConfigured] = useState<boolean>(isPinConfigured);

  // ── Auth bootstrap + subscription (only when the flag is on) ───────────────
  useEffect(() => {
    if (!SUPABASE_AUTH_ENABLED || !isAuthRequired()) return;

    let cancelled = false;
    getSession().then(s => {
      if (cancelled) return;
      setAuth(s
        ? { status: 'signed-in', session: s, bizIds: extractBizIdsSafe(s) }
        : { status: 'signed-out' });
    });

    const off = onAuthChange(s => {
      setAuth(s
        ? { status: 'signed-in', session: s, bizIds: extractBizIdsSafe(s) }
        : { status: 'signed-out' });
      // After a sign-out, the PIN scope must clear and we re-check config.
      if (!s) {
        usePinScope.getState().lock();
        setPinConfigured(isPinConfigured());
      }
    });

    return () => { cancelled = true; off(); };
  }, []);

  // ── Force selectedBusiness into the unlocked scope ─────────────────────────
  // If the PIN scope is e.g. ["pista"] but the persisted store still has
  // selectedBusiness="ganxo", the user would see Ganxo's data even though
  // they unlocked the L'Esquitx/La Pista book. Snap it to the first
  // allowed id on every unlock.
  useEffect(() => {
    if (!unlockedBizIds || unlockedBizIds.length === 0) return;
    const current = useAppStore.getState().selectedBusiness as BusinessId;
    if (!unlockedBizIds.includes(current)) {
      useAppStore.getState().setSelectedBusiness(unlockedBizIds[0]);
    }
  }, [unlockedBizIds]);

  // ── App-wide effects (backup + cloud sync) ──────────────────────────────────
  // Run only when the PIN gate is unlocked AND (Supabase Auth gate
  // satisfied OR disabled).
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
  // 1. Supabase Auth (only when the flag is on AND env vars are present)
  if (SUPABASE_AUTH_ENABLED && isAuthRequired()) {
    if (auth.status === 'loading') return <SplashFrame />;
    if (auth.status === 'signed-out') {
      return <SignInView onSignedIn={() => { /* onAuthChange will fire */ }} />;
    }
  }

  // 2. PIN setup — only appears if defaults are missing AND no localStorage
  //    config exists. With baked defaults this branch is effectively dead
  //    but stays in place for future PIN-reset flows.
  if (!pinConfigured) {
    return <PinSetupView onComplete={() => setPinConfigured(true)} />;
  }

  // 3. PIN unlock — ALWAYS required on a fresh load.
  if (unlockedBizIds === null) {
    return <PinLockView />;
  }

  // 4. Normal shell
  if (isMobile || isTablet) return <TouchShell />;
  return <DesktopShell />;
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
