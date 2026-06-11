/**
 * WhatsApp deep links — restaurants in Spain live on WhatsApp.
 *
 * wa.me wants the number in international format WITHOUT '+' or spaces.
 * Spanish numbers stored locally ("620 863 469") get the 34 prefix;
 * anything that already looks international passes through.
 *
 * Message builders keep the operator's voice: short, warm, Catalan.
 */
import type { Reservation } from '@/types';

/** Normalize to wa.me digits, or null when the phone is unusable. */
export function waPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let p = raw.replace(/[^\d+]/g, '');
  if (p.startsWith('+'))  p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  // Bare Spanish number (mobile 6/7, landline 8/9) → add country code.
  if (/^[6789]\d{8}$/.test(p)) p = '34' + p;
  return p.length >= 10 ? p : null;
}

export function waLink(phone: string | undefined | null, message?: string): string | null {
  const p = waPhone(phone);
  if (!p) return null;
  const q = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${p}${q}`;
}

const MONTHS_CA = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const DAYS_CA = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];

/** "divendres 12 de juny" from an ISO date. */
export function fmtDateCa(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  return `${DAYS_CA[d.getDay()]} ${d.getDate()} de ${MONTHS_CA[d.getMonth()]}`;
}

/** Confirmation text for a reservation — the most common WhatsApp. */
export function waReservationMessage(r: Reservation, bizName: string): string {
  const firstName = r.name.trim().split(/\s+/)[0];
  return `Hola ${firstName}! Et confirmem la reserva per ${r.pax} ${r.pax === 1 ? 'persona' : 'persones'} ` +
    `${fmtDateCa(r.date)} a les ${r.time} a ${bizName}. Fins aviat! 🍽`;
}

/** "Your table is ready" — for the waitlist queue. */
export function waWaitlistMessage(name: string, bizName: string): string {
  const firstName = name.trim().split(/\s+/)[0];
  return `Hola ${firstName}! Ja tenim la taula a punt a ${bizName} — pots venir quan vulguis 👍`;
}
