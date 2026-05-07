/**
 * tableStatus — single source of truth for "what's the live status of a
 * table on a given day?", used both by MobileTablesScreen (the live floor
 * plan) and TableSelectorModal (the picker inside the new-reservation form)
 * so both views agree on which tables are free, blocked, seated, etc.
 *
 * Rules:
 *   - 'blocked' and 'playing' are MANUAL overrides — they survive across
 *     dates because they are not derived from reservations.
 *   - For every other status the live value is computed from `dayRes`:
 *     · No active reservation → 'free'
 *     · An active reservation → status reflects the highest priority one
 *       (seated > confirmed > pending → 'seated' / 'confirmed' / 'reserved')
 */
import type { FloorTable, TableStatus, Reservation } from '@/types';

const INACTIVE = new Set(['cancelled', 'noshow', 'completed']);

export function effectiveTable(t: FloorTable, dayRes: Reservation[]): FloorTable {
  // Manual overrides survive date changes
  if (t.status === 'blocked' || t.status === 'playing') return t;

  const active = dayRes.filter(r =>
    r.tableIds?.includes(t.id) && !INACTIVE.has(r.status),
  );

  if (active.length === 0) {
    return { ...t, status: 'free', res: undefined, time: undefined };
  }

  // Priority: seated > confirmed > pending
  const best =
    active.find(r => r.status === 'seated') ??
    active.find(r => r.status === 'confirmed') ??
    active[0];

  const tableStatus: TableStatus =
    best.status === 'seated'    ? 'seated'    :
    best.status === 'confirmed' ? 'confirmed' :
    'reserved';

  return { ...t, status: tableStatus, res: best.name, time: best.time };
}
