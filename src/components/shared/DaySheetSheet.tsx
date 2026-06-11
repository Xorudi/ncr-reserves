/**
 * DaySheetSheet — "Full del dia": preview + share/copy of the day's
 * bookings as plain text (see utils/daySheet.ts).
 *
 * The night workflow it serves: after the tancament, the operator sends
 * TOMORROW's sheet to the kitchen WhatsApp group so prep starts right.
 * Hence the Avui/Demà toggle instead of a date picker — those are the
 * two days anyone ever shares.
 *
 * Share path: navigator.share when available (iPad/phone native sheet,
 * WhatsApp included); clipboard fallback with a toast elsewhere.
 */
import { useMemo, useState } from 'react';
import AnimatedSheet from './AnimatedSheet';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES } from '@/data/mockData';
import { buildDaySheet, buildWeekSheet, buildMonthSheet } from '@/utils/daySheet';
import { toast } from './Toaster';

interface Props {
  open: boolean;
  onClose: () => void;
}

function isoFromOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Range = 'today' | 'tomorrow' | 'week' | 'month';

export default function DaySheetSheet({ open, onClose }: Props) {
  const { selectedBusiness, reservations, floorPlans } = useAppStore();
  const [range, setRange] = useState<Range>('today');

  const text = useMemo(() => {
    const bizName = BUSINESSES.find(b => b.id === selectedBusiness)?.name ?? '';
    const mine    = reservations.filter(r => r.bizId === selectedBusiness);
    const plan    = floorPlans[selectedBusiness];
    switch (range) {
      case 'today':    return buildDaySheet(bizName, isoFromOffset(0), mine, plan);
      case 'tomorrow': return buildDaySheet(bizName, isoFromOffset(1), mine, plan);
      case 'week':     return buildWeekSheet(bizName, isoFromOffset(0), mine, plan);
      case 'month':    return buildMonthSheet(bizName, isoFromOffset(0), mine);
    }
  }, [selectedBusiness, reservations, floorPlans, range, open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast('Full del dia copiat', { icon: 'check', tone: 'olive' });
    } catch {
      toast('No s\'ha pogut copiar', { icon: 'alert', tone: 'rose' });
    }
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* user cancelled */ }
    } else {
      await copy();
    }
  }

  return (
    <AnimatedSheet open={open} onClose={onClose} desktopMaxWidth={620}>
      <div style={{
        padding: '18px 20px 22px',
        display: 'flex', flexDirection: 'column', gap: 14,
        background: 'var(--surface-elevated)', color: 'var(--ink-900)',
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
              Per a cuina i sala
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
              letterSpacing: -.012,
            }}>
              Full del dia
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

        {/* Day toggle */}
        <div style={{
          display: 'flex', gap: 4, padding: 3, borderRadius: 11,
          background: 'var(--ink-100)', alignSelf: 'flex-start',
        }}>
          {([
            ['today', 'Avui'], ['tomorrow', 'Demà'],
            ['week', 'Setmana'], ['month', 'Mes'],
          ] as const).map(([id, label]) => {
            const active = range === id;
            return (
              <button key={id} onClick={() => setRange(id)} className="press"
                aria-pressed={active}
                style={{
                  padding: '8px 14px', borderRadius: 9, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: active ? 700 : 600,
                  background: active ? 'var(--paper)' : 'transparent',
                  color: active ? 'var(--ink-900)' : 'var(--ink-500)',
                  boxShadow: active ? 'var(--sh-1), var(--shadow-ring)' : 'none',
                  transition: 'background 160ms var(--ease-out), color 160ms var(--ease-out)',
                }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Preview — exactly what will be sent */}
        <pre style={{
          margin: 0, padding: '12px 14px',
          background: 'var(--cream)', borderRadius: 12,
          border: '1px solid var(--line-soft)',
          fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.55,
          color: 'var(--ink-800)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: '42vh', overflowY: 'auto',
        }}>
          {text}
        </pre>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copy} className="tac-btn"
            style={{
              flex: 1, padding: '12px', borderRadius: 11,
              fontSize: 13.5, fontWeight: 650, color: 'var(--ink-800)',
              fontFamily: 'inherit',
            }}>
            Copiar
          </button>
          <button onClick={share} className="tac-btn tac-btn--accent"
            style={{
              flex: 2, padding: '12px', borderRadius: 11,
              fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            }}>
            Compartir →
          </button>
        </div>
      </div>
    </AnimatedSheet>
  );
}
