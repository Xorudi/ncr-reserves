import type {
  Reservation, Customer, FloorPlan, ShiftNote, AppEvent,
  Employee, EmployeeRole, BusinessConfig, BusinessHours,
  BizShift, NotifConfig, WeekScheduleData, EmployeeShift,
} from '@/types';

// ─── Backup data payload ──────────────────────────────────────────────────────
export interface BackupData {
  reservations:    Reservation[];
  customers:       Customer[];
  floorPlans:      Record<string, FloorPlan>;
  shiftNotes:      ShiftNote[];
  appEvents:       AppEvent[];
  employees:       Employee[];
  employeeRoles:   EmployeeRole[];
  businessConfigs: Record<string, BusinessConfig>;
  businessHours:   Record<string, BusinessHours>;
  bizShifts:       Record<string, BizShift[]>;
  notifConfigs:    Record<string, NotifConfig>;
  weekSchedule:    WeekScheduleData;
  employeeShifts:  EmployeeShift[];
}

// ─── Full backup (stored in IndexedDB) ───────────────────────────────────────
export interface AppBackup {
  id:        string;
  version:   '1.0';
  createdAt: string;          // ISO 8601
  type:      'manual' | 'auto';
  source:    'local' | 'online';
  hash:      string;          // FNV-32 of key data — used for dedup
  sizeBytes: number;
  label?:    string;
  data:      BackupData;
}

// ─── Metadata (no data payload — used for listing) ───────────────────────────
export type AppBackupMeta = Omit<AppBackup, 'data'>;
