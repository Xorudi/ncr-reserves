import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BusinessId, Reservation, Customer, ReservationStatus,
  ShiftNote, AppEvent, FloorPlan, FloorTable, FloorZone,
  BusinessConfig, BusinessHours, BizShift,
  Employee, EmployeeRole, NotifConfig, WeekScheduleData,
} from '@/types';
import {
  RESERVATIONS, CUSTOMERS, SHIFT_NOTES, APP_EVENTS, FLOOR_PLANS,
  BUSINESS_CONFIGS, BUSINESS_HOURS, BIZ_SHIFTS,
  EMPLOYEES, EMPLOYEE_ROLES, WEEK_SCHED, NOTIF_DEFAULTS,
} from '@/data/mockData';

interface AppState {
  // ── Core ────────────────────────────────────────────────────────
  selectedBusiness: BusinessId;
  selectedDate: Date;
  reservations: Reservation[];
  customers: Customer[];
  selectedReservation: Reservation | null;
  selectedCustomer: Customer | null;
  showWalkin: boolean;

  // ── Auth / Active user ───────────────────────────────────────────
  loggedIn: boolean;
  currentUser: any | null;
  setLoggedIn: (v: boolean, user?: any) => void;
  activeEmployeeId: string | null;
  setActiveEmployee: (id: string | null) => void;

  // ── Modal state ──────────────────────────────────────────────────
  confirmModalRes: any | null;
  cancelModalRes: any | null;
  blockModalTable: any | null;
  showWaitlist: boolean;
  mergeModalTable: any | null;

  // ── Shift notes + events ─────────────────────────────────────────
  shiftNotes: ShiftNote[];
  appEvents: AppEvent[];

  // ── Floor plans ──────────────────────────────────────────────────
  floorPlans: Record<string, FloorPlan>;

  // ── Settings: business config ────────────────────────────────────
  businessConfigs: Record<string, BusinessConfig>;
  businessHours: Record<string, BusinessHours>;
  bizShifts: Record<string, BizShift[]>;
  notifConfigs: Record<string, NotifConfig>;

  // ── Staff ────────────────────────────────────────────────────────
  employees: Employee[];
  employeeRoles: EmployeeRole[];
  weekSchedule: WeekScheduleData;

  // ── Setters ──────────────────────────────────────────────────────
  setSelectedBusiness: (id: BusinessId) => void;
  setSelectedDate: (d: Date) => void;
  setSelectedReservation: (r: Reservation | null) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setShowWalkin: (v: boolean) => void;

  // ── Reservation CRUD ─────────────────────────────────────────────
  updateReservationStatus: (id: string, status: ReservationStatus) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  addReservation: (r: Omit<Reservation, 'id'>) => void;

  // ── Customer CRUD ────────────────────────────────────────────────
  addCustomer: (c: Omit<Customer, 'id'>) => void;

  // ── Modal setters ────────────────────────────────────────────────
  setConfirmModalRes: (v: any | null) => void;
  setCancelModalRes: (v: any | null) => void;
  setBlockModalTable: (v: any | null) => void;
  setShowWaitlist: (v: boolean) => void;
  setMergeModalTable: (v: any | null) => void;

  // ── Shift notes CRUD ─────────────────────────────────────────────
  addShiftNote: (n: Omit<ShiftNote, 'id'>) => void;
  editShiftNote: (id: string, body: string) => void;
  deleteShiftNote: (id: string) => void;

  // ── Events CRUD ──────────────────────────────────────────────────
  addAppEvent: (e: Omit<AppEvent, 'id'>) => void;
  deleteAppEvent: (id: string) => void;

  // ── Floor plan CRUD ──────────────────────────────────────────────
  setFloorPlan: (bizId: string, plan: FloorPlan) => void;
  updateFloorTable: (bizId: string, tableId: string, updates: Partial<FloorTable>) => void;
  addFloorTable: (bizId: string, table: FloorTable) => void;
  deleteFloorTable: (bizId: string, tableId: string) => void;
  updateFloorZone: (bizId: string, zoneId: string, updates: Partial<FloorZone>) => void;
  addFloorZone: (bizId: string, zone: FloorZone) => void;
  deleteFloorZone: (bizId: string, zoneId: string) => void;

  // ── Settings CRUD ────────────────────────────────────────────────
  updateBusinessConfig: (bizId: string, cfg: BusinessConfig) => void;
  updateBusinessHours: (bizId: string, hours: BusinessHours) => void;
  addBizShift: (bizId: string, shift: Omit<BizShift, 'id'>) => void;
  updateBizShift: (bizId: string, shiftId: string, updates: Partial<BizShift>) => void;
  deleteBizShift: (bizId: string, shiftId: string) => void;
  updateNotifConfig: (bizId: string, cfg: NotifConfig) => void;

  // ── Staff CRUD ───────────────────────────────────────────────────
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  clockInEmployee: (id: string) => void;
  clockOutEmployee: (id: string) => void;

  // ── Role CRUD ────────────────────────────────────────────────────
  addEmployeeRole: (role: Omit<EmployeeRole, 'id'>) => void;
  updateEmployeeRole: (id: string, updates: Partial<EmployeeRole>) => void;
  deleteEmployeeRole: (id: string) => void;

  // ── Week schedule ────────────────────────────────────────────────
  setWeekShift: (bizId: string, dow: number, shiftId: string, empIds: string[]) => void;
}

