/**
 * useAmbientState — derives a single "operational mood" object from the
 * day's reservations, the hour of day, the queue, and the forecast.
 *
 * The goal is to give the rest of the UI a single source of truth for
 * subtle, ambient hints — a microcopy line under the date, a 4-px dot on
 * an hour row, a 5% bump in the ambient blob alphas. No new cards, no new
 * banners; just a quiet thread of intelligence woven through the shell.
 *
 * The hook is pure: feed it the same inputs the existing insights engine
 * already has access to, and you'll get back deterministic state. It does
 * not touch the store directly — callers (TouchShell, TodayView, etc.)
 * pull what they need from the store and pass it in. This keeps the hook
 * trivially testable and avoids subscribing the same component twice.
 */

import { useMemo } from 'react';
import type { Reservation, BusinessId, WaitlistEntry } from '@/types';
import type { WeatherForecast } from '@/lib/weather';

export type AmbientLevel = 'calm' | 'normal' | 'busy' | 'peak';

export type AmbientFlag =
  | 'rain-risk'
  | 'large-groups'
  | 'morning-prep'
  | 'evening-service'
  | 'queue-pressure';

export type AmbientAccent = 'olive' | 'clay' | 'terracotta' | 'plum' | 'ink';

export interface HourSignal {
  kind:     'concentration' | 'large-group' | 'rain';
  severity: 'soft' | 'firm';
}

export interface AmbientState {
  /** Load bucket derived from active reservations vs same-DOW average. */
  level:       AmbientLevel;
  /** 0..1 — amp scalar for ambient visuals (blob alpha, sun intensity). */
  intensity:   number;
  /** Active contextual overlays. */
  flags:       Set<AmbientFlag>;
  /** Operator-facing one-liner. Already humanised (no analytics tone). */
  microcopy:   string;
  /** Suggested colour family for any tonal accent the UI wants to apply. */
  toneAccent:  AmbientAccent;
  /** Per-hour signals for the timeline (concentration peak, big group, rain). */
  hourSignals: Map<number, HourSignal>;
}

