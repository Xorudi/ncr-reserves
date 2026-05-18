import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { BUSINESSES, avIdx } from '@/data/mockData';
import { useVisibleBusinesses } from '@/store/usePinScope';
import { useAppStore } from '@/store/useAppStore';
import type { BusinessId, BusinessStats, Employee, EmployeeRole } from '@/types';
import WeatherWidget from '@/components/shared/WeatherWidget';
import { signOut } from '@/lib/auth';
import { isAuthRequired } from '@/lib/supabase';
import { usePinScope } from '@/store/usePinScope';
import { SUPABASE_AUTH_ENABLED } from '@/lib/featureFlags';

interface Props {
  activeBizId: BusinessId;
  onChangeBiz: (id: BusinessId) => void;
  stats?: BusinessStats;
  activePage?: string;
  onNavigate?: (page: string) => void;
  onNewReservation?: () => void;
  onWalkin?: () => void;
  onSearch?: () => void;
}

export function LeftSidebar({ activeBizId, onChangeBiz, stats, activePage = 'today', onNavigate, onNewReservation, onWalkin, onSearch }: Props) {
  const { businessConfigs, employees, employeeRoles, activeEmployeeId, setActiveEmployee } = useAppStore();
  const visibleBusinesses = useVisibleBusinesses();
  const [showUserPicker, setShowUserPicker] = useState(false);

  const activeEmp  = employees.find(e => e.id === activeEmployeeId) ?? null;
  const activeRole = activeEmp ? employeeRoles.find(r => r.id === activeEmp.roleId) ?? null : null;

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

      {/* Business selector */}
      <div style={{ padding:'10px 12px 6px' }}>
        <div style={{ fontSize:10.5,fontWeight:600,letterSpacing:.08,textTransform:'uppercase',color:'var(--ink-500)',padding:'0 4px 8px' }}>Negocis</div>
        <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
          {visibleBusinesses.map(b => {
            const isActive = b.id === activeBizId;
            return (
              <button key={b.id} onClick={() => onChangeBiz(b.id as BusinessId)}
                style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',border:'none',cursor:'pointer',borderRadius:10,background:isActive?'var(--paper)':'transparent',boxShadow:isActive?`var(--sh-1), inset 3px 0 0 ${b.hue}`:'none',textAlign:'left',fontFamily:'inherit',transition:'background .12s' }}
                onMouseEnter={e=>{if(!isActive)(e.currentTarget as HTMLElement).style.background='rgba(60,40,20,0.04)';}}
                onMouseLeave={e=>{if(!isActive)(e.currentTarget as HTMLElement).style.background='transparent';}}>
                <span style={{ width:26,height:26,borderRadius:7,flex:'none',background:b.hueSoft,color:b.hue,display:'grid',placeItems:'center',fontWeight:700,fontSize:11,fontFamily:'var(--font-serif)',letterSpacing:.3 }}>{b.monogram}</span>
                <div style={{ display:'flex',flexDirection:'column',minWidth:0,flex:1 }}>
                  <span style={{ fontSize:13,fontWeight:isActive?600:500,color:isActive?'var(--ink-900)':'var(--ink-800)',lineHeight:1.15 }}>{b.name}</span>
                  <span style={{ fontSize:10.5,color:'var(--ink-500)',lineHeight:1.2,marginTop:1 }}>{businessConfigs[b.id]?.kind ?? b.kind}</span>
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

      {/* Weather pill — discreet, between the search bar and biz switcher.
          Sits in its own row so it can show without competing with the
          search affordance for taps. */}
      <div style={{ padding:'4px 12px' }}>
        <WeatherWidget />
      </div>

      {/* Global search trigger — also opens with Cmd/Ctrl+K. */}
      {onSearch && (
        <div style={{ padding:'4px 12px' }}>
          <button onClick={onSearch}
            style={{
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'7px 10px', borderRadius:8,
              border:'1px solid rgba(60,40,20,.10)',
              background:'var(--cream)', color:'var(--ink-500)',
              cursor:'pointer', fontFamily:'inherit', textAlign:'left',
            }}>
            <Icon d={I.search} size={14} />
            <span style={{ flex:1, fontSize:12.5 }}>Cerca…</span>
            <span style={{
              fontSize:10, padding:'2px 6px', borderRadius:5,
              background:'var(--paper)', border:'1px solid rgba(60,40,20,.1)',
              fontFamily:'var(--font-mono)', color:'var(--ink-500)',
            }}>⌘K</span>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ padding:'8px 12px',display:'flex',flexDirection:'column',gap:1 }}>
        {([
          { id:'today',     ico:I.calendar, label:'Avui', count:stats?.totalRes },
          { id:'floor',     ico:I.tableIco, label:'Plànol de taules' },
          { id:'clients',   ico:I.users,    label:'Clients' },
          { id:'calendar',  ico:I.calendar, label:'Calendari' },
          { id:'stats',     ico:I.barChart, label:'Estadístiques' },
          { id:'staff',     ico:I.users,    label:'Equip' },
          { id:'settings',  ico:I.settings, label:'Configuració' },
        ] as const).map(n => {
          const active = (n as {id:string}).id === activePage;
          return (
            <button key={(n as {id:string}).id} onClick={() => onNavigate?.((n as {id:string}).id)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'8px 10px', borderRadius:9,
                fontSize:13, fontWeight: active ? 600 : 500,
                color: active ? 'var(--ink-900)' : 'var(--ink-700)',
                background: active ? 'var(--paper)' : 'transparent',
                boxShadow: active
                  ? 'var(--sh-1), inset 3px 0 0 var(--terracotta-500)'
                  : 'none',
                border:'none', cursor:'pointer', fontFamily:'inherit',
                textAlign:'left',
                transition:'background 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
                letterSpacing:'-0.005em',
              }}
              onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='rgba(60,40,20,0.04)';}}
              onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.background='transparent';}}>
              <span style={{ color: active ? 'var(--terracotta-600)' : 'var(--ink-500)', transition: 'color 160ms var(--ease-out)' }}>
                <Icon d={(n as {ico:React.ReactNode}).ico} size={15} />
              </span>
              <span style={{ flex:1 }}>{(n as {label:string}).label}</span>
              {(n as {count?:number}).count !== undefined && (
                <span style={{
                  fontSize:10.5, fontWeight:600,
                  color: active ? 'var(--terracotta-700)' : 'var(--ink-500)',
                  background: active ? 'var(--terracotta-50)' : 'var(--ink-100)',
                  padding:'2px 7px', borderRadius:999,
                  fontFamily:'var(--font-mono)', letterSpacing:.02,
                }}>{(n as {count?:number}).count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ flex:1 }} />

      {/* Usuari actiu */}
      <div style={{ padding:'10px 12px', borderTop:'var(--hair)' }}>
        <button onClick={() => setShowUserPicker(true)}
          style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'8px 10px', border:'1px solid rgba(60,40,20,.1)', borderRadius:10, background:'var(--paper)', cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'background .12s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-50)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper)')}>
          {activeEmp ? (
            <>
              <span className={`avatar av-${avIdx(activeEmp.fullName)}`}
                style={{ width:28, height:28, fontSize:10, display:'grid', placeItems:'center', borderRadius:'50%', flexShrink:0 }}>
                {activeEmp.initials}
              </span>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeEmp.fullName}</div>
                <div style={{ fontSize:10.5, color:'var(--ink-500)' }}>{activeRole?.name ?? '—'}</div>
              </div>
            </>
          ) : (
            <>
              <span style={{ width:28, height:28, borderRadius:'50%', background:'var(--ink-100)', display:'grid', placeItems:'center', flexShrink:0, color:'var(--ink-500)', fontSize:12 }}>?</span>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--ink-600)' }}>Sense usuari actiu</div>
                <div style={{ fontSize:10.5, color:'var(--terracotta-600)', fontWeight:600 }}>Triar empleat →</div>
              </div>
            </>
          )}
          <Icon d={I.chevR} size={11} />
        </button>
      </div>

      {showUserPicker && (
        <UserSwitcherModal
          bizId={activeBizId}
          employees={employees}
          employeeRoles={employeeRoles}
          activeEmployeeId={activeEmployeeId}
          onSelect={id => { setActiveEmployee(id); setShowUserPicker(false); }}
          onClose={() => setShowUserPicker(false)}
        />
      )}

      {/* Blocar (always — PIN gate is always required).
          Tancar sessió (only when the Supabase Auth gate is in use). */}
      <div style={{ padding:'0 12px 10px', display:'flex', flexDirection:'column', gap:4 }}>
        <button
          onClick={() => usePinScope.getState().lock()}
          style={{
            display:'flex', alignItems:'center', gap:7, width:'100%',
            padding:'7px 10px', border:'none', borderRadius:8,
            background:'transparent', cursor:'pointer', fontFamily:'inherit',
            fontSize:12, color:'var(--ink-700)', transition:'background .12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-50)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Icon d={I.shield} size={11} /> Blocar (tornar al PIN)
        </button>
        {SUPABASE_AUTH_ENABLED && isAuthRequired() && (
          <button
            onClick={async () => {
              if (typeof window !== 'undefined' &&
                  !window.confirm('Segur que vols tancar la sessió en aquest dispositiu?')) {
                return;
              }
              await signOut();
            }}
            style={{
              display:'flex', alignItems:'center', gap:7, width:'100%',
              padding:'7px 10px', border:'none', borderRadius:8,
              background:'transparent', cursor:'pointer', fontFamily:'inherit',
              fontSize:12, color:'var(--ink-500)', transition:'background .12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-50)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon d={I.chevR} size={11} /> Tancar sessió
          </button>
        )}
      </div>

      {/* App version + author */}
      <div style={{
        padding:'10px 14px 12px',
        borderTop:'var(--hair)',
        textAlign:'center',
        fontSize:10, color:'var(--ink-400)',
        fontFamily:'var(--font-mono)', fontWeight:600,
        letterSpacing:.12, textTransform:'uppercase',
        lineHeight:1.5,
      }}>
        NCR Reserves · v0.1
        <div style={{ fontSize:9.5, fontWeight:500, textTransform:'none', letterSpacing:0, color:'var(--ink-400)', marginTop:2 }}>
          by Jordi Audinis
        </div>
      </div>
    </aside>
  );
}

// ─── User Switcher Modal ───────────────────────────────────────────────────────
function UserSwitcherModal({ bizId, employees, employeeRoles, activeEmployeeId, onSelect, onClose }: {
  bizId: BusinessId;
  employees: Employee[];
  employeeRoles: EmployeeRole[];
  activeEmployeeId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const bizEmps = employees.filter(e => e.bizId === bizId && e.active);
  const roleMap  = Object.fromEntries(employeeRoles.map(r => [r.id, r]));

  // Group by role order
  const sorted = [...bizEmps].sort((a, b) => {
    const ra = roleMap[a.roleId]?.order ?? 99;
    const rb = roleMap[b.roleId]?.order ?? 99;
    return ra !== rb ? ra - rb : a.fullName.localeCompare(b.fullName);
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'flex-start' }}
      onClick={onClose}>
      <div style={{ position:'absolute', left:12, bottom:64, width:232, background:'var(--paper)', borderRadius:14, boxShadow:'0 8px 40px rgba(60,40,20,.22), 0 2px 8px rgba(60,40,20,.1)', border:'var(--hair)', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'12px 14px 10px', borderBottom:'var(--hair)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-700)', letterSpacing:.04 }}>Usuari actiu</span>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-400)', padding:2, display:'grid', placeItems:'center' }}>
            <Icon d={I.x} size={13} />
          </button>
        </div>

        {/* Employee list */}
        <div style={{ maxHeight:320, overflowY:'auto', padding:'6px' }}>
          {sorted.map(emp => {
            const role    = roleMap[emp.roleId];
            const isActive = emp.id === activeEmployeeId;
            return (
              <button key={emp.id} onClick={() => onSelect(emp.id)}
                style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'8px 10px', border:'none', borderRadius:8, background: isActive ? 'var(--terracotta-50)' : 'transparent', cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'background .1s' }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--ink-50)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <span className={`avatar av-${avIdx(emp.fullName)}`}
                  style={{ width:30, height:30, fontSize:10.5, display:'grid', placeItems:'center', borderRadius:'50%', flexShrink:0 }}>
                  {emp.initials}
                </span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--terracotta-700)' : 'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.fullName}</div>
                  {role && (
                    <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:3, background:role.color, color:role.textColor }}>{role.name}</span>
                  )}
                </div>
                {isActive && <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--terracotta-500)', flexShrink:0 }} />}
              </button>
            );
          })}
          {sorted.length === 0 && (
            <div style={{ padding:'20px 12px', textAlign:'center', fontSize:12, color:'var(--ink-400)' }}>
              Cap empleat actiu en aquest negoci
            </div>
          )}
        </div>

        {/* Footer: deselect */}
        {activeEmployeeId && (
          <div style={{ borderTop:'var(--hair)', padding:'6px' }}>
            <button onClick={() => onSelect(null)}
              style={{ display:'flex', alignItems:'center', gap:7, width:'100%', padding:'7px 10px', border:'none', borderRadius:8, background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:12, color:'var(--ink-500)', transition:'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-50)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Icon d={I.x} size={12} /> Continuar sense usuari actiu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
