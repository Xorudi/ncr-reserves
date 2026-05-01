import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BusinessId, Reservation, Customer, ReservationStatus,
  ShiftNote, AppEvent, FloorPlan, FloorTable, FloorZone,
  BusinessConfig, BusinessHours, BizShift,
  Employee, EmployeeRole, NotifConfig, WeekScheduleData, EmployeeShift,
} from '@/types';
import {
  RESERVATIONS, CUSTOMERS, SHIFT_NOTES, APP_EVENTS, FLOOR_PLANS,
  BUSINESS_CONFIGS, BUSINESS_HOURS, BIZ_SHIFTS,
  EMPLOYEES, EMPLOYEE_ROLES, WEEK_SCHED, NOTIF_DEFAULTS,
  EMPLOYEE_SHIFTS_INIT,
} from '@/data/mockData';

interface AppState {
  // â”€â”€ Core â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  selectedBusiness: BusinessId;
  selectedDate: Date;
  reservations: Reservation[];
  customers: Customer[];
  selectedReservation: Reservation | null;
  selectedCustomer: Customer | null;
  showWalkin: boolean;

  // â”€â”€ Auth / Active user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  loggedIn: boolean;
  currentUser: any | null;
  setLoggedIn: (v: boolean, user?: any) => void;
  activeEmployeeId: string | null;
  setActiveEmployee: (id: string | null) => void;

  // â”€â”€ Modal state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  confirmModalRes: any | null;
  cancelModalRes: any | null;
  blockModalTable: any | null;
  showWaitlist: boolean;
  mergeModalTable: any | null;

  // â”€â”€ Shift notes + events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  shiftNotes: ShiftNote[];
  appEvents: AppEvent[];

  // â”€â”€ Floor plans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  floorPlans: Record<string, FloorPlan>;

  // â”€â”€ Settings: business config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  businessConfigs: Record<string, BusinessConfig>;
  businessHours: Record<string, BusinessHours>;
  bizShifts: Record<string, BizShift[]>;
  notifConfigs: Record<string, NotifConfig>;

  // â”€â”€ Staff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  employees: Employee[];
  employeeRoles: EmployeeRole[];
  weekSchedule: WeekScheduleData;

  // â”€â”€ Setters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setSelectedBusiness: (id: BusinessId) => void;
  setSelectedDate: (d: Date) => void;
  setSelectedReservation: (r: Reservation | null) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setShowWalkin: (v: boolean) => void;

  // â”€â”€ Reservation CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  updateReservationStatus: (id: string, status: ReservationStatus) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  addReservation: (r: Omit<Reservation, 'id'>) => void;

  // â”€â”€ Customer CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addCustomer:    (c: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // â”€â”€ Modal setters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setConfirmModalRes: (v: any | null) => void;
  setCancelModalRes: (v: any | null) => void;
  setBlockModalTable: (v: any | null) => void;
  setShowWaitlist: (v: boolean) => void;
  setMergeModalTable: (v: any | null) => void;

  // â”€â”€ Shift notes CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addShiftNote: (n: Omit<ShiftNote, 'id'>) => void;
  editShiftNote: (id: string, body: string) => void;
  deleteShiftNote: (id: string) => void;

  // â”€â”€ Events CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addAppEvent: (e: Omit<AppEvent, 'id'>) => void;
  deleteAppEvent: (id: string) => void;

  // â”€â”€ Floor plan CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setFloorPlan: (bizId: string, plan: FloorPlan) => void;
  updateFloorTable: (bizId: string, tableId: string, updates: Partial<FloorTable>) => void;
  addFloorTable: (bizId: string, table: FloorTable) => void;
  deleteFloorTable: (bizId: string, tableId: string) => void;
  updateFloorZone: (bizId: string, zoneId: string, updates: Partial<FloorZone>) => void;
  addFloorZone: (bizId: string, zone: FloorZone) => void;
  deleteFloorZone: (bizId: string, zoneId: string) => void;

