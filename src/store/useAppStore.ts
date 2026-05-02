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
import { cloud } from '@/lib/cloudSync';

interface AppState {
  // ── Core ──────────────────────────────────────────────────────────────────────
  selectedBusiness: BusinessId;
  selectedDate: Date;
  reservations: Reservation[];
  customers: Customer[];
  selectedReservation: Reservation | null;
  selectedCustomer: Customer | null;
  showWalkin: boolean;

  // ── Auth / Active user ────────────────────────────────────────────────────────
  loggedIn: boolean;
  currentUser: any | null;
  setLoggedIn: (v: boolean, user?: any) => void;
  activeEmployeeId: string | null;
  setActiveEmployee: (id: string | null) => void;

  // ── Modal state ───────────────────────────────────────────────────────────────
  confirmModalRes: any | null;
  cancelModalRes: any | null;
  blockModalTable: any | null;
  showWaitlist: boolean;
  mergeModalTable: any | null;

  // ── Shift notes + events ──────────────────────────────────────────────────────
  shiftNotes: ShiftNote[];
  appEvents: AppEvent[];

  // ── Floor plans ───────────────────────────────────────────────────────────────
  floorPlans: Record<string, FloorPlan>;

  // ── Settings: business config ─────────────────────────────────────────────────
  businessConfigs: Record<string, BusinessConfig>;
  businessHours: Record<string, BusinessHours>;
  bizShifts: Record<string, BizShift[]>;
  notifConfigs: Record<string, NotifConfig>;

  // ── Staff ─────────────────────────────────────────────────────────────────────
  employees: Employee[];
  employeeRoles: EmployeeRole[];
  weekSchedule: WeekScheduleData;

  // ── Setters ───────────────────────────────────────────────────────────────────
  setSelectedBusiness: (id: BusinessId) => void;
  setSelectedDate: (d: Date) => void;
  setSelectedReservation: (r: Reservation | null) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setShowWalkin: (v: boolean) => void;

  // ── Reservation CRUD ──────────────────────────────────────────────────────────
  updateReservationStatus: (id: string, status: ReservationStatus) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  addReservation: (r: Omit<Reservation, 'id'>) => void;
  deleteReservation: (id: string) => void;
  assignTablesToReservation: (resId: string, tableIds: string[]) => void;

  // ── Table management ──────────────────────────────────────────────────────────
  releaseTable: (bizId: string, tableId: string) => void;
  releaseAllTables: (bizId: string, includeBlocked?: boolean) => void;

