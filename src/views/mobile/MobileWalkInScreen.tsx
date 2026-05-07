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
  const {
    selectedBusiness, reservations, floorPlans,
    addReservation, updateFloorTable,
  } = useAppStore();

  const todayStr = isoDate(new Date());
  const now      = new Date();
  const nowTime  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // Floor plan data
  const plan  = floorPlans[selectedBusiness];
  const zones = useMemo(() =>
    plan ? [...plan.zones].sort((a, b) => a.order - b.order) : [],
    [plan],
  );

  // Form state
  const [pax,        setPax]        = useState(2);
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [notes,      setNotes]      = useState('');
  const [showExtra,  setShowExtra]  = useState(false);
  const [zoneId,     setZoneId]     = useState<string | null>(zones[0]?.id ?? null);
  const [tableMode,  setTableMode]  = useState<'auto' | 'manual'>('auto');
  const [selTableId, setSelTableId] = useState<string | null>(null);
  const [done,       setDone]       = useState(false);
  const [noTableWarn, setNoTableWarn] = useState(false);

  // Available (free) tables in selected zone with enough capacity
  const availableTables = useMemo(() => {
    if (!plan || !zoneId) return [];
    return plan.tables
      .filter(t => t.zone === zoneId && t.status === 'free' && t.cap >= pax)
      .sort((a, b) => a.cap - b.cap); // smallest fitting table first
  }, [plan, zoneId, pax]);

  // All tables in zone (for manual list — show available + others with status)
  const zoneTables = useMemo(() => {
    if (!plan || !zoneId) return [];
    return plan.tables
      .filter(t => t.zone === zoneId)
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [plan, zoneId]);

  const autoTable = availableTables[0] ?? null; // best auto pick
  const finalTable = tableMode === 'auto' ? autoTable : (selTableId ? plan?.tables.find(t => t.id === selTableId) ?? null : null);

  // Today's pending + confirmed reservations for this biz
  const pending = useMemo(() =>
    reservations
      .filter(r => r.bizId === selectedBusiness && r.date === todayStr && (r.status === 'pending' || r.status === 'confirmed'))
      .sort((a, b) => a.time.localeCompare(b.time)),
    [reservations, selectedBusiness, todayStr],
  );

  function handleSeat() {
    // Auto mode: check there's a table available
    if (tableMode === 'auto' && !autoTable && zones.length > 0) {
      setNoTableWarn(true);
      return;
    }
    setNoTableWarn(false);

    // Create reservation
    addReservation({
      bizId:  selectedBusiness,
      date:   todayStr,
      time:   nowTime,
      name:   name.trim() || `Walk-in ${pax}p`,
      pax,
      status: 'seated',
      source: 'walk-in',
      phone:  phone.trim() || undefined,
      notes:  notes.trim() || undefined,
    });

    // Update table status
    if (finalTable) {
      updateFloorTable(selectedBusiness, finalTable.id, { status: 'seated', time: nowTime });
    }

    setDone(true);
    setTimeout(() => {
      setDone(false);
      setName(''); setPhone(''); setNotes(''); setPax(2);
      setSelTableId(null); setShowExtra(false); setNoTableWarn(false);
    }, 1800);
  }

  function handleConfirm(id: string) {
    useAppStore.getState().updateReservationStatus(id, 'seated');
  }

  // When zone changes, reset table selection
  function handleZoneChange(id: string) {
    setZoneId(id);
    setSelTableId(null);
    setNoTableWarn(false);
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'10px 12px', border:'1.5px solid rgba(60,40,20,.15)',
    borderRadius:9, fontFamily:'inherit', fontSize:14, color:'var(--ink-900)',
    background:'var(--cream)', outline:'none',
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Quick-seat form ────────────────────────────────────────────── */}
      <div className="scroll" style={{ flex: 1, overflowY:'auto', paddingBottom:'var(--scroll-pad-bottom)' }}>

        <div style={{ background:'var(--paper)', borderBottom:'var(--hair)', padding:'14px 18px 18px' }}>

          <div style={{ fontSize:11, fontWeight:700, color:'var(--terracotta-700)', letterSpacing:.4, textTransform:'uppercase', marginBottom:14 }}>
            Sentar ara
          </div>

          {/* Pax selector */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.05, marginBottom:10 }}>COMENSALS</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
              {PAX_OPTIONS.map(n => (
                <button key={n} onClick={() => { setPax(n); setNoTableWarn(false); }}
                  style={{
                    aspectRatio:'1/1', borderRadius:14, fontFamily:'var(--font-serif)',
                    border: pax === n ? 'none' : '1px solid rgba(60,40,20,.14)',
                    background: pax === n ? 'var(--ink-900)' : 'var(--paper)',
                    color: pax === n ? 'var(--cream)' : 'var(--ink-900)',
                    fontSize:26, fontWeight:500, cursor:'pointer',
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center' }}>
              <button onClick={() => { setPax(Math.max(1, pax - 1)); setNoTableWarn(false); }}
                style={{ width:44, height:44, borderRadius:999, border:'1px solid rgba(60,40,20,.14)', background:'var(--paper)', fontSize:22, color:'var(--ink-600)', cursor:'pointer', fontFamily:'inherit' }}>−</button>
              <div style={{ flex:1, textAlign:'center', fontFamily:'var(--font-serif)', fontSize:17, color:'var(--ink-900)' }}>
                {pax} comensal{pax !== 1 ? 's' : ''}
              </div>
              <button onClick={() => { setPax(p => p + 1); setNoTableWarn(false); }}
                style={{ width:44, height:44, borderRadius:999, border:'1px solid rgba(60,40,20,.14)', background:'var(--paper)', fontSize:22, color:'var(--ink-600)', cursor:'pointer', fontFamily:'inherit' }}>+</button>
            </div>
          </div>

          {/* Zone selector */}
          {zones.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.05, marginBottom:10 }}>ZONA</div>
              <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
                {zones.map(z => (
                  <button key={z.id} onClick={() => handleZoneChange(z.id)}
                    style={{
                      flexShrink:0, padding:'7px 14px', borderRadius:999, whiteSpace:'nowrap',
                      border: zoneId === z.id ? 'none' : '1px solid rgba(60,40,20,.14)',
                      background: zoneId === z.id ? 'var(--ink-900)' : 'var(--paper)',
                      color: zoneId === z.id ? 'var(--cream)' : 'var(--ink-500)',
                      fontWeight: zoneId === z.id ? 600 : 500, fontSize:13,
                      cursor:'pointer', fontFamily:'inherit',
                    }}>
                    {z.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Table assignment */}
          {zones.length > 0 && zoneId && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.05, marginBottom:10 }}>TAULA</div>

              {/* Mode toggle — pill segmented */}
              <div style={{ display:'inline-flex', padding:3, background:'rgba(60,40,20,.06)', borderRadius:999, gap:2, marginBottom:12 }}>
                {(['auto','manual'] as const).map(m => {
                  const a = tableMode === m;
                  return (
                    <button key={m} onClick={() => { setTableMode(m); setSelTableId(null); setNoTableWarn(false); }}
                      style={{
                        padding:'7px 16px', borderRadius:999, border:'none',
                        background: a ? 'var(--paper)' : 'transparent',
                        color: a ? 'var(--ink-900)' : 'var(--ink-500)',
                        fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit',
                        boxShadow: a ? 'var(--sh-1)' : 'none',
                      }}>
                      {m === 'auto' ? 'Automàtica' : 'Manual'}
                    </button>
                  );
                })}
              </div>

              {/* Auto result */}
              {tableMode === 'auto' && (
                autoTable ? (
                  <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--olive-50)', border:'1px solid rgba(90,107,53,.2)', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:'var(--olive-100)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500, color:'var(--olive-700)', flexShrink:0 }}>
                      {autoTable.name ?? autoTable.id}
                    </div>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:700, color:'var(--olive-700)' }}>
                        Taula {autoTable.name ?? autoTable.id} · {autoTable.cap} pax
                      </div>
                      <div style={{ fontSize:11.5, color:'var(--olive-700)', opacity:.75, marginTop:1 }}>
                        {zones.find(z => z.id === zoneId)?.label} · lliure
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--clay-50)', border:'1px solid rgba(140,90,43,.2)', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'var(--clay-700)', flexShrink:0 }}>!</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--clay-700)' }}>No hi ha taules disponibles</div>
                      <div style={{ fontSize:11.5, color:'var(--clay-700)', opacity:.75 }}>Canvia de zona o redueix el pax</div>
                    </div>
                  </div>
                )
              )}

              {/* Manual table list — 3-col grid */}
              {tableMode === 'manual' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
                  {zoneTables.map(t => {
                    const isFree   = t.status === 'free';
                    const fits     = t.cap >= pax;
                    const selected = selTableId === t.id;
                    const disabled = !isFree;
                    return (
                      <button key={t.id}
                        onClick={() => !disabled && setSelTableId(selected ? null : t.id)}
                        style={{
                          aspectRatio:'1/1', borderRadius:12, padding:'10px 8px', fontFamily:'inherit',
                          border: selected ? `2px solid var(--terracotta-600)` : disabled ? '1px solid rgba(60,40,20,.08)' : fits ? '1px solid rgba(60,40,20,.14)' : '1px solid rgba(185,90,30,.25)',
                          background: selected ? 'var(--terracotta-50)' : disabled ? 'rgba(60,40,20,.04)' : 'var(--olive-50)',
                          opacity: disabled ? .5 : 1,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center', gap:4,
                        }}>
                        <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500, color: selected ? 'var(--terracotta-700)' : 'var(--olive-700)' }}>
                          {t.name ?? t.id}
                        </div>
                        <div style={{ fontSize:10, color:'var(--ink-500)', fontWeight:600 }}>{t.cap} pax</div>
                        {disabled && (
                          <div style={{ fontSize:9, color:'var(--ink-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:.3 }}>
                            {t.status === 'seated' ? 'ocupada' : t.status}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {zoneTables.length === 0 && (
                    <div style={{ gridColumn:'1/-1', fontSize:13, color:'var(--ink-500)', textAlign:'center', padding:'10px 0' }}>
                      Cap taula en aquesta zona
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No-table warning */}
          {noTableWarn && (
            <div style={{ padding:'9px 12px', borderRadius:9, background:'rgba(185,90,30,.12)', border:'1px solid rgba(185,90,30,.25)', fontSize:12, color:'var(--clay-700)', marginBottom:12 }}>
              ⚠️ No hi ha meses lliures. Pots continuar sense assignar taula o canviar de zona.
            </div>
          )}

          {/* Optional extra fields */}
          <button onClick={() => setShowExtra(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:5, background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12, color:'var(--ink-500)', marginBottom: showExtra ? 10 : 0, padding:0 }}>
            <Icon d={showExtra ? I.chevD : I.chevR} size={13} />
            Nom, telèfon i notes (opcional)
          </button>

          {showExtra && (
            <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:2 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom del client" style={inp} />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telèfon" style={inp} />
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (al·lèrgies, taula especial…)" style={inp} />
            </div>
          )}

          {/* CTA */}
          <button onClick={done ? undefined : handleSeat}
            style={{
              marginTop:16, width:'100%', padding:'15px', borderRadius:14,
              border:'none', cursor: done ? 'default' : 'pointer',
              background: done ? 'var(--olive-700)' : (noTableWarn ? 'var(--clay-600)' : 'var(--terracotta-600)'),
              color:'white', fontFamily:'inherit', fontSize:15, fontWeight:650,
              boxShadow: done ? 'none' : '0 4px 12px rgba(168,74,42,.3)',
              transition:'background .2s',
            }}>
            {done
              ? '✓ Registrat!'
              : noTableWarn
                ? `Asseure ${pax}p sense taula`
                : `Asseure ${pax} comensal${pax !== 1 ? 's' : ''} ara`
            }
          </button>

          {noTableWarn && (
            <button onClick={() => { setNoTableWarn(false); handleSeat(); }}
              style={{ marginTop:10, width:'100%', padding:'13px', borderRadius:14, border:'1px solid rgba(60,40,20,.14)', background:'transparent', color:'var(--ink-700)', fontFamily:'inherit', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Continuar igualment sense taula
            </button>
          )}
        </div>

        {/* ── Pending reservations list ─────────────────────────────────── */}
        <div style={{ padding:'14px 0 0' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.4, textTransform:'uppercase', marginBottom:6, paddingLeft:18 }}>
            Reserves pendents avui
          </div>

          {pending.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--ink-400)', fontSize:14, fontFamily:'var(--font-serif)' }}>
              Cap reserva pendent avui
            </div>
          ) : (
            pending.map(r => {
              const isSeated = r.status === 'seated';
              const stateBg  = isSeated ? 'var(--terracotta-50)' : r.status === 'confirmed' ? 'var(--olive-50)' : 'var(--clay-50)';
              const stateFg  = isSeated ? 'var(--terracotta-700)' : r.status === 'confirmed' ? 'var(--olive-700)' : 'var(--clay-700)';
              const stateLabel = isSeated ? 'A taula' : r.status === 'confirmed' ? 'Confirmada' : 'Pendent';
              return (
                <button key={r.id} style={{
                  width:'100%', textAlign:'left', background:'var(--paper)', border:'none',
                  borderTop:'var(--hair)', padding:'12px 18px',
                  display:'flex', gap:12, alignItems:'center', cursor:'pointer', fontFamily:'inherit',
                }}>
                  {/* Pax circle */}
                  <div style={{ width:42, height:42, borderRadius:12, flexShrink:0, background:'var(--cream)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500, color:'var(--ink-800)' }}>
                    {r.pax}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14.5, fontWeight:600, color:'var(--ink-900)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--ink-500)', marginTop:2 }}>
                      {r.time}{r.notes ? ` · ${r.notes}` : ''}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                    <span style={{ padding:'3px 9px', borderRadius:999, background:stateBg, color:stateFg, fontSize:11.5, fontWeight:600 }}>
                      {stateLabel}
                    </span>
                    {!isSeated && (
                      <button onClick={e => { e.stopPropagation(); handleConfirm(r.id); }}
                        style={{ padding:'4px 10px', borderRadius:7, border:'none', background:'var(--terracotta-600)', color:'white', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        A taula
                      </button>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
