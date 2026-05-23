/**
 * Cloud sync engine for NCR RESERVES.
 *
 * Responsibilities:
 *   1. bootstrap()    — load all data from Supabase on app start
 *   2. push()         — fire-and-forget mutation → Supabase
 *   3. subscribe()    — realtime channel for cross-device sync
 *   4. offline queue  — retry failed pushes on reconnect
 *
 * Logging gate:
 *   All [CloudSync] console output is silenced in production unless
 *   the operator opts in via localStorage NCR_DEBUG_PERF=true (set
 *   either manually or by visiting /?debugPerf=1). In dev it stays
 *   loud. Failure paths (console.warn) bypass the gate — those are
 *   actionable, not noise.
 *
 * Circular-dependency note:
 *   This file imports useAppStore lazily (inside async functions / callbacks)
 *   so that useAppStore.ts can safely import push() at module level.
 */
import { supabase, isCloudAvailable } from './supabase';
import type {
  Reservation, Customer, FloorPlan, ShiftNote, AppEvent,
  Employee, EmployeeRole, EmployeeShift,
  BusinessConfig, BusinessHours, BizShift, NotifConfig,
} from '@/types';

// Resolve the debug gate once. Dev builds always log; prod only logs
// when the operator explicitly opted in via /?debugPerf=1 (which
// persists to localStorage NCR_DEBUG_PERF=true) or NCR_DEBUG_SYNC.
function cloudLogEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('NCR_DEBUG_PERF') === 'true') return true;
    if (localStorage.getItem('NCR_DEBUG_SYNC') === 'true') return true;
  } catch { /* ignore */ }
  try {
    const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
    if (isDev) return true;
  } catch { /* ignore */ }
  return false;
}
const SYNC_LOG = cloudLogEnabled();
const slog = SYNC_LOG
  // eslint-disable-next-line no-console
  ? (...args: unknown[]) => console.log('[CloudSync]', ...args)
  : () => { /* silenced */ };

// Content signature of the last tableIds-only push during this session.
// Used to skip re-pushing the exact same assignments (e.g. when a
// duplicated SIGNED_IN re-triggers bootstrap with unchanged data).
let lastTableIdsPushSig = '';
// Last processed Supabase session id+expiry, so duplicate SIGNED_IN
// echoes for the same session don't re-run heavy work.
let lastAuthSessionKey = '';
export function shouldProcessAuthSession(userId: string | null, expiresAt: number | null): boolean {
  const key = `${userId ?? ''}:${expiresAt ?? 0}`;
  if (key === lastAuthSessionKey) return false;
  lastAuthSessionKey = key;
  return true;
}

// ─── Sync status store (tiny, used by UI banner) ──────────────────────────────
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
let _status: SyncStatus = 'idle';
let _statusListeners: Array<(s: SyncStatus) => void> = [];
export const onSyncStatus = (fn: (s: SyncStatus) => void) => { _statusListeners.push(fn); };
const setStatus = (s: SyncStatus) => { _status = s; _statusListeners.forEach(f => f(s)); };
export const getSyncStatus = () => _status;

// ─── Row mappers (TS camelCase ↔ DB snake_case) ───────────────────────────────

function resToRow(r: Reservation) {
  return {
    id:        r.id,
    biz_id:    r.bizId,
    date:      r.date,
    time:      r.time,
    name:      r.name,
    pax:       r.pax,
    status:    r.status,
    phone:     r.phone    ?? null,
    notes:     r.notes    ?? null,
    source:    r.source   ?? null,
    tags:      r.tags     ?? [],
    table_ids: r.tableIds ?? [],   // ← taules assignades
  };
}
function rowToRes(row: any): Reservation {
  return {
    id:       row.id,
    bizId:    row.biz_id,
    date:     row.date,
    time:     row.time,
    name:     row.name,
    pax:      row.pax,
    status:   row.status,
    phone:    row.phone    ?? undefined,
    notes:    row.notes    ?? undefined,
    source:   row.source   ?? undefined,
    tags:     row.tags     ?? [],
    tableIds: row.table_ids ?? [],   // ← taules assignades
  };
}

