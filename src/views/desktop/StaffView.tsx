import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { STAFF, ROLES, SHIFTS, WEEK_SCHEDULE, DAY_NAMES, TODAY_DOW, initials, avIdx } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';

export default function StaffView() {
  const [tab, setTab] = useState<'duty'|'schedule'>('duty');
  const { selectedBusiness } = useAppStore();
  return (
    <div style={{ flex:1,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'var(--cream)' }}>
      {/* Tabs */}
      <div style={{ padding:'14px 24px 0',borderBottom:'var(--hair)',flexShrink:0,display:'flex',gap:0 }}>
        {([['duty','Equip avui'],['schedule','Horaris setmanals']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'10px 18px',border:'none',background:'transparent',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:tab===k?600:500,color:tab===k?'var(--ink-900)':'var(--ink-600)',borderBottom:tab===k?'2px solid var(--terracotta-600)':'2px solid transparent',marginBottom:-1 }}>{l}</button>
        ))}
      </div>
      {tab==='duty'    && <StaffOnDuty bizId={selectedBusiness} />}
      {tab==='schedule'&& <ScheduleEditor bizId={selectedBusiness} />}
    </div>
  );
}

function StaffOnDuty({ bizId }: { bizId: string }) {
  const [shift, setShift] = useState('M');
  const todayDay = WEEK_SCHEDULE[bizId]?.[TODAY_DOW] ?? { M:[], N:[] };
  const ids = todayDay[shift as 'M'|'N'];
  const onDuty = ids.map(id => STAFF.find(s => s.id === id)).filter(Boolean) as typeof STAFF[0][];
  const byRole: Record<string, typeof STAFF[0][]> = {};
  onDuty.forEach(s => { (byRole[s.role] = byRole[s.role] || []).push(s); });
  const roleOrder = ['encarregat','sala','terrassa','barra','bar','capCuina','cuina','pizzer'];

  return (
    <div className="scroll" style={{ overflowY:'auto',flex:1,padding:'18px 28px 40px' }}>
      <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
        <div style={{ display:'flex',gap:3,padding:3,background:'var(--ink-100)',borderRadius:8 }}>
          {SHIFTS.map(s=>(
            <button key={s.id} onClick={()=>setShift(s.id)} style={{ padding:'7px 14px',border:'none',borderRadius:6,background:shift===s.id?'var(--paper)':'transparent',color:'var(--ink-800)',fontSize:12.5,fontWeight:600,fontFamily:'inherit',cursor:'pointer',boxShadow:shift===s.id?'var(--sh-1)':'none' }}>
              {s.label} <span style={{ marginLeft:6,color:'var(--ink-500)',fontWeight:500,fontSize:11 }}>{s.range}</span>
            </button>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:12,color:'var(--ink-600)' }}>
          <b style={{ color:'var(--ink-900)' }}>{onDuty.filter(s=>s.clockedIn).length}</b> fitxats · {onDuty.length} planificats
        </span>
      </div>

      {roleOrder.filter(r=>byRole[r]?.length).map(role=>(
        <div key={role} style={{ marginBottom:22 }}>
          <div style={{ display:'flex',alignItems:'baseline',gap:8,marginBottom:10 }}>
            <span style={{ padding:'3px 9px',borderRadius:4,background:ROLES[role].bg,color:ROLES[role].hue,fontSize:10.5,fontWeight:700,letterSpacing:.06,textTransform:'uppercase' }}>{ROLES[role].label}</span>
            <span style={{ fontSize:12,color:'var(--ink-500)' }}>{byRole[role].length} {byRole[role].length===1?'persona':'persones'}</span>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10 }}>
            {byRole[role].map(s=>(
              <div key={s.id} style={{ padding:12,background:'var(--paper)',borderRadius:12,border:'var(--hair)',boxShadow:'var(--sh-1)',display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ position:'relative' }}>
                  <span className={`avatar av-${avIdx(s.name)}`} style={{ width:40,height:40,fontSize:13 }}>{initials(s.name)}</span>
                  {s.clockedIn && <span style={{ position:'absolute',bottom:-2,right:-2,width:12,height:12,borderRadius:'50%',background:'var(--olive-500)',border:'2px solid var(--paper)' }} />}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13.5,fontWeight:600,color:'var(--ink-900)' }}>{s.name}</div>
                  <div style={{ fontSize:11.5,color:'var(--ink-600)',marginTop:2 }}>{s.clockedIn?`Fitxat a ${s.startedAt}`:'No ha fitxat'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {onDuty.length===0 && <div style={{ padding:'60px 0',textAlign:'center',color:'var(--ink-500)',fontFamily:'var(--font-serif)',fontSize:16 }}>Ningú planificat per a aquest torn</div>}
    </div>
  );
}

function ScheduleEditor({ bizId }: { bizId: string }) {
  const week = WEEK_SCHEDULE[bizId] ?? {};
  const bizStaff = STAFF.filter(s => s.biz.includes(bizId));
  const weekStart = 20;

  return (
    <div className="scroll" style={{ overflowY:'auto',flex:1,padding:'18px 28px 40px' }}>
      <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
        <button style={{ width:28,height:28,display:'grid',placeItems:'center',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',color:'var(--ink-700)' }}><Icon d={I.chevL} size={13} /></button>
        <span style={{ fontFamily:'var(--font-serif)',fontSize:18,fontWeight:500,color:'var(--ink-900)' }}>Setmana del {weekStart} – {weekStart+6} abril 2026</span>
        <button style={{ width:28,height:28,display:'grid',placeItems:'center',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',color:'var(--ink-700)' }}><Icon d={I.chevR} size={13} /></button>
        <div style={{ flex:1 }} />
        <button style={{ padding:'6px 12px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:550,color:'var(--ink-800)' }}>Copiar setmana anterior</button>
        <button style={{ padding:'6px 14px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:550 }}>Publicar horari</button>
      </div>

      <div style={{ background:'var(--paper)',borderRadius:12,border:'var(--hair)',overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid',gridTemplateColumns:'180px repeat(7,1fr)',borderBottom:'var(--hair)',background:'var(--ink-50)' }}>
          <div style={{ padding:'10px 12px',fontSize:10.5,fontWeight:700,letterSpacing:.06,textTransform:'uppercase',color:'var(--ink-500)' }}>Empleat</div>
          {DAY_NAMES.map((d,i)=>(
            <div key={d} style={{ padding:'10px 12px',borderLeft:'var(--hair)',fontSize:11,color:i===TODAY_DOW?'var(--terracotta-700)':'var(--ink-600)',fontWeight:600 }}>
              {d.slice(0,2)} <span style={{ fontFamily:'var(--font-mono)',marginLeft:4,color:i===TODAY_DOW?'var(--terracotta-700)':'var(--ink-800)' }}>{weekStart+i}</span>
              {i===TODAY_DOW && <span style={{ marginLeft:4,fontSize:9,padding:'1px 4px',background:'var(--terracotta-100)',color:'var(--terracotta-700)',borderRadius:3,fontWeight:700 }}>AVUI</span>}
            </div>
          ))}
        </div>
        {/* Rows */}
        {bizStaff.map(s=>(
          <div key={s.id} style={{ display:'grid',gridTemplateColumns:'180px repeat(7,1fr)',borderBottom:'var(--hair)' }}>
            <div style={{ padding:'8px 12px',display:'flex',alignItems:'center',gap:8 }}>
              <span className={`avatar av-${avIdx(s.name)}`} style={{ width:24,height:24,fontSize:9 }}>{initials(s.name)}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12,fontWeight:600,color:'var(--ink-900)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{s.name}</div>
                <div style={{ fontSize:9.5,color:ROLES[s.role]?.hue??'var(--ink-500)',fontWeight:600 }}>{ROLES[s.role]?.label}</div>
              </div>
            </div>
            {Array.from({length:7}).map((_,dayIdx)=>{
              const day = week[dayIdx] ?? {M:[],N:[]};
              const hasM = day.M.includes(s.id);
              const hasN = day.N.includes(s.id);
              return (
                <div key={dayIdx} style={{ borderLeft:'var(--hair)',padding:4,display:'flex',flexDirection:'column',gap:3,minHeight:52,background:dayIdx===TODAY_DOW?'rgba(200,97,58,0.04)':'transparent' }}>
                  <button style={{ flex:1,padding:'4px 6px',borderRadius:5,border:hasM?'none':'1px dashed rgba(60,40,20,.14)',background:hasM?'var(--olive-100)':'transparent',color:hasM?'var(--olive-700)':'var(--ink-400)',fontFamily:'inherit',fontSize:10,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:4 }}>
                    <span style={{ fontWeight:700 }}>M</span>
                    <span style={{ fontFamily:'var(--font-mono)',fontSize:9 }}>{hasM?'12–16':'—'}</span>
                  </button>
                  <button style={{ flex:1,padding:'4px 6px',borderRadius:5,border:hasN?'none':'1px dashed rgba(60,40,20,.14)',background:hasN?'var(--terracotta-100)':'transparent',color:hasN?'var(--terracotta-700)':'var(--ink-400)',fontFamily:'inherit',fontSize:10,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:4 }}>
                    <span style={{ fontWeight:700 }}>N</span>
                    <span style={{ fontFamily:'var(--font-mono)',fontSize:9 }}>{hasN?'20–00':'—'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ marginTop:12,padding:10,background:'var(--paper)',borderRadius:8,border:'var(--hair)',fontSize:12,color:'var(--ink-600)',display:'flex',gap:12,alignItems:'center' }}>
        <span style={{ color:'var(--rose-700)' }}>⚠ Bernat Solé té doble torn dijous</span>
        <div style={{ flex:1 }} />
        <span>Total planificat: <b style={{ color:'var(--ink-900)' }}>284h</b></span>
      </div>
    </div>
  );
}
