import React, { useEffect } from 'react';
import { useDevice } from '@/hooks/useDevice';
import DesktopShell from '@/views/desktop/DesktopShell';
import TabletShell  from '@/views/tablet/TabletShell';
import MobileShell  from '@/views/mobile/MobileShell';
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
 *  mobile  (<768 px / touch)                  → MobileShell  (bottom-nav PWA)
 *  tablet  (768–1099 px  OR touch < 1100)     → TabletShell  (left side-nav)
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

  if (isMobile) return <MobileShell />;
  if (isTablet)  return <TabletShell />;
  return <DesktopShell />;
}