function custToRow(c: Customer) {
  return {
    id:         c.id,
    name:       c.name,
    phone:      c.phone      ?? '',
    email:      c.email      ?? '',
    visits:     c.visits     ?? 0,
    last_visit: c.lastVisit  ?? '',
    spend:      c.spend      ?? 0,
    tags:       c.tags       ?? [],
    biz:        c.biz        ?? [],
    notes:      c.notes      ?? '',
  };
}
function rowToCust(row: any): Customer {
  return {
    id:        row.id,
    name:      row.name,
    phone:     row.phone,
    email:     row.email,
    visits:    row.visits,
    lastVisit: row.last_visit,
    spend:     Number(row.spend),
    tags:      row.tags  ?? [],
    biz:       row.biz   ?? [],
    notes:     row.notes ?? '',
  };
}

function snToRow(n: ShiftNote) {
  return {
    id:            n.id,
    biz_id:        n.bizId,
    date:          n.date,
    author:        n.author,
    body:          n.body,
    created_at_ms: n.createdAt,
  };
}
function rowToSn(row: any): ShiftNote {
  return {
    id:        row.id,
    bizId:     row.biz_id,
    date:      row.date,
    author:    row.author,
    body:      row.body,
    createdAt: row.created_at_ms,
  };
}

function evToRow(e: AppEvent) {
  return {
    id:          e.id,
    biz_id:      e.bizId,
    date:        e.date,
    title:       e.title,
    time:        e.time        ?? null,
    description: e.description ?? null,
    kind:        e.kind        ?? null,
  };
}
function rowToEv(row: any): AppEvent {
  return {
    id:          row.id,
    bizId:       row.biz_id,
    date:        row.date,
    title:       row.title,
    time:        row.time        ?? undefined,
    description: row.description ?? undefined,
    kind:        row.kind        ?? undefined,
  };
}

function empToRow(e: Employee) {
  return {
    id:         e.id,
    biz_id:     e.bizId,
    full_name:  e.fullName,
    initials:   e.initials,
    role_id:    e.roleId,
    phone:      e.phone     ?? null,
    email:      e.email     ?? null,
    active:     e.active,
    notes:      e.notes     ?? null,
    clocked_in: e.clockedIn ?? false,
    started_at: e.startedAt ?? null,
  };
}
function rowToEmp(row: any): Employee {
  return {
    id:        row.id,
    bizId:     row.biz_id,
    fullName:  row.full_name,
    initials:  row.initials,
    roleId:    row.role_id,
    phone:     row.phone     ?? undefined,
    email:     row.email     ?? undefined,
    active:    row.active,
    notes:     row.notes     ?? undefined,
    clockedIn: row.clocked_in,
    startedAt: row.started_at ?? null,
  };
}

function roleToRow(r: EmployeeRole) {
  return {
    id:         r.id,
    biz_id:     r.bizId,
    name:       r.name,
    color:      r.color,
    text_color: r.textColor,
    order:      r.order,
    active:     r.active,
  };
}
function rowToRole(row: any): EmployeeRole {
  return {
    id:        row.id,
    bizId:     row.biz_id,
    name:      row.name,
    color:     row.color,
    textColor: row.text_color,
    order:     row.order,
    active:    row.active,
  };
}

function empShiftToRow(s: EmployeeShift) {
  return {
    id:          s.id,
    employee_id: s.employeeId,
    business_id: s.businessId,
    dow:         s.dow,
    start_time:  s.startTime,
    end_time:    s.endTime,
    role_id:     s.roleId ?? null,
  };
}
function rowToEmpShift(row: any): EmployeeShift {
  return {
    id:         row.id,
    employeeId: row.employee_id,
    businessId: row.business_id,
    dow:        row.dow,
    startTime:  row.start_time,
    endTime:    row.end_time,
    roleId:     row.role_id ?? undefined,
  };
}

