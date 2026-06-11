/**
 * TrashScreen — Més → Historial.
 *
 * Reservations deleted on THIS device, newest first, with one-tap
 * restore: the booking returns to the exact day/time it lived at
 * (original id and data) and propagates to the cloud. The
 * "por si las moscas" net for accidental deletes.
 */
import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { listTrash, removeFromTrash, clearTrash, type TrashedRes } from '@/lib/resTrash';
import { fmtDateCa } from '@/utils/whatsapp';
import { toast } from '@/components/shared/Toaster';
import EmptyState from '@/components/shared/EmptyState';
import { BUSINESSES } from '@/data/mockData';

function relWhen(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)   return 'ara mateix';
  if (min < 60)  return `fa ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `fa ${h} h`;
  const d = Math.floor(h / 24);
  return `fa ${d} ${d === 1 ? 'dia' : 'dies'}`;
}

export default function TrashScreen({ onBack }: { onBack: () => void }) {
  const restoreReservation = useAppStore(s => s.restoreReservation);
  const reservations       = useAppStore(s => s.reservations);
  const [items, setItems]  = useState<TrashedRes[]>(listTrash);

  function restore(t: TrashedRes) {
    restoreReservation(t.res);
    removeFromTrash(t.res.id);
    setItems(listTrash());
    toast(`${t.res.name} restaurada al ${fmtDateCa(t.res.date)}`, { icon: 'check', tone: 'olive' });
  }

  function emptyAll() {
    clearTrash();
    setItems([]);
    toast('Historial buidat', { icon: 'check', tone: 'olive' });
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
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
            color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
          }}>
            Historial
          </div>
          <div style={{
            fontSize: 10.5, color: 'var(--ink-500)', fontWeight: 600,
            letterSpacing: .08, textTransform: 'uppercase', marginTop: 3,
            fontFamily: 'var(--font-mono)',
          }}>
            Reserves eliminades en aquest dispositiu
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={emptyAll} className="tac-btn tac-btn--ghost"
            style={{
              padding: '7px 12px', borderRadius: 9, fontSize: 12,
              fontWeight: 650, color: 'var(--ink-500)', fontFamily: 'inherit',
            }}>
            Buidar
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="✓"
          title="Cap reserva eliminada"
          sub="Quan s'elimini una reserva quedarà aquí 90 dies, llesta per restaurar"
          glow="rgba(116,133,74,.20)"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(t => {
            const alreadyBack = reservations.some(r => r.id === t.res.id);
            const bizName = BUSINESSES.find(b => b.id === t.res.bizId)?.name ?? t.res.bizId;
            return (
              <div key={t.res.id} style={{
                padding: '12px 14px', borderRadius: 14,
                background: 'var(--card-face)',
                boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                  <span style={{
                    fontSize: 14.5, fontWeight: 650, color: 'var(--ink-900)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                  }}>
                    {t.res.name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500,
                    color: 'var(--ink-700)', flexShrink: 0,
                  }}>
                    {t.res.pax}
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-500)', marginLeft: 2 }}>PAX</span>
                  </span>
                </div>
                <div style={{
                  fontSize: 11.5, color: 'var(--ink-500)',
                  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 650, color: 'var(--ink-600)' }}>
                    {fmtDateCa(t.res.date)} · {t.res.time}
                  </span>
                  <span>· {bizName}</span>
                  <span style={{ color: 'var(--ink-400)' }}>· eliminada {relWhen(t.deletedAt)}</span>
                </div>
                <div>
                  {alreadyBack ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 650, color: 'var(--olive-700)',
                    }}>
                      <Icon d={I.check} size={12} stroke={2.4} /> Ja torna a ser a l'agenda
                    </span>
                  ) : (
                    <button onClick={() => restore(t)} className="tac-btn tac-btn--accent"
                      style={{
                        padding: '8px 16px', borderRadius: 9,
                        fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                      }}>
                      Restaurar →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
