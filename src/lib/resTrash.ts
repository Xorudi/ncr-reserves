/**
 * resTrash — local safety net for deleted reservations.
 *
 * Every reservation deleted on THIS device is snapshotted here before it
 * leaves the store, so an accidental "mantén premut per eliminar" can be
 * undone days later from Més → Historial. Restoring re-inserts the
 * reservation with its ORIGINAL id and data — it returns to the exact
 * day/time it lived at, and the cloud upsert propagates it everywhere.
 *
 * Deliberately device-local (localStorage, no Supabase schema): it's a
 * "por si las moscas" net, not a synced audit log. Capped at 100 entries
 * / 90 days so it can't grow unbounded.
 */
import type { Reservation } from '@/types';

const KEY = 'ncr-res-trash-v1';
const MAX_ENTRIES = 100;
const MAX_AGE_MS  = 90 * 24 * 60 * 60 * 1000;

export interface TrashedRes {
  res:       Reservation;
  deletedAt: string;   // ISO timestamp
}

function load(): TrashedRes[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as TrashedRes[];
    if (!Array.isArray(list)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return list.filter(t => t?.res?.id && new Date(t.deletedAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

function save(list: TrashedRes[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES))); } catch { /* ignore */ }
}

/** Snapshot a reservation on its way out. Newest first. */
export function pushToTrash(res: Reservation): void {
  const list = load().filter(t => t.res.id !== res.id);
  list.unshift({ res, deletedAt: new Date().toISOString() });
  save(list);
}

/** Deleted reservations, newest first. */
export function listTrash(): TrashedRes[] {
  return load();
}

export function removeFromTrash(resId: string): void {
  save(load().filter(t => t.res.id !== resId));
}

export function clearTrash(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
