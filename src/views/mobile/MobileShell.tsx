import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, getStats } from '@/data/mockData';
import MobileTodayView from './TodayView';
import MobileClientsView from './MobileClientsView';

type Tab = 'today' | 'floor' | 'clients' | 'settings';

export default function MobileShell() {
  const [tab, setTab] = useState<Tab>('today');
  const { selectedBusiness, setSelectedBusiness } = useAppStore();
  const biz = BUSINESSES.find(b => b.id === selectedBusiness)!;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--cream)', overflow:'hidden' }}>
      {/* Top header */}
      <header style={{ padding:'12px 16px 10px', borderBottom:'var(--hair)', background:'var(--paper)', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--ink-500)', letterSpacing:.06 }}>NCR Reserves</div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--ink-900)', marginTop:1 }}>{biz.name}</div>
        </div>
        {/* Business switcher */}
        <div style={{ display:'flex', gap:5 }}>
          {BUSINESSES.map(b => (
            <button key={b.id} onClick={() => setSelectedBusiness(b.id)}
              style={{ width:30, height:30, borderRadius:8, background:b.id===selectedBusiness?b.hueSoft:'transparent', color:b.hue, border:b.id===selectedBusiness?`1.5px solid ${b.hue}`:'1px solid rgba(60,40,20,.1)', fontWeight:700, fontSize:10, fontFamily:'var(--font-serif)', cursor:'pointer' }}>
              {b.monogram}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'today'   && <MobileTodayView />}
        {tab === 'clients' && <MobileClientsView />}
        {(tab === 'floor' || tab === 'settings') && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-500)', flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:28 }}>{tab === 'floor' ? '🗺️' : '⚙️'}</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:16, color:'var(--ink-700)' }}>{tab === 'floor' ? 'Plànol de taules' : 'Configuració'}</div>
            <div style={{ fontSize:13 }}>Disponible aviat</div>
          </div>
        )}
      </main>

      {/* Bottom tab bar */}
      <nav style={{ borderTop:'var(--hair)', background:'var(--paper)', flexShrink:0, display:'grid', gridTemplateColumns:'repeat(4,1fr)', paddingBottom:'env(safe-area-inset-bottom)' }}>
        {([
          { id:'today',    ico:I.calendar, label:'Avui' },
          { id:'floor',    ico:I.tableIco, label:'Plànol' },
          { id:'clients',  ico:I.users,    label:'Clients' },
          { id:'settings', ico:I.settings, label:'Config' },
        ] as const).map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'10px 4px', border:'none', background:'transparent', cursor:'pointer', color:active?'var(--terracotta-600)':'var(--ink-500)', fontFamily:'inherit' }}>
              <Icon d={t.ico} size={22} stroke={active?2:1.6} />
              <span style={{ fontSize:10.5, fontWeight:active?600:500 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
