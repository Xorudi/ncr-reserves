/**
 * daySheet — the day's reservations as clean shareable text.
 *
 * Restaurants are still paper-and-WhatsApp at 18:45: the kitchen group
 * wants tonight's bookings as a message, not a login. This builds a
 * plain-text "full del dia" — monospace-friendly, grouped by shift,
 * with tables, comandes and allergy flags — ready for the share sheet
 * or the clipboard.
 *
 * Pure function of its inputs; no store, no Date.now().
 */
import type { FloorPlan, Reservation } from '@/types';
import { fmtDateCa } from './whatsapp';

const ACTIVE = new Set(['pending', 'confirmed', 'seated', 'completed']);

const STATUS_TXT: Record<string, string> = {
  pending:   'PENDENT',
  confirmed: 'confirmada',
  seated:    'a taula',
  completed: 'acabada',
};

function tableNames(r: Reservation, plan?: FloorPlan): string {
  if (!r.tableIds || r.tableIds.length === 0) return 'sense taula';
  return r.tableIds
    .map(id => plan?.tables.find(t => t.id === id)?.name ?? id)
    .join(' + ');
}

export function buildDaySheet(
  bizName: string,
  dateIso: string,
  reservations: Reservation[],
  plan?: FloorPlan,
): string {
  const day = reservations
    .filter(r => r.date === dateIso && ACTIVE.has(r.status))
    .sort((a, b) => a.time.localeCompare(b.time));

  const lines: string[] = [];
  lines.push(`${bizName.toUpperCase()} — ${fmtDateCa(dateIso)}`);
  lines.push('─'.repeat(28));

  if (day.length === 0) {
    lines.push('Cap reserva activa aquest dia.');
    return lines.join('\n');
  }

  const migdia = day.filter(r => parseInt(r.time.slice(0, 2), 10) < 17);
  const nit    = day.filter(r => parseInt(r.time.slice(0, 2), 10) >= 17);

  for (const [label, list] of [['MIGDIA', migdia], ['NIT', nit]] as const) {
    if (list.length === 0) continue;
    const pax = list.reduce((s, r) => s + r.pax, 0);
    lines.push('');
    lines.push(`${label} · ${list.length} reserv${list.length === 1 ? 'a' : 'es'} · ${pax} pax`);
    lines.push('');
    for (const r of list) {
      const flags: string[] = [];
      if (r.status === 'pending') flags.push(STATUS_TXT.pending);
      if (r.allergens && r.allergens.length > 0) flags.push(`AL·LÈRGIES: ${r.allergens.join(', ')}`);
      lines.push(`${r.time} · ${r.name} · ${r.pax}p · ${tableNames(r, plan)}${flags.length ? ' · ' + flags.join(' · ') : ''}`);
      if (r.notes && r.notes.trim()) {
        // Indent the brief so each booking reads as a block.
        const note = r.notes.trim().replace(/\s*\n\s*/g, ' / ');
        lines.push(`   » ${note}`);
      }
    }
  }

  const totalPax = day.reduce((s, r) => s + r.pax, 0);
  const pendents = day.filter(r => r.status === 'pending').length;
  const allergic = day.filter(r => r.allergens && r.allergens.length > 0).length;
  lines.push('');
  lines.push('─'.repeat(28));
  lines.push(`TOTAL: ${day.length} reserves · ${totalPax} pax`
    + (pendents ? ` · ${pendents} pendent${pendents === 1 ? '' : 's'} de confirmar` : '')
    + (allergic ? ` · ${allergic} amb al·lèrgies` : ''));

  return lines.join('\n');
}
