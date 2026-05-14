/**
 * Session-only scope state — which business book the PIN unlocked.
 *
 * NOT persisted: a page reload forces a fresh PIN entry. The Supabase
 * Auth session survives a reload (long-lived), but the in-app scope
 * does not.
 */
import { create } from 'zustand';
import type { BusinessId, Business } from '@/types';
import { BUSINESSES } from '@/data/mockData';

interface PinScopeState {
  /** null = locked. Non-null array = unlocked, with the visible business set. */
  unlockedBizIds: BusinessId[] | null;
  /** Display label of the PIN that's currently unlocking the session. */
  label: string | null;

  unlock: (label: string, scope: BusinessId[]) => void;
  lock:   () => void;
}

export const usePinScope = create<PinScopeState>((set) => ({
  unlockedBizIds: null,
  label:          null,

  unlock: (label, scope) => set({ unlockedBizIds: scope, label }),
  lock:   ()             => set({ unlockedBizIds: null, label: null }),
}));

/**
 * Read-only selector usable inside non-React code (cloud sync, etc.).
 * Returns null when locked.
 */
export const getUnlockedBizIds = (): readonly BusinessId[] | null =>
  usePinScope.getState().unlockedBizIds;

/** True if a given biz id is currently visible. */
export const isBizUnlocked = (id: BusinessId): boolean => {
  const scope = usePinScope.getState().unlockedBizIds;
  return scope ? scope.includes(id) : false;
};

/**
 * Hook: the list of businesses the current PIN scope allows to see.
 *
 *   • In offline-dev mode (no Supabase Auth) the scope is never set,
 *     so we return all BUSINESSES — preserves existing behaviour.
 *   • Otherwise we filter BUSINESSES by the unlocked scope.
 *
 * All UI that lists businesses (sidebar, header pills, comparison view)
 * should use this instead of the raw `BUSINESSES` constant so the
 * locked books simply don't appear.
 */
export function useVisibleBusinesses(): Business[] {
  const scope = usePinScope(s => s.unlockedBizIds);
  if (!scope) return BUSINESSES;            // dev / pre-unlock fallback
  return BUSINESSES.filter(b => scope.includes(b.id));
}
