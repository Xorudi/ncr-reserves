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

        <div style={{ background:'var(--paper)', borderBottom:'var(--hair)', padding:'14px 16px 18px' }}>

          <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, textTransform:'uppercase', marginBottom:12 }}>
            Sentar ara
          </div>

          {/* Pax selector */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.05, marginBottom:8 }}>PAX</div>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
              {PAX_OPTIONS.map(n => (
                <button key={n} onClick={() => { setPax(n); setNoTableWarn(false); }}
                  style={{
                    width:40, height:40, borderRadius:10,
                    border: pax === n ? '2px solid var(--terracotta-600)' : '1.5px solid rgba(60,40,20,.15)',
                    background: pax === n ? 'var(--terracotta-50)' : 'var(--cream)',
                    color: pax === n ? 'var(--terracotta-700)' : 'var(--ink-700)',
                    fontWeight: pax === n ? 700 : 500, fontSize:15,
                    cursor:'pointer', fontFamily:'inherit', display:'grid', placeItems:'center',
                  }}>
                  {n}
                </button>
              ))}
              <button onClick={() => { setPax(p => p + 1); setNoTableWarn(false); }}
                style={{
                  width:40, height:40, borderRadius:10,
                  border: pax > 8 ? '2px solid var(--terracotta-600)' : '1.5px solid rgba(60,40,20,.15)',
                  background: pax > 8 ? 'var(--terracotta-50)' : 'var(--cream)',
                  color: pax > 8 ? 'var(--terracotta-700)' : 'var(--ink-500)',
                  fontWeight:500, fontSize:12, cursor:'pointer', fontFamily:'inherit',
                  display:'grid', placeItems:'center',
                }}>
                {pax > 8 ? pax : '+'}
              </button>
            </div>
          </div>

          {/* Zone selector */}
          {zones.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.05, marginBottom:8 }}>ZONA</div>
              <div style={{ display:'flex', gap:7, overflowX:'auto', paddingBottom:2 }}>
                {zones.map(z => (
                  <button key={z.id} onClick={() => handleZoneChange(z.id)}
                    style={{
                      flexShrink:0, padding:'7px 14px', borderRadius:9,
                      border: zoneId === z.id ? '2px solid var(--terracotta-600)' : '1.5px solid rgba(60,40,20,.15)',
                      background: zoneId === z.id ? 'var(--terracotta-50)' : 'var(--cream)',
                      color: zoneId === z.id ? 'var(--terracotta-700)' : 'var(--ink-700)',
                      fontWeight: zoneId === z.id ? 700 : 500, fontSize:13,
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
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.05, marginBottom:8 }}>MESA</div>

              {/* Mode toggle */}
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                {(['auto','manual'] as const).map(m => (
                  <button key={m} onClick={() => { setTableMode(m); setSelTableId(null); setNoTableWarn(false); }}
                    style={{
                      flex:1, padding:'8px 0', borderRadius:9,
                      border: tableMode === m ? '2px solid var(--ink-800)' : '1.5px solid rgba(60,40,20,.15)',
                      background: tableMode === m ? 'var(--ink-900)' : 'var(--cream)',
                      color: tableMode === m ? 'var(--cream)' : 'var(--ink-600)',
                      fontWeight: tableMode === m ? 700 : 500, fontSize:13,
                      cursor:'pointer', fontFamily:'inherit',
                    }}>
                    {m === 'auto' ? '⚡ Automàtica' : '🔍 Manual'}
                  </button>
                ))}
              </div>

              {/* Auto result */}
              {tableMode === 'auto' && (
                autoTable ? (
                  <div style={{ padding:'10px 13px', borderRadius:10, background:'rgba(46,112,64,.08)', border:'1px solid rgba(46,112,64,.2)', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18 }}>✅</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-900)' }}>
                        Mesa {autoTable.name ?? autoTable.id}
                      </div>
                      <div style={{ fontSize:11.5, color:'var(--ink-500)' }}>
                        {autoTable.cap} pax · {zones.find(z => z.id === zoneId)?.label}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding:'10px 13px', borderRadius:10, background:'rgba(185,90,30,.08)', border:'1px solid rgba(185,90,30,.2)', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--clay-700)' }}>No hi ha meses disponibles</div>
                      <div style={{ fontSize:11.5, color:'var(--ink-500)' }}>
                        Canvia de zona o redueix el pax
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Manual table list */}
              {tableMode === 'manual' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:7 }}>
                  {zoneTables.map(t => {
                    const isFree   = t.status === 'free';
                    const fits     = t.cap >= pax;
                    const selected = selTableId === t.id;
                    const disabled = !isFree;
                    return (
                      <button key={t.id}
                        onClick={() => !disabled && setSelTableId(selected ? null : t.id)}
                        style={{
                          padding:'9px 6px', borderRadius:10,
                          border: selected ? '2px solid var(--terracotta-600)' : disabled ? '1.5px solid rgba(60,40,20,.08)' : fits ? '1.5px solid rgba(60,40,20,.15)' : '1.5px solid rgba(185,90,30,.3)',
                          background: selected ? 'var(--terracotta-50)' : disabled ? 'rgba(60,40,20,.04)' : 'var(--cream)',
                          opacity: disabled ? .5 : 1,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          fontFamily:'inherit', textAlign:'center',
                        }}>
                        <div style={{ fontSize:13, fontWeight:700, color: selected ? 'var(--terracotta-700)' : 'var(--ink-900)' }}>
                          {t.name ?? t.id}
                        </div>
                        <div style={{ fontSize:10, color:'var(--ink-500)', marginTop:2 }}>{t.cap}p</div>
                        {disabled && (
                          <div style={{ fontSize:9, color:'var(--ink-400)', marginTop:1 }}>
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
              marginTop:14, width:'100%', padding:'13px 0', borderRadius:12,
              border:'none', cursor: done ? 'default' : 'pointer',
              background: done ? '#2e7040' : (noTableWarn ? 'var(--clay-600)' : 'var(--terracotta-600)'),
              color:'white', fontFamily:'inherit', fontSize:15, fontWeight:700,
              transition:'background .2s',
            }}>
            {done
              ? '✓ Registrat!'
              : noTableWarn
                ? `Sentar ${pax}p sense taula`
                : `🍽️ Sentar ${pax} persona${pax !== 1 ? 'es' : ''} ara`
            }
          </button>

          {noTableWarn && (
            <button onClick={() => { setNoTableWarn(false); handleSeat(); }}
              style={{ marginTop:8, width:'100%', padding:'11px 0', borderRadius:12, border:'1.5px solid rgba(60,40,20,.15)', background:'transparent', color:'var(--ink-700)', fontFamily:'inherit', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Continuar igualment sense taula
            </button>
          )}
        </div>

        {/* ── Reservations list ──────────────────────────────────────────── */}
        <div style={{ padding:'14px 14px 0' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, textTransform:'uppercase', marginBottom:10 }}>
            Reserves d'avui · {todayStr}
          </div>

          {pending.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--ink-400)', fontSize:14 }}>
              Cap reserva pendent avui
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8, paddingBottom:8 }}>
              {pending.map(r => {
                const sc = STATUS_COLOR[r.status] ?? 'var(--ink-500)';
                return (
                  <div key={r.id}
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'12px 14px', borderRadius:12,
                      background:'var(--paper)', border:'1px solid rgba(60,40,20,.1)',
                    }}>
                    <span className="mono" style={{ fontSize:14, fontWeight:700, color:'var(--ink-700)', flexShrink:0 }}>
                      {r.time}
                    </span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize:12, color:'var(--ink-500)' }}>
                        {r.pax} pax{r.notes ? ` · ${r.notes}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                      <span style={{ fontSize:10.5, fontWeight:700, color:sc }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      {r.status !== 'seated' && (
                        <button onClick={() => handleConfirm(r.id)}
                          style={{ padding:'4px 10px', borderRadius:7, border:'none', background:'var(--terracotta-600)', color:'white', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer' }}>
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
    </div>
  );
}
