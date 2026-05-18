/**
 * ReservationsListSheet — bottom sheet that lists a filtered subset of the
 * day's reservations. Opened from a SmartInsightsStrip chip ("4 grups grans",
 * "2 clients VIP", "reserves a les 21h", etc.) so the operator can jump
 * straight from the insight to the actionable list.
 *
 * Tapping a row sets selectedReservation in the store and closes the sheet —
 * the parent shell will surface the detail (RightPanel on desktop, detail
 * sheet on touch).
 */
import React, { useMemo } from 'react';
import AnimatedSheet from './AnimatedSheet';
import { Icon, I } from './Icons';
import { useAppStore } from '@/store/useAppStore';
import { rankCustomers, type CustomerStats } from '@/utils/loyalty';
import { matchReservations, type ReservationFilter } from '@/utils/insights';
import { resPalette } from '@/utils/statusLabels';
import type { Reservation } from '@/types';

interface Props {
  open:   boolean;
  filter: ReservationFilter | null;
  title:  string;
  onClose: () => void;
}

export default function ReservationsListSheet({ open, filter, title, onClose }: Props) {
  const {
    selectedBusiness, selectedDate, reservations, customers,
    setSelectedReservation,
  } = useAppStore();

  const dayIso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;
  const dayRes = useMemo(
    () => reservations.filter(r =>
      r.bizId === selectedBusiness && r.date === dayIso && r.status !== 'cancelled'
    ).sort((a, b) => a.time.localeCompare(b.time)),
    [reservations, selectedBusiness, dayIso]
  );

  // Build the loyalty lookup once so VIP filter is O(1) per row.
  const rankedMap = useMemo(() => {
    const m = new Map<string, CustomerStats>();
    const ranked = rankCustomers(customers, reservations, selectedBusiness);
    ranked.forEach(r => {
      if (r.customer.phone) m.set(`p:${r.customer.phone}`, r.stats);
      m.set(`n:${r.customer.name.trim().toLowerCase()}`, r.stats);
    });
    return m;
  }, [customers, reservations, selectedBusiness]);

  const matched = useMemo(
    () => filter ? matchReservations(filter, dayRes, rankedMap) : [],
    [filter, dayRes, rankedMap]
  );

  function pick(r: Reservation) {
    setSelectedReservation(r);
    onClose();
  }

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={210}>
      <div
        data-swipeable="true"
        style={{
          background: 'linear-gradient(180deg, var(--paper) 0%, var(--cream) 100%)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -6px 32px rgba(60,40,20,.18)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
          maxHeight: '88vh',
          overflowY: 'auto',
        }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '11px auto 12px' }} />

        {/* Header */}
        <div style={{
          padding: '4px 22px 16px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: 'var(--hair)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
            }}>{title}</div>
            <div style={{
              fontSize: 11.5, color: 'var(--ink-500)', marginTop: 4,
              fontFamily: 'var(--font-mono)', letterSpacing: .04,
            }}>{matched.length} {matched.length === 1 ? 'reserva' : 'reserves'}</div>
          </div>
          <button onClick={onClose} className="tac-btn" style={{
            color: 'var(--ink-700)',
            fontSize: 13, fontWeight: 650, padding: '7px 14px',
            borderRadius: 999, flexShrink: 0,
          }}>Tancar</button>
        </div>

        {/* List */}
        <div style={{ padding: '14px 16px 4px' }}>
          {matched.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 16px 28px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              {/* Soft icon — search glass over a hairline circle */}
              <div aria-hidden style={{
                width: 56, height: 56, borderRadius: 999,
                background: 'var(--surface-base)',
                border: '1px dashed rgba(60,40,20,.16)',
                display: 'grid', placeItems: 'center',
                color: 'var(--ink-500)',
                marginBottom: 4,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-3.7-3.7" />
                </svg>
              </div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500,
                color: 'var(--ink-800)', letterSpacing: -.005,
              }}>
                Cap reserva al filtre
              </div>
              <div style={{
                fontSize: 12.5, color: 'var(--ink-500)', maxWidth: 240, lineHeight: 1.45,
              }}>
                Prova canviant el filtre o el dia per veure més reserves.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matched.map(m => <ResRow key={m.reservation.id} m={m} onPick={pick} />)}
            </div>
          )}
        </div>
      </div>
    </AnimatedSheet>
  );
}

function ResRow({ m, onPick }: { m: { reservation: Reservation; isVip: boolean }; onPick: (r: Reservation) => void }) {
  const r = m.reservation;
  const pal = resPalette(r.status);
  return (
    <button onClick={() => onPick(r)} className="press"
      style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 12,
        background: 'var(--paper)',
        border: '1px solid rgba(60,40,20,.08)',
        boxShadow: '0 1px 2px rgba(60,40,20,.04)',
        cursor: 'pointer', fontFamily: 'inherit',
      }}>
      <div style={{
        flexShrink: 0, width: 48, padding: '6px 0',
        background: 'var(--ink-50)', borderRadius: 9, textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500, color: 'var(--ink-900)', lineHeight: 1 }}>
          {r.pax}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .1, textTransform: 'uppercase', marginTop: 2 }}>
          pax
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 14.5, fontWeight: 650, color: 'var(--ink-900)',
          letterSpacing: -.005,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
          {m.isVip && <span title="VIP" style={{ fontSize: 11 }}>⭐</span>}
          {(r.tags?.includes('birthday') || r.notes?.toLowerCase().includes('aniversari')) && <span style={{ fontSize: 12 }}>🎂</span>}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--ink-500)', marginTop: 3,
          fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: .02,
        }}>
          {r.time}{r.phone ? ` · ${r.phone}` : ''}{r.source ? ` · ${r.source}` : ''}
        </div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 999,
        background: pal.bg, color: pal.fg, border: `1px solid ${pal.ring}`,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>{pal.label}</span>
      <Icon d={I.chevR} size={13} stroke={2} />
    </button>
  );
}
