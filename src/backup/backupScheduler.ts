/**
 * Backup scheduler.
 *
 * Two triggers:
 *   1. Interval every AUTO_INTERVAL_MS (5 min)
 *   2. Debounced subscription to Zustand store changes (3 s after last change)
 *
 * Both use createLocalBackup('auto') which skips if data hasn't changed.
 * Returns a cleanup function — call it on app unmount.
 */
import { useAppStore } from '@/store/useAppStore';
import { createLocalBackup } from './backupService';
import { useBackupStore } from './useBackupStore';

const AUTO_INTERVAL_MS  = 5 * 60 * 1000;   // 5 minutes
const CHANGE_DEBOUNCE   = 3_000;            // 3 seconds after last change

let _intervalId:   ReturnType<typeof setInterval>  | null = null;
let _debounceId:   ReturnType<typeof setTimeout>   | null = null;
let _unsubStore:   (() => void) | null = null;

async function runAutoBackup() {
  const { setStatus, setLastBackupAt, loadHistory } = useBackupStore.getState();
  try {
    const backup = await createLocalBackup('auto');
    if (backup) {
      setLastBackupAt(backup.createdAt);
      await loadHistory();
      setStatus('saved', 'Backup automàtic desat');
      setTimeout(() => useBackupStore.getState().clearStatus(), 3000);
    }
  } catch (err) {
    useBackupStore.getState().setStatus('error', 'Error al crear backup automàtic');
    console.error('[NCR Backup] auto-backup failed:', err);
  }
}

export function startBackupScheduler(): () => void {
  // Guard against duplicate schedulers
  if (_intervalId !== null) return stopBackupScheduler;

  // ① Periodic interval
  _intervalId = setInterval(runAutoBackup, AUTO_INTERVAL_MS);

  // ② Run immediately on start
  runAutoBackup();

  // ③ Debounced reaction to data changes
  const watched = [
    'reservations', 'customers', 'floorPlans',
    'shiftNotes', 'appEvents', 'employees',
    'employeeRoles', 'businessConfigs',
  ] as const;

  _unsubStore = useAppStore.subscribe((state, prev) => {
    const changed = watched.some(k => (state as any)[k] !== (prev as any)[k]);
    if (!changed) return;
    if (_debounceId) clearTimeout(_debounceId);
    _debounceId = setTimeout(runAutoBackup, CHANGE_DEBOUNCE);
  });

  // ④ Backup when user returns to the tab
  const onVisible = () => {
    if (document.visibilityState === 'visible') runAutoBackup();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    stopBackupScheduler();
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function stopBackupScheduler(): void {
  if (_intervalId)  { clearInterval(_intervalId);  _intervalId  = null; }
  if (_debounceId)  { clearTimeout(_debounceId);   _debounceId  = null; }
  if (_unsubStore)  { _unsubStore();               _unsubStore  = null; }
}