  // â”€â”€ Settings CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  updateBusinessConfig: (bizId: string, cfg: BusinessConfig) => void;
  updateBusinessHours: (bizId: string, hours: BusinessHours) => void;
  addBizShift: (bizId: string, shift: Omit<BizShift, 'id'>) => void;
  updateBizShift: (bizId: string, shiftId: string, updates: Partial<BizShift>) => void;
  deleteBizShift: (bizId: string, shiftId: string) => void;
  updateNotifConfig: (bizId: string, cfg: NotifConfig) => void;

  // â”€â”€ Staff CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  clockInEmployee: (id: string) => void;
  clockOutEmployee: (id: string) => void;

  // â”€â”€ Role CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addEmployeeRole: (role: Omit<EmployeeRole, 'id'>) => void;
  updateEmployeeRole: (id: string, updates: Partial<EmployeeRole>) => void;
  deleteEmployeeRole: (id: string) => void;

  // â”€â”€ Week schedule (legacy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setWeekShift: (bizId: string, dow: number, shiftId: string, empIds: string[]) => void;

  // â”€â”€ Employee shifts (intervals reals) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  employeeShifts: EmployeeShift[];
  addEmployeeShift: (s: Omit<EmployeeShift, 'id'>) => void;
  updateEmployeeShift: (id: string, updates: Partial<EmployeeShift>) => void;
  deleteEmployeeShift: (id: string) => void;
}

// Helper: seed notif configs for each biz
const seedNotifs = (): Record<string, NotifConfig> => ({
  ganxo:   { ...NOTIF_DEFAULTS },
  pista:   { ...NOTIF_DEFAULTS },
  esquitx: { ...NOTIF_DEFAULTS },
});

