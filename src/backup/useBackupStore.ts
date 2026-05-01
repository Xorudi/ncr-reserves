/**
 * Zustand store for backup UI state.
 * Not persisted — reloaded from IndexedDB on mount.
 */
import { create } from 'zustand';
import { idbListMeta } from './indexedDB';
import type { AppBackupMeta } from './types';

export type BackupStatus = 'idle' | 'saving' | 'saved' | 'error' | 'restoring' | 'restored';

interface BackupUIState {
  status:        BackupStatus;
  statusMessage: string;
  isWorking:     boolean;
  lastBackupAt:  string | null;
  history:       AppBackupMeta[];

  setStatus:       (k: BackupStatus, msg?: string) => void;
  setLastBackupAt: (at: string) => void;
  loadHistory:     () => Promise<void>;
  clearStatus:     () => void;
}

export const useBackupStore = create<BackupUIState>()((set) => ({
  status:        'idle',
  statusMessage: '',
  isWorking:     false,
  lastBackupAt:  null,
  history:       [],

  setStatus: (k, msg = '') =>
    set({ status: k, statusMessage: msg, isWorking: k === 'saving' || k === 'restoring' }),

  setLastBackupAt: (at) => set({ lastBackupAt: at }),

  loadHistory: async () => {
    try {
      const list = await idbListMeta();
      set({ history: list, lastBackupAt: list[0]?.createdAt ?? null });
    } catch {
      // IndexedDB unavailable (private mode, SSR)
    }
  },

  clearStatus: () => set({ status: 'idle', statusMessage: '' }),
}));
