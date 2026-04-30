import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { isoDate } from '@/data/mockData';
import type { MobileTab } from './MobileShell';

const PAX_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pendent',
  confirmed: 'Confirmada',
  seated:    'Ocupada',
  completed: 'Completada',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   '#b05a00',
  confirmed: '#1a4ea0',
  seated:    '#b52b22',
  completed: '#2e7040',
};

export default function MobileWalkInScreen({ onSwitchTab }: { onSwitchTab: (tab: MobileTab) => void }) {
  const { selectedBusiness, reservations, addReservation } = useAppStore();

  const [pax, setPax]         = useState(2);
  const [name, setName]       = useState('');
  const [notes, setNotes]     = useState('');
  const [showExtra, setShowExtra] = useState(false);
  const [done, setDone]       = useState(false);

  const todayStr = isoDate(new Date());
  const now      = new Date();
  const nowTime  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // Today's pending + confirmed reservations for this biz
  const pending = useMemo(() =>
    reservations
      .filter(r => r.bizId === selectedBusiness && r.date === todayStr && (r.status === 'pending' || r.status === 'confirmed'))
      .sort((a, b) => a.time.localeCompare(b.time)),
    [reservations, selectedBusiness, todayStr],
  );

  function handleSeat() {
    addReservation({
      bizId:  selectedBusiness,
      date:   todayStr,
      time:   nowTime,
      name:   name.trim() || `Walk-in ${pax}pax`,
      pax,
      status: 'seated',
      source: 'walk-in',
      notes:  notes.trim() || undefined,
    });
    setDone(true);
    setTimeout(() => {
      setDone(false);
      setName('');
      setNotes('');
      setPax(2);
      setShowExtra(false);
    }, 1800);
  }

  function handleConfirm(id: string) {
    const { updateReservationStatus } = useAppStore.getState();
    updateReservationStatus(id, 'seated');
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Quick-seat card ────────────────────────────────────────────── */}
      <div style={{ background: 'var(--paper)', borderBottom: 'var(--hair)', padding: '16px 16px 20px', flexShrink: 0 }}>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 12 }}>
          Sentar ara
        </div>

        {/* Pax selector */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          {PAX_OPTIONS.map(n => (
            <button key={n} onClick={() => setPax(n)}
              style={{
                width: 40, height: 40, borderRadius: 10,
                border: pax === n ? '2px solid var(--terracotta-600)' : '1.5px solid rgba(60,40,20,.15)',
                background: pax === n ? 'var(--terracotta-50)' : 'var(--cream)',
                color: pax === n ? 'var(--terracotta-700)' : 'var(--ink-700)',
                fontWeight: pax === n ? 700 : 500,
                fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                display: 'grid', placeItems: 'center',
              }}>
              {n}
            </button>
          ))}
          <button onClick={() => setPax(p => p + 1)}
            style={{
              width: 40, height: 40, borderRadius: 10,
              border: pax > 8 ? '2px solid var(--terracotta-600)' : '1.5px solid rgba(60,40,20,.15)',
              background: pax > 8 ? 'var(--terracotta-50)' : 'var(--cream)',
              color: pax > 8 ? 'var(--terracotta-700)' : 'var(--ink-500)',
              fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              display: 'grid', placeItems: 'center',
            }}>
            {pax > 8 ? pax : '+'}
          </button>
        </div>

        {/* Optional extra fields */}
        <button onClick={() => setShowExtra(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--ink-500)', marginBottom: showExtra ? 12 : 0, padding: 0 }}>
          <Icon d={showExtra ? I.chevD : I.chevR} size={13} />
          Nom i notes (opcional)
        </button>

        {showExtra && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 2 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nom del client"
              style={{
                padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(60,40,20,.15)',
                background: 'var(--cream)', fontFamily: 'inherit', fontSize: 14, color: 'var(--ink-900)',
                outline: 'none',
              }}
            />
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (al·lèrgies, taula especial…)"
              style={{
                padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(60,40,20,.15)',
                background: 'var(--cream)', fontFamily: 'inherit', fontSize: 14, color: 'var(--ink-900)',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* CTA */}
        <button
          onClick={done ? undefined : handleSeat}
          style={{
            marginTop: 14, width: '100%', padding: '13px 0', borderRadius: 12,
            border: 'none', cursor: done ? 'default' : 'pointer',
            background: done ? '#2e7040' : 'var(--terracotta-600)',
            color: 'white', fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
            transition: 'background .2s',
          }}>
          {done ? '✓ Registrat!' : `🍽️ Sentar ${pax} persona${pax !== 1 ? 'es' : ''} ara`}
        </button>
      </div>

      {/* ── Reservations list ──────────────────────────────────────────── */}
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 80px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 10 }}>
          Reserves d'avui · {todayStr}
        </div>

        {pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-400)', fontSize: 14 }}>
            Cap reserva pendent avui
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(r => {
              const sc = STATUS_COLOR[r.status] ?? 'var(--ink-500)';
              return (
                <div key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 12,
                    background: 'var(--paper)',
                    border: '1px solid rgba(60,40,20,.1)',
                  }}>
                  {/* Time */}
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-700)', flexShrink: 0 }}>
                    {r.time}
                  </span>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                      {r.pax} pax
                      {r.notes ? ` · ${r.notes}` : ''}
                    </div>
                  </div>
                  {/* Status + seat button */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: sc }}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    {r.status !== 'seated' && (
                      <button
                        onClick={() => handleConfirm(r.id)}
                        style={{
                          padding: '4px 10px', borderRadius: 7, border: 'none',
                          background: 'var(--terracotta-600)', color: 'white',
                          fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}>
                        A taula
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
