export type BusinessId = 'ganxo' | 'pista' | 'esquitx';
export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'noshow';
export type TableStatus = 'free' | 'seated' | 'confirmed' | 'reserved' | 'pending' | 'blocked' | 'playing';
export type TableShape = 'round' | 'square' | 'rect' | 'stool' | 'court';

export interface Business {
  id: BusinessId;
  name: string;
  kind: string;
  hue: string;
  hueSoft: string;
  monogram: string;
  address: string;
  capacity: number;
}

export interface Reservation {
  id: string;
  bizId: BusinessId;
  date: string;
  time: string;
  name: string;
  pax: number;
  status: ReservationStatus;
  phone?: string;
  notes?: string;
  source?: string;
  tags?: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  visits: number;
  lastVisit: string;
  spend: number;
  tags: string[];
  biz: BusinessId[];
  notes: string;
}

export interface FloorZone {
  id: string;
  label: string;
  order: number;
  // Legacy canvas positioning (optional — used in old single-canvas mode)
  x?: number; y?: number; w?: number; h?: number;
}

export interface FloorTable {
  id: string;
  name?: string;      // display name (e.g. "10-bis", "T4"); falls back to id
  x: number;
  y: number;
  w?: number;
  h?: number;
  shape: TableShape;
  cap: number;
  zone: string;
  status: TableStatus;
  res?: string;
  time?: string;
  note?: string;
  reservedLater?: boolean;
}

export interface FloorPlan {
  gridW: number;
  gridH: number;
  zones: FloorZone[];
  tables: FloorTable[];
}

export interface BusinessStats {
  totalRes: number;
  totalPax: number;
  peak: number;
  occupancyPct: number;
  level: 'low' | 'medium' | 'high';
}

export interface ShiftNote {
  id: string;
  bizId: BusinessId;
  date: string;
  author: string;
  body: string;
  createdAt: number;
}

export interface AppEvent {
  id: string;
  bizId: BusinessId;
  date: string;
  title: string;
  time?: string;
  description?: string;
  kind?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface BusinessConfig {
  name: string;
  kind: string;
  address: string;
  phone: string;
  email: string;
  capacity: number;
  active: boolean;
}

export interface TimeSlot { start: string; end: string; }
export interface DayHours { open: boolean; slots: TimeSlot[]; }
export interface BusinessHours {
  days: DayHours[];        // 0 = Dilluns … 6 = Diumenge
  avgTableMinutes: number;
}

export interface BizShift {
  id: string;
  code: string;
  label: string;
  start: string;
  end: string;
  color: string;
  active: boolean;
}

export interface NotifConfig {
  pendingConfirm: boolean;
  peakAlert: boolean;
  birthdays: boolean;
  resChanges: boolean;
  clientNotes: boolean;
  channel: 'intern' | 'email' | 'whatsapp';
  advanceMinutes: number;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  bizId: BusinessId;
  fullName: string;
  initials: string;
  roleId: string;
  phone?: string;
  email?: string;
  active: boolean;
  notes?: string;
  clockedIn?: boolean;
  startedAt?: string | null;
}

export interface EmployeeRole {
  id: string;
  bizId: BusinessId;
  name: string;
  color: string;
  textColor: string;
  order: number;
  active: boolean;
}

// bizId → dow(0-6) → shiftId → employeeIds
export type WeekScheduleData = Record<string, Record<number, Record<string, string[]>>>;
