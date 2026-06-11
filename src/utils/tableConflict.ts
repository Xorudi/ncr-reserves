/**
 * tableConflict — detect probable double-bookings before they happen.
 *
 * Two reservations can legitimately share a table on the same day
 * (lunch at 13:00, dinner at 21:00) — the conflict is TIME overlap:
 * same table, same date, both still active, and their estimated seating
 * windows collide. The window length comes from the business's
 * avgTableMinutes (Horaris config), defaulting to 90.
 *
 * Pure function — callers feed it the candidate tables, the day's
 * reservations and the context; it answers "who would you collide with".
 * The operator stays the authority: the UI warns, it never blocks.
 */
import type { FloorPlan, Reservation } from '@/types';

const INACTIVE = new Set(['cancelled', 'noshow', 'completed']);

export interface TableConflict {
  tableId:   string;
  tableName: string;
  /** The existing reservation we would collide with. */
  other:     Reservation;
}

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function findTableConflicts(
  tableIds: string[],
  plan: FloorPlan | undefined,
  dayRes: Reservation[],
  opts: {
    /** HH:MM of the reservation being assigned. Without it, any active
     *  holder of the table counts as a conflict (conservative). */
    time?: string;
    /** Estimated seating window in minutes (avgTableMinutes). */
    durationMin?: number;
    /** Reservation being edited — never conflicts with itself. */
    excludeResId?: string;
  } = {},
): TableConflict[] {
  if (!plan || tableIds.length === 0) return [];
  const dur  = opts.durationMin && opts.durationMin > 0 ? opts.durationMin : 90;
  const mine = opts.time ? toMin(opts.time) : null;

  const out: TableConflict[] = [];
  for (const id of tableIds) {
    for (const r of dayRes) {
      if (r.id === opts.excludeResId) continue;
      if (INACTIVE.has(r.status)) continue;
      if (!r.tableIds?.includes(id)) continue;
      if (mine !== null) {
        const theirs = toMin(r.time);
        // Both windows are dur long → they overlap iff starts are closer
        // than one window. Unparseable time falls back to conservative.
        if (theirs !== null && Math.abs(theirs - mine) >= dur) continue;
      }
      const t = plan.tables.find(t => t.id === id);
      out.push({ tableId: id, tableName: t?.name ?? id, other: r });
    }
  }
  return out;
}
