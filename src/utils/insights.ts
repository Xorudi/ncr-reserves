/**
 * Smart insights engine — interprets reservation/customer/weather data to
 * surface human-readable observations the operator can act on.
 *
 * Architecture (v2):
 *   1. Generators (pure functions) build a flat list of candidate insights.
 *   2. Each insight carries `priority` (0-100), `category`, and `headline`
 *      eligibility so the presentation layer can pick the "insight del moment"
 *      and demote/cull the rest.
 *   3. UI lives in:
 *        - components/shared/InsightOfMoment.tsx (hero card, 1 insight max)
 *        - components/shared/SmartInsightsStrip.tsx (compact row, secondaries)
 *
 * Design principles:
 *   - Silent by default: irrelevant categories return [].
 *   - Contextual: morning/lunch/evening, today vs future, busy vs quiet.
 *   - Predictive when possible (next-hour rain, projected capacity).
 *   - Memory-aware: compares to same DOW history.
 */

import type { Reservation, Customer, BusinessId, WaitlistEntry } from '@/types';
import type { WeatherForecast } from '@/lib/weather';
import { operationalInsights } from '@/lib/weather';
import { rankCustomers, type CustomerStats } from '@/utils/loyalty';

export type InsightTone = 'positive' | 'warning' | 'alert' | 'neutral';

/** Bucketed for visual styling and prioritisation. */
export type InsightCategory =
  | 'operational'   // distribute tables, peaks, queue pressure (now)
  | 'predictive'   // next-hour, projected capacity, walk-in prediction
  | 'business'     // trends, comparatives, revenue signals
  | 'client'       // VIP, birthdays, recurring patrons
  | 'weather'      // wx-driven
  | 'context';     // time-of-day nudge, memory recall

/** What a tap on the insight chip should do. */
export type InsightAction =
  | { kind: 'open-weather' }
  | { kind: 'open-waitlist' }
  | { kind: 'open-stats-comparative' }
  | { kind: 'show-reservations'; filter: ReservationFilter; title: string }
  | { kind: 'scroll-to-hour'; hour: number };

/** A predicate name the UI knows how to evaluate against the day's reservations. */
export type ReservationFilter =
  | { kind: 'large-groups'; minPax?: number }
  | { kind: 'vip' }                       // Diamond+ from loyalty
  | { kind: 'birthday' }
  | { kind: 'hour'; hour: number };

export interface SmartInsight {
  id:       string;             // stable, used as React key + dismiss persist
  icon:     string;             // emoji
  text:     string;             // headline (one line)
  sub?:     string;             // optional secondary
  tone:     InsightTone;
  category: InsightCategory;
  /** 0 (silent) - 100 (must-see). Drives hero pick + sort order. */
  priority: number;
  /** When true, eligible to be the "insight del moment" hero. */
  headline?: boolean;
  action?:  InsightAction;      // optional — chip becomes tappable when set
}

interface GenerateOpts {
  selectedDate:    Date;
  bizId:           BusinessId;
  reservations:    Reservation[];
  customers:       Customer[];
  waitlist:        WaitlistEntry[];
  forecast?:       WeatherForecast | null;
}

// ─── Dismiss persistence (per day) ────────────────────────────────────────────

function dismissKey(dayIso: string): string {
  return `ncr.insights.dismissed.${dayIso}`;
}
export function isInsightDismissed(insightId: string, dayIso: string): boolean {
  try {
    const stored = sessionStorage.getItem(dismissKey(dayIso));
    if (!stored) return false;
    return stored.split('|').includes(insightId);
  } catch { return false; }
}
export function dismissInsight(insightId: string, dayIso: string) {
  try {
    const stored = sessionStorage.getItem(dismissKey(dayIso)) ?? '';
    const ids = new Set(stored.split('|').filter(Boolean));
    ids.add(insightId);
    sessionStorage.setItem(dismissKey(dayIso), Array.from(ids).join('|'));
  } catch { /* private mode */ }
}