interface Opts {
  selectedDate: Date;
  bizId:        BusinessId;
  reservations: Reservation[];
  waitlist:     WaitlistEntry[];
  forecast?:    WeatherForecast | null;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function useAmbientState(opts: Opts): AmbientState {
  const { selectedDate, bizId, reservations, waitlist, forecast } = opts;

  return useMemo<AmbientState>(() => {
    const dayIso = isoDay(selectedDate);
    const todayIso = isoDay(new Date());
    const isToday = dayIso === todayIso;
    const now = new Date();
    const hourNow = now.getHours();

    const dayRes = reservations.filter(r => r.bizId === bizId && r.date === dayIso);
    const active = dayRes.filter(r => r.status !== 'cancelled' && r.status !== 'noshow');

    // ── Same-DOW baseline ───────────────────────────────────────────────
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
    const avg = sameDow.reduce((s, n) => s + n, 0) / Math.max(1, sameDow.length);

    // ── Load level ──────────────────────────────────────────────────────
    // Ratio of today's active count to the 4-week same-DOW average. Falls
    // back to absolute count when we don't have enough history yet.
    // Covers (pax) matter as much as reservation count: a day with few
    // bookings but two 28-pax groups is a HEAVY service, not a calm one.
    // We blend a count-ratio with a pax-load that mirrors the capacity
    // insight (insights.ts: expectedPax = avgCount * 2.4) so the header
    // subtitle and the insight banner never contradict each other
    // ("Servei tranquil" vs "Servei més carregat del normal").
    const totalPax = active.reduce((s, r) => s + (r.pax || 0), 0);
    let level: AmbientLevel = 'normal';
    let intensity = 0.5;
    if (avg >= 2) {
      const ratio       = active.length / avg;
      const expectedPax = avg * 2.4;
      const paxLoad     = expectedPax > 0 ? totalPax / expectedPax : 0;
      const load        = Math.max(ratio, paxLoad); // either dimension can mark it busy
      if      (load >= 1.30)                      { level = 'peak';   intensity = 0.95; }
      else if (load >= 1.15)                      { level = 'busy';   intensity = 0.75; }
      else if (ratio <= 0.55 && paxLoad <= 0.55)  { level = 'calm';   intensity = 0.30; }
      else                                        { level = 'normal'; intensity = 0.50; }
    } else {
      // Low history → absolute fallback, also pax-aware.
      if      (active.length === 0)              { level = 'calm';   intensity = 0.25; }
      else if (totalPax >= 40)                   { level = 'peak';   intensity = 0.95; }
      else if (totalPax >= 24 || active.length > 8)  { level = 'busy';   intensity = 0.75; }
      else if (active.length <= 3 && totalPax < 12)  { level = 'calm';   intensity = 0.35; }
      else                                       { level = 'normal'; intensity = 0.55; }
    }

    // ── Flags ───────────────────────────────────────────────────────────
    const flags = new Set<AmbientFlag>();

    // Large groups: any reservation with pax >= 8
    const bigGroups = active.filter(r => r.pax >= 8);
    if (bigGroups.length > 0) flags.add('large-groups');

    // Queue pressure (today only)
    if (isToday) {
      const queueToday = waitlist.filter(w => {
        if (w.bizId !== bizId) return false;
        const d = new Date(w.addedAt);
        return isoDay(d) === dayIso && (w.status === 'waiting' || w.status === 'notified');
      });
      if (queueToday.length >= 3) flags.add('queue-pressure');
    }

    // Weather: rain or showers with high probability in the remaining day
    let rainHour: number | null = null;
    if (forecast?.hourly) {
      const fromHour = isToday ? hourNow : 0;
      const rainSlot = forecast.hourly.find(h =>
        h.hour >= fromHour && h.precipProb >= 60 &&
        (h.condition === 'rain' || h.condition === 'showers' || h.condition === 'drizzle' || h.condition === 'thunder')
      );
      if (rainSlot) { flags.add('rain-risk'); rainHour = rainSlot.hour; }
    }

    // Time-of-day prep flags (today only)
    if (isToday) {
      if (hourNow >= 8 && hourNow < 12)  flags.add('morning-prep');
      if (hourNow >= 19 && hourNow < 23) flags.add('evening-service');
    }

    // ── Tone accent ─────────────────────────────────────────────────────
    // Default follows the load level; weather/queue can override toward
    // terracotta when something genuinely demands attention.
    let toneAccent: AmbientAccent =
      level === 'peak'   ? 'clay'        :
      level === 'busy'   ? 'clay'        :
      level === 'calm'   ? 'olive'       :
                           'ink';
    if (flags.has('queue-pressure') || (flags.has('rain-risk') && active.some(r => /terrass/i.test(r.notes ?? '')))) {
      toneAccent = 'terracotta';
    }

    // ── Microcopy — human, single line ──────────────────────────────────
    // Priority: queue pressure > rain risk > peak/busy > calm + time-of-day
    // > generic. Caps at ~50 chars so it fits as a subtitle under the date.
    let microcopy = 'Ritme habitual del servei';
    if (flags.has('queue-pressure')) {
      microcopy = 'Pressió a la sala · grups esperant';
    } else if (flags.has('rain-risk') && rainHour !== null) {
      const lab = rainHour <= hourNow + 1 && isToday
        ? 'ara'
        : `a partir de les ${String(rainHour).padStart(2, '0')}h`;
      microcopy = `Possible pluja ${lab} · vigila terrassa`;
    } else if (level === 'peak') {
      microcopy = 'Pic de servei en marxa';
    } else if (level === 'busy') {
      microcopy = bigGroups.length > 0
        ? 'Servei carregat · cura els grups grans'
        : 'Servei amb força càrrega';
    } else if (level === 'calm') {
      if (flags.has('morning-prep'))      microcopy = 'Matí tranquil · bon moment per preparar la sala';
      else if (flags.has('evening-service')) microcopy = 'Nit tranquil·la · servei detallista';
      else                                microcopy = 'Servei tranquil · cuida els detalls';
    } else {
      if (flags.has('morning-prep'))      microcopy = 'Bon matí · revisa la sala abans del servei';
      else if (flags.has('evening-service')) microcopy = 'Servei de nit · tot a punt';
      else                                microcopy = 'Ritme habitual del servei';
    }

    // ── Hour signals — concentration peaks + large-group times + rain ──
    const hourSignals = new Map<number, HourSignal>();
    if (active.length >= 4) {
      const byHour: Record<number, number> = {};
      active.forEach(r => {
        const h = parseInt(r.time.split(':')[0], 10);
        byHour[h] = (byHour[h] || 0) + 1;
      });
      const avgPerHour = active.length / Math.max(1, Object.keys(byHour).length);
      for (const [hStr, n] of Object.entries(byHour)) {
        const h = parseInt(hStr, 10);
        if (n >= 4 && n >= avgPerHour * 2.0) {
          hourSignals.set(h, { kind: 'concentration', severity: n >= 6 ? 'firm' : 'soft' });
        }
      }
    }
    // Large groups override with their own marker — same hour but different kind.
    for (const g of bigGroups) {
      const h = parseInt(g.time.split(':')[0], 10);
      const prev = hourSignals.get(h);
      hourSignals.set(h, {
        kind: 'large-group',
        severity: prev?.severity === 'firm' || g.pax >= 12 ? 'firm' : 'soft',
      });
    }
    // Rain signal — at the start hour only, soft severity (it's a forecast).
    if (rainHour !== null && !hourSignals.has(rainHour)) {
      hourSignals.set(rainHour, { kind: 'rain', severity: 'soft' });
    }

    return { level, intensity, flags, microcopy, toneAccent, hourSignals };
  }, [selectedDate, bizId, reservations, waitlist, forecast]);
}
