/**
 * DayCloseSheet — "Tancament del dia".
 *
 * The end-of-service ritual: when the kitchen shuts (Més → Horaris sets
 * the time; the service bell prompts automatically) the operator reviews
 * one calm page:
 *
 *   1. What happened today  — covers, reservations, walk-ins, no-shows,
 *      peak hour, vs. the same weekday's average.
 *   2. What's still open    — reservations not yet completed, with a
 *      one-tap "mark all finished" (each runs through the normal status
 *      mutator, so loyalty/tables/cloud behave exactly like manual taps).
 *   3. Tomorrow             — count, covers, first booking, big groups.
 *
 * Same visual language as BriefingSheet: paper surface, serif sentences,
 * mono eyebrows. Reads as a note from the head of room, not a report.
 */
import React, { useMemo } from 'react';
import AnimatedSheet from './AnimatedSheet';
import { useAppStore } from '@/store/useAppStore';
import { toast } from './Toaster';
import type { Reservation } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_NAMES = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];

export default function DayCloseSheet({ open, onClose }: Props) {
  const { selectedBusiness, reservations, updateReservationStatus } = useAppStore();

  const data = useMemo(() => {
    const now = new Date();
    const todayIso = iso(now);
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const tomorrowIso = iso(tomorrow);

    const todays = reservations.filter(r => r.bizId === selectedBusiness && r.date === todayIso);
    const completed = todays.filter(r => r.status === 'completed');
    const stillOpen = todays.filter(r =>
      r.status === 'seated' || r.status === 'confirmed' || r.status === 'pending');
    const noshows   = todays.filter(r => r.status === 'noshow');
    const cancelled = todays.filter(r => r.status === 'cancelled');
    const walkIns   = todays.filter(r => r.source === 'walk-in' &&
      (r.status === 'completed' || r.status === 'seated'));

    const servedPax = completed.reduce((s, r) => s + r.pax, 0)
      + todays.filter(r => r.status === 'seated').reduce((s, r) => s + r.pax, 0);

    // Peak hour — the hour with the most covers among reservations that
    // actually happened (or are happening).
    const byHour = new Map<number, number>();
    for (const r of todays) {
      if (r.status === 'cancelled' || r.status === 'noshow') continue;
      const h = parseInt(r.time.slice(0, 2), 10);
      if (Number.isFinite(h)) byHour.set(h, (byHour.get(h) ?? 0) + r.pax);
    }
    let peakHour: number | null = null, peakPax = 0;
    for (const [h, pax] of byHour) if (pax > peakPax) { peakHour = h; peakPax = pax; }

    // Same-weekday average over the previous 4 weeks (covers).
    const dow = now.getDay();
    let histSum = 0, histDays = 0;
    for (let w = 1; w <= 4; w++) {
      const d = new Date(now); d.setDate(now.getDate() - 7 * w);
      if (d.getDay() !== dow) continue;
      const dIso = iso(d);
      const pax = reservations
        .filter(r => r.bizId === selectedBusiness && r.date === dIso && r.status === 'completed')
        .reduce((s, r) => s + r.pax, 0);
      if (pax > 0) { histSum += pax; histDays++; }
    }
    const avgPax = histDays > 0 ? histSum / histDays : null;
    const deltaPct = avgPax ? Math.round(((servedPax - avgPax) / avgPax) * 100) : null;

    const toms = reservations
      .filter(r => r.bizId === selectedBusiness && r.date === tomorrowIso
        && r.status !== 'cancelled' && r.status !== 'noshow')
      .sort((a, b) => a.time.localeCompare(b.time));
    const tomPax = toms.reduce((s, r) => s + r.pax, 0);
    const tomBig = toms.filter(r => r.pax >= 8);

    return {
      dayLabel: DAY_NAMES[dow],
      todays, completed, stillOpen, noshows, cancelled, walkIns,
      servedPax, peakHour, peakPax, deltaPct,
      toms, tomPax, tomBig,
    };
  }, [reservations, selectedBusiness, open]);

  function closeRemaining(list: Reservation[]) {
    for (const r of list) updateReservationStatus(r.id, 'completed');
    toast(`${list.length} reserv${list.length === 1 ? 'a marcada' : 'es marcades'} com acabades`, {
      icon: 'check', tone: 'olive',
    });
  }

  const d = data;
  const quietDay = d.todays.length === 0;

  return (
    <AnimatedSheet open={open} onClose={onClose} desktopMaxWidth={640}>
      <div style={{
        padding: '18px 20px 22px',
        display: 'flex', flexDirection: 'column', gap: 16,
        background: 'var(--surface-elevated)',
        color: 'var(--ink-900)',
      }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          paddingBottom: 6, borderBottom: '1px solid var(--line-soft)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: .14,
              color: 'var(--ink-500)', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)', marginBottom: 4,
            }}>
              Tancament del dia
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
              letterSpacing: -.012, color: 'var(--ink-900)',
              textTransform: 'capitalize',
            }}>
              {d.dayLabel}
            </div>
          </div>
          <button onClick={onClose} aria-label="Tancar" className="tac-btn tac-btn--ghost"
            style={{
              flexShrink: 0, width: 36, height: 36,
              display: 'grid', placeItems: 'center', borderRadius: 10,
              fontSize: 20, color: 'var(--ink-500)', lineHeight: 1,
            }}>
            ×
          </button>
        </header>

        {quietDay ? (
          <p style={{
            margin: 0, fontFamily: 'var(--font-serif)', fontSize: 15,
            lineHeight: 1.55, color: 'var(--ink-600)',
          }}>
            Cap reserva registrada avui. Dia tranquil — la sala descansa.
          </p>
        ) : (
          <>
            {/* KPI row */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: d.servedPax,        l: 'comensals' },
                { v: d.completed.length, l: 'acabades' },
                { v: d.walkIns.length,   l: 'walk-ins' },
                { v: d.noshows.length,   l: 'no-shows' },
              ].map(k => (
                <div key={k.l} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 12,
                  background: 'var(--card-face)',
                  boxShadow: 'var(--shadow-ring), var(--shadow-inset-top)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
                    color: k.l === 'no-shows' && k.v > 0 ? 'var(--rose-700)' : 'var(--ink-900)',
                    lineHeight: 1.1,
                  }}>{k.v}</div>
                  <div style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: .1,
                    color: 'var(--ink-500)', textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)', marginTop: 3,
                  }}>{k.l}</div>
                </div>
              ))}
            </div>

            {/* Narrative */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.peakHour !== null && (
                <p style={narr}>
                  El pic del servei ha estat a les {String(d.peakHour).padStart(2, '0')}:00,
                  amb {d.peakPax} comensals asseguts en aquella franja.
                </p>
              )}
              {d.deltaPct !== null && (
                <p style={narr}>
                  {d.deltaPct >= 0
                    ? `Un ${Math.abs(d.deltaPct)}% més de moviment que un ${d.dayLabel} habitual.`
                    : `Un ${Math.abs(d.deltaPct)}% més tranquil que un ${d.dayLabel} habitual.`}
                </p>
              )}
              {d.cancelled.length > 0 && (
                <p style={narr}>
                  {d.cancelled.length} cancel·laci{d.cancelled.length === 1 ? 'ó' : 'ons'} durant el dia.
                </p>
              )}
            </section>

            {/* Still open — the action */}
            {d.stillOpen.length > 0 && (
              <section style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(176,118,54,.07)',
                border: '1px solid rgba(176,118,54,.22)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.45 }}>
                  <b>{d.stillOpen.length}</b> reserv{d.stillOpen.length === 1 ? 'a' : 'es'} encara
                  sense tancar ({d.stillOpen.reduce((s, r) => s + r.pax, 0)} pax).
                </div>
                <button onClick={() => closeRemaining(d.stillOpen)}
                  className="tac-btn tac-btn--accent"
                  style={{ padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
                  Marcar-les totes com acabades
                </button>
              </section>
            )}
          </>
        )}

        {/* Tomorrow */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: .14,
            color: 'var(--ink-500)', textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
          }}>
            Demà
          </div>
          {d.toms.length === 0 ? (
            <p style={narr}>Sense reserves per demà, de moment.</p>
          ) : (
            <>
              <p style={narr}>
                {d.toms.length} reserv{d.toms.length === 1 ? 'a' : 'es'} · {d.tomPax} comensals.
                La primera, {d.toms[0].name} a les {d.toms[0].time}
                {d.toms[0].pax >= 8 ? ` (${d.toms[0].pax} pax)` : ''}.
              </p>
              {d.tomBig.length > 0 && (
                <p style={{ ...narr, color: 'var(--clay-700)' }}>
                  {d.tomBig.length} grup{d.tomBig.length === 1 ? '' : 's'} gran{d.tomBig.length === 1 ? '' : 's'} —
                  {' '}{d.tomBig.map(r => `${r.pax} pax a les ${r.time}`).join(' · ')}.
                  {d.tomBig.some(r => !r.tableIds || r.tableIds.length === 0)
                    ? ' Recorda deixar la distribució de taules pensada.'
                    : ''}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </AnimatedSheet>
  );
}

const narr: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-serif)', fontSize: 15,
  lineHeight: 1.55, color: 'var(--ink-800)', letterSpacing: -.003,
};