// ─── Apply a ReservationFilter to a day's bookings ────────────────────────────

export interface MatchedReservation { reservation: Reservation; isVip: boolean; }

export function matchReservations(
  filter: ReservationFilter,
  bookings: Reservation[],
  ranked?: Map<string, CustomerStats>,
): MatchedReservation[] {
  switch (filter.kind) {
    case 'large-groups': {
      const min = filter.minPax ?? 8;
      return bookings.filter(r => r.pax >= min).map(r => ({ reservation: r, isVip: false }));
    }
    case 'birthday':
      return bookings
        .filter(r => r.tags?.includes('birthday') || (r.notes && r.notes.toLowerCase().includes('aniversari')))
        .map(r => ({ reservation: r, isVip: false }));
    case 'hour':
      return bookings
        .filter(r => parseInt(r.time.split(':')[0], 10) === filter.hour)
        .map(r => ({ reservation: r, isVip: false }));
    case 'vip':
      if (!ranked) return [];
      return bookings
        .filter(r => {
          const stats = (r.phone && ranked.get(`p:${r.phone}`)) ||
                        ranked.get(`n:${r.name.trim().toLowerCase()}`);
          return stats && (stats.level.id === 'diamond' || stats.level.id === 'master');
        })
        .map(r => ({ reservation: r, isVip: true }));
    default:
      return [];
  }
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ─── Generator ───────────────────────────────────────────────────────────────

export function generateDayInsights(opts: GenerateOpts): SmartInsight[] {
  const { selectedDate, bizId, reservations, customers, waitlist, forecast } = opts;
  const dayIso = isoDay(selectedDate);
  const today = startOfDay(new Date());
  const isToday  = isoDay(today) === dayIso;
  const isPast   = dayIso < isoDay(today);
  const isFuture = dayIso > isoDay(today);

  const out: SmartInsight[] = [];

  const dayRes = reservations.filter(r => r.bizId === bizId && r.date === dayIso);
  const active = dayRes.filter(r => r.status !== 'cancelled' && r.status !== 'noshow');
  const totalPax = active.reduce((s, r) => s + r.pax, 0);

  const now = new Date();
  const hourNow = now.getHours();

  // ── 1. Comparative vs same DOW over the last 4 weeks ───────────────────────
  const dow = selectedDate.getDay();
  const dowNames = ['diumenges','dilluns','dimarts','dimecres','dijous','divendres','dissabtes'];
  const sameDowCounts: number[] = [];
  for (let w = 1; w <= 4; w++) {
    const past = new Date(selectedDate);
    past.setDate(past.getDate() - w * 7);
    const iso = isoDay(past);
    const c = reservations.filter(r =>
      r.bizId === bizId && r.date === iso && r.status !== 'cancelled'
    ).length;
    sameDowCounts.push(c);
  }
  const avgSameDow = sameDowCounts.reduce((s, n) => s + n, 0) / 4;
  if (avgSameDow >= 2 && active.length > 0) {
    const delta = ((active.length - avgSameDow) / avgSameDow) * 100;
    if (delta >= 30) {
      out.push({
        id: 'cmp-up', icon: '📈',
        text: `Avui hi ha més moviment que un ${dowNames[dow].replace(/s$/, '')} habitual`,
        sub:  `${active.length} reserves · mitjana ${avgSameDow.toFixed(1)}`,
        tone: 'positive', category: 'business',
        priority: Math.min(80, 50 + Math.round(delta / 4)),
        headline: delta >= 50,
      });
    } else if (delta >= 15) {
      out.push({
        id: 'cmp-up', icon: '📈',
        text: `Lleuger augment vs ${dowNames[dow]} habituals`,
        sub:  `${active.length} reserves · mitjana ${avgSameDow.toFixed(1)}`,
        tone: 'positive', category: 'business',
        priority: 40,
      });
    } else if (delta <= -25) {
      out.push({
        id: 'cmp-down', icon: '📉',
        text: `Ritme més tranquil que un ${dowNames[dow].replace(/s$/, '')} habitual`,
        sub:  `${active.length} reserves · mitjana ${avgSameDow.toFixed(1)}`,
        tone: 'warning', category: 'business',
        priority: Math.min(70, 40 + Math.abs(Math.round(delta / 5))),
        headline: delta <= -40 && (isToday || isFuture),
      });
    }
  }

  // ── 2. Ritme superior al normal (today only) ──────────────────────────────
  if (isToday) {
    const earlyBird = hourNow < 13;
    if (earlyBird && active.length >= Math.max(6, avgSameDow * 0.7)) {
      out.push({
        id: 'ritme-fast', icon: '🔥',
        text: 'Ritme superior al normal',
        sub:  `${active.length} reserves abans de migdia`,
        tone: 'positive', category: 'predictive',
        priority: 60, headline: active.length >= avgSameDow,
      });
    }
  }

  // ── 3. Grup gran detectat ──────────────────────────────────────────────────
  const largeGroups = active.filter(r => r.pax >= 8);
  if (largeGroups.length > 0) {
    const totalPaxBig = largeGroups.reduce((s, r) => s + r.pax, 0);
    const firstTime = largeGroups.map(r => r.time).sort()[0];
    out.push({
      id: 'large-groups', icon: '👥',
      text: largeGroups.length === 1
        ? `Grup gran a les ${firstTime} (${totalPaxBig} pax)`
        : `${largeGroups.length} grups grans · ${totalPaxBig} pax`,
      sub:  'Comprova distribució de taules',
      tone: 'warning', category: 'operational',
      priority: 55 + Math.min(20, largeGroups.length * 5),
      headline: largeGroups.length >= 2 || totalPaxBig >= 16,
      action: { kind: 'show-reservations', filter: { kind: 'large-groups', minPax: 8 }, title: 'Grups grans' },
    });
  }

  // ── 4. Possibles retards entre HH-HH ──────────────────────────────────────
  if (active.length >= 6) {
    const byHour: Record<number, number> = {};
    active.forEach(r => {
      const h = parseInt(r.time.split(':')[0], 10);
      byHour[h] = (byHour[h] || 0) + 1;
    });
    const peakHour = Object.entries(byHour)
      .map(([h, n]) => ({ h: parseInt(h, 10), n }))
      .sort((a, b) => b.n - a.n)[0];
    const avgPerHour = active.length / Math.max(1, Object.keys(byHour).length);
    if (peakHour && peakHour.n >= 4 && peakHour.n >= avgPerHour * 2.2) {
      out.push({
        id: 'delays', icon: '⏱',
        text: `Possibles retards a les ${String(peakHour.h).padStart(2, '0')}h`,
        sub:  `${peakHour.n} reserves concentrades`,
        tone: 'warning', category: 'operational',
        priority: 65 + Math.min(15, peakHour.n),
        headline: peakHour.n >= 6,
        action: { kind: 'show-reservations', filter: { kind: 'hour', hour: peakHour.h }, title: `Reserves a les ${String(peakHour.h).padStart(2, '0')}h` },
      });
    }
  }

  // ── 4b. Quiet window — operational/commercial opportunity ─────────────────
  // If today/future has a 2-hour gap inside a service window with <2 reservations,
  // and total day load is healthy, surface it as a "good time to call back-list /
  // walk-ins". Skip on quiet days where it'd just be noise.
  if (!isPast && active.length >= 5) {
    const SERVICE_HOURS = [13, 14, 20, 21, 22] as const;
    for (const h of SERVICE_HOURS) {
      const slot = active.filter(r => parseInt(r.time.split(':')[0], 10) === h).length;
      const adj = active.filter(r => {
        const rh = parseInt(r.time.split(':')[0], 10);
        return Math.abs(rh - h) <= 1;
      }).length;
      if (slot <= 1 && adj <= 2 && (isFuture || h >= hourNow)) {
        out.push({
          id: `quiet-${h}`, icon: '🌿',
          text: `Finestra tranquil·la a les ${String(h).padStart(2,'0')}h`,
          sub:  'Bon moment per walk-ins o trucades a la llista d\'espera',
          tone: 'neutral', category: 'predictive',
          priority: 28,
        });
        break;  // surface at most one quiet window
      }
    }
  }

  // ── 5. VIP / Diamond+ aquesta nit ─────────────────────────────────────────
  let rankedMap: Map<string, CustomerStats> | null = null;
  if (active.length > 0) {
    const ranked = rankCustomers(customers, reservations, bizId);
    const byKey = new Map<string, CustomerStats>();
    ranked.forEach(r => {
      if (r.customer.phone) byKey.set(`p:${r.customer.phone}`, r.stats);
      byKey.set(`n:${r.customer.name.trim().toLowerCase()}`, r.stats);
    });
    rankedMap = byKey;
    const vipBookings = active.filter(r => {
      const stats = (r.phone && byKey.get(`p:${r.phone}`)) ||
                    byKey.get(`n:${r.name.trim().toLowerCase()}`);
      return stats && (stats.level.id === 'diamond' || stats.level.id === 'master');
    });
    if (vipBookings.length > 0) {
      out.push({
        id: 'vip-tonight', icon: '⭐',
        text: vipBookings.length === 1
          ? `Client VIP avui: ${vipBookings[0].name}`
          : `${vipBookings.length} clients VIP avui`,
        sub:  'Reserva preferent · detall extra al servei',
        tone: 'positive', category: 'client',
        priority: 50 + vipBookings.length * 5,
        headline: vipBookings.length >= 2,
        action: { kind: 'show-reservations', filter: { kind: 'vip' }, title: 'Clients VIP' },
      });
    }
  }

  // ── 5b. Recurring customer (Gold+ visits) ─────────────────────────────────
  if (active.length > 0 && rankedMap) {
    const recurring = active.filter(r => {
      const stats = (r.phone && rankedMap!.get(`p:${r.phone}`)) ||
                    rankedMap!.get(`n:${r.name.trim().toLowerCase()}`);
      if (!stats) return false;
      const id = stats.level.id;
      return (id === 'gold' || id === 'platinum') && stats.completed >= 5;
    });
    // Only surface if there's no VIP insight already and the count is meaningful.
    if (recurring.length >= 2 && !out.find(i => i.id === 'vip-tonight')) {
      out.push({
        id: 'recurring-today', icon: '🤝',
        text: `${recurring.length} clients habituals avui`,
        sub:  'Gent que ja coneix la casa',
        tone: 'positive', category: 'client',
        priority: 38,
      });
    }
  }

  // ── 6. Aniversaris detectats ──────────────────────────────────────────────
  const birthdayBookings = active.filter(r =>
    r.tags?.includes('birthday') ||
    (r.notes && r.notes.toLowerCase().includes('aniversari'))
  );
  if (birthdayBookings.length > 0) {
    const first = birthdayBookings[0];
    out.push({
      id: 'birthday', icon: '🎂',
      text: birthdayBookings.length === 1
        ? `Aniversari: ${first.name}`
        : `${birthdayBookings.length} aniversaris avui`,
      sub:  'Detall extra al servei',
      tone: 'positive', category: 'client',
      priority: 42,
      action: { kind: 'show-reservations', filter: { kind: 'birthday' }, title: 'Aniversaris' },
    });
  }

  // ── 7. Weather-driven ─────────────────────────────────────────────────────
  if (forecast && !isPast) {
    const wxIns = operationalInsights(forecast);
    if (wxIns.length > 0) {
      const w = wxIns[0];
      const sevPriority = w.severity === 'alert' ? 85 : w.severity === 'warn' ? 65 : 35;
      out.push({
        id:   `wx-${w.id}`,
        icon: w.icon,
        text: w.text.replace(/\.$/, ''),
        sub:  w.when,
        tone: w.severity === 'alert' ? 'alert' :
              w.severity === 'warn'  ? 'warning' : 'positive',
        category: 'weather',
        priority: sevPriority,
        headline: w.severity === 'alert',
        action: { kind: 'open-weather' },
      });
    }
  }

  // ── 7b. Large group without table assigned ───────────────────────────────
  // Operational risk: an 8+ pax group that doesn't have any tableIds. Fires
  // any day (not just today) since the planning is the operator's job ahead
  // of time too. Always headline-eligible because the consequence is real.
  if (!isPast) {
    const noTableBig = active.filter(r => r.pax >= 8 && (!r.tableIds || r.tableIds.length === 0));
    if (noTableBig.length > 0) {
      const first = noTableBig[0];
      out.push({
        id: 'big-group-no-table', icon: '🧩',
        text: noTableBig.length === 1
          ? `Grup de ${first.pax} pax a les ${first.time} sense taula assignada`
          : `${noTableBig.length} grups grans sense taula assignada`,
        sub: 'Obre el plànol per assignar-los abans del servei',
        tone: 'alert', category: 'operational',
        priority: 75 + Math.min(15, noTableBig.length * 3),
        headline: true,
      });
    }
  }

  // ── 7c. Pending reservations near the service window ─────────────────────
  // Fires when there are ≥3 pending (unconfirmed) reservations whose time is
  // within the next 4 hours. Today-only; surface as a soft warning + headline
  // candidate when the count is meaningful.
  if (isToday) {
    const pendingSoon = active.filter(r =>
      r.status === 'pending' && (() => {
        const h = parseInt(r.time.split(':')[0], 10);
        return h >= hourNow && h <= hourNow + 4;
      })()
    );
    if (pendingSoon.length >= 3) {
      out.push({
        id: 'pending-near', icon: '☎️',
        text: `${pendingSoon.length} reserves pendents de confirmar properes`,
        sub: 'Bon moment per trucar abans del servei',
        tone: 'warning', category: 'operational',
        priority: 58 + Math.min(15, pendingSoon.length * 2),
        headline: pendingSoon.length >= 5,
      });
    }
  }

  // ── 8. Queue pressure ─────────────────────────────────────────────────────
  if (isToday) {
    const queueToday = waitlist.filter(w => {
      if (w.bizId !== bizId) return false;
      const d = new Date(w.addedAt);
      return isoDay(d) === dayIso;
    });
    if (queueToday.length >= 3) {
      out.push({
        id: 'queue-pressure', icon: '🚶',
        text: `${queueToday.length} grups a la cua`,
        sub:  'Pressió a la sala',
        tone: 'warning', category: 'operational',
        priority: 60 + Math.min(20, queueToday.length * 3),
        headline: queueToday.length >= 5,
        action: { kind: 'open-waitlist' },
      });
    }
  }

  // ── 9. Capacity projection — % occupancy vs typical ───────────────────────
  // Soft signal: if today's pax is already > 80% of a "full-house" estimate
  // (avgSameDow * 2.4 pax/group), warn early. Skip for past dates.
  if (!isPast && avgSameDow >= 3 && active.length > 0) {
    const expectedPax = avgSameDow * 2.4;
    const loadPct = totalPax / Math.max(1, expectedPax);
    if (loadPct >= 1.15) {
      out.push({
        id: 'capacity-high', icon: '🎯',
        text: 'Servei més carregat del normal',
        sub:  `${totalPax} pax previstos · planifica equip i sala`,
        tone: 'warning', category: 'predictive',
        priority: 55 + Math.min(20, Math.round((loadPct - 1) * 40)),
        headline: loadPct >= 1.3,
      });
    } else if (loadPct <= 0.55 && (isToday || isFuture)) {
      out.push({
        id: 'capacity-low', icon: '🍃',
        text: 'Servei tranquil previst',
        sub:  'Bon moment per detallisme i clients habituals',
        tone: 'neutral', category: 'predictive',
        priority: 30,
      });
    }
  }

  // ── 10. Time-of-day context nudge (today only) ────────────────────────────
  // Soft, low-priority contextual reminder that adapts the dashboard tone to
  // the moment of the day. Only fires if no other operational insight has
  // already taken the spotlight, to avoid pile-up.
  if (isToday) {
    const isQuiet = active.length <= 3;
    const noUrgentYet = !out.some(i => i.priority >= 60);
    if (hourNow >= 8 && hourNow < 12 && noUrgentYet) {
      out.push({
        id: 'tod-morning', icon: '☕',
        text: 'Bon matí · prepara la sala',
        sub:  active.length > 0
          ? `${active.length} reserves al llarg del dia`
          : 'Cap reserva confirmada encara — revisa la cua si n\'hi ha',
        tone: 'neutral', category: 'context',
        priority: 20,
      });
    } else if (hourNow >= 19 && hourNow < 22 && isQuiet && noUrgentYet) {
      out.push({
        id: 'tod-evening-quiet', icon: '🕯',
        text: 'Nit tranquil·la · servei detallista',
        sub:  'Cura els clients presents · ofereix recomanacions',
        tone: 'neutral', category: 'context',
        priority: 22,
      });
    }
  }

  // ── 11. Memory recall: "Situació similar a [data passada]" ─────────────────
  // If today's reservation count closely matches one of the last 4 same-DOW
  // points AND the day was notably busy/quiet, surface a comparison nudge.
  // Subtle by design — fires only when the match is striking.
  if (!isPast && avgSameDow >= 3 && active.length >= 3) {
    let bestMatch: { weeksAgo: number; count: number; diff: number } | null = null;
    sameDowCounts.forEach((c, idx) => {
      const diff = Math.abs(c - active.length);
      if (c >= 4 && diff <= Math.max(1, active.length * 0.1)) {
        if (!bestMatch || diff < bestMatch.diff) {
          bestMatch = { weeksAgo: idx + 1, count: c, diff };
        }
      }
    });
    if (bestMatch !== null) {
      const m = bestMatch as { weeksAgo: number; count: number; diff: number };
      const phrase = m.weeksAgo === 1
        ? `setmana passada (${m.count} reserves)`
        : `fa ${m.weeksAgo} setmanes (${m.count} reserves)`;
      out.push({
        id: 'memory-similar', icon: '🔁',
        text: `Situació similar al mateix dia ${phrase}`,
        sub:  'Patró comparable · pots anticipar el ritme',
        tone: 'neutral', category: 'context',
        priority: 32,
      });
    }
  }

  // ── Filter dismissed + sort by priority descending ────────────────────────
  return out
    .filter(i => !isInsightDismissed(i.id, dayIso))
    .sort((a, b) => b.priority - a.priority);
}

/** Pick the single "insight del moment" from a sorted list. Returns null if
 *  no candidate is strong enough to deserve hero treatment (priority < 45). */
export function pickHeadlineInsight(insights: SmartInsight[]): SmartInsight | null {
  const eligible = insights.filter(i => i.headline && i.priority >= 50);
  if (eligible.length > 0) return eligible[0];
  // Fallback: take the top one if it's strong enough on priority alone.
  const top = insights[0];
  if (top && top.priority >= 60) return top;
  return null;
}

/** Return the secondary insights — everything that didn't make hero.
 *  Default cap of 3 keeps the strip silent and lets the operator focus on
 *  the reservation list. The optional `quiet` flag tightens further to
 *  1-2 when the day has barely any booked context. */
export function pickSecondaryInsights(
  insights: SmartInsight[],
  headlineId?: string | null,
  max = 3,
  quiet = false,
): SmartInsight[] {
  const limit = quiet ? Math.min(max, 2) : max;
  return insights
    .filter(i => i.id !== headlineId)
    // Only keep insights with at least a moderate priority — anything below
    // 25 is "ambient context" and only belongs in the hero or in tooltips.
    .filter(i => i.priority >= 25)
    .slice(0, limit);
}
