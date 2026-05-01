/**
 * Core backup service.
 * All functions are framework-agnostic (no hooks) — they read/write
 * Zustand state imperatively via getState() / setState().
 */
import { useAppStore } from '@/store/useAppStore';
import type { AppBackup, BackupData } from './types';
import { idbSave, idbGet, idbPrune, idbClearAll, idbDelete } from './indexedDB';

// ─── Hash ─────────────────────────────────────────────────────────────────────
/** FNV-32 hash — fast, non-cryptographic, good for change detection */
function fnv32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function hashData(data: BackupData): string {
  // Hash key counts + last few reservations for fast dedup
  const sig = JSON.stringify({
    r:  data.reservations.length,
    c:  data.customers.length,
    e:  data.employees.length,
    sn: data.shiftNotes.length,
    ae: data.appEvents.length,
    // include last reservation id/status for sensitive change detection
    last: data.reservations.slice(-3).map(r => `${r.id}:${r.status}`),
  });
  return fnv32(sig);
}

// ─── Collect state ────────────────────────────────────────────────────────────
export function collectBackupData(): BackupData {
  const s = useAppStore.getState();
  return {
    reservations:    s.reservations,
    customers:       s.customers,
    floorPlans:      s.floorPlans,
    shiftNotes:      s.shiftNotes,
    appEvents:       s.appEvents,
    employees:       s.employees,
    employeeRoles:   s.employeeRoles,
    businessConfigs: s.businessConfigs,
    businessHours:   s.businessHours,
    bizShifts:       s.bizShifts,
    notifConfigs:    s.notifConfigs,
    weekSchedule:    s.weekSchedule,
    employeeShifts:  s.employeeShifts,
  };
}

// ─── Create + save ────────────────────────────────────────────────────────────
let _lastSavedHash = '';

/**
 * Creates a local backup and saves it to IndexedDB.
 * For 'auto' type, skips if data hasn't changed since last save.
 * Returns the backup object, or null if skipped.
 */
export async function createLocalBackup(type: 'manual' | 'auto' = 'auto'): Promise<AppBackup | null> {
  const data  = collectBackupData();
  const hash  = hashData(data);

  if (type === 'auto' && hash === _lastSavedHash) return null;
  _lastSavedHash = hash;

  const json   = JSON.stringify(data);
  const backup: AppBackup = {
    id:        `bkp-${Date.now()}`,
    version:   '1.0',
    createdAt: new Date().toISOString(),
    type,
    source:    'local',
    hash,
    sizeBytes: new TextEncoder().encode(json).length,
    data,
  };

  await idbSave(backup);
  await idbPrune();
  return backup;
}

// ─── Validate ─────────────────────────────────────────────────────────────────
export function validateBackup(obj: unknown): obj is AppBackup {
  if (!obj || typeof obj !== 'object') return false;
  const b = obj as AppBackup;
  return (
    b.version    === '1.0'           &&
    typeof b.createdAt === 'string'  &&
    b.data       != null             &&
    Array.isArray(b.data.reservations) &&
    Array.isArray(b.data.customers)    &&
    b.data.floorPlans != null
  );
}

// ─── Restore ─────────────────────────────────────────────────────────────────
export async function restoreFromBackup(backup: AppBackup): Promise<void> {
  if (!validateBackup(backup)) throw new Error('Backup invàlid o corrupte');

  const { data } = backup;
  useAppStore.setState({
    reservations:    data.reservations,
    customers:       data.customers,
    floorPlans:      data.floorPlans,
    shiftNotes:      data.shiftNotes      ?? [],
    appEvents:       data.appEvents       ?? [],
    employees:       data.employees,
    employeeRoles:   data.employeeRoles,
    businessConfigs: data.businessConfigs,
    businessHours:   data.businessHours,
    bizShifts:       data.bizShifts,
    notifConfigs:    data.notifConfigs,
    weekSchedule:    data.weekSchedule,
    employeeShifts:  data.employeeShifts  ?? [],
  });
  // Update hash so next auto-backup isn't skipped
  _lastSavedHash = backup.hash;
}

export async function restoreFromId(id: string): Promise<void> {
  const backup = await idbGet(id);
  if (!backup) throw new Error('Backup no trobat');
  await restoreFromBackup(backup);
}

// ─── Delete ───────────────────────────────────────────────────────────────────
export const deleteBackupById  = idbDelete;
export const clearLocalBackups = idbClearAll;

// ─── Export / Import ──────────────────────────────────────────────────────────
export function exportBackupToFile(backup: AppBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ncr-backup-${backup.createdAt.slice(0, 19).replace(/[T:]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCurrentToFile(): void {
  const data  = collectBackupData();
  const hash  = hashData(data);
  const json  = JSON.stringify(data);
  const backup: AppBackup = {
    id:        `bkp-export-${Date.now()}`,
    version:   '1.0',
    createdAt: new Date().toISOString(),
    type:      'manual',
    source:    'local',
    hash,
    sizeBytes: new TextEncoder().encode(json).length,
    data,
  };
  exportBackupToFile(backup);
}

export async function importBackupFromFile(file: File): Promise<AppBackup> {
  return new Promise((resolve, reject) => {
    const reader  = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result as string);
        if (!validateBackup(obj)) throw new Error('Format de backup invàlid');
        resolve(obj as AppBackup);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Error llegint el fitxer'));
    reader.readAsText(file);
  });
}
