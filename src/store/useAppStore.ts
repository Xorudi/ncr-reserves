import { create } from 'zustand';
import type { BusinessId, Reservation, Customer, ReservationStatus, ShiftNote, AppEvent, FloorPlan, FloorTable, FloorZone } from '@/types';
import { RESERVATIONS, CUSTOMERS, SHIFT_NOTES, APP_EVENTS, FLOOR_PLANS } from '@/data/mockData';

interface AppState {
  selectedBusiness: BusinessId;
  selectedDate: Date;
  reservations: Reservation[];
  customers: Customer[];
  selectedReservation: Reservation | null;
  selectedCustomer: Customer | null;
  showWalkin: boolean;

  // Auth
  loggedIn: boolean;
  currentUser: any | null;
  setLoggedIn: (v: boolean, user?: any) => void;

  // Modal state
  confirmModalRes: any | null;
  cancelModalRes: any | null;
  blockModalTable: any | null;
  showWaitlist: boolean;
  mergeModalTable: any | null;

  // Shift notes + events
  shiftNotes: ShiftNote[];
  appEvents: AppEvent[];

  setSelectedBusiness: (id: BusinessId) => void;
  setSelectedDate: (d: Date) => void;
  setSelectedReservation: (r: Reservation | null) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setShowWalkin: (v: boolean) => void;

  updateReservationStatus: (id: string, status: ReservationStatus) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  addReservation: (r: Omit<Reservation, 'id'>) => void;
  addCustomer: (c: Omit<Customer, 'id'>) => void;

  // Modal setters
  setConfirmModalRes: (v: any | null) => void;
  setCancelModalRes: (v: any | null) => void;
  setBlockModalTable: (v: any | null) => void;
  setShowWaitlist: (v: boolean) => void;
  setMergeModalTable: (v: any | null) => void;

  // Shift notes CRUD
  addShiftNote: (n: Omit<ShiftNote, 'id'>) => void;
  editShiftNote: (id: string, body: string) => void;
  deleteShiftNote: (id: string) => void;

  // Events CRUD
  addAppEvent: (e: Omit<AppEvent, 'id'>) => void;
  deleteAppEvent: (id: string) => void;

  // Floor plans
  floorPlans: Record<string, FloorPlan>;
  setFloorPlan: (bizId: string, plan: FloorPlan) => void;
  updateFloorTable: (bizId: string, tableId: string, updates: Partial<FloorTable>) => void;
  addFloorTable: (bizId: string, table: FloorTable) => void;
  deleteFloorTable: (bizId: string, tableId: string) => void;
  updateFloorZone: (bizId: string, zoneId: string, updates: Partial<FloorZone>) => void;
  addFloorZone: (bizId: string, zone: FloorZone) => void;
  deleteFloorZone: (bizId: string, zoneId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedBusiness: 'ganxo',
  selectedDate: new Date(2026, 3, 24), // 24 Apr 2026
  reservations: RESERVATIONS,
  customers: CUSTOMERS,
  selectedReservation: null,
  selectedCustomer: null,
  showWalkin: false,

  // Auth
  loggedIn: false,
  currentUser: null,
  setLoggedIn: (v, user) => set({ loggedIn: v, currentUser: user ?? null }),

  // Modal state
  confirmModalRes: null,
  cancelModalRes: null,
  blockModalTable: null,
  showWaitlist: false,
  mergeModalTable: null,

  // Shift notes + events
  shiftNotes: SHIFT_NOTES,
  appEvents: APP_EVENTS,

  setSelectedBusiness: (id) => set({ selectedBusiness: id, selectedReservation: null }),
  setSelectedDate: (d) => set({ selectedDate: d, selectedReservation: null }),
  setSelectedReservation: (r) => set({ selectedReservation: r }),
  setSelectedCustomer: (c) => set({ selectedCustomer: c }),
  setShowWalkin: (v) => set({ showWalkin: v }),

  updateReservationStatus: (id, status) =>
    set((s) => ({
      reservations: s.reservations.map((r) => (r.id === id ? { ...r, status } : r)),
      selectedReservation: s.selectedReservation?.id === id
        ? { ...s.selectedReservation, status }
        : s.selectedReservation,
    })),

  updateReservation: (id, updates) =>
    set((s) => ({
      reservations: s.reservations.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      selectedReservation: s.selectedReservation?.id === id
        ? { ...s.selectedReservation, ...updates }
        : s.selectedReservation,
    })),

  addReservation: (res) =>
    set((s) => ({
      reservations: [...s.reservations, { ...res, id: `${res.bizId}-${res.time}-${res.name}-${Date.now()}` }],
    })),

  addCustomer: (cust) =>
    set((s) => ({
      customers: [...s.customers, { ...cust, id: `cust-${Date.now()}` }],
    })),

  // Modal setters
  setConfirmModalRes: (v) => set({ confirmModalRes: v }),
  setCancelModalRes: (v) => set({ cancelModalRes: v }),
  setBlockModalTable: (v) => set({ blockModalTable: v }),
  setShowWaitlist: (v) => set({ showWaitlist: v }),
  setMergeModalTable: (v) => set({ mergeModalTable: v }),

  // Shift notes CRUD
  addShiftNote: (n) =>
    set((s) => ({
      shiftNotes: [...s.shiftNotes, { ...n, id: `sn-${Date.now()}` }],
    })),
  editShiftNote: (id, body) =>
    set((s) => ({
      shiftNotes: s.shiftNotes.map((n) => (n.id === id ? { ...n, body } : n)),
    })),
  deleteShiftNote: (id) =>
    set((s) => ({ shiftNotes: s.shiftNotes.filter((n) => n.id !== id) })),

  // Events CRUD
  addAppEvent: (e) =>
    set((s) => ({
      appEvents: [...s.appEvents, { ...e, id: `ev-${Date.now()}` }],
    })),
  deleteAppEvent: (id) =>
    set((s) => ({ appEvents: s.appEvents.filter((e) => e.id !== id) })),

  // Floor plans
  floorPlans: JSON.parse(JSON.stringify(FLOOR_PLANS)), // deep copy so edits don't mutate seed data
  setFloorPlan: (bizId, plan) =>
    set((s) => ({ floorPlans: { ...s.floorPlans, [bizId]: plan } })),
  updateFloorTable: (bizId, tableId, updates) =>
    set((s) => {
      const plan = s.floorPlans[bizId];
      if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        tables: plan.tables.map(t => t.id === tableId ? { ...t, ...updates } : t),
      }}};
    }),
  addFloorTable: (bizId, table) =>
    set((s) => {
      const plan = s.floorPlans[bizId];
      if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan, tables: [...plan.tables, table] }}};
    }),
  deleteFloorTable: (bizId, tableId) =>
    set((s) => {
      const plan = s.floorPlans[bizId];
      if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        tables: plan.tables.filter(t => t.id !== tableId),
      }}};
    }),
  updateFloorZone: (bizId, zoneId, updates) =>
    set((s) => {
      const plan = s.floorPlans[bizId];
      if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        zones: plan.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z),
      }}};
    }),
  addFloorZone: (bizId, zone) =>
    set((s) => {
      const plan = s.floorPlans[bizId];
      if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan, zones: [...plan.zones, zone] }}};
    }),
  deleteFloorZone: (bizId, zoneId) =>
    set((s) => {
      const plan = s.floorPlans[bizId];
      if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        zones: plan.zones.filter(z => z.id !== zoneId),
        tables: plan.tables.filter(t => t.zone !== zoneId),
      }}};
    }),
}));
