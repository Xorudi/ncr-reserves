import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, avIdx } from '@/data/mockData';
import { useIsStandalonePWA } from '@/hooks/useDevice';
import type { Employee, EmployeeRole, BusinessId } from '@/types';

import MobileTodayView       from './TodayView';
import MobileTablesScreen    from './MobileTablesScreen';
import MobileWalkInScreen    from './MobileWalkInScreen';
import MobileClientsView     from './MobileClientsView';
import MobileMoreScreen      from './MobileMoreScreen';

export type MobileTab = 'reservations' | 'tables' | 'walkin' | 'clients' | 'more';

const TABS: { id: MobileTab; label: string; ico: React.ReactNode; special?: boolean }[] = [
  { id: 'reservations', label: 'Reserves', ico: I.calendar },
  { id: 'tables',       label: 'Meses',    ico: I.tableIco },
  { id: 'walkin',       label: 'Walk-in',  ico: I.walkin,  special: true },
  { id: 'clients',      label: 'Clients',  ico: I.users },
  { id: 'more',         label: 'Més',      ico: I.dotsH },
];

export default function MobileShell() {
  const [tab, setTab]               = useState<MobileTab>('reservations');
  const [showBizPicker, setShowBizPicker] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const {
    selectedBusiness, setSelectedBusiness,
    employees, employeeRoles,
    activeEmployeeId, setActiveEmployee,
  } = useAppStore();

  const isStandalone = useIsStandalonePWA();
  const biz       = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const activeEmp = employees.find(e => e.id === activeEmployeeId) ?? null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:'var(--cream)', overflow:'hidden' }}>

      {/* ── Top header ────────────────────────────────────────────────── */}
      <header style={{
        /* In PWA standalone mode on iOS, env(safe-area-inset-top) is the
           status-bar height (≈44–59 px on notched iPhones). We push the
           header content below it so nothing hides under the status bar. */
        paddingTop:    isStandalone ? 'calc(10px + env(safe-area-inset-top))' : '10px',
        paddingBottom: '9px',
        paddingLeft:   '14px',
        paddingRight:  '14px',
        borderBottom:  'var(--hair)',
        background:    'var(--paper)',
        flexShrink:    0,
        display:       'flex',
        alignItems:    'center',
        gap:           10,
      }}>
        {/* Biz switcher */}
        <button
          onClick={() => setShowBizPicker(true)}
          style={{
            flex:1, display:'flex', alignItems:'center', gap:8,
            background:'transparent', border:'none', cursor:'pointer',
            fontFamily:'inherit', textAlign:'left', padding:0,
          }}>
          <span style={{
            width:30, height:30, borderRadius:8, flexShrink:0,
            background:biz.hueSoft, color:biz.hue,
            fontWeight:700, fontSize:11, fontFamily:'var(--font-serif)',
            display:'grid', placeItems:'center',
          }}>
            {biz.monogram}
          </span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--ink-900)', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {biz.name}
            </div>
            <div style={{ fontSize:10.5, color:'var(--ink-500)', lineHeight:1.1 }}>{biz.kind}</div>
          </div>
          <Icon d={I.chevD} size={13} />
        </button>

        {/* User pill */}
        <button
          onClick={() => setShowUserPicker(true)}
          style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'4px 10px 4px 5px',
            border:'1px solid rgba(60,40,20,.12)', borderRadius:20,
            background:'var(--cream)', cursor:'pointer', fontFamily:'inherit', flexShrink:0,
          }}>
          {activeEmp ? (
            <>
              <span className={`avatar av-${avIdx(activeEmp.fullName)}`}
                style={{ width:22, height:22, fontSize:8.5, display:'grid', placeItems:'center', borderRadius:'50%' }}>
                {activeEmp.initials}
              </span>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--ink-800)' }}>
                {activeEmp.fullName.split(' ')[0]}
              </span>
            </>
          ) : (
            <span style={{ fontSize:12, color:'var(--ink-500)' }}>Usuari</span>
          )}
        </button>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'reservations' && <MobileTodayView />}
        {tab === 'tables'       && <MobileTablesScreen />}
        {tab === 'walkin'       && <MobileWalkInScreen onSwitchTab={setTab} />}
        {tab === 'clients'      && <MobileClientsView />}
        {tab === 'more'         && <MobileMoreScreen onSwitchTab={setTab} />}
      </main>

      {/* ── Bottom nav ────────────────────────────────────────────────── */}
      <nav style={{
        borderTop:   'var(--hair)',
        background:  'var(--paper)',
        flexShrink:  0,
        display:     'grid',
        gridTemplateColumns: 'repeat(5,1fr)',
        /* Push the tab bar above the iOS home indicator / Android gesture bar */
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft:   'env(safe-area-inset-left)',
        paddingRight:  'env(safe-area-inset-right)',
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          if (t.special) {
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  padding:'8px 4px 10px', border:'none', background:'transparent',
                  cursor:'pointer', fontFamily:'inherit',
                }}>
                <span style={{
                  width:42, height:30, borderRadius:10, display:'grid', placeItems:'center',
                  background: active ? 'var(--terracotta-600)' : 'var(--terracotta-50)',
                  color: active ? 'white' : 'var(--terracotta-600)',
                  transition:'background .15s',
                }}>
                  <Icon d={t.ico} size={20} stroke={active ? 2.2 : 1.8} />
                </span>
                <span style={{ fontSize:10, fontWeight:active?700:500, color: active?'var(--terracotta-600)':'var(--ink-500)' }}>
                  {t.label}
                </span>
              </button>
            );
          }
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                padding:'10px 4px 10px', border:'none', background:'transparent',
                cursor:'pointer', fontFamily:'inherit',
                color: active ? 'var(--terracotta-600)' : 'var(--ink-500)',
              }}>
              <Icon d={t.ico} size={22} stroke={active ? 2.1 : 1.6} />
              <span style={{ fontSize:10, fontWeight:active?700:500 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Biz picker sheet ──────────────────────────────────────────── */}
      {showBizPicker && (
        <BizPickerSheet
          current={selectedBusiness}
          onSelect={id => { setSelectedBusiness(id); setShowBizPicker(false); }}
          onClose={() => setShowBizPicker(false)}
        />
      )}

      {/* ── User picker sheet ─────────────────────────────────────────── */}
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
    </div>
  );
}

