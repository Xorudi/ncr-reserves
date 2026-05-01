import React, { useEffect } from 'react';
import { useDevice } from '@/hooks/useDevice';
import DesktopShell from '@/views/desktop/DesktopShell';
import TabletShell  from '@/views/tablet/TabletShell';
import MobileShell  from '@/views/mobile/MobileShell';
import { startBackupScheduler } from '@/backup/backupScheduler';
import { useBackupStore } from '@/backup/useBackupStore';

/**
 * Root router — picks the correct shell based on device context.
 *
 *  mobile  (<768 px)                          → MobileShell  (bottom-nav PWA)
 *  tablet  (768–1024 px, portrait)            → TabletShell  (left side-nav)
 *  desktop (>1024 px OR landscape tablet)     → DesktopShell (full sidebar)
 *
 * Also detects standalone PWA mode so each shell can apply safe-area insets.
 */
export default function App() {
  const { isMobile, isTablet } = useDevice();

  // Start backup scheduler once on mount; load history for UI
  useEffect(() => {
    const stop = startBackupScheduler();
    useBackupStore.getState().loadHistory();
    return stop;
  }, []);

  if (isMobile) return <MobileShell />;
  if (isTablet)  return <TabletShell />;
  return <DesktopShell />;
}
