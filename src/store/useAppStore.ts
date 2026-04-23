import { create } from 'zustand';
import { BusinessId, Reservation, Client } from '@/types';
import { BUSINESSES, RESERVATIONS, CLIENTS, ALERTS, SHIFT_NOTES, EVENTS } from '@/data/mockData';

interface AppState {
  selectedBusiness: BusinessId;
  selectedDate: string;
  reservations: Reservation[];
  clients: Client[];
  alerts: typeof ALERTS;
  shiftNotes: typeof SHIFT_NOTES;
  events: typeof EVENTS;
  businesses: typeof BUSINESSES;

  setSelectedBusiness: (id: BusinessId) => void;
  setSelectedDate: (date: string) => void;
  addReservation: (r: Reservation) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  deleteReservation: (id: string) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedBusiness: 'el-ganxo',
  selectedDate: '2026-04-24',
  reservations: RESERVATIONS,
  clients: CLIENTS,
  alerts: ALERTS,
  shiftNotes: SHIFT_NOTES,
  events: EVENTS,
  businesses: BUSINESSES,

  setSelectedBusiness: (id) => set({ selectedBusiness: id }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  addReservation: (r) => set((s) => ({ reservations: [...s.reservations, r] })),
  updateReservation: (id, updates) => set((s) => ({
    reservations: s.reservations.map((r) => r.id === id ? { ...r, ...updates } : r),
  })),
  deleteReservation: (id) => set((s) => ({ reservations: s.reservations.filter((r) => r.id !== id) })),
  addClient: (c) => set((s) => ({ clients: [...s.clients, c] })),
  updateClient: (id, updates) => set((s) => ({
    clients: s.clients.map((c) => c.id === id ? { ...c, ...updates } : c),
  })),
}));
