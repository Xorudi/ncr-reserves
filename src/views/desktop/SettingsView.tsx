import React, { useState } from 'react';
import { BUSINESSES, SHIFTS, DAY_NAMES } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';

const TABS = [
  ['general','General'],['hours','Horaris'],['shifts','Torns'],
  ['integrations','Integracions'],['notifications','Notificacions'],['team','Equip'],
] as const;

export default function SettingsView() {
  const [tab, setTab] = useState<string>('general');
  const { selectedBusiness } = useAppStore();
  const biz = BUSINESSES.find(b => b.id === selectedBusiness)!;

  return (
    <div style={{ flex:1,display:'flex',height:'100%',overflow:'hidden',background:'var(--cream)' }}>
      {/* Sidebar */}
      <aside style={{ width:200,padding:'20px 12px',borderRight:'var(--hair)',flexShrink:0 }}>
        <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,textTransform:'uppercase',color:'var(--ink-500)',padding:'0 10px 10px' }}>Configuració</div>
        {TABS.map(([k,label])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ display:'block',width:'100%',padding:'7px 10px',background:tab===k?'var(--ink-100)':'transparent',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:tab===k?600:500,color:'var(--ink-800)',textAlign:'left',marginBottom:1 }}>{label}</button>
        ))}
      </aside>

      {/* Content */}
      <div className="scroll" style={{ flex:1,overflowY:'auto',padding:'24px 32px' }}>
        {tab==='general'      && <GeneralSettings biz={biz} />}
        {tab==='hours'        && <HoursSettings />}
        {tab==='shifts'       && <ShiftsSettings />}
        {!['general','hours','shifts'].includes(tab) && (
          <div style={{ color:'var(--ink-500)',padding:'60px 0',textAlign:'center',fontFamily:'var(--font-serif)',fontSize:18 }}>
            {TABS.find(t=>t[0]===tab)?.[1]} — pendent de dissenyar
          </div>
        )}
      </div>
    </div>
  );
}

function GeneralSettings({ biz }: { biz: typeof BUSINESSES[0] }) {
  return (
    <div style={{ maxWidth:600 }}>
      <h3 style={{ fontFamily:'var(--font-serif)',fontWeight:500,fontSize:22,color:'var(--ink-900)',margin:'0 0 20px' }}>General</h3>
      {[
        ['Nom del negoci', biz.name],
        ['Tipus', biz.kind],
        ['Adreça', biz.address],
        ['Telèfon', '+34 93 000 11 22'],
        ['Email', `reserves@${biz.id}.cat`],
        ['Capacitat total', String(biz.capacity)],
      ].map(([l,v])=>(
        <div key={l} style={{ marginBottom:14 }}>
          <div style={{ fontSize:11,fontWeight:600,color:'var(--ink-600)',letterSpacing:.04,textTransform:'uppercase',marginBottom:5 }}>{l}</div>
          <input defaultValue={v} style={{ width:'100%',padding:'9px 12px',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,fontFamily:'inherit',fontSize:13,background:'var(--paper)',color:'var(--ink-900)',outline:'none' }} />
        </div>
      ))}
      <button style={{ padding:'9px 18px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,marginTop:8 }}>Guardar canvis</button>
    </div>
  );
}

function HoursSettings() {
  return (
    <div style={{ maxWidth:720 }}>
      <h3 style={{ fontFamily:'var(--font-serif)',fontWeight:500,fontSize:22,color:'var(--ink-900)',margin:'0 0 20px' }}>Horaris d'obertura</h3>
      <div style={{ background:'var(--paper)',borderRadius:12,border:'var(--hair)',overflow:'hidden' }}>
        {DAY_NAMES.map((d,i)=>(
          <div key={d} style={{ display:'grid',gridTemplateColumns:'130px 1fr 1fr 60px',gap:12,padding:'12px 16px',borderBottom:i<6?'var(--hair)':'none',alignItems:'center' }}>
            <div style={{ fontSize:13,fontWeight:600,color:'var(--ink-900)' }}>{d}</div>
            <input defaultValue="13:00 – 16:00" style={{ padding:'7px 10px',border:'1px solid rgba(60,40,20,.14)',borderRadius:6,fontFamily:'var(--font-mono)',fontSize:12,background:'var(--cream)',outline:'none' }} />
            <input defaultValue={i===6?'Tancat':'20:00 – 00:00'} style={{ padding:'7px 10px',border:'1px solid rgba(60,40,20,.14)',borderRadius:6,fontFamily:'var(--font-mono)',fontSize:12,background:'var(--cream)',color:i===6?'var(--ink-500)':'var(--ink-800)',outline:'none' }} />
            <label style={{ fontSize:11,color:'var(--ink-600)',display:'flex',alignItems:'center',gap:5 }}>
              <input type="checkbox" defaultChecked={i!==6} /> Obert
            </label>
          </div>
        ))}
      </div>
      <div style={{ marginTop:12,padding:'10px 14px',background:'var(--clay-50)',borderRadius:8,fontSize:12.5,color:'var(--clay-700)',display:'flex',alignItems:'center',gap:8 }}>
        Durada mitjana: <input defaultValue="90" style={{ width:50,padding:'2px 6px',border:'1px solid rgba(60,40,20,.14)',borderRadius:4,fontFamily:'var(--font-mono)',outline:'none' }} /> minuts per taula
      </div>
    </div>
  );
}

function ShiftsSettings() {
  return (
    <div style={{ maxWidth:600 }}>
      <h3 style={{ fontFamily:'var(--font-serif)',fontWeight:500,fontSize:22,color:'var(--ink-900)',margin:'0 0 20px' }}>Torns</h3>
      {SHIFTS.map(s=>(
        <div key={s.id} style={{ padding:14,marginBottom:8,background:'var(--paper)',borderRadius:10,border:'var(--hair)',display:'grid',gridTemplateColumns:'50px 1fr 1fr 1fr',gap:10,alignItems:'center' }}>
          <div style={{ fontFamily:'var(--font-serif)',fontSize:22,fontWeight:500,color:'var(--ink-900)' }}>{s.id}</div>
          <input defaultValue={s.label} style={{ padding:'8px 10px',border:'1px solid rgba(60,40,20,.14)',borderRadius:6,fontFamily:'inherit',fontSize:13,background:'var(--cream)',outline:'none' }} />
          <input defaultValue={s.range.split(' – ')[0]} style={{ padding:'8px 10px',border:'1px solid rgba(60,40,20,.14)',borderRadius:6,fontFamily:'var(--font-mono)',fontSize:13,background:'var(--cream)',outline:'none' }} />
          <input defaultValue={s.range.split(' – ')[1]} style={{ padding:'8px 10px',border:'1px solid rgba(60,40,20,.14)',borderRadius:6,fontFamily:'var(--font-mono)',fontSize:13,background:'var(--cream)',outline:'none' }} />
        </div>
      ))}
    </div>
  );
}
