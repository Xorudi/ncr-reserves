import { create } from 'zustand';
import type { BusinessId, Reservation, Customer, ReservationStatus } from '@/types';
import { RESERVATIONS, CUSTOMERS } from '@/data/mockData';

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

  setSelectedBusiness: (id: BusinessId) => void;
  setSelectedDate: (d: Date) => void;
  setSelectedReservation: (r: Reservation | null) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setShowWalkin: (v: boolean) => void;
  updateReservationStatus: (id: string, status: ReservationStatus) => void;
  addReservation: (r: Omit<Reservation, 'id'>) => void;
  addCustomer: (c: Omit<Customer, 'id'>) => void;

  // Modal setters
  setConfirmModalRes: (v: any | null) => void;
  setCancelModalRes: (v: any | null) => void;
  setBlockModalTable: (v: any | null) => void;
  setShowWaitlist: (v: boolean) => void;
  setMergeModalTable: (v: any | null) => void;
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

  setSelectedBusiness: (id) => set({ selectedBusiness: id, selectedReservation: null }),
  setSelectedDate: (d) => set({ selectedDate: d }),
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
}));
