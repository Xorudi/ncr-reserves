/**
 * Briefing engine — narrates the operational state of the service in 2-4
 * humane sentences, plus a short list of suggested next actions and any
 * detected risks worth surfacing.
 *
 * This is the layer that turns NCR Reserves from "an app that lists
 * reservations" into "an assistant that helps run the service". It does
 * not invent data: every sentence and every action is derived from the
 * same inputs the insights engine already uses. When the inputs are
 * thin, the briefing falls back to a single calm line rather than
 * fabricating context — smart silence by design.
 *
 * Output shape is consumed by BriefingSheet.tsx and by the "Veure
 * detall →" path on InsightOfMoment when the headline has no specific
 * action attached.
 */

import type { Reservation, Customer, BusinessId, WaitlistEntry } from '@/types';
import type { WeatherForecast } from '@/lib/weather';
import type { AmbientState } from '@/hooks/useAmbientState';
import { rankCustomers, type CustomerStats } from '@/utils/loyalty';

export type SuggestedActionKind =
  | 'open-floor-plan'
  | 'open-waitlist'
  | 'open-weather'
  | 'show-pending'
  | 'show-large-groups'
  | 'show-vip'
  | 'show-hour';

export interface SuggestedAction {
  /** Stable id so React can key these without duplication concerns. */
  id:    string;
  /** Verb-led label in operator tone ("Revisar distribució de taules"). */
  label: string;
  /** What kind of UI surface this action should reach. */
  kind:  SuggestedActionKind;
  /** Extra payload used by the host (e.g. hour for show-hour). */
  meta?: Record<string, string | number>;
  /** Tone hint — drives the side accent on the action button. */
  tone:  'olive' | 'clay' | 'terracotta' | 'ink';
}

export interface Risk {
  id:    string;
  text:  string;          // single-line, calm wording
  tone:  'warning' | 'alert' | 'neutral';
}

export interface Briefing {
  /** Two to four narrative sentences. Empty array on truly thin days. */
  summary: string[];
  /** Operational risks worth eyes-on. Sorted alert → warning → neutral. */
  risks:   Risk[];
  /** Suggested next actions. Max 4. Most useful first. */
  actions: SuggestedAction[];
  /** Echo of ambient.level — the host uses this to colour the sheet chip. */
  level:   AmbientState['level'];
}

