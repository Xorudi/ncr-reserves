export type BusinessId = 'el-ganxo' | 'la-pista' | 'lesquitx';
export type ReservationStatus = 'pendent' | 'confirmada' | 'a-taula' | 'cancel·lada' | 'no-show';
export type ReservationSource = 'telefon' | 'whatsapp' | 'walk-in' | 'web' | 'instagram' | 'thefork';
export type ReservationTag = 'vip' | 'aniversari' | 'al·lergia' | 'habitual' | 'terrassa';
export type AlertType = 'peak' | 'pending' | 'special' | 'info';
export type ClientTag = 'vip' | 'aniversari' | 'al·lergia' | 'habitual' | 'conflictiu';

export interface Business {
  id: BusinessId;
  name: string;
  type: string;
  address: string;
  initials: string;
  color: string;
  reservationCount: number;
}

export interface Client {
  id: string;
  fullName: string;
  phone: string;
  allergies: string[];
  importantNotes: string;
  preferences: string;
  tags: ClientTag[];
  visitHistory: Visit[];
  internalComments: ClientComment[];
  businessId?: BusinessId;
}

export interface Visit {
  date: string;
  businessId: BusinessId;
  guestCount: number;
  notes: string;
  reservationId: string;
}

export interface ClientComment {
  id: string;
  text: string;
  authorName: string;
  date: string;
}

export interface Reservation {
  id: string;
  businessId: BusinessId;
  date: string;
  time: string;
  serviceBlock: string;
  guestCount: number;
  customerId?: string;
  customerName: string;
  phone?: string;
  notes: string;
  status: ReservationStatus;
  source?: ReservationSource;
  tags: ReservationTag[];
  tableInfo?: string;
}

export interface Alert {
  id: string;
  businessId: BusinessId;
  date: string;
  type: AlertType;
  title: string;
  description: string;
  priority: number;
}

export interface ShiftNote {
  id: string;
  businessId: BusinessId;
  date: string;
  authorName: string;
  authorRole: string;
  text: string;
  minutesAgo: number;
}

export interface CalendarEvent {
  id: string;
  businessId: BusinessId;
  date: string;
  title: string;
  description: string;
  dayLabel: string;
}

export interface ServiceBlockDef {
  id: string;
  name: string;
  timeRange: string;
}