// ─── Push all local state to Supabase (first-device migration) ───────────────
export async function pushAllLocalToCloud(): Promise<void> {
  if (!supabase) return;
  const { useAppStore } = await import('@/store/useAppStore');
  const s = useAppStore.getState();

  // Push in parallel — wrap each builder in .then() so it becomes a real Promise
  const p = (q: any) => Promise.resolve(q);
  const promises = [
    ...s.reservations.map(r   => p(supabase!.from('reservations').upsert(resToRow(r)))),
    ...s.customers.map(c      => p(supabase!.from('customers').upsert(custToRow(c)))),
    ...s.shiftNotes.map(n     => p(supabase!.from('shift_notes').upsert(snToRow(n)))),
    ...s.appEvents.map(e      => p(supabase!.from('app_events').upsert(evToRow(e)))),
    ...s.employees.map(e      => p(supabase!.from('employees').upsert(empToRow(e)))),
    ...s.employeeRoles.map(r  => p(supabase!.from('employee_roles').upsert(roleToRow(r)))),
    ...s.employeeShifts.map(sh => p(supabase!.from('employee_shifts').upsert(empShiftToRow(sh)))),
    ...Object.entries(s.floorPlans).map(([bizId, plan]) =>
      p(supabase!.from('floor_plans').upsert({ biz_id: bizId, data: plan }))),
  ];
  await Promise.allSettled(promises);
}

