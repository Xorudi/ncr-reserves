import React, { useEffect } from 'react';
import { useDevice } from '@/hooks/useDevice';
import DesktopShell from '@/views/desktop/DesktopShell';
import TouchShell   from '@/views/touch/TouchShell';
import { startBackupScheduler } from '@/backup/backupScheduler';
import { useBackupStore } from '@/backup/useBackupStore';
import {
  bootstrapFromCloud,
  subscribeRealtime,
  watchConnectivity,
} from '@/lib/cloudSync';

/**
 * Root router — picks the correct shell based on device context.
 *
 *  mobile  (<768 px)                           → TouchShell   (bottom-nav)
 *  tablet  (768–1099 px OR touch ≥ 768)       → TouchShell   (left side-nav)
 *  desktop (≥1100 px, non-touch)              → DesktopShell (full sidebar)
 *
 * On mount:
 *   • starts the local backup scheduler
 *   • bootstraps state from Supabase (if configured + online)
 *   • subscribes to realtime cross-device changes
 *   • watches connectivity to flush offline queue on reconnect
 */
export default function App() {
  const { isMobile, isTablet } = useDevice();

  useEffect(() => {
    // ── Local backup scheduler ────────────────────────────────────────────────
    const stopBackup = startBackupScheduler();
    useBackupStore.getState().loadHistory();

    // ── Cloud sync ────────────────────────────────────────────────────────────
    bootstrapFromCloud();              // load all data from Supabase (no-op if offline)
    const stopRealtime     = subscribeRealtime();    // listen for changes from other devices
    const stopConnectivity = watchConnectivity();    // flush offline queue on reconnect

    return () => {
      stopBackup();
      stopRealtime();
      stopConnectivity();
    };
  }, []);

  if (isMobile || isTablet) return <TouchShell />;
  return <DesktopShell />;
}
