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

  setSelectedBusiness: (id: BusinessId) => void;
  setSelectedDate: (d: Date) => void;
  setSelectedReservation: (r: Reservation | null) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setShowWalkin: (v: boolean) => void;
  updateReservationStatus: (id: string, status: ReservationStatus) => void;
  addReservation: (r: Omit<Reservation, 'id'>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedBusiness: 'ganxo',
  selectedDate: new Date(2026, 3, 24), // 24 Apr 2026
  reservations: RESERVATIONS,
  customers: CUSTOMERS,
  selectedReservation: null,
  selectedCustomer: null,
  showWalkin: false,

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
}));