// ─── Bootstrap: load all data from Supabase ───────────────────────────────────
export async function bootstrapFromCloud(): Promise<boolean> {
  if (!isCloudAvailable()) return false;
  setStatus('syncing');

  try {
    const [resR, custR, fpR, snR, aeR, empR, roleR, empShR] = await Promise.all([
      supabase!.from('reservations').select('*'),
      supabase!.from('customers').select('*'),
      supabase!.from('floor_plans').select('*'),
      supabase!.from('shift_notes').select('*'),
      supabase!.from('app_events').select('*'),
      supabase!.from('employees').select('*'),
      supabase!.from('employee_roles').select('*'),
      supabase!.from('employee_shifts').select('*'),
    ]);

    const { useAppStore } = await import('@/store/useAppStore');

    // Count total records in cloud
    const cloudTotal = (resR.data?.length ?? 0)
      + (custR.data?.length ?? 0)
      + (snR.data?.length ?? 0)
      + (aeR.data?.length ?? 0)
      + (empR.data?.length ?? 0);

    // Count total records locally (meaningful tables only)
    const local = useAppStore.getState();
    const localTotal = local.reservations.length
      + local.customers.length
      + local.shiftNotes.length
      + local.appEvents.length
      + local.employees.length;

    if (cloudTotal === 0 && localTotal > 0) {
      // Cloud is empty but device has data → this is the first device connecting.
      // Push local state up so other devices can sync from it.
      slog('Cloud empty, pushing local data to cloud…');
      await pushAllLocalToCloud();
      setStatus('synced');
      return true;
    }

    // ── Smart merge: preserve local tableIds if cloud has none yet ────────────
    // This handles the case where assignments were made before cloudSync sent
    // table_ids, so cloud has [] but local state has the real data.
    const localTableIds: Record<string, string[]> = {};
    local.reservations.forEach(r => {
      if (r.tableIds && r.tableIds.length > 0) localTableIds[r.id] = r.tableIds;
    });

    const mergedReservations = (resR.data ?? []).map(rowToRes).map(r => {
      if ((!r.tableIds || r.tableIds.length === 0) && localTableIds[r.id]) {
        return { ...r, tableIds: localTableIds[r.id] };
      }
      return r;
    });

    // Push merged tableIds back to Supabase (fire-and-forget).
    // Dedupe: skip the push entirely if the same (reservation id →
    // tableIds) set was already pushed in this session. The user saw
    // "Pushing 120 local tableIds" log multiple times even though the
    // assignments hadn't changed — bootstrap was re-firing on every
    // SIGNED_IN echo, so the same payload kept going up.
    const toSync = mergedReservations.filter(r => r.tableIds && r.tableIds.length > 0 && localTableIds[r.id]);
    if (toSync.length > 0) {
      // Cheap content hash: id + tableIds joined. Sorted so identical
      // contents always produce the same string regardless of order.
      const sig = toSync
        .map(r => `${r.id}:${(r.tableIds ?? []).join(',')}`)
        .sort()
        .join('|');
      if (sig === lastTableIdsPushSig) {
        slog(`Skipping push of ${toSync.length} tableIds — unchanged since last push`);
      } else {
        lastTableIdsPushSig = sig;
        slog(`Pushing ${toSync.length} local tableIds to cloud`);
        Promise.allSettled(toSync.map(r => supabase!.from('reservations').upsert(resToRow(r))));
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Cloud has data → merge into local state
    const currentFloorPlans = local.floorPlans;
    const cloudFloorPlans: Record<string, FloorPlan> = { ...currentFloorPlans };
    for (const row of fpR.data ?? []) {
      cloudFloorPlans[row.biz_id] = row.data as FloorPlan;
    }

    useAppStore.setState({
      reservations:  mergedReservations,
      customers:     (custR.data  ?? []).map(rowToCust),
      floorPlans:    cloudFloorPlans,
      shiftNotes:    (snR.data    ?? []).map(rowToSn),
      appEvents:     (aeR.data    ?? []).map(rowToEv),
      employees:     (empR.data   ?? []).map(rowToEmp),
      employeeRoles: (roleR.data  ?? []).map(rowToRole),
      employeeShifts:(empShR.data ?? []).map(rowToEmpShift),
    });

    setStatus('synced');
    return true;
  } catch (err) {
    console.error('[CloudSync] bootstrap failed:', err);
    setStatus('error');
    return false;
  }
}

// ─── Push: fire-and-forget mutation to Supabase ───────────────────────────────
type PushTable =
  | 'reservations' | 'customers' | 'floor_plans'
  | 'shift_notes'  | 'app_events'
  | 'employees'    | 'employee_roles' | 'employee_shifts'
  | 'biz_settings';

export function push(table: PushTable, action: 'upsert' | 'delete', payload: any): void {
  if (!isCloudAvailable()) {
    queueOffline(table, action, payload);
    return;
  }
  _executePush(table, action, payload).catch(err => {
    console.warn(`[CloudSync] ${table}.${action} failed, queuing:`, err);
    queueOffline(table, action, payload);
    setStatus('error');
  });
}

async function _executePush(table: PushTable, action: string, payload: any): Promise<void> {
  if (!supabase) return;
  if (action === 'upsert') {
    const { error } = await supabase.from(table).upsert(payload);
    if (error) throw error;
  } else if (action === 'delete') {
    const id = typeof payload === 'string' ? payload : payload.id;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  }
}

// ─── Typed push helpers (used by useAppStore actions) ─────────────────────────
export const cloud = {
  upsertReservation:  (r: Reservation)    => push('reservations',   'upsert', resToRow(r)),
  deleteReservation:  (id: string)        => push('reservations',   'delete', id),
  upsertCustomer:     (c: Customer)       => push('customers',      'upsert', custToRow(c)),
  deleteCustomer:     (id: string)        => push('customers',      'delete', id),
  upsertFloorPlan:    (bizId: string, p: FloorPlan) =>
    push('floor_plans', 'upsert', { biz_id: bizId, data: p }),
  upsertShiftNote:    (n: ShiftNote)      => push('shift_notes',    'upsert', snToRow(n)),
  deleteShiftNote:    (id: string)        => push('shift_notes',    'delete', id),
  upsertEvent:        (e: AppEvent)       => push('app_events',     'upsert', evToRow(e)),
  deleteEvent:        (id: string)        => push('app_events',     'delete', id),
  upsertEmployee:     (e: Employee)       => push('employees',      'upsert', empToRow(e)),
  deleteEmployee:     (id: string)        => push('employees',      'delete', id),
  upsertRole:         (r: EmployeeRole)   => push('employee_roles', 'upsert', roleToRow(r)),
  deleteRole:         (id: string)        => push('employee_roles', 'delete', id),
  upsertEmpShift:     (s: EmployeeShift)  => push('employee_shifts','upsert', empShiftToRow(s)),
  deleteEmpShift:     (id: string)        => push('employee_shifts','delete', id),
  upsertBizSettings:  (bizId: string, cfg: BusinessConfig, hours: BusinessHours,
                        shifts: BizShift[], notif: NotifConfig) =>
    push('biz_settings', 'upsert', { biz_id: bizId, config: cfg, hours, shifts, notif }),
};

// ─── Realtime: listen for changes from other devices ─────────────────────────
export function subscribeRealtime(): () => void {
  if (!supabase) return () => {};
  const sb = supabase; // narrow to non-null for the cleanup closure

  const channel = sb
    .channel('ncr-global-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' },
      payload => applyRealtimeChange('reservations', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' },
      payload => applyRealtimeChange('customers', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'floor_plans' },
      payload => applyRealtimeChange('floor_plans', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_notes' },
      payload => applyRealtimeChange('shift_notes', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_events' },
      payload => applyRealtimeChange('app_events', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' },
      payload => applyRealtimeChange('employees', payload))
    .subscribe();

  return () => { sb.removeChannel(channel); };
}

async function applyRealtimeChange(table: string, payload: any) {
  const { eventType, new: row, old } = payload;
  // Lazy import to avoid circular dep at module init time
  const { useAppStore } = await import('@/store/useAppStore');
  const setState = useAppStore.setState.bind(useAppStore);

  switch (table) {
    case 'reservations': {
      if (eventType === 'DELETE') {
        setState(s => ({ reservations: s.reservations.filter(x => x.id !== old.id) }));
      } else {
        const r = rowToRes(row);
        setState(s => ({ reservations: s.reservations.filter(x => x.id !== r.id).concat(r) }));
      }
      break;
    }
    case 'customers': {
      if (eventType === 'DELETE') {
        setState(s => ({ customers: s.customers.filter(x => x.id !== old.id) }));
      } else {
        const c = rowToCust(row);
        setState(s => ({ customers: s.customers.filter(x => x.id !== c.id).concat(c) }));
      }
      break;
    }
    case 'floor_plans': {
      if (eventType !== 'DELETE') {
        setState(s => ({
          floorPlans: { ...s.floorPlans, [row.biz_id]: row.data as FloorPlan },
        }));
      }
      break;
    }
    case 'shift_notes': {
      if (eventType === 'DELETE') {
        setState(s => ({ shiftNotes: s.shiftNotes.filter(x => x.id !== old.id) }));
      } else {
        const n = rowToSn(row);
        setState(s => ({ shiftNotes: s.shiftNotes.filter(x => x.id !== n.id).concat(n) }));
      }
      break;
    }
    case 'app_events': {
      if (eventType === 'DELETE') {
        setState(s => ({ appEvents: s.appEvents.filter(x => x.id !== old.id) }));
      } else {
        const e = rowToEv(row);
        setState(s => ({ appEvents: s.appEvents.filter(x => x.id !== e.id).concat(e) }));
      }
      break;
    }
    case 'employees': {
      if (eventType === 'DELETE') {
        setState(s => ({ employees: s.employees.filter(x => x.id !== old.id) }));
      } else {
        const e = rowToEmp(row);
        setState(s => ({ employees: s.employees.filter(x => x.id !== e.id).concat(e) }));
      }
      break;
    }
  }
}

// ─── Offline queue (localStorage) ─────────────────────────────────────────────
const QUEUE_KEY = 'ncr-offline-queue-v1';

interface QueuedChange {
  id:        string;
  table:     string;
  action:    string;
  payload:   any;
  queuedAt:  string;
}

function queueOffline(table: string, action: string, payload: any): void {
  try {
    const existing: QueuedChange[] = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    existing.push({ id: `q-${Date.now()}`, table, action, payload, queuedAt: new Date().toISOString() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
    setStatus('offline');
  } catch { /* storage full or private mode */ }
}

export function getOfflineQueueLength(): number {
  try {
    return (JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedChange[]).length;
  } catch { return 0; }
}

export async function flushOfflineQueue(): Promise<void> {
  if (!isCloudAvailable()) return;
  try {
    const queue: QueuedChange[] = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    if (queue.length === 0) return;
    slog(`flushing ${queue.length} queued changes`);
    for (const change of queue) {
      await _executePush(change.table as PushTable, change.action, change.payload);
    }
    localStorage.removeItem(QUEUE_KEY);
    setStatus('synced');
  } catch (err) {
    console.error('[CloudSync] flush failed:', err);
  }
}

// ─── Reconnect handler ────────────────────────────────────────────────────────
export function watchConnectivity(): () => void {
  const onOnline = async () => {
    await flushOfflineQueue();
    await bootstrapFromCloud(); // re-fetch latest state
  };
  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', () => setStatus('offline'));
  return () => {
    window.removeEventListener('online',  onOnline);
    window.removeEventListener('offline', () => setStatus('offline'));
  };
}
