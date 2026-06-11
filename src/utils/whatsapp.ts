/**
 * WhatsApp deep links — restaurants in Spain live on WhatsApp.
 *
 * wa.me wants the number in international format WITHOUT '+' or spaces.
 * Spanish numbers stored locally ("620 863 469") get the 34 prefix;
 * anything that already looks international passes through.
 *
 * Templates: each context offers a small set of ready messages the
 * operator picks from (confirmation, reminder, ask-to-confirm…). Plain
 * text only — emoji render unreliably across devices, so the voice is
 * warm Catalan without decoration. The operator can still edit the text
 * inside WhatsApp before sending.
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

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0];
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface WaTemplate {
  id:    string;
  /** Short label shown in the picker. */
  label: string;
  /** Full message; empty string = open the chat with no prefill. */
  text:  string;
}

/** Message options for a reservation context (detail sheet, briefing). */
export function waReservationTemplates(r: Reservation, bizName: string): WaTemplate[] {
  const nom   = firstName(r.name);
  const quan  = `${fmtDateCa(r.date)} a les ${r.time}`;
  const grup  = `${r.pax} ${r.pax === 1 ? 'persona' : 'persones'}`;
  // Lunch vs dinner decides the dining-room limit quoted in the
  // big-group reminder (migdia room until 16:30, sopars until 23:00).
  const isLunch   = parseInt(r.time.slice(0, 2), 10) < 17;
  const roomLimit = isLunch ? '16:30' : '23:00';
  const apat      = isLunch ? 'dinars' : 'sopars';
  return [
    {
      id: 'confirm',
      label: 'Confirmar la reserva',
      text: `Hola ${nom}! Et confirmem la reserva per ${grup} ${quan} a ${bizName}. Fins aviat!`,
    },
    {
      id: 'remind',
      label: 'Recordatori',
      text: `Hola ${nom}! Et recordem la reserva per ${grup} ${quan} a ${bizName}. Us esperem!`,
    },
    {
      id: 'ask',
      label: 'Demanar confirmació',
      text: `Hola ${nom}! Tens una reserva per ${grup} ${quan} a ${bizName}. Ens pots confirmar que vindreu? Gràcies!`,
    },
    {
      id: 'dishes',
      label: 'Demanar els plats',
      text: `Hola ${nom}! De cara a la reserva de ${quan} a ${bizName}, ens podríeu enviar per aquí els plats que escollireu? Així cuina ho deixa tot avançat i el dia del servei anirà rodat. Gràcies!`,
    },
    // Big-group reminder — only offered for 8+ pax: shared service at the
    // centre of the table (and what that means for the bill) + the
    // dining-room time limit for their meal.
    ...(r.pax >= 8 ? [{
      id: 'group-rules',
      label: 'Recordatori grups grans',
      text: `Hola ${nom}! Un parell d'apunts per a la reserva de ${quan} a ${bizName}:\n\n` +
        `- Els plats se serveixen al centre per compartir, així el servei va més àgil i tothom tasta de tot. ` +
        `Tingueu-ho present a l'hora d'escollir, sobretot de cara a dividir el compte entre tots.\n\n` +
        `- Per als ${apat}, el menjador és disponible fins a les ${roomLimit}.\n\n` +
        `Gràcies! Ens veiem aviat.`,
    }] : []),
    {
      id: 'free',
      label: 'Sense missatge (xat obert)',
      text: '',
    },
  ];
}

/** Message options for the waitlist queue. */
export function waWaitlistTemplates(name: string, bizName: string): WaTemplate[] {
  const nom = firstName(name);
  return [
    {
      id: 'ready',
      label: 'Taula a punt',
      text: `Hola ${nom}! Ja tenim la taula a punt a ${bizName} — pots venir quan vulguis.`,
    },
    {
      id: 'soon',
      label: 'Queda poc',
      text: `Hola ${nom}! Et falta poc per tenir taula a ${bizName} — uns minuts més i t'avisem.`,
    },
    {
      id: 'free',
      label: 'Sense missatge (xat obert)',
      text: '',
    },
  ];
}