// Helper: seed notif configs for each biz
const seedNotifs = (): Record<string, NotifConfig> => ({
  ganxo:   { ...NOTIF_DEFAULTS },
  pista:   { ...NOTIF_DEFAULTS },
  esquitx: { ...NOTIF_DEFAULTS },
});

export const useAppStore = create<AppState>()(persist((set) => ({
  // ── Core ────────────────────────────────────────────────────────
  selectedBusiness: 'ganxo',
  selectedDate: new Date(2026, 3, 24),
  reservations: RESERVATIONS,
  customers: CUSTOMERS,
  selectedReservation: null,
  selectedCustomer: null,
  showWalkin: false,

  // ── Auth ─────────────────────────────────────────────────────────
  loggedIn: false,
  currentUser: null,
  setLoggedIn: (v, user) => set({ loggedIn: v, currentUser: user ?? null }),
  activeEmployeeId: null,
  setActiveEmployee: (id) => set({ activeEmployeeId: id }),

  // ── Modal state ──────────────────────────────────────────────────
  confirmModalRes: null,
  cancelModalRes: null,
  blockModalTable: null,
  showWaitlist: false,
  mergeModalTable: null,

  // ── Shift notes + events ─────────────────────────────────────────
  shiftNotes: SHIFT_NOTES,
  appEvents: APP_EVENTS,

  // ── Floor plans ──────────────────────────────────────────────────
  floorPlans: JSON.parse(JSON.stringify(FLOOR_PLANS)),

  // ── Settings ─────────────────────────────────────────────────────
  businessConfigs: JSON.parse(JSON.stringify(BUSINESS_CONFIGS)),
  businessHours:   JSON.parse(JSON.stringify(BUSINESS_HOURS)),
  bizShifts:       JSON.parse(JSON.stringify(BIZ_SHIFTS)),
  notifConfigs:    seedNotifs(),

  // ── Staff ────────────────────────────────────────────────────────
  employees:     JSON.parse(JSON.stringify(EMPLOYEES)),
  employeeRoles: JSON.parse(JSON.stringify(EMPLOYEE_ROLES)),
  weekSchedule:  JSON.parse(JSON.stringify(WEEK_SCHED)),

  // ── Setters ──────────────────────────────────────────────────────
  setSelectedBusiness: (id) => set({ selectedBusiness: id, selectedReservation: null }),
  setSelectedDate: (d) => set({ selectedDate: d, selectedReservation: null }),
  setSelectedReservation: (r) => set({ selectedReservation: r }),
  setSelectedCustomer: (c) => set({ selectedCustomer: c }),
  setShowWalkin: (v) => set({ showWalkin: v }),

  // ── Reservation CRUD ─────────────────────────────────────────────
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

  // ── Customer CRUD ────────────────────────────────────────────────
  addCustomer: (cust) =>
    set((s) => ({ customers: [...s.customers, { ...cust, id: `cust-${Date.now()}` }] })),

  // ── Modal setters ────────────────────────────────────────────────
  setConfirmModalRes: (v) => set({ confirmModalRes: v }),
  setCancelModalRes: (v) => set({ cancelModalRes: v }),
  setBlockModalTable: (v) => set({ blockModalTable: v }),
  setShowWaitlist: (v) => set({ showWaitlist: v }),
  setMergeModalTable: (v) => set({ mergeModalTable: v }),

  // ── Shift notes CRUD ─────────────────────────────────────────────
  addShiftNote: (n) =>
    set((s) => ({ shiftNotes: [...s.shiftNotes, { ...n, id: `sn-${Date.now()}` }] })),
  editShiftNote: (id, body) =>
    set((s) => ({ shiftNotes: s.shiftNotes.map((n) => n.id === id ? { ...n, body } : n) })),
  deleteShiftNote: (id) =>
    set((s) => ({ shiftNotes: s.shiftNotes.filter((n) => n.id !== id) })),

  // ── Events CRUD ──────────────────────────────────────────────────
  addAppEvent: (e) =>
    set((s) => ({ appEvents: [...s.appEvents, { ...e, id: `ev-${Date.now()}` }] })),
  deleteAppEvent: (id) =>
    set((s) => ({ appEvents: s.appEvents.filter((e) => e.id !== id) })),

  // ── Floor plan CRUD ──────────────────────────────────────────────
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

  // ── Settings CRUD ────────────────────────────────────────────────
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

  // ── Staff CRUD ───────────────────────────────────────────────────
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

  // ── Role CRUD ────────────────────────────────────────────────────
  addEmployeeRole: (role) =>
    set((s) => ({ employeeRoles: [...s.employeeRoles, { ...role, id: `er-${Date.now()}` }] })),
  updateEmployeeRole: (id, updates) =>
    set((s) => ({ employeeRoles: s.employeeRoles.map(r => r.id === id ? { ...r, ...updates } : r) })),
  deleteEmployeeRole: (id) =>
    set((s) => ({ employeeRoles: s.employeeRoles.filter(r => r.id !== id) })),

  // ── Week schedule ────────────────────────────────────────────────
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
}), {
  name: 'ncr-reserves-storage',
  partialize: (s) => ({
    weekSchedule:      s.weekSchedule,
    businessConfigs:   s.businessConfigs,
    businessHours:     s.businessHours,
    bizShifts:         s.bizShifts,
    employees:         s.employees,
    employeeRoles:     s.employeeRoles,
    notifConfigs:      s.notifConfigs,
    activeEmployeeId:  s.activeEmployeeId,
    selectedBusiness:  s.selectedBusiness,
  }),
}));
