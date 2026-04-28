import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { APRIL_2026, DAY_NAMES, DAY_NAMES_SHORT, TODAY_DOW } from '@/data/mockData';

export default function CalendarView() {
  const [view, setView] = useState<'month'|'week'>('month');
  return (
    <div className="scroll" style={{ flex:1,overflowY:'auto',background:'var(--cream)',padding:'18px 28px 40px' }}>
      <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
        <button style={{ width:28,height:28,display:'grid',placeItems:'center',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',color:'var(--ink-700)' }}><Icon d={I.chevL} size={13} /></button>
        <h2 style={{ margin:0,fontFamily:'var(--font-serif)',fontSize:22,fontWeight:500,color:'var(--ink-900)' }}>Abril 2026</h2>
        <button style={{ width:28,height:28,display:'grid',placeItems:'center',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',color:'var(--ink-700)' }}><Icon d={I.chevR} size={13} /></button>
        <button style={{ padding:'4px 10px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:550,color:'var(--ink-700)' }}>Avui</button>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex',gap:3,padding:3,background:'var(--ink-100)',borderRadius:8 }}>
          {([['month','Mes'],['week','Setmana']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setView(k)} style={{ padding:'5px 12px',border:'none',borderRadius:6,background:view===k?'var(--paper)':'transparent',fontSize:12,fontWeight:600,fontFamily:'inherit',cursor:'pointer',color:'var(--ink-800)',boxShadow:view===k?'var(--sh-1)':'none' }}>{l}</button>
          ))}
        </div>
      </div>
      {view==='month' ? <MonthView /> : <WeekView />}
    </div>
  );
}

function MonthView() {
  const max = Math.max(...APRIL_2026.map(d=>d.count));
  const intensity = (n: number) => Math.min(1, n / max);
  const gridStart = 2;
  return (
    <div style={{ background:'var(--paper)',borderRadius:14,border:'var(--hair)',overflow:'hidden' }}>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--ink-50)',borderBottom:'var(--hair)' }}>
        {DAY_NAMES.map(d=>(
          <div key={d} style={{ padding:'8px 12px',fontSize:10.5,fontWeight:700,letterSpacing:.06,textTransform:'uppercase',color:'var(--ink-500)' }}>{d.slice(0,2)}</div>
        ))}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)' }}>
        {Array.from({length:gridStart}).map((_,i)=>(
          <div key={'e'+i} style={{ minHeight:110,borderRight:'var(--hair)',borderBottom:'var(--hair)',background:'rgba(60,40,20,0.025)' }} />
        ))}
        {APRIL_2026.map(d=>{
          const i = intensity(d.count);
          const isToday = d.day === 24;
          return (
            <div key={d.day} style={{ minHeight:110,padding:'8px 10px',borderRight:'var(--hair)',borderBottom:'var(--hair)',background:`rgba(200,97,58,${i*0.22})`,position:'relative',cursor:'pointer' }}>
              <div style={{ display:'flex',alignItems:'baseline',gap:6 }}>
                <span style={{ fontFamily:'var(--font-serif)',fontSize:isToday?20:16,fontWeight:500,color:isToday?'var(--terracotta-700)':'var(--ink-900)',width:isToday?28:undefined,height:isToday?28:undefined,borderRadius:'50%',background:isToday?'var(--terracotta-100)':'transparent',display:isToday?'grid':'inline-block',placeItems:'center',textAlign:'center',lineHeight:isToday?'28px':undefined }}>{d.day}</span>
                {d.special && <span style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:'var(--clay-100)',color:'var(--clay-700)',fontWeight:700 }}>{d.special}</span>}
              </div>
              <div style={{ marginTop:6,fontSize:11.5,color:'var(--ink-700)' }}><b style={{ color:'var(--ink-900)' }}>{d.count}</b> reserves</div>
              <div style={{ position:'absolute',bottom:8,left:10,right:10,height:4,borderRadius:2,background:'rgba(60,40,20,0.08)' }}>
                <div style={{ width:`${i*100}%`,height:'100%',background:'var(--terracotta-500)',borderRadius:2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView() {
  const days = [20,21,22,23,24,25,26];
  const hours = ['12','13','14','15','16','17','18','19','20','21','22','23'];
  return (
    <div style={{ background:'var(--paper)',borderRadius:14,border:'var(--hair)',overflow:'hidden' }}>
      <div style={{ display:'grid',gridTemplateColumns:'60px repeat(7,1fr)',borderBottom:'var(--hair)',background:'var(--ink-50)' }}>
        <div />
        {days.map((d,i)=>(
          <div key={d} style={{ padding:'10px 12px',borderLeft:'var(--hair)',fontSize:11,fontWeight:600,color:i===TODAY_DOW?'var(--terracotta-700)':'var(--ink-700)' }}>
            {DAY_NAMES_SHORT[i]} <span style={{ fontFamily:'var(--font-mono)',marginLeft:4,fontSize:13 }}>{d}</span>
            {i===TODAY_DOW && <span style={{ marginLeft:5,fontSize:9,padding:'1px 5px',background:'var(--terracotta-500)',color:'#fff',borderRadius:3,fontWeight:700 }}>AVUI</span>}
          </div>
        ))}
      </div>
      {hours.map(h=>(
        <div key={h} style={{ display:'grid',gridTemplateColumns:'60px repeat(7,1fr)',borderBottom:'var(--hair)',minHeight:44 }}>
          <div style={{ padding:'6px 10px',fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--ink-500)',textAlign:'right' }}>{h}:00</div>
          {days.map((d,di)=>{
            const seed = (d * 31 + parseInt(h)) % 7;
            const has = seed < 3 && (parseInt(h)>=13 && parseInt(h)<=14 || parseInt(h)>=20 && parseInt(h)<=22);
            return (
              <div key={di} style={{ borderLeft:'var(--hair)',padding:3 }}>
                {has && <div style={{ padding:'3px 6px',borderRadius:4,background:'var(--olive-100)',color:'var(--olive-700)',fontSize:10.5,fontWeight:600 }}>{2+(seed%3)} reserve{seed!==1&&'s'}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
