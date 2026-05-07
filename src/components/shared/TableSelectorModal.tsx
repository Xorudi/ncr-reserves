/**
 * TableSelectorModal — bottom-sheet to pick one or more floor tables for a reservation.
 *
 * Works on both mobile (full bottom-sheet) and desktop (centred overlay).
 * Props:
 *   bizId         — business whose floor plan to show
 *   pax           — number of guests in the reservation (for capacity warning)
 *   currentIds    — table IDs already assigned to this reservation
 *   onSave(ids)   — called with new selection (may be empty to clear)
 *   onClose       — close without saving
 */
import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { effectiveTable } from '@/utils/tableStatus';

interface Props {
  bizId: string;
  pax: number;
  currentIds: string[];
  /** ISO date (YYYY-MM-DD) of the reservation being edited — used to compute
   *  live table status (free/seated/blocked) for that day. Required so the
   *  picker matches what the Taules screen shows for the same date. */
  date?: string;
  onSave: (tableIds: string[]) => void;
  onClose: () => void;
}

const OCCUPIED_STATUSES = new Set(['seated', 'confirmed', 'reserved', 'pending', 'blocked']);

export default function TableSelectorModal({ bizId, pax, currentIds, date, onSave, onClose }: Props) {
  const { floorPlans, reservations } = useAppStore();
  const plan  = floorPlans[bizId];
  const zones = useMemo(
    () => plan ? [...plan.zones].sort((a, b) => a.order - b.order) : [],
    [plan],
  );

  // Tables with their LIVE status for this reservation's date (matches what
  // the Taules screen renders for that same date — single source of truth).
  const liveTables = useMemo(() => {
    if (!plan) return [];
    if (!date) return plan.tables;
    const dayRes = reservations.filter(r =>
      r.bizId === bizId && r.date === date,
    );
    return plan.tables.map(t => effectiveTable(t, dayRes));
  }, [plan, reservations, bizId, date]);

  const [search,     setSearch]     = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('__all__');
  const [selected,   setSelected]   = useState<string[]>(currentIds);

  const filtered = useMemo(() => {
    if (!plan) return [];
    const q = search.trim().toLowerCase();
    return liveTables.filter(t => {
      if (zoneFilter !== '__all__' && t.zone !== zoneFilter) return false;
      if (!q) return true;
      const name = (t.name ?? t.id).toLowerCase();
      const zone = plan.zones.find(z => z.id === t.zone)?.label.toLowerCase() ?? '';
      return name.includes(q) || zone.includes(q) || String(t.cap).includes(q);
    }).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id, undefined, { numeric: true }));
  }, [plan, liveTables, search, zoneFilter]);

  const totalCap = useMemo(() =>
    selected.reduce((sum, id) => {
      const t = plan?.tables.find(t => t.id === id);
      return sum + (t?.cap ?? 0);
    }, 0),
    [selected, plan],
  );

  const capWarning = selected.length > 0 && totalCap < pax;

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  if (!plan) return null;

  const btnLabel =
    selected.length === 0 ? 'Sense taula' :
    selected.length === 1 ? 'Assignar taula' :
    `Assignar ${selected.length} taules`;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.45)' }} />

      {/* Sheet */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:201,
        background:'var(--paper)', borderRadius:'20px 20px 0 0',
        boxShadow:'0 -6px 32px rgba(0,0,0,.2)',
        maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        {/* Handle */}
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'14px auto 10px', flexShrink:0 }} />

        {/* Header */}
        <div style={{ padding:'0 16px 12px', borderBottom:'var(--hair)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--ink-900)' }}>Assignar taula</div>
            <div style={{ fontSize:12, color:'var(--ink-500)', marginTop:2 }}>
              {selected.length > 0
                ? `${selected.length} taula${selected.length > 1 ? 'es' : ''} · ${totalCap} pax capacitat`
                : `Reserva per ${pax} pax`}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', padding:4 }}>
            <Icon d={I.x} size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding:'10px 14px 6px', flexShrink:0 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
            background:'var(--cream)', border:'1px solid rgba(60,40,20,.12)', borderRadius:10,
          }}>
            <Icon d={I.search} size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per nom, número o zona…"
              style={{ flex:1, border:'none', background:'transparent', fontFamily:'inherit', fontSize:14, color:'var(--ink-900)', outline:'none' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', padding:0, display:'flex' }}>
                <Icon d={I.x} size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Zone filter */}
        <div style={{ padding:'4px 14px 8px', display:'flex', gap:6, overflowX:'auto', flexShrink:0, scrollbarWidth:'none' }}>
          {[{ id:'__all__', label:'Totes' }, ...zones.map(z => ({ id:z.id, label:z.label }))].map(z => (
            <button key={z.id} onClick={() => setZoneFilter(z.id)}
              style={{
                flexShrink:0, padding:'4px 12px', borderRadius:8, border:'none',
                fontFamily:'inherit', fontSize:12.5, fontWeight:600, cursor:'pointer',
                background: zoneFilter === z.id ? 'var(--ink-900)' : 'var(--cream)',
                color:      zoneFilter === z.id ? 'white' : 'var(--ink-600)',
              }}>
              {z.label}
            </button>
          ))}
        </div>

        {/* Capacity warning */}
        {capWarning && (
          <div style={{
            margin:'0 14px 8px', padding:'8px 12px',
            background:'rgba(190,100,20,.08)', border:'1px solid rgba(190,100,20,.2)',
            borderRadius:8, fontSize:12.5, color:'#b05a00', flexShrink:0,
          }}>
            ⚠️ Capacitat total ({totalCap} pax) inferior als comensals ({pax} pax). Pots confirmar igualment.
          </div>
        )}

        {/* Table grid */}
        <div className="scroll" style={{ flex:1, overflowY:'auto', padding:'4px 14px 8px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(86px, 1fr))', gap:8 }}>
            {filtered.map(t => {
              const isSel     = selected.includes(t.id);
              const wasCurrent = currentIds.includes(t.id);
              const isBlocked  = t.status === 'blocked' && !wasCurrent;
              const isOccupied = !isSel && !wasCurrent && OCCUPIED_STATUSES.has(t.status);
              const zoneName   = plan.zones.find(z => z.id === t.zone)?.label ?? '';
              return (
                <button key={t.id}
                  onClick={() => { if (!isBlocked) toggle(t.id); }}
                  style={{
                    padding:'10px 8px', borderRadius:11, textAlign:'left',
                    border: isSel
                      ? '2px solid var(--terracotta-500)'
                      : isOccupied || isBlocked
                        ? '1.5px solid rgba(60,40,20,.08)'
                        : '1.5px solid rgba(60,40,20,.14)',
                    background: isSel
                      ? 'var(--terracotta-50)'
                      : isOccupied || isBlocked ? 'rgba(60,40,20,.03)' : 'var(--cream)',
                    cursor: isBlocked ? 'not-allowed' : 'pointer',
                    opacity: isBlocked ? 0.45 : isOccupied ? 0.6 : 1,
                    fontFamily:'inherit',
                    display:'flex', flexDirection:'column', gap:3,
                  }}>
                  <div style={{
                    fontSize:16, fontWeight:700, lineHeight:1,
                    color: isSel ? 'var(--terracotta-700)' : 'var(--ink-900)',
                  }}>
                    {t.name ?? t.id}
                  </div>
                  <div style={{ fontSize:10, color:'var(--ink-500)' }}>{t.cap} pax</div>
                  {zoneName && <div style={{ fontSize:9.5, color:'var(--ink-400)' }}>{zoneName}</div>}
                  {isOccupied && (
                    <div style={{ fontSize:9.5, color:'#b05a00', fontWeight:600 }}>Ocupada</div>
                  )}
                  {isBlocked && (
                    <div style={{ fontSize:9.5, color:'var(--ink-500)', fontWeight:600 }}>Bloquejada</div>
                  )}
                  {isSel && (
                    <div style={{ alignSelf:'flex-end', color:'var(--terracotta-500)', marginTop:2 }}>
                      <Icon d={I.check} size={12} stroke={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'30px 0', color:'var(--ink-500)', fontSize:14 }}>
              Cap taula trobada
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding:'12px 14px calc(env(safe-area-inset-bottom) + 12px)',
          borderTop:'var(--hair)', display:'flex', gap:8, flexShrink:0,
        }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'11px', background:'var(--ink-100)', border:'none', borderRadius:11, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:'var(--ink-800)' }}>
            Cancel·lar
          </button>
          <button onClick={() => { onSave(selected); onClose(); }}
            style={{ flex:2, padding:'11px', background:'var(--terracotta-600)', border:'none', borderRadius:11, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, color:'white' }}>
            {btnLabel}
          </button>
        </div>
      </div>
    </>
  );
}
