/**
 * CalendarScreen — canonical calendar view for the whole app.
 *
 * Three view modes share the same data layer and selected-day state:
 *   - Month  : heatmap grid + selected day's reservations
 *   - Week   : 7 columns Mon–Sun with reservation cards stacked chronologically
 *   - Agenda : scrollable chronological list grouped by day
 *
 * Tapping a reservation anywhere selects it in the store and (if available)
 * switches to the Reserves tab so the operator can act on it immediately.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { isoDate } from '@/data/mockData';
import { rankCustomers, type CustomerStats } from '@/utils/loyalty';
import { resPalette } from '@/utils/statusLabels';
import type { Reservation } from '@/types';

type ViewMode = 'month' | 'week' | 'agenda';

interface LoyaltyEntry { stats: CustomerStats; rank: number; }
type LoyaltyByKey = Map<string, LoyaltyEntry>;

export default function CalendarScreen({ onBack, onSwitchToReserves }: {
  onBack: () => void;
  /** If provided, tapping a reservation switches to the Reserves tab. */
  onSwitchToReserves?: () => void;
}) {
  const {
    selectedBusiness, reservations, appEvents, customers,
    setSelectedDate, setSelectedReservation,
  } = useAppStore();

  const today = new Date();
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const saved = sessionStorage.getItem('ncr.calendar.view');
      if (saved === 'month' || saved === 'week' || saved === 'agenda') return saved;
    } catch { /* private mode */ }
    return 'month';
  });
  useEffect(() => {
    try { sessionStorage.setItem('ncr.calendar.view', view); } catch { /* ignore */ }
  }, [view]);

  // Anchor date — the calendar's "cursor". Month view rounds to first-of-month;
  // week view rounds to Monday; agenda starts from `anchor` and looks forward.
  const [anchor, setAnchor] = useState<Date>(today);

  // Loyalty lookup so reservation rows can render a level pill in O(1).
  const loyalty = useMemo<LoyaltyByKey>(() => {
    const m: LoyaltyByKey = new Map();
    const ranked = rankCustomers(customers, reservations, selectedBusiness as any);
    for (const r of ranked) {
      const entry: LoyaltyEntry = { stats: r.stats, rank: r.rank };
      if (r.customer.phone) m.set(`p:${r.customer.phone}`, entry);
      m.set(`n:${r.customer.name.trim().toLowerCase()}`, entry);
    }
    return m;
  }, [customers, reservations, selectedBusiness]);

  function lookupLoyalty(r: Reservation): LoyaltyEntry | undefined {
    if (r.phone && loyalty.has(`p:${r.phone}`)) return loyalty.get(`p:${r.phone}`);
    return loyalty.get(`n:${r.name.trim().toLowerCase()}`);
  }

  function openReservation(r: Reservation) {
    setSelectedDate(new Date(r.date + 'T00:00:00'));
    setSelectedReservation(r);
    if (onSwitchToReserves) onSwitchToReserves();
    else onBack();
  }

  function newReservationOn(date: Date) {
    setSelectedDate(date);
    setSelectedReservation(null);
    if (onSwitchToReserves) onSwitchToReserves();
    else onBack();
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CalendarHeader
        view={view} onView={setView}
        anchor={anchor} onAnchor={setAnchor}
        onBack={onBack}
      />

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 12px var(--scroll-pad-bottom)' }}>
        {view === 'month'  && <MonthView  anchor={anchor} onReservation={openReservation} onNewOn={newReservationOn} lookupLoyalty={lookupLoyalty} />}
        {view === 'week'   && <WeekView   anchor={anchor} onReservation={openReservation} lookupLoyalty={lookupLoyalty} />}
        {view === 'agenda' && <AgendaView anchor={anchor} onReservation={openReservation} lookupLoyalty={lookupLoyalty} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header — title + view tabs + nav arrows + Avui
// ─────────────────────────────────────────────────────────────────────────────

function CalendarHeader({ view, onView, anchor, onAnchor, onBack }: {
  view: ViewMode; onView: (v: ViewMode) => void;
  anchor: Date; onAnchor: (d: Date) => void;
  onBack: () => void;
}) {
  const today = new Date();

  // Title varies per view
  const title = useMemo(() => {
    if (view === 'month') return anchor.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });
    if (view === 'week') {
      const mon = mondayOf(anchor);
      const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
      const sameMonth = mon.getMonth() === sun.getMonth();
      const fmt = (d: Date, withMonth: boolean) =>
        withMonth ? d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' }) : String(d.getDate());
      return `${fmt(mon, !sameMonth)} – ${fmt(sun, true)}`;
    }
    // agenda
    return anchor.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [view, anchor]);

  function step(direction: -1 | 1) {
    const d = new Date(anchor);
    if (view === 'month') d.setMonth(d.getMonth() + direction);
    else if (view === 'week') d.setDate(d.getDate() + 7 * direction);
    else d.setDate(d.getDate() + 7 * direction);
    onAnchor(d);
  }

  return (
    <div style={{
      padding: '14px 14px 10px',
      background: 'var(--paper)', borderBottom: 'var(--hair)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button onClick={onBack} className="press"
          style={{
            width: 34, height: 34, borderRadius: 999,
            background: 'var(--cream)', border: '1px solid var(--line-soft)',
            cursor: 'pointer', color: 'var(--ink-700)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
          <Icon d={I.chevL} size={16} stroke={2} />
        </button>
        <div style={{
          flex: 1, minWidth: 0,
          fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
          textTransform: 'capitalize',
        }}>
          {title}
        </div>
        <button onClick={() => onAnchor(new Date())} className="press"
          style={{
            padding: '6px 12px', borderRadius: 999,
            border: '1.5px solid var(--terracotta-500)',
            background: 'var(--terracotta-50)', color: 'var(--terracotta-700)',
            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
            cursor: 'pointer', flexShrink: 0,
          }}>
          Avui
        </button>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--cream)', borderRadius: 999, padding: 3, marginBottom: 10 }}>
        {([['month','Mes'],['week','Setmana'],['agenda','Agenda']] as const).map(([id, label]) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => onView(id)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: active ? 'var(--ink-900)' : 'transparent',
                color:      active ? 'var(--cream)'  : 'var(--ink-600)',
                fontSize: 12, fontWeight: 650, fontFamily: 'inherit',
                transition: 'background 180ms var(--ease-in-out)',
              }}>{label}</button>
          );
        })}
      </div>

      {/* Nav arrows */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => step(-1)} className="press" style={navBtn} aria-label="Anterior">
          <Icon d={I.chevL} size={14} stroke={2} />
        </button>
        <button onClick={() => step(1)} className="press" style={navBtn} aria-label="Següent">
          <Icon d={I.chevR} size={14} stroke={2} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers / shared types
// ─────────────────────────────────────────────────────────────────────────────

const navBtn: React.CSSProperties = {
  width: 34, height: 30, borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--paper)', cursor: 'pointer',
  color: 'var(--ink-700)',
  display: 'grid', placeItems: 'center',
};

function mondayOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7;  // Mon = 0
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - dow);
  return m;
}

