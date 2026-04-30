import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, getStats, avIdx } from '@/data/mockData';
import MobileTodayView from './TodayView';
import MobileClientsView from './MobileClientsView';

type Tab = 'today' | 'floor' | 'clients' | 'settings';

export default function MobileShell() {
  const [tab, setTab] = useState<Tab>('today');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const { selectedBusiness, setSelectedBusiness, employees, employeeRoles, activeEmployeeId, setActiveEmployee } = useAppStore();
  const biz       = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const activeEmp = employees.find(e => e.id === activeEmployeeId) ?? null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--cream)', overflow:'hidden' }}>
      {/* Top header */}
      <header style={{ padding:'12px 16px 10px', borderBottom:'var(--hair)', background:'var(--paper)', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--ink-500)', letterSpacing:.06 }}>NCR Reserves</div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--ink-900)', marginTop:1 }}>{biz.name}</div>
        </div>
        {/* Usuari actiu + business switcher */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setShowUserPicker(true)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 8px 4px 4px', border:'1px solid rgba(60,40,20,.1)', borderRadius:20, background:'var(--cream)', cursor:'pointer', fontFamily:'inherit' }}>
            {activeEmp ? (
              <>
                <span className={`avatar av-${avIdx(activeEmp.fullName)}`}
                  style={{ width:24, height:24, fontSize:9, display:'grid', placeItems:'center', borderRadius:'50%' }}>
                  {activeEmp.initials}
                </span>
                <span style={{ fontSize:11.5, fontWeight:600, color:'var(--ink-800)' }}>{activeEmp.fullName.split(' ')[0]}</span>
              </>
            ) : (
              <span style={{ fontSize:11.5, color:'var(--ink-500)', padding:'0 4px' }}>Usuari</span>
            )}
          </button>
          {BUSINESSES.map(b => (
            <button key={b.id} onClick={() => setSelectedBusiness(b.id)}
              style={{ width:30, height:30, borderRadius:8, background:b.id===selectedBusiness?b.hueSoft:'transparent', color:b.hue, border:b.id===selectedBusiness?`1.5px solid ${b.hue}`:'1px solid rgba(60,40,20,.1)', fontWeight:700, fontSize:10, fontFamily:'var(--font-serif)', cursor:'pointer' }}>
              {b.monogram}
            </button>
          ))}
        </div>

        {showUserPicker && (
          <MobileUserPicker
            bizId={selectedBusiness}
            employees={employees}
            employeeRoles={employeeRoles}
            activeEmployeeId={activeEmployeeId}
            onSelect={id => { setActiveEmployee(id); setShowUserPicker(false); }}
            onClose={() => setShowUserPicker(false)}
          />
        )}
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

// ─── Mobile User Picker ───────────────────────────────────────────
import type { Employee, EmployeeRole, BusinessId } from '@/types';

function MobileUserPicker({ bizId, employees, employeeRoles, activeEmployeeId, onSelect, onClose }: {
  bizId: BusinessId; employees: Employee[]; employeeRoles: EmployeeRole[];
  activeEmployeeId: string | null; onSelect: (id: string | null) => void; onClose: () => void;
}) {
  const bizEmps = employees.filter(e => e.bizId === bizId && e.active);
  const roleMap  = Object.fromEntries(employeeRoles.map(r => [r.id, r]));
  const sorted   = [...bizEmps].sort((a, b) => (roleMap[a.roleId]?.order ?? 99) - (roleMap[b.roleId]?.order ?? 99));

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'flex-end' }}
      onClick={onClose}>
      <div style={{ width:'100%', background:'var(--paper)', borderRadius:'18px 18px 0 0', padding:'16px 12px 32px', maxHeight:'70vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 16px' }} />
        <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, textTransform:'uppercase', marginBottom:12, paddingLeft:4 }}>Usuari actiu</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:8 }}>
          {sorted.map(emp => {
            const role     = roleMap[emp.roleId];
            const isActive = emp.id === activeEmployeeId;
            return (
              <button key={emp.id} onClick={() => onSelect(emp.id)}
                style={{ display:'flex', flexDirection:'column', gap:6, padding:'10px 12px', border: isActive ? '2px solid var(--terracotta-500)' : '1.5px solid rgba(60,40,20,.1)', borderRadius:12, background: isActive ? 'var(--terracotta-50)' : 'var(--cream)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                <span className={`avatar av-${avIdx(emp.fullName)}`}
                  style={{ width:32, height:32, fontSize:11, display:'grid', placeItems:'center', borderRadius:'50%' }}>
                  {emp.initials}
                </span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color: isActive ? 'var(--terracotta-700)' : 'var(--ink-900)' }}>{emp.fullName}</div>
                  {role && <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:3, background:role.color, color:role.textColor }}>{role.name}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {activeEmployeeId && (
          <button onClick={() => onSelect(null)}
            style={{ marginTop:14, width:'100%', padding:'10px 0', border:'var(--hair)', borderRadius:10, background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:'var(--ink-500)' }}>
            Continuar sense usuari actiu
          </button>
        )}
      </div>
    </div>
  );
}