interface GenerateOpts {
  selectedDate: Date;
  bizId:        BusinessId;
  reservations: Reservation[];
  customers:    Customer[];
  waitlist:     WaitlistEntry[];
  forecast?:    WeatherForecast | null;
  ambient:      AmbientState;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const DOW_SINGULAR = ['diumenge','dilluns','dimarts','dimecres','dijous','divendres','dissabte'];

export function generateBriefing(opts: GenerateOpts): Briefing {
  const { selectedDate, bizId, reservations, customers, waitlist, forecast, ambient } = opts;
  const dayIso  = isoDay(selectedDate);
  const todayIso = isoDay(new Date());
  const isToday  = dayIso === todayIso;
  const now = new Date();
  const hourNow = now.getHours();

  const dayRes  = reservations.filter(r => r.bizId === bizId && r.date === dayIso);
  const active  = dayRes.filter(r => r.status !== 'cancelled' && r.status !== 'noshow');
  const totalPax = active.reduce((s, r) => s + r.pax, 0);

  // ── Baseline: same DOW avg over the last 4 weeks ──────────────────────
  const sameDow: number[] = [];
  for (let w = 1; w <= 4; w++) {
    const past = new Date(selectedDate);
    past.setDate(past.getDate() - w * 7);
    const iso = isoDay(past);
    sameDow.push(
      reservations.filter(r =>
        r.bizId === bizId && r.date === iso && r.status !== 'cancelled'
      ).length
    );
  }
  const avgSameDow = sameDow.reduce((s, n) => s + n, 0) / Math.max(1, sameDow.length);
  const dowName = DOW_SINGULAR[selectedDate.getDay()];

  // ── Compositional data ────────────────────────────────────────────────
  const pending = active.filter(r => r.status === 'pending');
  const bigGroups = active.filter(r => r.pax >= 8);
  const bigGroupTotalPax = bigGroups.reduce((s, r) => s + r.pax, 0);
  const bigGroupFirstTime = bigGroups.length > 0
    ? [...bigGroups].sort((a, b) => a.time.localeCompare(b.time))[0].time
    : null;

  // Large groups without an assigned table — operational risk.
  const bigGroupsNoTable = bigGroups.filter(r => !r.tableIds || r.tableIds.length === 0);

  // Pending count near the next service window (within the next 4 h).
  const pendingNearService = isToday
    ? pending.filter(r => {
        const h = parseInt(r.time.split(':')[0], 10);
        return h >= hourNow && h <= hourNow + 4;
      })
    : pending;

  // Waitlist still waiting / notified today.
  const queueActive = waitlist.filter(w => {
    if (w.bizId !== bizId) return false;
    const d = new Date(w.addedAt);
    return isoDay(d) === dayIso && (w.status === 'waiting' || w.status === 'notified');
  });

  // VIP / recurring customers booked today.
  let vipCount = 0;
  let recurringCount = 0;
  if (active.length > 0) {
    const ranked = rankCustomers(customers, reservations, bizId);
    const byKey = new Map<string, CustomerStats>();
    ranked.forEach(r => {
      if (r.customer.phone) byKey.set(`p:${r.customer.phone}`, r.stats);
      byKey.set(`n:${r.customer.name.trim().toLowerCase()}`, r.stats);
    });
    for (const r of active) {
      const s = (r.phone && byKey.get(`p:${r.phone}`)) ||
                byKey.get(`n:${r.name.trim().toLowerCase()}`);
      if (!s) continue;
      const id = s.level.id;
      if (id === 'diamond' || id === 'master') vipCount++;
      else if ((id === 'gold' || id === 'platinum') && s.completed >= 5) recurringCount++;
    }
  }

  // Rain risk hour (if any) — from ambient flags + forecast hourly.
  let rainStartHour: number | null = null;
  if (ambient.flags.has('rain-risk') && forecast?.hourly) {
    const fromHour = isToday ? hourNow : 0;
    const slot = forecast.hourly.find(h =>
      h.hour >= fromHour && h.precipProb >= 60 &&
      (h.condition === 'rain' || h.condition === 'showers' || h.condition === 'drizzle' || h.condition === 'thunder')
    );
    if (slot) rainStartHour = slot.hour;
  }

  // ── Narrative summary — 2-4 short, operator-tone sentences ───────────
  const summary: string[] = [];

  // Opening line — mood + load.
  const loadPhrase =
    ambient.level === 'peak'   ? 'pic de servei' :
    ambient.level === 'busy'   ? 'servei amb força càrrega' :
    ambient.level === 'calm'   ? 'servei tranquil' :
                                  'ritme habitual';
  if (active.length === 0 && isToday) {
    summary.push('Encara no hi ha reserves confirmades per avui.');
  } else if (active.length === 0) {
    summary.push(`Sense reserves confirmades per aquest ${dowName}.`);
  } else if (avgSameDow >= 2) {
    const delta = ((active.length - avgSameDow) / avgSameDow) * 100;
    if (Math.abs(delta) < 15) {
      summary.push(`Avui ${loadPhrase} · ${active.length} reserves i ${totalPax} pax · en línia amb un ${dowName} habitual.`);
    } else if (delta > 0) {
      summary.push(`Avui ${loadPhrase} · ${active.length} reserves i ${totalPax} pax · més moviment del que es veu un ${dowName} habitual.`);
    } else {
      summary.push(`Avui ${loadPhrase} · ${active.length} reserves i ${totalPax} pax · més fluix del que es veu un ${dowName} habitual.`);
    }
  } else {
    summary.push(`Avui ${loadPhrase} · ${active.length} reserves i ${totalPax} pax confirmats.`);
  }

  // Large groups sentence
  if (bigGroups.length > 0 && bigGroupFirstTime) {
    if (bigGroups.length === 1) {
      summary.push(`Hi ha 1 grup gran a les ${bigGroupFirstTime} (${bigGroupTotalPax} pax) — val la pena revisar la distribució de taules.`);
    } else {
      summary.push(`Hi ha ${bigGroups.length} grups grans a partir de les ${bigGroupFirstTime} (${bigGroupTotalPax} pax en total) — revisa la distribució de taules abans del pic.`);
    }
  }

  // Weather sentence — terrace risk
  if (rainStartHour !== null) {
    const lab = isToday && rainStartHour <= hourNow + 1
      ? 'ara mateix'
      : `a partir de les ${String(rainStartHour).padStart(2, '0')}:00`;
    summary.push(`La terrassa pot perdre activitat ${lab} · val la pena tenir pla interior preparat.`);
  } else if (ambient.flags.has('morning-prep') && ambient.level !== 'peak' && ambient.level !== 'busy') {
    if (forecast && forecast.condition === 'clear' && forecast.tMax >= 18 && forecast.tMax <= 28) {
      summary.push('Bon dia per tenir la terrassa activa des de l\'inici.');
    }
  }

  // Pending pressure
  if (pendingNearService.length >= 3) {
    summary.push(`Tens ${pendingNearService.length} reserves pendents de confirmar ${isToday ? 'pròximes' : 'aquest dia'} — bon moment per trucar abans del servei.`);
  } else if (queueActive.length >= 3) {
    summary.push(`Hi ha ${queueActive.length} grups esperant a la sala · revisa la cua per encabir-los aviat.`);
  } else if (ambient.level === 'calm' && active.length > 0 && !bigGroups.length && rainStartHour === null) {
    if (recurringCount + vipCount >= 1) {
      summary.push('Bon moment per cuidar detalls i acompanyar els clients habituals.');
    } else {
      summary.push('Bon moment per repassar la sala amb calma i preparar el servei.');
    }
  }

  // VIP/recurring extra mention only if no other client line landed AND it adds info
  if (vipCount >= 1 && summary.length < 4) {
    summary.push(vipCount === 1
      ? 'Un client VIP avui · reserva preferent.'
      : `${vipCount} clients VIP avui · reserves preferents.`);
  }

  // ── Risks — only material ones, sorted by severity ───────────────────
  const risks: Risk[] = [];
  if (bigGroupsNoTable.length > 0) {
    risks.push({
      id: 'no-table-big-group',
      text: bigGroupsNoTable.length === 1
        ? `Un grup de ${bigGroupsNoTable[0].pax} pax a les ${bigGroupsNoTable[0].time} encara no té taula assignada.`
        : `${bigGroupsNoTable.length} grups grans encara sense taula assignada.`,
      tone: 'alert',
    });
  }
  if (rainStartHour !== null && bigGroups.length > 0) {
    risks.push({
      id: 'rain-with-bigs',
      text: 'Hi ha grups grans i risc de pluja la mateixa tarda — assegura el pla interior.',
      tone: 'alert',
    });
  } else if (rainStartHour !== null) {
    risks.push({
      id: 'rain',
      text: `Risc de pluja a partir de les ${String(rainStartHour).padStart(2,'0')}:00 — vigila les taules exteriors.`,
      tone: 'warning',
    });
  }
  if (pendingNearService.length >= 3) {
    risks.push({
      id: 'pending-pile',
      text: `${pendingNearService.length} reserves pendents sense confirmar a curt termini.`,
      tone: 'warning',
    });
  }
  if (queueActive.length >= 3) {
    risks.push({
      id: 'queue-pressure',
      text: `${queueActive.length} grups esperant a la cua de sala.`,
      tone: 'warning',
    });
  }
  if (ambient.level === 'peak' && risks.length === 0) {
    risks.push({
      id: 'peak-load',
      text: 'Pic de servei — el ritme pot acumular retards si no es gestiona l\'entrada.',
      tone: 'warning',
    });
  }
  const sevOrder = { alert: 0, warning: 1, neutral: 2 } as const;
  risks.sort((a, b) => sevOrder[a.tone] - sevOrder[b.tone]);

  // ── Suggested actions — max 4, ordered by usefulness ─────────────────
  const actions: SuggestedAction[] = [];
  if (bigGroupsNoTable.length > 0 || bigGroups.length > 0) {
    actions.push({
      id: 'go-floor',
      label: bigGroupsNoTable.length > 0 ? 'Assignar taula a grups grans' : 'Revisar distribució de taules',
      kind: 'open-floor-plan',
      tone: bigGroupsNoTable.length > 0 ? 'terracotta' : 'clay',
    });
  }
  if (pendingNearService.length >= 2) {
    actions.push({
      id: 'show-pending',
      label: `Confirmar ${pendingNearService.length} reserves pendents`,
      kind: 'show-pending',
      tone: 'clay',
    });
  }
  if (queueActive.length >= 1) {
    actions.push({
      id: 'open-queue',
      label: queueActive.length === 1 ? 'Veure cua d\'espera' : `Atendre cua (${queueActive.length})`,
      kind: 'open-waitlist',
      tone: queueActive.length >= 3 ? 'terracotta' : 'clay',
    });
  }
  if (rainStartHour !== null) {
    actions.push({
      id: 'open-weather',
      label: 'Veure previsió i preparar pla interior',
      kind: 'open-weather',
      tone: 'clay',
    });
  }
  if (vipCount >= 1) {
    actions.push({
      id: 'show-vip',
      label: vipCount === 1 ? 'Veure client VIP del dia' : `Veure ${vipCount} clients VIP`,
      kind: 'show-vip',
      tone: 'olive',
    });
  }
  // If we still have slack, surface the concentration hour as a jump target.
  if (actions.length < 4 && ambient.hourSignals.size > 0) {
    const concentration = [...ambient.hourSignals.entries()]
      .find(([, sig]) => sig.kind === 'concentration');
    if (concentration) {
      const [h] = concentration;
      actions.push({
        id: `jump-${h}`,
        label: `Anar a la franja de les ${String(h).padStart(2, '0')}:00`,
        kind: 'show-hour',
        meta: { hour: h },
        tone: 'ink',
      });
    }
  }

  return {
    summary: summary.slice(0, 4),
    risks,
    actions: actions.slice(0, 4),
    level: ambient.level,
  };
}