export const useAppStore = create<AppState>()(persist((set) => ({
  // â”€â”€ Core â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  selectedBusiness: 'ganxo',
  selectedDate: new Date(),
  reservations: RESERVATIONS,
  customers: CUSTOMERS,
  selectedReservation: null,
  selectedCustomer: null,
  showWalkin: false,

  // â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  loggedIn: false,
  currentUser: null,
  setLoggedIn: (v, user) => set({ loggedIn: v, currentUser: user ?? null }),
  activeEmployeeId: null,
  setActiveEmployee: (id) => set({ activeEmployeeId: id }),

  // â”€â”€ Modal state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  confirmModalRes: null,
  cancelModalRes: null,
  blockModalTable: null,
  showWaitlist: false,
  mergeModalTable: null,

  // â”€â”€ Shift notes + events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  shiftNotes: SHIFT_NOTES,
  appEvents: APP_EVENTS,

  // â”€â”€ Floor plans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  floorPlans: JSON.parse(JSON.stringify(FLOOR_PLANS)),

  // â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  businessConfigs: JSON.parse(JSON.stringify(BUSINESS_CONFIGS)),
  businessHours:   JSON.parse(JSON.stringify(BUSINESS_HOURS)),
  bizShifts:       JSON.parse(JSON.stringify(BIZ_SHIFTS)),
  notifConfigs:    seedNotifs(),

  // â”€â”€ Staff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  employees:       JSON.parse(JSON.stringify(EMPLOYEES)),
  employeeRoles:   JSON.parse(JSON.stringify(EMPLOYEE_ROLES)),
  weekSchedule:    JSON.parse(JSON.stringify(WEEK_SCHED)),
  employeeShifts:  JSON.parse(JSON.stringify(EMPLOYEE_SHIFTS_INIT)),

  // â”€â”€ Setters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setSelectedBusiness: (id) => set({ selectedBusiness: id, selectedReservation: null }),
  setSelectedDate: (d) => set({ selectedDate: d, selectedReservation: null }),
  setSelectedReservation: (r) => set({ selectedReservation: r }),
  setSelectedCustomer: (c) => set({ selectedCustomer: c }),
  setShowWalkin: (v) => set({ showWalkin: v }),

  // â”€â”€ Reservation CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  updateReservationStatus: (id, status) =>
    set((s) => ({
      reservations: s.reservations.map((r) => r.id === id ? { ...r, status } : r),
      selectedReservation: s.selectedReservation?.id === id
        ? { ...s.selectedReservation, status } : s.selectedReservation,
    })),

  updateReservation: (id, updates) =>
    set((s) => ({
      reservations: s.reservations.map((r) => r.id === id ? { ...r, ...updates } : r),
      selectedReservation: s.selectedReservation?.id === id
        ? { ...s.selectedReservation, ...updates } : s.selectedReservation,
    })),

  addReservation: (res) =>
    set((s) => ({
      reservations: [...s.reservations, { ...res, id: `${res.bizId}-${res.time}-${Date.now()}` }],
    })),

  // â”€â”€ Customer CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addCustomer: (cust) =>
    set((s) => ({ customers: [...s.customers, { ...cust, id: `cust-${Date.now()}` }] })),

  updateCustomer: (id, updates) =>
    set((s) => ({ customers: s.customers.map(c => c.id === id ? { ...c, ...updates } : c) })),

  deleteCustomer: (id) =>
    set((s) => ({ customers: s.customers.filter(c => c.id !== id) })),

  // â”€â”€ Modal setters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setConfirmModalRes: (v) => set({ confirmModalRes: v }),
  setCancelModalRes: (v) => set({ cancelModalRes: v }),
  setBlockModalTable: (v) => set({ blockModalTable: v }),
  setShowWaitlist: (v) => set({ showWaitlist: v }),
  setMergeModalTable: (v) => set({ mergeModalTable: v }),

  // â”€â”€ Shift notes CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addShiftNote: (n) =>
    set((s) => ({ shiftNotes: [...s.shiftNotes, { ...n, id: `sn-${Date.now()}` }] })),
  editShiftNote: (id, body) =>
    set((s) => ({ shiftNotes: s.shiftNotes.map((n) => n.id === id ? { ...n, body } : n) })),
  deleteShiftNote: (id) =>
    set((s) => ({ shiftNotes: s.shiftNotes.filter((n) => n.id !== id) })),

  // â”€â”€ Events CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addAppEvent: (e) =>
    set((s) => ({ appEvents: [...s.appEvents, { ...e, id: `ev-${Date.now()}` }] })),
  deleteAppEvent: (id) =>
    set((s) => ({ appEvents: s.appEvents.filter((e) => e.id !== id) })),

  // â”€â”€ Floor plan CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setFloorPlan: (bizId, plan) =>
    set((s) => ({ floorPlans: { ...s.floorPlans, [bizId]: plan } })),
  updateFloorTable: (bizId, tableId, updates) =>
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        tables: plan.tables.map(t => t.id === tableId ? { ...t, ...updates } : t) } } };
    }),
  addFloorTable: (bizId, table) =>
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan, tables: [...plan.tables, table] } } };
    }),
  deleteFloorTable: (bizId, tableId) =>
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        tables: plan.tables.filter(t => t.id !== tableId) } } };
    }),
  updateFloorZone: (bizId, zoneId, updates) =>
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        zones: plan.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z) } } };
    }),
  addFloorZone: (bizId, zone) =>
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan, zones: [...plan.zones, zone] } } };
    }),
  deleteFloorZone: (bizId, zoneId) =>
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        zones: plan.zones.filter(z => z.id !== zoneId),
        tables: plan.tables.filter(t => t.zone !== zoneId) } } };
    }),

  // â”€â”€ Settings CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  updateBusinessConfig: (bizId, cfg) =>
    set((s) => ({ businessConfigs: { ...s.businessConfigs, [bizId]: cfg } })),

  updateBusinessHours: (bizId, hours) =>
    set((s) => ({ businessHours: { ...s.businessHours, [bizId]: hours } })),

  addBizShift: (bizId, shift) =>
    set((s) => ({
      bizShifts: { ...s.bizShifts,
        [bizId]: [...(s.bizShifts[bizId] ?? []), { ...shift, id: `sh-${Date.now()}` }] },
    })),
  updateBizShift: (bizId, shiftId, updates) =>
    set((s) => ({
      bizShifts: { ...s.bizShifts,
        [bizId]: (s.bizShifts[bizId] ?? []).map(sh => sh.id === shiftId ? { ...sh, ...updates } : sh) },
    })),
  deleteBizShift: (bizId, shiftId) =>
    set((s) => ({
      bizShifts: { ...s.bizShifts,
        [bizId]: (s.bizShifts[bizId] ?? []).filter(sh => sh.id !== shiftId) },
    })),

  updateNotifConfig: (bizId, cfg) =>
    set((s) => ({ notifConfigs: { ...s.notifConfigs, [bizId]: cfg } })),

  // â”€â”€ Staff CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addEmployee: (emp) =>
    set((s) => ({ employees: [...s.employees, { ...emp, id: `emp-${Date.now()}` }] })),
  updateEmployee: (id, updates) =>
    set((s) => ({ employees: s.employees.map(e => e.id === id ? { ...e, ...updates } : e) })),
  deleteEmployee: (id) =>
    set((s) => ({ employees: s.employees.filter(e => e.id !== id) })),
  clockInEmployee: (id) =>
    set((s) => ({ employees: s.employees.map(e =>
      e.id === id ? { ...e, clockedIn: true, startedAt: new Date().toTimeString().slice(0,5) } : e) })),
  clockOutEmployee: (id) =>
    set((s) => ({ employees: s.employees.map(e =>
      e.id === id ? { ...e, clockedIn: false, startedAt: null } : e) })),

  // â”€â”€ Role CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addEmployeeRole: (role) =>
    set((s) => ({ employeeRoles: [...s.employeeRoles, { ...role, id: `er-${Date.now()}` }] })),
  updateEmployeeRole: (id, updates) =>
    set((s) => ({ employeeRoles: s.employeeRoles.map(r => r.id === id ? { ...r, ...updates } : r) })),
  deleteEmployeeRole: (id) =>
    set((s) => ({ employeeRoles: s.employeeRoles.filter(r => r.id !== id) })),

  // â”€â”€ Week schedule (legacy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setWeekShift: (bizId, dow, shiftId, empIds) =>
    set((s) => ({
      weekSchedule: {
        ...s.weekSchedule,
        [bizId]: {
          ...(s.weekSchedule[bizId] ?? {}),
          [dow]: { ...(s.weekSchedule[bizId]?.[dow] ?? {}), [shiftId]: empIds },
        },
      },
    })),

  // â”€â”€ Employee shifts (intervals reals) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addEmployeeShift: (s) =>
    set((st) => ({ employeeShifts: [...st.employeeShifts, { ...s, id: `es-${Date.now()}` }] })),
  updateEmployeeShift: (id, updates) =>
    set((s) => ({ employeeShifts: s.employeeShifts.map(sh => sh.id === id ? { ...sh, ...updates } : sh) })),
  deleteEmployeeShift: (id) =>
    set((s) => ({ employeeShifts: s.employeeShifts.filter(sh => sh.id !== id) })),
}), {
  name: 'ncr-reserves-storage',
  partialize: (s) => ({
    // ── Mutable user data — must survive reload ──────────────────────────────
    reservations:      s.reservations,
    customers:         s.customers,
    floorPlans:        s.floorPlans,
    shiftNotes:        s.shiftNotes,
    appEvents:         s.appEvents,
    // ── Settings & staff ─────────────────────────────────────────────────────
    weekSchedule:      s.weekSchedule,
    businessConfigs:   s.businessConfigs,
    businessHours:     s.businessHours,
    bizShifts:         s.bizShifts,
    employees:         s.employees,
    employeeRoles:     s.employeeRoles,
    notifConfigs:      s.notifConfigs,
    activeEmployeeId:  s.activeEmployeeId,
    selectedBusiness:  s.selectedBusiness,
    employeeShifts:    s.employeeShifts,
  }),
}));



