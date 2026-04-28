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
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
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
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorTable {
  id: string;
  x: number;
  y: number;
  shape: TableShape;
  cap: number;
  zone: string;
  status: TableStatus;
  res?: string;
  time?: string;
  note?: string;
  w?: number;
  h?: number;
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
  date: string;        // YYYY-MM-DD
  author: string;
  body: string;
  createdAt: number;   // Date.now() timestamp
}

export interface AppEvent {
  id: string;
  bizId: BusinessId;
  date: string;        // YYYY-MM-DD
  title: string;
  time?: string;
  description?: string;
  kind?: string;       // 'event' | 'festiu' | 'closure' | 'promo'
}
