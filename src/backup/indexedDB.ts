/**
 * IndexedDB wrapper for local backup storage.
 * Keeps up to MAX_LOCAL snapshots, pruning oldest automatically.
 */
import type { AppBackup, AppBackupMeta } from './types';

const DB_NAME    = 'ncr-backups-v1';
const DB_VERSION = 1;
const STORE      = 'snapshots';
export const MAX_LOCAL = 25;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db); };
    req.onerror   = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

export async function idbSave(backup: AppBackup): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(backup);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function idbGetAll(): Promise<AppBackup[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as AppBackup[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(id: string): Promise<AppBackup | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function idbDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function idbClearAll(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Keep only the newest MAX_LOCAL, delete older ones */
export async function idbPrune(): Promise<void> {
  const all      = await idbGetAll(); // sorted newest-first
  const toDelete = all.slice(MAX_LOCAL);
  await Promise.all(toDelete.map(b => idbDelete(b.id)));
}

/** Returns list without data payload (for listing UI) */
export async function idbListMeta(): Promise<AppBackupMeta[]> {
  const all = await idbGetAll();
  return all.map(({ data: _data, ...meta }) => meta);
}