  // ── Customer CRUD ─────────────────────────────────────────────────────────────
  addCustomer:    (c: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // ── Modal setters ─────────────────────────────────────────────────────────────
  setConfirmModalRes: (v: any | null) => void;
  setCancelModalRes: (v: any | null) => void;
  setBlockModalTable: (v: any | null) => void;
  setShowWaitlist: (v: boolean) => void;
  setMergeModalTable: (v: any | null) => void;

  // ── Shift notes CRUD ──────────────────────────────────────────────────────────
  addShiftNote: (n: Omit<ShiftNote, 'id'>) => void;
  editShiftNote: (id: string, body: string) => void;
  deleteShiftNote: (id: string) => void;

  // ── Events CRUD ───────────────────────────────────────────────────────────────
  addAppEvent: (e: Omit<AppEvent, 'id'>) => void;
  deleteAppEvent: (id: string) => void;

  // ── Floor plan CRUD ───────────────────────────────────────────────────────────
  setFloorPlan: (bizId: string, plan: FloorPlan) => void;
  updateFloorTable: (bizId: string, tableId: string, updates: Partial<FloorTable>) => void;
  addFloorTable: (bizId: string, table: FloorTable) => void;
  deleteFloorTable: (bizId: string, tableId: string) => void;
  updateFloorZone: (bizId: string, zoneId: string, updates: Partial<FloorZone>) => void;
  addFloorZone: (bizId: string, zone: FloorZone) => void;
  deleteFloorZone: (bizId: string, zoneId: string) => void;

  // ── Settings CRUD ─────────────────────────────────────────────────────────────
  updateBusinessConfig: (bizId: string, cfg: BusinessConfig) => void;
  updateBusinessHours: (bizId: string, hours: BusinessHours) => void;
  addBizShift: (bizId: string, shift: Omit<BizShift, 'id'>) => void;
  updateBizShift: (bizId: string, shiftId: string, updates: Partial<BizShift>) => void;
  deleteBizShift: (bizId: string, shiftId: string) => void;
  updateNotifConfig: (bizId: string, cfg: NotifConfig) => void;

  // ── Staff CRUD ────────────────────────────────────────────────────────────────
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  clockInEmployee: (id: string) => void;
  clockOutEmployee: (id: string) => void;

  // ── Role CRUD ─────────────────────────────────────────────────────────────────
  addEmployeeRole: (role: Omit<EmployeeRole, 'id'>) => void;
  updateEmployeeRole: (id: string, updates: Partial<EmployeeRole>) => void;
  deleteEmployeeRole: (id: string) => void;

  // ── Week schedule (legacy) ────────────────────────────────────────────────────
  setWeekShift: (bizId: string, dow: number, shiftId: string, empIds: string[]) => void;

  // ── Employee shifts (intervals reals) ─────────────────────────────────────────
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

export const useAppStore = create<AppState>()(persist((set, get) => ({
  // ── Core ──────────────────────────────────────────────────────────────────────
  selectedBusiness: 'ganxo',
  selectedDate: new Date(),
  reservations: RESERVATIONS,
  customers: CUSTOMERS,
  selectedReservation: null,
  selectedCustomer: null,
  showWalkin: false,

  // ── Auth ──────────────────────────────────────────────────────────────────────
  loggedIn: false,
  currentUser: null,
  setLoggedIn: (v, user) => set({ loggedIn: v, currentUser: user ?? null }),
  activeEmployeeId: null,
  setActiveEmployee: (id) => set({ activeEmployeeId: id }),

  // ── Modal state ───────────────────────────────────────────────────────────────
  confirmModalRes: null,
  cancelModalRes: null,
  blockModalTable: null,
  showWaitlist: false,
  mergeModalTable: null,

  // ── Shift notes + events ──────────────────────────────────────────────────────
  shiftNotes: SHIFT_NOTES,
  appEvents: APP_EVENTS,

  // ── Floor plans ───────────────────────────────────────────────────────────────
  floorPlans: JSON.parse(JSON.stringify(FLOOR_PLANS)),

  // ── Settings ──────────────────────────────────────────────────────────────────
  businessConfigs: JSON.parse(JSON.stringify(BUSINESS_CONFIGS)),
  businessHours:   JSON.parse(JSON.stringify(BUSINESS_HOURS)),
  bizShifts:       JSON.parse(JSON.stringify(BIZ_SHIFTS)),
  notifConfigs:    seedNotifs(),

  // ── Staff ─────────────────────────────────────────────────────────────────────
  employees:       JSON.parse(JSON.stringify(EMPLOYEES)),
  employeeRoles:   JSON.parse(JSON.stringify(EMPLOYEE_ROLES)),
  weekSchedule:    JSON.parse(JSON.stringify(WEEK_SCHED)),
  employeeShifts:  JSON.parse(JSON.stringify(EMPLOYEE_SHIFTS_INIT)),

  // ── Setters ───────────────────────────────────────────────────────────────────
  setSelectedBusiness: (id) => set({ selectedBusiness: id, selectedReservation: null }),
  setSelectedDate: (d) => set({ selectedDate: d, selectedReservation: null }),
  setSelectedReservation: (r) => set({ selectedReservation: r }),
  setSelectedCustomer: (c) => set({ selectedCustomer: c }),
  setShowWalkin: (v) => set({ showWalkin: v }),

  // ── Reservation CRUD ──────────────────────────────────────────────────────────
  updateReservationStatus: (id, status) => {
    const res = get().reservations.find(r => r.id === id);
    const bizId = res?.bizId;
    const tableIds = res?.tableIds ?? [];
    const tableStatus =
      status === 'seated'     ? 'seated' as const :
      status === 'confirmed'  ? 'confirmed' as const :
      status === 'pending'    ? 'reserved' as const :
      'free' as const; // completed / cancelled / noshow → free

    set((s) => {
      const reservations = s.reservations.map((r) => r.id === id ? { ...r, status } : r);
      const selectedReservation = s.selectedReservation?.id === id
        ? { ...s.selectedReservation, status } : s.selectedReservation;

      let floorPlans = s.floorPlans;
      if (bizId && tableIds.length > 0 && s.floorPlans[bizId]) {
        const plan = s.floorPlans[bizId];
        const releasing = tableStatus === 'free';
        const tables = plan.tables.map(t => {
          if (!tableIds.includes(t.id)) return t;
          return releasing
            ? { ...t, status: 'free' as const, res: undefined, time: undefined }
            : { ...t, status: tableStatus };
        });
        floorPlans = { ...s.floorPlans, [bizId]: { ...plan, tables } };
      }
      return { reservations, selectedReservation, floorPlans };
    });

    const updated = get().reservations.find(r => r.id === id);
    if (updated) cloud.upsertReservation(updated);
    if (bizId && tableIds.length > 0) {
      const plan = get().floorPlans[bizId];
      if (plan) cloud.upsertFloorPlan(bizId, plan);
    }
  },

  updateReservation: (id, updates) => {
    set((s) => ({
      reservations: s.reservations.map((r) => r.id === id ? { ...r, ...updates } : r),
      selectedReservation: s.selectedReservation?.id === id
        ? { ...s.selectedReservation, ...updates } : s.selectedReservation,
    }));
    const updated = get().reservations.find(r => r.id === id);
    if (updated) cloud.upsertReservation(updated);
  },

  addReservation: (res) => {
    const newRes: Reservation = { ...res, id: `${res.bizId}-${res.time}-${Date.now()}` };
    set((s) => ({ reservations: [...s.reservations, newRes] }));
    cloud.upsertReservation(newRes);
  },

  assignTablesToReservation: (resId, tableIds) => {
    const res = get().reservations.find(r => r.id === resId);
    if (!res) return;
    const bizId = res.bizId;
    const oldTableIds = res.tableIds ?? [];
    const tableStatus =
      res.status === 'seated'    ? 'seated'    as const :
      res.status === 'confirmed' ? 'confirmed' as const :
      'reserved' as const;

    set((s) => {
      const reservations = s.reservations.map(r => r.id === resId ? { ...r, tableIds } : r);
      const selectedReservation = s.selectedReservation?.id === resId
        ? { ...s.selectedReservation, tableIds } : s.selectedReservation;

      const plan = s.floorPlans[bizId];
      if (!plan) return { reservations, selectedReservation };

      const tables = plan.tables.map(t => {
        if (tableIds.includes(t.id)) {
          return { ...t, status: tableStatus, res: res.name, time: res.time };
        }
        if (oldTableIds.includes(t.id) && !tableIds.includes(t.id) && t.status !== 'blocked') {
          return { ...t, status: 'free' as const, res: undefined, time: undefined };
        }
        return t;
      });
      return { reservations, selectedReservation, floorPlans: { ...s.floorPlans, [bizId]: { ...plan, tables } } };
    });

    const updatedRes = get().reservations.find(r => r.id === resId);
    if (updatedRes) cloud.upsertReservation(updatedRes);
    const plan = get().floorPlans[bizId];
    if (plan) cloud.upsertFloorPlan(bizId, plan);
  },

  releaseTable: (bizId, tableId) => {
    const ownerResId = get().reservations.find(r => r.tableIds?.includes(tableId))?.id;
    set((s) => {
      const plan = s.floorPlans[bizId];
      if (!plan) return {};
      const table = plan.tables.find(t => t.id === tableId);
      if (!table || table.status === 'blocked') return {};
      const tables = plan.tables.map(t =>
        t.id === tableId ? { ...t, status: 'free' as const, res: undefined, time: undefined } : t
      );
      const reservations = ownerResId
        ? s.reservations.map(r => r.id === ownerResId
            ? { ...r, tableIds: (r.tableIds ?? []).filter(id => id !== tableId) }
            : r)
        : s.reservations;
      return { reservations, floorPlans: { ...s.floorPlans, [bizId]: { ...plan, tables } } };
    });
    const updatedPlan = get().floorPlans[bizId];
    if (updatedPlan) cloud.upsertFloorPlan(bizId, updatedPlan);
    if (ownerResId) {
      const updatedRes = get().reservations.find(r => r.id === ownerResId);
      if (updatedRes) cloud.upsertReservation(updatedRes);
    }
  },

  releaseAllTables: (bizId, includeBlocked = false) => {
    set((s) => {
      const plan = s.floorPlans[bizId];
      if (!plan) return {};
      const tables = plan.tables.map(t => {
        if (!includeBlocked && t.status === 'blocked') return t;
        return { ...t, status: 'free' as const, res: undefined, time: undefined };
      });
      const reservations = s.reservations.map(r =>
        r.bizId === bizId && (r.tableIds?.length ?? 0) > 0 ? { ...r, tableIds: [] } : r
      );
      return { reservations, floorPlans: { ...s.floorPlans, [bizId]: { ...plan, tables } } };
    });
    const updatedPlan = get().floorPlans[bizId];
    if (updatedPlan) cloud.upsertFloorPlan(bizId, updatedPlan);
    get().reservations.filter(r => r.bizId === bizId).forEach(r => cloud.upsertReservation(r));
  },

  deleteReservation: (id) => {
    const toDelete = get().reservations.find(r => r.id === id);
    const bizId = toDelete?.bizId;
    set((s) => {
      const reservations = s.reservations.filter(r => r.id !== id);
      const selectedReservation = s.selectedReservation?.id === id ? null : s.selectedReservation;
      // Free any floor table linked to this reservation (match by id or name)
      let floorPlans = s.floorPlans;
      if (bizId && s.floorPlans[bizId] && toDelete) {
        const plan = s.floorPlans[bizId];
        const tables = plan.tables.map(t => {
          if ((t.res === id || t.res === toDelete.name) && t.status !== 'blocked') {
            return { ...t, res: undefined, time: undefined, status: 'free' as const };
          }
          return t;
        });
        floorPlans = { ...s.floorPlans, [bizId]: { ...plan, tables } };
      }
      return { reservations, selectedReservation, floorPlans };
    });
    cloud.deleteReservation(id);
    if (bizId) {
      const plan = get().floorPlans[bizId];
      if (plan) cloud.upsertFloorPlan(bizId, plan);
    }
  },

  // ── Customer CRUD ─────────────────────────────────────────────────────────────
  addCustomer: (cust) => {
    const newCust: Customer = { ...cust, id: `cust-${Date.now()}` };
    set((s) => ({ customers: [...s.customers, newCust] }));
    cloud.upsertCustomer(newCust);
  },

  updateCustomer: (id, updates) => {
    set((s) => ({ customers: s.customers.map(c => c.id === id ? { ...c, ...updates } : c) }));
    const updated = get().customers.find(c => c.id === id);
    if (updated) cloud.upsertCustomer(updated);
  },

  deleteCustomer: (id) => {
    set((s) => ({ customers: s.customers.filter(c => c.id !== id) }));
    cloud.deleteCustomer(id);
  },

  // ── Modal setters ─────────────────────────────────────────────────────────────
  setConfirmModalRes: (v) => set({ confirmModalRes: v }),
  setCancelModalRes: (v) => set({ cancelModalRes: v }),
  setBlockModalTable: (v) => set({ blockModalTable: v }),
  setShowWaitlist: (v) => set({ showWaitlist: v }),
  setMergeModalTable: (v) => set({ mergeModalTable: v }),

  // ── Shift notes CRUD ──────────────────────────────────────────────────────────
  addShiftNote: (n) => {
    const newNote: ShiftNote = { ...n, id: `sn-${Date.now()}` };
    set((s) => ({ shiftNotes: [...s.shiftNotes, newNote] }));
    cloud.upsertShiftNote(newNote);
  },

  editShiftNote: (id, body) => {
    set((s) => ({ shiftNotes: s.shiftNotes.map((n) => n.id === id ? { ...n, body } : n) }));
    const updated = get().shiftNotes.find(n => n.id === id);
    if (updated) cloud.upsertShiftNote(updated);
  },

  deleteShiftNote: (id) => {
    set((s) => ({ shiftNotes: s.shiftNotes.filter((n) => n.id !== id) }));
    cloud.deleteShiftNote(id);
  },

  // ── Events CRUD ───────────────────────────────────────────────────────────────
  addAppEvent: (e) => {
    const newEv: AppEvent = { ...e, id: `ev-${Date.now()}` };
    set((s) => ({ appEvents: [...s.appEvents, newEv] }));
    cloud.upsertEvent(newEv);
  },

  deleteAppEvent: (id) => {
    set((s) => ({ appEvents: s.appEvents.filter((e) => e.id !== id) }));
    cloud.deleteEvent(id);
  },

  // ── Floor plan CRUD ───────────────────────────────────────────────────────────
  setFloorPlan: (bizId, plan) => {
    set((s) => ({ floorPlans: { ...s.floorPlans, [bizId]: plan } }));
    cloud.upsertFloorPlan(bizId, plan);
  },

  updateFloorTable: (bizId, tableId, updates) => {
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        tables: plan.tables.map(t => t.id === tableId ? { ...t, ...updates } : t) } } };
    });
    const plan = get().floorPlans[bizId];
    if (plan) cloud.upsertFloorPlan(bizId, plan);
  },

