import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { BUSINESSES, isoDate } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { FloorTable } from '@/types';

export default function WalkinView({ onClose }: { onClose: () => void }) {
  const { selectedBusiness, floorPlans, addReservation, updateFloorTable } = useAppStore();
  const biz = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const plan = floorPlans[selectedBusiness];

  const [pax, setPax] = useState(2);
  const [step, setStep] = useState(1);
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null);
  const [name, setName] = useState('');

  const freeTables = plan.tables.filter(t => t.status === 'free' && t.shape !== 'stool' && t.shape !== 'court');
  const suitable   = freeTables.filter(t => t.cap >= pax).sort((a,b) => a.cap - b.cap);
  const tooSmall   = freeTables.filter(t => t.cap < pax);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  return (
    <div style={{ flex:1,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'var(--cream)' }}>
      {/* Header */}
      <div style={{ padding:'18px 28px 14px',borderBottom:'var(--hair)',display:'flex',alignItems:'center',gap:14,flexShrink:0 }}>
        <button onClick={onClose} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 10px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:550,color:'var(--ink-700)' }}>
          <Icon d={I.chevL} size={14} /> Tornar
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11,fontWeight:600,color:'var(--ink-500)',textTransform:'uppercase',letterSpacing:.06 }}>Arribada sense reserva · {biz.name}</div>
          <h2 style={{ margin:'2px 0 0',fontFamily:'var(--font-serif)',fontWeight:500,fontSize:22,color:'var(--ink-900)' }}>Walk-in</h2>
        </div>
        {/* Step indicators */}
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <StepDot n={1} label="Comensals" active={step===1} done={step>1} onClick={() => setStep(1)} />
          <StepBar done={step>1} />
          <StepDot n={2} label="Taula" active={step===2} done={step>2} onClick={() => step>1 && setStep(2)} />
          <StepBar done={step>2} />
          <StepDot n={3} label="Asseure" active={step===3} done={false} onClick={undefined} />
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="scroll" style={{ overflowY:'auto',flex:1,padding:'40px 28px' }}>
          <div style={{ maxWidth:640,margin:'0 auto' }}>
            <div style={{ fontSize:13,color:'var(--ink-600)',marginBottom:10,textAlign:'center' }}>Quants són?</div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:24 }}>
              {[1,2,3,4,5,6,7,8,9,10,12,'+'].map(n => {
                const active = pax === n;
                return (
                  <button key={String(n)} onClick={() => typeof n === 'number' && setPax(n)} style={{ aspectRatio:'1/1',border:active?'none':'1.5px solid rgba(60,40,20,0.14)',background:active?'var(--ink-900)':'var(--paper)',color:active?'var(--cream)':'var(--ink-800)',borderRadius:14,fontFamily:'var(--font-serif)',fontSize:28,fontWeight:500,cursor:'pointer',transition:'all .1s',display:'grid',placeItems:'center',boxShadow:active?'var(--sh-2)':'var(--sh-1)' }}>
                    {n}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block',fontSize:11,fontWeight:600,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:6 }}>Nom (opcional)</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Només si deixem que esperin"
                style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:'var(--hair-strong)',background:'var(--paper)',fontFamily:'inherit',fontSize:13,color:'var(--ink-900)',outline:'none' }} />
            </div>

            <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
              <button onClick={() => setStep(3)} style={ghostBtn}>A la barra (sense taula)</button>
              <button onClick={() => setStep(2)} style={primaryBtn}>Triar taula <Icon d={I.arrowR} size={13} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="scroll" style={{ overflowY:'auto',flex:1,padding:'24px 28px' }}>
          <div style={{ display:'flex',alignItems:'baseline',gap:10,marginBottom:14 }}>
            <span style={{ fontFamily:'var(--font-serif)',fontSize:18,fontWeight:500,color:'var(--ink-900)' }}>Taules lliures per a {pax} {pax===1?'persona':'persones'}</span>
            <span style={{ fontSize:12,color:'var(--ink-500)' }}>{suitable.length} disponibles · ordenades per ajust</span>
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,marginBottom:20 }}>
            {suitable.map(t => {
              const isSel = selectedTable?.id === t.id;
              const exact = t.cap === pax;
              return (
                <button key={t.id} onClick={() => setSelectedTable(t)} style={{ padding:14,borderRadius:12,border:isSel?'none':'1.5px solid rgba(60,40,20,0.14)',background:isSel?'var(--ink-900)':'var(--paper)',color:isSel?'var(--cream)':'var(--ink-800)',fontFamily:'inherit',textAlign:'left',cursor:'pointer',display:'flex',flexDirection:'column',gap:4,boxShadow:isSel?'var(--sh-2)':'var(--sh-1)',transition:'all .1s' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <span style={{ fontFamily:'var(--font-mono)',fontSize:15,fontWeight:700,letterSpacing:.3 }}>{t.id}</span>
                    {exact && !isSel && <span style={{ fontSize:9.5,fontWeight:700,letterSpacing:.04,textTransform:'uppercase',padding:'1px 6px',borderRadius:4,background:'var(--olive-100)',color:'var(--olive-700)' }}>Encaix perfecte</span>}
                  </div>
                  <div style={{ fontSize:13,color:isSel?'rgba(251,247,238,.75)':'var(--ink-600)' }}>
                    {t.cap} pax · {plan.zones.find(z=>z.id===t.zone)?.label}
                  </div>
                  {t.cap - pax > 0 && (
                    <div style={{ fontSize:11,color:isSel?'rgba(251,247,238,.6)':'var(--ink-500)' }}>
                      + {t.cap - pax} {t.cap-pax===1?'lloc':'llocs'} extra
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {tooSmall.length > 0 && (
            <details style={{ marginBottom:20 }}>
              <summary style={{ fontSize:12,color:'var(--ink-500)',cursor:'pointer' }}>{tooSmall.length} taules petites · unir-les?</summary>
              <div style={{ marginTop:8,fontSize:12,color:'var(--ink-600)' }}>
                Unir {tooSmall[0]?.id} + {tooSmall[1]?.id} faria {(tooSmall[0]?.cap||0)+(tooSmall[1]?.cap||0)} pax.
              </div>
            </details>
          )}

          <div style={{ display:'flex',gap:8,justifyContent:'space-between',alignItems:'center' }}>
            <button onClick={() => setStep(1)} style={ghostBtn}><Icon d={I.chevL} size={13} /> Canviar comensals</button>
            <div style={{ display:'flex',gap:8 }}>
              <button style={ghostBtn}>Llista d'espera</button>
              <button disabled={!selectedTable} onClick={() => setStep(3)}
                style={{ ...primaryBtn, opacity:selectedTable?1:.5 }}>
                Asseure a {selectedTable?.id || '…'} <Icon d={I.check} size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — confirm */}
      {step === 3 && (
        <ConfirmStep
          bizId={selectedBusiness}
          pax={pax}
          name={name}
          timeStr={timeStr}
          selectedTable={selectedTable}
          plan={plan}
          addReservation={addReservation}
          updateFloorTable={updateFloorTable}
          onClose={onClose}
        />
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display:'flex',alignItems:'center',gap:6,padding:'8px 16px',background:'var(--ink-900)',color:'var(--cream)',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550 };
const ghostBtn: React.CSSProperties   = { display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'transparent',color:'var(--ink-800)',border:'1px solid rgba(60,40,20,0.14)',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550 };

// ─── Step 3 component — persists the walk-in to the store ────────────────────
import type { FloorPlan } from '@/types';

function ConfirmStep({ bizId, pax, name, timeStr, selectedTable, plan, addReservation, updateFloorTable, onClose }: {
  bizId: string;
  pax: number;
  name: string;
  timeStr: string;
  selectedTable: FloorTable | null;
  plan: FloorPlan;
  addReservation: (r: any) => void;
  updateFloorTable: (bizId: string, tableId: string, updates: any) => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);

  function handleConfirm() {
    if (saved) return;
    const today = isoDate(new Date());
    addReservation({
      bizId,
      date:   today,
      time:   timeStr,
      name:   name.trim() || 'Walk-in',
      pax,
      status: 'seated',
      source: 'walk-in',
      notes:  selectedTable ? `Taula ${selectedTable.id}` : undefined,
    });
    if (selectedTable) {
      updateFloorTable(bizId, selectedTable.id, { status: 'seated', time: timeStr });
    }
    setSaved(true);
  }

  // Auto-confirm on first render (walk-in workflow always confirms)
  React.useEffect(() => { handleConfirm(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ textAlign:'center',maxWidth:520,padding:'0 28px' }}>
        <div style={{ width:72,height:72,borderRadius:'50%',background:'var(--olive-100)',color:'var(--olive-700)',display:'grid',placeItems:'center',margin:'0 auto 20px' }}>
          <Icon d={I.check} size={36} stroke={2.5} />
        </div>
        <h3 style={{ fontFamily:'var(--font-serif)',fontSize:26,fontWeight:500,color:'var(--ink-900)',margin:'0 0 10px' }}>
          Taula {selectedTable?.id ?? 'barra'} assignada
        </h3>
        <p style={{ fontSize:14,color:'var(--ink-600)',margin:'0 0 28px',lineHeight:1.5 }}>
          {pax} {pax===1?'comensal':'comensals'}{name && ` · ${name}`} · entrada a les {timeStr}
        </p>
        <div style={{ fontSize:12,color:'var(--olive-600)',marginBottom:20,fontWeight:600 }}>
          {saved ? '✓ Reserva guardada correctament' : 'Guardant…'}
        </div>
        <div style={{ display:'flex',gap:8,justifyContent:'center' }}>
          <button onClick={onClose} style={ghostBtn}>Tornar a la llista</button>
        </div>
      </div>
    </div>
  );
}

function StepDot({ n, label, active, done, onClick }: { n: number; label: string; active: boolean; done: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderRadius:999,background:active?'var(--ink-900)':'transparent',color:active?'var(--cream)':done?'var(--olive-700)':'var(--ink-500)',border:'none',cursor:onClick?'pointer':'default',fontFamily:'inherit',fontSize:12,fontWeight:600 }}>
      <span style={{ width:18,height:18,borderRadius:'50%',background:active?'rgba(255,255,255,0.12)':done?'var(--olive-100)':'var(--ink-100)',display:'grid',placeItems:'center',fontSize:10,fontWeight:700 }}>
        {done ? '✓' : n}
      </span>
      {label}
    </button>
  );
}
function StepBar({ done }: { done: boolean }) {
  return <span style={{ width:24,height:2,background:done?'var(--olive-500)':'rgba(60,40,20,0.12)',borderRadius:1 }} />;
}