function fmtDayLong(d: Date): string {
  return d.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

const DOW_NAMES = ['diumenge','dilluns','dimarts','dimecres','dijous','divendres','dissabte'];

// ─────────────────────────────────────────────────────────────────────────────
// MONTH view — heatmap grid + selected-day panel
// ─────────────────────────────────────────────────────────────────────────────

interface DayStat { count: number; pax: number; migdia: number; nit: number; hasEvent: boolean; }

function MonthView({ anchor, onReservation, onNewOn, lookupLoyalty }: {
  anchor: Date;
  onReservation: (r: Reservation) => void;
  onNewOn: (d: Date) => void;
  lookupLoyalty: (r: Reservation) => LoyaltyEntry | undefined;
}) {
  const { selectedBusiness, reservations, appEvents } = useAppStore();
  const today = new Date();
  const todayIso = isoDate(today);

  const year  = anchor.getFullYear();
  const month = anchor.getMonth();

  const cells = useMemo(() => {
    const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total       = firstDow + daysInMonth;
    const rows        = Math.ceil(total / 7);
    const arr: (number | null)[] = Array(rows * 7).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr[firstDow + d - 1] = d;
    return arr;
  }, [year, month]);

  const statsByDay = useMemo(() => {
    const m: Record<string, DayStat> = {};
    reservations.filter(r => r.bizId === selectedBusiness).forEach(r => {
      const [ry, rm] = r.date.split('-').map(Number);
      if (ry !== year || rm !== month + 1) return;
      const s = m[r.date] ?? { count: 0, pax: 0, migdia: 0, nit: 0, hasEvent: false };
      s.count++;
      s.pax += r.pax;
      const h = parseInt(r.time.split(':')[0] ?? '0', 10);
      if (h < 18) s.migdia += r.pax; else s.nit += r.pax;
      m[r.date] = s;
    });
    appEvents.filter(e => e.bizId === selectedBusiness).forEach(e => {
      const [ry, rm] = e.date.split('-').map(Number);
      if (ry !== year || rm !== month + 1) return;
      m[e.date] = { ...(m[e.date] ?? { count: 0, pax: 0, migdia: 0, nit: 0, hasEvent: false }), hasEvent: true };
    });
    return m;
  }, [reservations, appEvents, selectedBusiness, year, month]);

  const monthTotals = useMemo(() => {
    let count = 0, pax = 0, busiest = 0, busyDay: number | null = null;
    Object.entries(statsByDay).forEach(([ds, s]) => {
      count += s.count; pax += s.pax;
      if (s.pax > busiest) { busiest = s.pax; busyDay = parseInt(ds.split('-')[2], 10); }
    });
    const maxPax = Math.max(0, ...Object.values(statsByDay).map(s => s.pax));
    return { count, pax, busyDay, busiest, maxPax };
  }, [statsByDay]);

  const [selDay, setSelDay] = useState<number | null>(
    anchor.getMonth() === today.getMonth() && anchor.getFullYear() === today.getFullYear() ? today.getDate() : null
  );

  // Reset selDay when the month changes (so a stale day number doesn't linger)
  useEffect(() => {
    if (anchor.getMonth() === today.getMonth() && anchor.getFullYear() === today.getFullYear()) {
      setSelDay(today.getDate());
    } else {
      setSelDay(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  function intensityFor(s?: DayStat) {
    if (!s || s.pax === 0) return 0;
    if (monthTotals.maxPax === 0) return 0;
    return Math.min(0.18 + (s.pax / monthTotals.maxPax) * 0.7, 0.92);
  }

  const selIsoDate = selDay ? isoDate(new Date(year, month, selDay)) : null;
  const dayRes = selIsoDate
    ? reservations.filter(r => r.bizId === selectedBusiness && r.date === selIsoDate).sort((a, b) => a.time.localeCompare(b.time))
    : [];
  const dayStat = selIsoDate ? statsByDay[selIsoDate] ?? null : null;
  const dayEvents = selIsoDate ? appEvents.filter(e => e.bizId === selectedBusiness && e.date === selIsoDate) : [];

  // DOW comparison: avg reservations on the same day of week over the previous 4 weeks
  const dowAvg = useMemo(() => {
    if (!selIsoDate) return 0;
    const selDate = new Date(selIsoDate + 'T00:00:00');
    const dow = selDate.getDay();
    let sum = 0, cnt = 0;
    for (let w = 1; w <= 4; w++) {
      const past = new Date(selDate.getTime() - w * 7 * 86400000);
      const iso = isoDate(past);
      const c = reservations.filter(r =>
        r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled'
      ).length;
      sum += c; cnt++;
    }
    return cnt > 0 ? sum / cnt : 0;
    // We use `dow` for clarity but it's not directly needed since past dates align by construction
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return dow;
  }, [selIsoDate, reservations, selectedBusiness]);

  return (
    <>
      {/* Month totals strip */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
        fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
        fontFamily: 'var(--font-mono)', letterSpacing: .06,
        padding: '0 4px 10px',
      }}>
        <span><b style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-900)' }}>{monthTotals.count}</b> reserves</span>
        <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-300)' }} />
        <span><b style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-900)' }}>{monthTotals.pax}</b> pax</span>
        {monthTotals.busyDay && (
          <>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-300)' }} />
            <span style={{ color: 'var(--terracotta-700)' }}>pic dia <b style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>{monthTotals.busyDay}</b></span>
          </>
        )}
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6, padding: '0 2px' }}>
        {['Dl','Dt','Dc','Dj','Dv','Ds','Dg'].map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 700,
            letterSpacing: .12, textTransform: 'uppercase',
            color: i >= 5 ? 'var(--terracotta-700)' : 'var(--ink-500)',
            fontFamily: 'var(--font-mono)', paddingBottom: 4,
          }}>{d}</div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, padding: '0 2px' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds      = isoDate(new Date(year, month, day));
          const stat    = statsByDay[ds];
          const intensity = intensityFor(stat);
          const isToday = ds === todayIso;
          const isSel   = day === selDay;
          const dow     = (new Date(year, month, day).getDay() + 6) % 7;
          const isWknd  = dow >= 5;
          return (
            <button key={i} onClick={() => setSelDay(day === selDay ? null : day)} className="press"
              style={{
                position: 'relative',
                aspectRatio: '1/1.05', minHeight: 0,
                borderRadius: 10,
                border: isSel
                  ? '2px solid var(--terracotta-600)'
                  : isToday ? '1.5px solid var(--terracotta-500)' : '1px solid var(--line-soft)',
                background: intensity > 0
                  ? `rgba(168,74,42,${intensity})`
                  : isWknd ? 'var(--cream)' : 'var(--paper)',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                padding: '6px 2px 5px', overflow: 'hidden',
                transition: 'border-color 200ms var(--ease-out), background 220ms var(--ease-out)',
              }}>
              <span style={{
                fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500, lineHeight: 1, letterSpacing: -.005,
                color: intensity > 0.45 ? '#fff'
                  : isSel ? 'var(--terracotta-700)'
                  : isToday ? 'var(--terracotta-600)' : 'var(--ink-900)',
              }}>{day}</span>
              {stat && stat.pax > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, marginTop: 3,
                  fontFamily: 'var(--font-mono)', letterSpacing: .04,
                  color: intensity > 0.45 ? 'rgba(255,255,255,.85)' : 'var(--terracotta-700)',
                }}>{stat.pax}p</span>
              )}
              {stat && stat.pax > 0 && (
                <span style={{
                  position: 'absolute', left: 4, right: 4, bottom: 3, height: 2, borderRadius: 999,
                  background: 'rgba(255,255,255,.2)', overflow: 'hidden', display: 'flex',
                }}>
                  <span style={{
                    width: `${(stat.migdia / stat.pax) * 100}%`,
                    background: intensity > 0.45 ? 'rgba(255,255,255,.9)' : '#c89a3a',
                  }} />
                  <span style={{
                    width: `${(stat.nit / stat.pax) * 100}%`,
                    background: intensity > 0.45 ? 'rgba(255,255,255,.55)' : '#6b3e5c',
                  }} />
                </span>
              )}
              {stat?.hasEvent && (
                <span style={{
                  position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: 999,
                  background: '#1a4ea0',
                  boxShadow: intensity > 0.45 ? '0 0 0 1.5px rgba(255,255,255,.6)' : '0 0 0 1.5px var(--paper)',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '12px 4px 4px', fontSize: 10.5, color: 'var(--ink-500)', fontWeight: 600,
        letterSpacing: .04,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Menys</span>
        {[0.12, 0.30, 0.50, 0.70, 0.90].map(v => (
          <span key={v} style={{ width: 14, height: 14, borderRadius: 4, background: `rgba(168,74,42,${v})`, border: '1px solid var(--line-soft)' }} />
        ))}
        <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Més</span>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: '#1a4ea0' }} /> Esdev.
        </span>
      </div>

      {/* Day panel */}
      {selDay && (
        <div style={{ marginTop: 14, padding: '0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500,
                color: 'var(--ink-900)', letterSpacing: -.005, textTransform: 'capitalize',
              }}>
                {new Date(year, month, selDay).toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div style={{
                fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
                letterSpacing: .06, marginTop: 3, fontFamily: 'var(--font-mono)',
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              }}>
                <span>{dayRes.length} reserves</span>
                {dayStat && dayStat.pax > 0 && (
                  <>
                    <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-300)' }} />
                    <span>{dayStat.pax} pax</span>
                  </>
                )}
                {dowAvg > 0 && (
                  <>
                    <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-300)' }} />
                    <span style={{ color: dayRes.length > dowAvg + 0.5 ? 'var(--olive-700)' : dayRes.length < dowAvg - 0.5 ? 'var(--rose-700)' : 'var(--ink-500)' }}>
                      {dayRes.length > dowAvg + 0.5 ? '▲' : dayRes.length < dowAvg - 0.5 ? '▼' : '='} mitjana {dowAvg.toFixed(1)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => onNewOn(new Date(year, month, selDay))} className="press"
              style={{
                padding: '7px 12px', borderRadius: 9, border: 'none',
                background: 'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)',
                color: '#fff', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                boxShadow: '0 2px 6px rgba(168,74,42,.28)', flexShrink: 0,
              }}>
              <Icon d={I.plus} size={11} stroke={2.6} /> Nova
            </button>
          </div>

          {dayEvents.length > 0 && (
            <div style={{
              marginBottom: 10, padding: '9px 12px', borderRadius: 10,
              background: '#e8eef8', border: '1px solid rgba(26,78,160,.18)',
            }}>
              {dayEvents.map(e => (
                <div key={e.id} style={{ fontSize: 12.5, color: '#1a4ea0', fontWeight: 600 }}>
                  📌 {e.title}{e.time ? ` · ${e.time}` : ''}
                </div>
              ))}
            </div>
          )}

          {dayRes.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '28px 0', color: 'var(--ink-400)', fontSize: 13,
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            }}>
              Cap reserva aquest dia
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dayRes.map(r => (
                <ReservationRow key={r.id} r={r} loyalty={lookupLoyalty(r)} onClick={() => onReservation(r)} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEK view — 7 columns, each a chronological stack of reservation chips
// ─────────────────────────────────────────────────────────────────────────────

function WeekView({ anchor, onReservation, lookupLoyalty }: {
  anchor: Date;
  onReservation: (r: Reservation) => void;
  lookupLoyalty: (r: Reservation) => LoyaltyEntry | undefined;
}) {
  const { selectedBusiness, reservations } = useAppStore();
  const today = new Date();
  const todayIso = isoDate(today);
  const mon = mondayOf(anchor);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [mon]);

  // Group reservations per day
  const byDay = useMemo(() => {
    const m: Record<string, Reservation[]> = {};
    for (const d of days) m[isoDate(d)] = [];
    reservations.forEach(r => {
      if (r.bizId !== selectedBusiness) return;
      if (m[r.date]) m[r.date].push(r);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)));
    return m;
  }, [days, reservations, selectedBusiness]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
      {days.map((d, i) => {
        const iso = isoDate(d);
        const isToday = iso === todayIso;
        const dow = ['Dl','Dt','Dc','Dj','Dv','Ds','Dg'][i];
        const isWknd = i >= 5;
        const list = byDay[iso] ?? [];
        const totalPax = list.reduce((s, r) => s + r.pax, 0);
        return (
          <div key={iso} style={{
            background: isToday ? 'var(--terracotta-50)' : 'var(--surface-elevated)',
            border: 'none',
            boxShadow: isToday
              ? '0 0 0 1.5px var(--terracotta-500), var(--shadow-md), var(--shadow-inset-top)'
              : 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
            borderRadius: 12, padding: 6, minHeight: 220,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ textAlign: 'center', paddingBottom: 4, borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: isWknd ? 'var(--terracotta-700)' : 'var(--ink-500)',
                fontFamily: 'var(--font-mono)', letterSpacing: .1, textTransform: 'uppercase',
              }}>{dow}</div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500,
                color: isToday ? 'var(--terracotta-700)' : 'var(--ink-900)',
                lineHeight: 1, marginTop: 1,
              }}>{d.getDate()}</div>
              {list.length > 0 && (
                <div style={{ fontSize: 9, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 2 }}>
                  {list.length}r · {totalPax}p
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', maxHeight: 360 }}>
              {list.map(r => (
                <WeekResCard key={r.id} r={r} loyalty={lookupLoyalty(r)} onClick={() => onReservation(r)} />
              ))}
              {list.length === 0 && (
                <div style={{
                  fontSize: 9.5, color: 'var(--ink-400)', textAlign: 'center', padding: '12px 0',
                  fontStyle: 'italic',
                }}>—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekResCard({ r, loyalty, onClick }: {
  r: Reservation; loyalty?: LoyaltyEntry; onClick: () => void;
}) {
  const pal = resPalette(r.status);
  return (
    <button onClick={onClick} className="press"
      style={{
        width: '100%', textAlign: 'left',
        padding: '5px 6px', borderRadius: 6,
        background: pal.bg, border: `1px solid ${pal.ring}`,
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', gap: 1,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 700, color: pal.fg,
          fontFamily: 'var(--font-mono)', letterSpacing: .02,
        }}>{r.time}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: pal.fg, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{r.pax}p</span>
      </div>
      <div style={{
        fontSize: 10.5, fontWeight: 650, color: 'var(--ink-900)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -.005,
      }}>{r.name}</div>
      {loyalty && loyalty.stats.level.id !== 'bronze' && (
        <span style={{ fontSize: 9.5 }}>{loyalty.stats.level.icon}</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENDA view — chronological list grouped by day, looking forward 30 days
// ─────────────────────────────────────────────────────────────────────────────

function AgendaView({ anchor, onReservation, lookupLoyalty }: {
  anchor: Date;
  onReservation: (r: Reservation) => void;
  lookupLoyalty: (r: Reservation) => LoyaltyEntry | undefined;
}) {
  const { selectedBusiness, reservations, appEvents } = useAppStore();

  const grouped = useMemo(() => {
    const startIso = isoDate(anchor);
    const end = new Date(anchor.getTime() + 30 * 86400000);
    const endIso = isoDate(end);
    const m: Record<string, { res: Reservation[]; events: typeof appEvents }> = {};
    reservations.forEach(r => {
      if (r.bizId !== selectedBusiness) return;
      if (r.date < startIso || r.date > endIso) return;
      if (r.status === 'cancelled' || r.status === 'noshow') return;
      if (!m[r.date]) m[r.date] = { res: [], events: [] };
      m[r.date].res.push(r);
    });
    appEvents.forEach(e => {
      if (e.bizId !== selectedBusiness) return;
      if (e.date < startIso || e.date > endIso) return;
      if (!m[e.date]) m[e.date] = { res: [], events: [] };
      m[e.date].events.push(e);
    });
    Object.values(m).forEach(g => g.res.sort((a, b) => a.time.localeCompare(b.time)));
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [reservations, appEvents, selectedBusiness, anchor]);

  if (grouped.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 24px', color: 'var(--ink-400)',
        fontSize: 14, fontFamily: 'var(--font-serif)', fontStyle: 'italic',
      }}>
        Cap reserva en els pròxims 30 dies des de {fmtDayLong(anchor)}.
      </div>
    );
  }

  const todayIso = isoDate(new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {grouped.map(([iso, g]) => {
        const d = new Date(iso + 'T00:00:00');
        const isToday = iso === todayIso;
        const totalPax = g.res.reduce((s, r) => s + r.pax, 0);
        return (
          <div key={iso}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8,
              paddingBottom: 6, borderBottom: '1px solid var(--line-soft)',
            }}>
              <span style={{
                fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500,
                color: isToday ? 'var(--terracotta-700)' : 'var(--ink-900)',
                textTransform: 'capitalize', letterSpacing: -.005,
              }}>
                {isToday ? 'Avui · ' : ''}{fmtDayLong(d)}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{
                fontSize: 11, color: 'var(--ink-500)', fontWeight: 700,
                fontFamily: 'var(--font-mono)', letterSpacing: .04,
              }}>{g.res.length}r · {totalPax}p</span>
            </div>

            {g.events.map(e => (
              <div key={e.id} style={{
                marginBottom: 6, padding: '8px 12px', borderRadius: 10,
                background: '#e8eef8', border: '1px solid rgba(26,78,160,.18)',
                fontSize: 12.5, color: '#1a4ea0', fontWeight: 600,
              }}>📌 {e.title}{e.time ? ` · ${e.time}` : ''}</div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.res.map(r => (
                <ReservationRow key={r.id} r={r} loyalty={lookupLoyalty(r)} onClick={() => onReservation(r)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared ReservationRow — used by Month day panel and Agenda
// ─────────────────────────────────────────────────────────────────────────────

function ReservationRow({ r, loyalty, onClick }: {
  r: Reservation; loyalty?: LoyaltyEntry; onClick: () => void;
}) {
  const pal = resPalette(r.status);
  // Status accent — same colors used in TodayView's ResRow so a reservation
  // looks the same wherever it shows up in the app.
  const accentColor =
    r.status === 'seated'    ? 'var(--terracotta-500)' :
    r.status === 'confirmed' ? 'var(--olive-500)'      :
    r.status === 'pending'   ? 'var(--clay-500)'       :
    r.status === 'noshow'    ? 'var(--rose-600)'       :
    'transparent';
  return (
    <button onClick={onClick} className="press"
      style={{
        position: 'relative',
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 13px 10px 14px', borderRadius: 12,
        background: 'var(--surface-elevated)',
        border: 'none',
        boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
        cursor: 'pointer', fontFamily: 'inherit',
        overflow: 'hidden',
      }}>
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: accentColor,
      }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700,
        color: 'var(--ink-700)', flexShrink: 0, minWidth: 38,
      }}>{r.time}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13.5, fontWeight: 650, color: 'var(--ink-900)',
          overflow: 'hidden', letterSpacing: -.005,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto' }}>{r.name}</span>
          {loyalty && loyalty.stats.level.id !== 'bronze' && (
            <span title={`${loyalty.stats.points} punts`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 6px', borderRadius: 999,
              background: loyalty.stats.level.bg, color: loyalty.stats.level.color,
              border: `1px solid ${loyalty.stats.level.color}33`,
              fontSize: 9.5, fontWeight: 700, flexShrink: 0,
            }}>
              <span>{loyalty.stats.level.icon}</span>{loyalty.stats.level.name}
            </span>
          )}
        </div>
        {r.notes && (
          <div style={{
            fontSize: 11, color: 'var(--ink-500)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic',
          }}>{r.notes}</div>
        )}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, color: pal.fg,
        flexShrink: 0, fontFamily: 'var(--font-mono)',
      }}>{r.pax}p</span>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999,
        background: pal.bg, color: pal.fg, border: `1px solid ${pal.ring}`,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>{pal.label}</span>
    </button>
  );
}
