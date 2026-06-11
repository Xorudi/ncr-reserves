/**
 * HoursScreen — Més → "Horaris".
 *
 * One place for everything time-related of the CURRENT business:
 *
 *   1. Torns de servei — per shift: start/end, kitchen close (last
 *      orders) and dining-room close (when to start moving guests to
 *      bar/terrace so the room can be reset). The two bell times drive
 *      the automatic service reminders + the Tancament del dia prompt.
 *   2. Horari d'obertura — weekly open/close per day (up to two slots).
 *
 * Everything saves through the existing store mutators, which also sync
 * to the cloud (biz_settings JSON blob — new fields ride along free).
 */
import React from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES } from '@/data/mockData';
import type { BizShift, BusinessHours, TimeSlot } from '@/types';

const DAY_LABELS = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];

export default function HoursScreen({ onBack }: { onBack: () => void }) {
  const {
    selectedBusiness, bizShifts, updateBizShift,
    businessHours, updateBusinessHours,
  } = useAppStore();

  const biz    = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const shifts = bizShifts[selectedBusiness] ?? [];
  const hours  = businessHours[selectedBusiness];

  function patchShift(id: string, updates: Partial<BizShift>) {
    updateBizShift(selectedBusiness, id, updates);
  }

  function patchDay(dayIdx: number, updates: Partial<BusinessHours['days'][number]>) {
    if (!hours) return;
    const days = hours.days.map((d, i) => i === dayIdx ? { ...d, ...updates } : d);
    updateBusinessHours(selectedBusiness, { ...hours, days });
  }

  function patchSlot(dayIdx: number, slotIdx: number, patch: Partial<TimeSlot>) {
    if (!hours) return;
    const day = hours.days[dayIdx];
    const slots = day.slots.map((s, i) => i === slotIdx ? { ...s, ...patch } : s);
    patchDay(dayIdx, { slots });
  }

  function addSlot(dayIdx: number) {
    if (!hours) return;
    const day = hours.days[dayIdx];
    if (day.slots.length >= 2) return;
    patchDay(dayIdx, { slots: [...day.slots, { start: '19:00', end: '23:00' }] });
  }

  function removeSlot(dayIdx: number, slotIdx: number) {
    if (!hours) return;
    const day = hours.days[dayIdx];
    patchDay(dayIdx, { slots: day.slots.filter((_, i) => i !== slotIdx) });
  }

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px var(--scroll-pad-bottom)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 16px' }}>
        <button onClick={onBack} className="tac-btn"
          style={{
            width: 36, height: 36, borderRadius: 10, padding: 0,
            display: 'grid', placeItems: 'center', color: 'var(--ink-700)',
          }}>
          <Icon d={I.chevL ?? I.chevR} size={15} />
        </button>
        <div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
            color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
          }}>
            Horaris
          </div>
          <div style={{
            fontSize: 10.5, color: 'var(--ink-500)', fontWeight: 600,
            letterSpacing: .08, textTransform: 'uppercase', marginTop: 3,
            fontFamily: 'var(--font-mono)',
          }}>
            {biz.name} · servei, cuina i obertura
          </div>
        </div>
      </div>

      {/* ── Torns de servei ──────────────────────────────────────────── */}
      <SectionLabel>Torns de servei</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {shifts.map(s => (
          <div key={s.id} style={{
            padding: '13px 14px', borderRadius: 14,
            background: 'var(--card-face)',
            boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
            display: 'flex', flexDirection: 'column', gap: 10,
            opacity: s.active ? 1 : .55,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500,
                color: 'var(--ink-900)', flex: 1,
              }}>
                {s.label}
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--ink-500)' }}>
                  {s.active ? 'Actiu' : 'Inactiu'}
                </span>
                <input type="checkbox" checked={s.active}
                  onChange={e => patchShift(s.id, { active: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: 'var(--terracotta-600)' }} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <TimeField label="Inici"  value={s.start} onChange={v => patchShift(s.id, { start: v })} />
              <TimeField label="Final"  value={s.end}   onChange={v => patchShift(s.id, { end: v })} />
              <TimeField label="Cuina tanca" hint="últimes comandes"
                value={s.kitchenClose ?? ''} clearable
                onChange={v => patchShift(s.id, { kitchenClose: v || undefined })} />
              <TimeField label="Tancar menjador" hint="avís a sala"
                value={s.diningClose ?? ''} clearable
                onChange={v => patchShift(s.id, { diningClose: v || undefined })} />
            </div>
          </div>
        ))}
        <p style={{
          margin: '2px 4px 0', fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink-500)',
        }}>
          «Cuina tanca» dispara l'avís de tancament del dia. «Tancar menjador» recorda
          convidar els clients a bar/terrassa per preparar la sala. Deixa'ls buits per
          desactivar els avisos.
        </p>
      </div>

      {/* ── Horari d'obertura ────────────────────────────────────────── */}
      <SectionLabel>Horari d'obertura</SectionLabel>
      <div style={{
        borderRadius: 14, overflow: 'hidden',
        background: 'var(--card-face)',
        boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
      }}>
        {hours?.days.map((day, i) => (
          <div key={i} style={{
            padding: '11px 14px',
            borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 13.5, fontWeight: 650, flex: 1,
                color: day.open ? 'var(--ink-900)' : 'var(--ink-400)',
              }}>
                {DAY_LABELS[i]}
              </span>
              {!day.open && (
                <span style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: .06,
                  color: 'var(--ink-400)', textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                }}>Tancat</span>
              )}
              <input type="checkbox" checked={day.open}
                onChange={e => patchDay(i, { open: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: 'var(--olive-600)' }} />
            </div>

            {day.open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {day.slots.map((slot, si) => (
                  <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" value={slot.start}
                      onChange={e => patchSlot(i, si, { start: e.target.value })}
                      style={timeInput} />
                    <span style={{ color: 'var(--ink-400)', fontSize: 12 }}>–</span>
                    <input type="time" value={slot.end}
                      onChange={e => patchSlot(i, si, { end: e.target.value })}
                      style={timeInput} />
                    <button onClick={() => removeSlot(i, si)} aria-label="Treure franja"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--ink-400)', padding: 4, display: 'flex',
                      }}>
                      <Icon d={I.x} size={13} />
                    </button>
                  </div>
                ))}
                {day.slots.length < 2 && (
                  <button onClick={() => addSlot(i)}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'transparent', border: '1px dashed var(--line)',
                      borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 11.5, fontWeight: 650,
                      color: 'var(--ink-500)',
                    }}>
                    + Afegir franja
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)',
      letterSpacing: .08, textTransform: 'uppercase',
      padding: '0 4px 8px',
    }}>
      {children}
    </div>
  );
}

function TimeField({ label, hint, value, onChange, clearable }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; clearable?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: .08,
        color: 'var(--ink-500)', textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>
        {label}{hint ? <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> · {hint}</span> : null}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="time" value={value} onChange={e => onChange(e.target.value)} style={timeInput} />
        {clearable && value && (
          <button onClick={() => onChange('')} aria-label={`Treure ${label}`}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--ink-400)', padding: 2, display: 'flex',
            }}>
            <Icon d={I.x} size={12} />
          </button>
        )}
      </div>
    </label>
  );
}

const timeInput: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
  color: 'var(--ink-900)', background: 'var(--cream)',
  border: '1px solid var(--line)', borderRadius: 8,
  padding: '6px 8px', outline: 'none', minWidth: 0, flex: 1,
};
