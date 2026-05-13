/**
 * Smart insights engine — interprets reservation/customer/weather data to
 * surface human-readable observations the operator can act on.
 *
 * Each insight is a small immutable object with a severity, icon, headline
 * and optional sub. The generator is intentionally pure: feed it the data,
 * get a list back. UI lives in components/shared/SmartInsightsStrip.tsx.
 */

import type { Reservation, Customer, BusinessId, WaitlistEntry } from '@/types';
import type { WeatherForecast } from '@/lib/weather';
import { operationalInsights } from '@/lib/weather';
import { rankCustomers, type CustomerStats } from '@/utils/loyalty';

export type InsightTone = 'positive' | 'warning' | 'alert' | 'neutral';

export interface SmartInsight {
  id:       string;          // stable, used as React key
  icon:     string;          // emoji
  text:     string;          // headline (one line)
  sub?:     string;          // optional secondary
  tone:     InsightTone;
}

interface GenerateOpts {
  selectedDate:    Date;
  bizId:           BusinessId;
  reservations:    Reservation[];
  customers:       Customer[];
  waitlist:        WaitlistEntry[];
  forecast?:       WeatherForecast | null;
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

  // For past days we don't surface "future-leaning" insights (predicted peaks,
  // weather warnings, etc.) — only retrospective ones.
  // For future days we lean heavily on prediction (vs same DOW history, weather).
  const out: SmartInsight[] = [];

  const dayRes = reservations.filter(r => r.bizId === bizId && r.date === dayIso);
  const active = dayRes.filter(r => r.status !== 'cancelled' && r.status !== 'noshow');
  const totalPax = active.reduce((s, r) => s + r.pax, 0);

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
    if (delta >= 15) {
      out.push({
        id:   'cmp-up',
        icon: '📈',
        text: `Reserves un ${Math.round(delta)}% més que els ${dowNames[dow]}`,
        sub:  `Mitjana 4 setmanes: ${avgSameDow.toFixed(1)}`,
        tone: 'positive',
      });
    } else if (delta <= -20) {
      out.push({
        id:   'cmp-down',
        icon: '📉',
        text: `Reserves un ${Math.abs(Math.round(delta))}% menys que els ${dowNames[dow]}`,
        sub:  `Mitjana 4 setmanes: ${avgSameDow.toFixed(1)}`,
        tone: 'warning',
      });
    }
  }

  // ── 2. Ritme superior al normal (today/future only) ───────────────────────
  // If there are already many reservations entered for today AND today isn't
  // even past lunch yet, that signals an unusually busy run.
  if (isToday) {
    const now = new Date();
    const hourNow = now.getHours();
    const earlyBird = hourNow < 13;  // before lunch starts
    if (earlyBird && active.length >= Math.max(6, avgSameDow * 0.7)) {
      out.push({
        id:   'ritme-fast',
        icon: '🔥',
        text: 'Ritme superior al normal',
        sub:  `${active.length} reserves abans de migdia`,
        tone: 'positive',
      });
    }
  }

  // ── 3. Grup gran detectat ──────────────────────────────────────────────────
  const largeGroups = active.filter(r => r.pax >= 8);
  if (largeGroups.length > 0) {
    const totalPaxBig = largeGroups.reduce((s, r) => s + r.pax, 0);
    const firstTime = largeGroups.map(r => r.time).sort()[0];
    out.push({
      id:   'large-groups',
      icon: '👥',
      text: largeGroups.length === 1
        ? `Grup gran a les ${firstTime} (${totalPaxBig} pax)`
        : `${largeGroups.length} grups grans · ${totalPaxBig} pax`,
      sub:  'Comprova distribució de taules',
      tone: 'warning',
    });
  }

  // ── 4. Possibles retards entre HH-HH ──────────────────────────────────────
  // Count reservations per hour slot. If any slot has more than 3× the day
  // average AND it's the dinner peak, surface a "delays likely" hint.
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
        id:   'delays',
        icon: '⏱',
        text: `Possibles retards a les ${String(peakHour.h).padStart(2, '0')}h`,
        sub:  `${peakHour.n} reserves concentrades`,
        tone: 'warning',
      });
    }
  }

  // ── 5. VIP / Diamond+ aquesta nit ─────────────────────────────────────────
  // Cross-reference reservations with customer ranking. Only fire if there's
  // at least one customer at Diamond level or higher booked for this day.
  if (active.length > 0) {
    const ranked = rankCustomers(customers, reservations, bizId);
    const byKey = new Map<string, CustomerStats>();
    ranked.forEach(r => {
      if (r.customer.phone) byKey.set(`p:${r.customer.phone}`, r.stats);
      byKey.set(`n:${r.customer.name.trim().toLowerCase()}`, r.stats);
    });
    const vipBookings = active.filter(r => {
      const stats = (r.phone && byKey.get(`p:${r.phone}`)) ||
                    byKey.get(`n:${r.name.trim().toLowerCase()}`);
      return stats && (stats.level.id === 'diamond' || stats.level.id === 'master');
    });
    if (vipBookings.length > 0) {
      out.push({
        id:   'vip-tonight',
        icon: '⭐',
        text: vipBookings.length === 1
          ? `Client VIP avui: ${vipBookings[0].name}`
          : `${vipBookings.length} clients VIP avui`,
        sub:  'Reserva preferent',
        tone: 'positive',
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
      id:   'birthday',
      icon: '🎂',
      text: birthdayBookings.length === 1
        ? `Aniversari: ${first.name}`
        : `${birthdayBookings.length} aniversaris avui`,
      sub:  'Detall extra al servei',
      tone: 'positive',
    });
  }

  // ── 7. Weather-driven (delegated to operationalInsights) ──────────────────
  if (forecast && !isPast) {
    const wxIns = operationalInsights(forecast);
    // Take at most 1 weather insight to avoid the strip ballooning.
    if (wxIns.length > 0) {
      const w = wxIns[0];
      out.push({
        id:   `wx-${w.id}`,
        icon: w.icon,
        text: w.text.replace(/\.$/, ''),  // strip trailing period to match other tones
        sub:  w.when,
        tone: w.severity === 'alert' ? 'alert' :
              w.severity === 'warn'  ? 'warning' :
              'positive',
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
        id:   'queue-pressure',
        icon: '🚶',
        text: `${queueToday.length} grups a la cua`,
        sub:  'Pressió a la sala',
        tone: 'warning',
      });
    }
  }

  return out;
}