// ─── Biz picker ───────────────────────────────────────────────────────────────
function BizPickerSheet({ current, onSelect, onClose }: {
  current: BusinessId; onSelect: (id: BusinessId) => void; onClose: () => void;
}) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'flex-end' }}
      onClick={onClose}>
      <div style={{ width:'100%', background:'var(--paper)', borderRadius:'18px 18px 0 0', padding:'16px 14px 32px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 14px' }} />
        <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, textTransform:'uppercase', marginBottom:10, paddingLeft:2 }}>
          Canviar negoci
        </div>
        {BUSINESSES.map(b => (
          <button key={b.id} onClick={() => onSelect(b.id)}
            style={{
              display:'flex', alignItems:'center', gap:12, width:'100%',
              padding:'13px 12px', border: b.id === current ? `1.5px solid ${b.hue}` : '1px solid rgba(60,40,20,.1)',
              borderRadius:12, marginBottom:8,
              background: b.id === current ? b.hueSoft : 'var(--cream)',
              cursor:'pointer', fontFamily:'inherit', textAlign:'left',
            }}>
            <span style={{ width:36, height:36, borderRadius:9, background:b.hueSoft, color:b.hue, fontWeight:700, fontSize:13, fontFamily:'var(--font-serif)', display:'grid', placeItems:'center', flexShrink:0 }}>
              {b.monogram}
            </span>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)' }}>{b.name}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-500)' }}>{b.kind}</div>
            </div>
            {b.id === current && (
              <span style={{ marginLeft:'auto', color:b.hue }}><Icon d={I.check} size={18} stroke={2.5} /></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── User picker ──────────────────────────────────────────────────────────────
function MobileUserPicker({ bizId, employees, employeeRoles, activeEmployeeId, onSelect, onClose }: {
  bizId: BusinessId; employees: Employee[]; employeeRoles: EmployeeRole[];
  activeEmployeeId: string | null; onSelect: (id: string | null) => void; onClose: () => void;
}) {
  const bizEmps = employees.filter(e => e.bizId === bizId && e.active);
  const roleMap = Object.fromEntries(employeeRoles.map(r => [r.id, r]));
  const sorted  = [...bizEmps].sort((a, b) => (roleMap[a.roleId]?.order ?? 99) - (roleMap[b.roleId]?.order ?? 99));

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'flex-end' }}
      onClick={onClose}>
      <div style={{ width:'100%', background:'var(--paper)', borderRadius:'18px 18px 0 0', padding:'16px 12px 32px', maxHeight:'72vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 16px' }} />
        <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, textTransform:'uppercase', marginBottom:12, paddingLeft:4 }}>
          Usuari actiu
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:8 }}>
          {sorted.map(emp => {
            const role     = roleMap[emp.roleId];
            const isActive = emp.id === activeEmployeeId;
            return (
              <button key={emp.id} onClick={() => onSelect(emp.id)}
                style={{
                  display:'flex', flexDirection:'column', gap:6, padding:'10px 12px',
                  border: isActive ? '2px solid var(--terracotta-500)' : '1.5px solid rgba(60,40,20,.1)',
                  borderRadius:12, background: isActive ? 'var(--terracotta-50)' : 'var(--cream)',
                  cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                }}>
                <span className={`avatar av-${avIdx(emp.fullName)}`}
                  style={{ width:32, height:32, fontSize:11, display:'grid', placeItems:'center', borderRadius:'50%' }}>
                  {emp.initials}
                </span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color: isActive ? 'var(--terracotta-700)' : 'var(--ink-900)' }}>
                    {emp.fullName}
                  </div>
                  {role && (
                    <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:3, background:role.color, color:role.textColor }}>
                      {role.name}
                    </span>
                  )}
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
