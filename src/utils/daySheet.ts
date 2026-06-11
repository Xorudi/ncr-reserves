/**
 * daySheet — reservations as clean shareable text, at three zooms.
 *
 * Restaurants are still paper-and-WhatsApp at 18:45: the kitchen group
 * wants tonight as a message; the owner wants the week ahead; the
 * planning chat wants a month overview. Same voice, three densities:
 *
 *   • buildDaySheet   — one day, full detail (tables, comandes, flags)
 *   • buildWeekSheet  — 7 days, full detail under a heading per day
 *   • buildMonthSheet — 30 days, one summary line per day (planning view)
 *
 * Pure functions of their inputs; no store, no Date.now().
 */
import type { FloorPlan, Reservation } from '@/types';
import { fmtDateCa } from './whatsapp';

const ACTIVE = new Set(['pending', 'confirmed', 'seated', 'completed']);

function tableNames(r: Reservation, plan?: FloorPlan): string {
  if (!r.tableIds || r.tableIds.length === 0) return 'sense taula';
  return r.tableIds
    .map(id => plan?.tables.find(t => t.id === id)?.name ?? id)
    .join(' + ');
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function activeOn(reservations: Reservation[], iso: string): Reservation[] {
  return reservations
    .filter(r => r.date === iso && ACTIVE.has(r.status))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Detail lines for one day's bookings (no header).
 *
 *  Formatting choices learned from real comandes (walls of menu text):
 *   • The booking line is *bold* — WhatsApp renders asterisks as bold,
 *     so the kitchen group scans names/times at a glance. In plain-text
 *     contexts the asterisks degrade gracefully.
 *   • The client's own line breaks in the comanda are PRESERVED: each
 *     paragraph becomes its own indented » bullet (flattening them into
 *     one giant line was unreadable).
 *   • A blank line after every booking with a comanda — blocks breathe. */
function detailLines(day: Reservation[], plan?: FloorPlan, withNotes = true): string[] {
  const lines: string[] = [];
  const migdia = day.filter(r => parseInt(r.time.slice(0, 2), 10) < 17);
  const nit    = day.filter(r => parseInt(r.time.slice(0, 2), 10) >= 17);

  for (const [label, list] of [['MIGDIA', migdia], ['NIT', nit]] as const) {
    if (list.length === 0) continue;
    const pax = list.reduce((s, r) => s + r.pax, 0);
    lines.push('');
    lines.push(`*${label} · ${list.length} reserv${list.length === 1 ? 'a' : 'es'} · ${pax} pax*`);
    lines.push('');
    for (const r of list) {
      const flags: string[] = [];
      if (r.status === 'pending') flags.push('PENDENT');
      if (r.allergens && r.allergens.length > 0) flags.push(`AL·LÈRGIES: ${r.allergens.join(', ')}`);
      lines.push(`*${r.time} · ${r.name} · ${r.pax}p* · ${tableNames(r, plan)}${flags.length ? ' · ' + flags.join(' · ') : ''}`);
      if (withNotes && r.notes && r.notes.trim()) {
        const paras = r.notes.trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
        for (const p of paras) lines.push(`   » ${p}`);
        lines.push('');
      }
    }
  }
  // No trailing blank — the caller adds its own separators.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function totalsLine(day: Reservation[]): string {
  const totalPax = day.reduce((s, r) => s + r.pax, 0);
  const pendents = day.filter(r => r.status === 'pending').length;
  const allergic = day.filter(r => r.allergens && r.allergens.length > 0).length;
  return `TOTAL: ${day.length} reserves · ${totalPax} pax`
    + (pendents ? ` · ${pendents} pendent${pendents === 1 ? '' : 's'} de confirmar` : '')
    + (allergic ? ` · ${allergic} amb al·lèrgies` : '');
}

// ─── One day, full detail ─────────────────────────────────────────────────────

export function buildDaySheet(
  bizName: string,
  dateIso: string,
  reservations: Reservation[],
  plan?: FloorPlan,
): string {
  const day = activeOn(reservations, dateIso);
  const lines: string[] = [];
  lines.push(`${bizName.toUpperCase()} — ${fmtDateCa(dateIso)}`);
  lines.push('─'.repeat(28));

  if (day.length === 0) {
    lines.push('Cap reserva activa aquest dia.');
    return lines.join('\n');
  }

  lines.push(...detailLines(day, plan, true));
  lines.push('');
  lines.push('─'.repeat(28));
  lines.push(totalsLine(day));
  return lines.join('\n');
}

// ─── Seven days ahead, full detail per day ────────────────────────────────────

export function buildWeekSheet(
  bizName: string,
  fromIso: string,
  reservations: Reservation[],
  plan?: FloorPlan,
): string {
  const lines: string[] = [];
  lines.push(`${bizName.toUpperCase()} — SETMANA (des de ${fmtDateCa(fromIso)})`);
  lines.push('═'.repeat(28));

  const all: Reservation[] = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(fromIso, i);
    const day = activeOn(reservations, iso);
    if (day.length === 0) continue;
    all.push(...day);
    lines.push('');
    lines.push(`*${fmtDateCa(iso).toUpperCase()}*`);
    lines.push(...detailLines(day, plan, true));
  }

  if (all.length === 0) {
    lines.push('Cap reserva activa aquesta setmana.');
    return lines.join('\n');
  }

  lines.push('');
  lines.push('═'.repeat(28));
  lines.push(totalsLine(all));
  return lines.join('\n');
}

// ─── Thirty days ahead, one summary line per day (planning view) ──────────────

export function buildMonthSheet(
  bizName: string,
  fromIso: string,
  reservations: Reservation[],
): string {
  const lines: string[] = [];
  lines.push(`${bizName.toUpperCase()} — PROPERS 30 DIES (des de ${fmtDateCa(fromIso)})`);
  lines.push('═'.repeat(28));
  lines.push('');

  const all: Reservation[] = [];
  let bigTotal = 0;
  for (let i = 0; i < 30; i++) {
    const iso = addDays(fromIso, i);
    const day = activeOn(reservations, iso);
    if (day.length === 0) continue;
    all.push(...day);
    const pax  = day.reduce((s, r) => s + r.pax, 0);
    const bigs = day.filter(r => r.pax >= 8);
    bigTotal += bigs.length;
    lines.push(`${fmtDateCa(iso)} · ${day.length} res · ${pax} pax`
      + (bigs.length ? ` · ${bigs.length} grup${bigs.length === 1 ? '' : 's'} gran${bigs.length === 1 ? '' : 's'} (${bigs.map(r => `${r.pax}p ${r.time}`).join(', ')})` : ''));
  }

  if (all.length === 0) {
    lines.push('Cap reserva activa en els pròxims 30 dies.');
    return lines.join('\n');
  }

  const totalPax = all.reduce((s, r) => s + r.pax, 0);
  lines.push('');
  lines.push('═'.repeat(28));
  lines.push(`TOTAL: ${all.length} reserves · ${totalPax} pax`
    + (bigTotal ? ` · ${bigTotal} grups grans` : ''));
  return lines.join('\n');
}
