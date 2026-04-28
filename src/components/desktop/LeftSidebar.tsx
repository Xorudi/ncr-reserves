import React from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { BUSINESSES } from '@/data/mockData';
import type { BusinessId, BusinessStats } from '@/types';

interface Props {
  activeBizId: BusinessId;
  onChangeBiz: (id: BusinessId) => void;
  stats?: BusinessStats;
  activePage?: string;
  onNavigate?: (page: string) => void;
  onNewReservation?: () => void;
  onWalkin?: () => void;
}

export function LeftSidebar({ activeBizId, onChangeBiz, stats, activePage = 'today', onNavigate, onNewReservation, onWalkin }: Props) {
  return (
    <aside style={{ width:244, flex:'none', borderRight:'var(--hair)', background:'var(--cream)', display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Brand */}
      <div style={{ padding:'18px 18px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:28,height:28,borderRadius:8,background:'var(--ink-900)',color:'var(--cream)',display:'grid',placeItems:'center',fontWeight:700,fontSize:12,letterSpacing:.5,fontFamily:'var(--font-serif)' }}>N</div>
        <div style={{ display:'flex',flexDirection:'column',lineHeight:1.1 }}>
          <span style={{ fontWeight:600,fontSize:13,color:'var(--ink-900)' }}>NCR Reserves</span>
          <span style={{ fontSize:11,color:'var(--ink-500)' }}>Gestió interna</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding:'0 12px 10px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,background:'var(--paper)',border:'var(--hair)',color:'var(--ink-500)',fontSize:12 }}>
          <Icon d={I.search} size={14} />
          <span style={{ flex:1 }}>Cerca reserves…</span>
          <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:18,height:18,padding:'0 5px',borderRadius:4,fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--ink-600)',background:'var(--paper)',border:'1px solid rgba(60,40,20,.1)',boxShadow:'0 1px 0 rgba(60,40,20,.05)' }}>⌘K</span>
        </div>
      </div>

      {/* Business selector */}
      <div style={{ padding:'10px 12px 6px' }}>
        <div style={{ fontSize:10.5,fontWeight:600,letterSpacing:.08,textTransform:'uppercase',color:'var(--ink-500)',padding:'0 4px 8px' }}>Negocis</div>
        <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
          {BUSINESSES.map(b => {
            const isActive = b.id === activeBizId;
            return (
              <button key={b.id} onClick={() => onChangeBiz(b.id as BusinessId)}
                style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',border:'none',cursor:'pointer',borderRadius:10,background:isActive?'var(--paper)':'transparent',boxShadow:isActive?`var(--sh-1), inset 3px 0 0 ${b.hue}`:'none',textAlign:'left',fontFamily:'inherit',transition:'background .12s' }}
                onMouseEnter={e=>{if(!isActive)(e.currentTarget as HTMLElement).style.background='rgba(60,40,20,0.04)';}}
                onMouseLeave={e=>{if(!isActive)(e.currentTarget as HTMLElement).style.background='transparent';}}>
                <span style={{ width:26,height:26,borderRadius:7,flex:'none',background:b.hueSoft,color:b.hue,display:'grid',placeItems:'center',fontWeight:700,fontSize:11,fontFamily:'var(--font-serif)',letterSpacing:.3 }}>{b.monogram}</span>
                <div style={{ display:'flex',flexDirection:'column',minWidth:0,flex:1 }}>
                  <span style={{ fontSize:13,fontWeight:isActive?600:500,color:isActive?'var(--ink-900)':'var(--ink-800)',lineHeight:1.15 }}>{b.name}</span>
                  <span style={{ fontSize:10.5,color:'var(--ink-500)',lineHeight:1.2,marginTop:1 }}>{b.kind}</span>
                </div>
                {isActive && stats && (
                  <span style={{ fontSize:10.5,fontWeight:600,color:'var(--ink-600)',background:'var(--ink-100)',padding:'2px 6px',borderRadius:6 }}>{stats.totalRes}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding:'12px',display:'flex',flexDirection:'column',gap:6 }}>
        <button onClick={onNewReservation}
          style={{ display:'flex',alignItems:'center',gap:6,width:'100%',padding:'9px 12px',fontSize:13,fontWeight:550,background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',transition:'background .12s',letterSpacing:'-0.005em' }}
          onMouseEnter={e=>(e.currentTarget.style.background='var(--terracotta-700)')}
          onMouseLeave={e=>(e.currentTarget.style.background='var(--terracotta-600)')}>
          <Icon d={I.plus} size={14} /> Nova reserva
          <span style={{ marginLeft:'auto',opacity:.7,fontSize:11 }}>N</span>
        </button>
        <button onClick={onWalkin}
          style={{ display:'flex',alignItems:'center',gap:6,width:'100%',padding:'7px 12px',fontSize:12.5,fontWeight:550,background:'transparent',color:'var(--ink-800)',border:'1px solid rgba(60,40,20,0.14)',borderRadius:10,cursor:'pointer',fontFamily:'inherit',transition:'background .12s',letterSpacing:'-0.005em' }}
          onMouseEnter={e=>(e.currentTarget.style.background='var(--ink-100)')}
          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
          <Icon d={I.users} size={13} /> Walk-in
          <span style={{ marginLeft:'auto',opacity:.7,fontSize:11 }}>W</span>
        </button>
      </div>

      <div style={{ height:1,background:'rgba(60,40,20,0.08)',margin:'4px 12px' }} />

      {/* Nav */}
      <nav style={{ padding:'8px 12px',display:'flex',flexDirection:'column',gap:1 }}>
        {([
          { id:'today',   ico:I.calendar, label:'Avui', count:stats?.totalRes },
          { id:'floor',   ico:I.tableIco, label:'Plànol de taules' },
          { id:'clients',  ico:I.users,    label:'Clients' },
          { id:'history',  ico:I.logs,     label:'Historial' },
          { id:'staff',    ico:I.users,    label:'Equip' },
          { id:'calendar', ico:I.calendar, label:'Calendari' },
          { id:'settings', ico:I.settings, label:'Configuració' },
        ] as const).map(n => {
          const active = (n as {id:string}).id === activePage;
          return (
            <button key={(n as {id:string}).id} onClick={() => onNavigate?.((n as {id:string}).id)}
              style={{ display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,fontSize:13,fontWeight:500,color:active?'var(--ink-900)':'var(--ink-700)',background:active?'var(--ink-100)':'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'background .12s',letterSpacing:'-0.005em' }}
              onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='rgba(60,40,20,0.04)';}}
              onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='transparent';}}>
              <span style={{ color:active?'var(--ink-800)':'var(--ink-500)' }}><Icon d={(n as {ico:React.ReactNode}).ico} size={15} /></span>
              <span style={{ flex:1 }}>{(n as {label:string}).label}</span>
              {(n as {count?:number}).count !== undefined && <span style={{ fontSize:11,color:'var(--ink-500)' }}>{(n as {count?:number}).count}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ flex:1 }} />

      {/* Profile */}
      <div style={{ padding:'12px 14px',borderTop:'var(--hair)',display:'flex',alignItems:'center',gap:10 }}>
        <span className="avatar av-1">EM</span>
        <div style={{ display:'flex',flexDirection:'column',lineHeight:1.2,minWidth:0,flex:1 }}>
          <span style={{ fontSize:12.5,fontWeight:550,color:'var(--ink-900)' }}>Èlia Masdeu</span>
          <span style={{ fontSize:10.5,color:'var(--ink-500)' }}>Encarregada · torn migdia</span>
        </div>
        <button style={{ width:30,height:30,padding:0,display:'grid',placeItems:'center',background:'transparent',border:'none',borderRadius:8,cursor:'pointer',color:'var(--ink-600)' }}>
          <Icon d={I.settings} size={14} />
        </button>
      </div>
    </aside>
  );
}