  addFloorTable: (bizId, table) => {
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan, tables: [...plan.tables, table] } } };
    });
    const plan = get().floorPlans[bizId];
    if (plan) cloud.upsertFloorPlan(bizId, plan);
  },

  deleteFloorTable: (bizId, tableId) => {
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        tables: plan.tables.filter(t => t.id !== tableId) } } };
    });
    const plan = get().floorPlans[bizId];
    if (plan) cloud.upsertFloorPlan(bizId, plan);
  },

  updateFloorZone: (bizId, zoneId, updates) => {
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        zones: plan.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z) } } };
    });
    const plan = get().floorPlans[bizId];
    if (plan) cloud.upsertFloorPlan(bizId, plan);
  },

  addFloorZone: (bizId, zone) => {
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan, zones: [...plan.zones, zone] } } };
    });
    const plan = get().floorPlans[bizId];
    if (plan) cloud.upsertFloorPlan(bizId, plan);
  },

  deleteFloorZone: (bizId, zoneId) => {
    set((s) => {
      const plan = s.floorPlans[bizId]; if (!plan) return {};
      return { floorPlans: { ...s.floorPlans, [bizId]: { ...plan,
        zones: plan.zones.filter(z => z.id !== zoneId),
        tables: plan.tables.filter(t => t.zone !== zoneId) } } };
    });
    const plan = get().floorPlans[bizId];
    if (plan) cloud.upsertFloorPlan(bizId, plan);
  },

  // ── Settings CRUD ─────────────────────────────────────────────────────────────
  updateBusinessConfig: (bizId, cfg) => {
    set((s) => ({ businessConfigs: { ...s.businessConfigs, [bizId]: cfg } }));
    const s = get();
    cloud.upsertBizSettings(bizId, cfg,
      s.businessHours[bizId], s.bizShifts[bizId] ?? [], s.notifConfigs[bizId]);
  },

  updateBusinessHours: (bizId, hours) => {
    set((s) => ({ businessHours: { ...s.businessHours, [bizId]: hours } }));
    const s = get();
    cloud.upsertBizSettings(bizId,
      s.businessConfigs[bizId], hours, s.bizShifts[bizId] ?? [], s.notifConfigs[bizId]);
  },

  addBizShift: (bizId, shift) => {
    const newShift: BizShift = { ...shift, id: `sh-${Date.now()}` };
    set((s) => ({
      bizShifts: { ...s.bizShifts,
        [bizId]: [...(s.bizShifts[bizId] ?? []), newShift] },
    }));
    const s = get();
    cloud.upsertBizSettings(bizId,
      s.businessConfigs[bizId], s.businessHours[bizId], s.bizShifts[bizId] ?? [], s.notifConfigs[bizId]);
  },

  updateBizShift: (bizId, shiftId, updates) => {
    set((s) => ({
      bizShifts: { ...s.bizShifts,
        [bizId]: (s.bizShifts[bizId] ?? []).map(sh => sh.id === shiftId ? { ...sh, ...updates } : sh) },
    }));
    const s = get();
    cloud.upsertBizSettings(bizId,
      s.businessConfigs[bizId], s.businessHours[bizId], s.bizShifts[bizId] ?? [], s.notifConfigs[bizId]);
  },

  deleteBizShift: (bizId, shiftId) => {
    set((s) => ({
      bizShifts: { ...s.bizShifts,
        [bizId]: (s.bizShifts[bizId] ?? []).filter(sh => sh.id !== shiftId) },
    }));
    const s = get();
    cloud.upsertBizSettings(bizId,
      s.businessConfigs[bizId], s.businessHours[bizId], s.bizShifts[bizId] ?? [], s.notifConfigs[bizId]);
  },

  updateNotifConfig: (bizId, cfg) => {
    set((s) => ({ notifConfigs: { ...s.notifConfigs, [bizId]: cfg } }));
    const s = get();
    cloud.upsertBizSettings(bizId,
      s.businessConfigs[bizId], s.businessHours[bizId], s.bizShifts[bizId] ?? [], cfg);
  },

  // ── Staff CRUD ────────────────────────────────────────────────────────────────
  addEmployee: (emp) => {
    const newEmp: Employee = { ...emp, id: `emp-${Date.now()}` };
    set((s) => ({ employees: [...s.employees, newEmp] }));
    cloud.upsertEmployee(newEmp);
  },

  updateEmployee: (id, updates) => {
    set((s) => ({ employees: s.employees.map(e => e.id === id ? { ...e, ...updates } : e) }));
    const updated = get().employees.find(e => e.id === id);
    if (updated) cloud.upsertEmployee(updated);
  },

  deleteEmployee: (id) => {
    set((s) => ({ employees: s.employees.filter(e => e.id !== id) }));
    cloud.deleteEmployee(id);
  },

  clockInEmployee: (id) => {
    set((s) => ({ employees: s.employees.map(e =>
      e.id === id ? { ...e, clockedIn: true, startedAt: new Date().toTimeString().slice(0,5) } : e) }));
    const updated = get().employees.find(e => e.id === id);
    if (updated) cloud.upsertEmployee(updated);
  },

  clockOutEmployee: (id) => {
    set((s) => ({ employees: s.employees.map(e =>
      e.id === id ? { ...e, clockedIn: false, startedAt: null } : e) }));
    const updated = get().employees.find(e => e.id === id);
    if (updated) cloud.upsertEmployee(updated);
  },

  // ── Role CRUD ─────────────────────────────────────────────────────────────────
  addEmployeeRole: (role) => {
    const newRole: EmployeeRole = { ...role, id: `er-${Date.now()}` };
    set((s) => ({ employeeRoles: [...s.employeeRoles, newRole] }));
    cloud.upsertRole(newRole);
  },

  updateEmployeeRole: (id, updates) => {
    set((s) => ({ employeeRoles: s.employeeRoles.map(r => r.id === id ? { ...r, ...updates } : r) }));
    const updated = get().employeeRoles.find(r => r.id === id);
    if (updated) cloud.upsertRole(updated);
  },

  deleteEmployeeRole: (id) => {
    set((s) => ({ employeeRoles: s.employeeRoles.filter(r => r.id !== id) }));
    cloud.deleteRole(id);
  },

  // ── Week schedule (legacy) ────────────────────────────────────────────────────
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

  // ── Employee shifts (intervals reals) ─────────────────────────────────────────
  addEmployeeShift: (s) => {
    const newShift: EmployeeShift = { ...s, id: `es-${Date.now()}` };
    set((st) => ({ employeeShifts: [...st.employeeShifts, newShift] }));
    cloud.upsertEmpShift(newShift);
  },

  updateEmployeeShift: (id, updates) => {
    set((s) => ({ employeeShifts: s.employeeShifts.map(sh => sh.id === id ? { ...sh, ...updates } : sh) }));
    const updated = get().employeeShifts.find(sh => sh.id === id);
    if (updated) cloud.upsertEmpShift(updated);
  },

  deleteEmployeeShift: (id) => {
    set((s) => ({ employeeShifts: s.employeeShifts.filter(sh => sh.id !== id) }));
    cloud.deleteEmpShift(id);
  },
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
