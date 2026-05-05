import React, { useState, useEffect, useRef } from 'react';
import AnimatedSheet from '@/components/shared/AnimatedSheet';
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
  { id: 'tables',       label: 'Taules',    ico: I.tableIco },
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
    selectedDate, setSelectedDate,
  } = useAppStore();

  const isStandalone = useIsStandalonePWA();

  // ── Fix iOS Safari viewport height (browser chrome steals space) ──────────
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);

  // ── Swipe left/right to change date (only on date-aware tabs) ────────────
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (tab !== 'reservations' && tab !== 'tables') return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only act on clearly horizontal swipes (dx dominant, >50 px)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + (dx < 0 ? 1 : -1));
    setSelectedDate(next);
  };
  const biz       = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const activeEmp = employees.find(e => e.id === activeEmployeeId) ?? null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(var(--vh, 1dvh) * 100)', background:'var(--cream)', overflow:'hidden' }}>

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

      {/* ── Main content — swipe L/R changes date on date-aware tabs ── */}
      {/* paddingBottom ensures content isn't hidden behind the fixed nav */}
      <main
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'calc(var(--mobile-nav-h) + env(safe-area-inset-bottom, 0px))',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* key triggers remount + tab-enter animation on every tab switch */}
        <div key={tab} className="tab-enter" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {tab === 'reservations' && <MobileTodayView />}
          {tab === 'tables'       && <MobileTablesScreen />}
          {tab === 'walkin'       && <MobileWalkInScreen onSwitchTab={setTab} />}
          {tab === 'clients'      && <MobileClientsView />}
          {tab === 'more'         && <MobileMoreScreen onSwitchTab={setTab} />}
        </div>
      </main>

      {/* ── Bottom nav — fixed so it always sticks to screen edge ──── */}
      <nav style={{
        position:    'fixed',
        bottom:      0,
        left:        0,
        right:       0,
        zIndex:      50,
        borderTop:   'var(--hair)',
        background:  'var(--paper)',
        display:     'grid',
        gridTemplateColumns: 'repeat(5,1fr)',
        /* Push buttons above iOS home indicator / Android gesture bar */
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft:   'env(safe-area-inset-left,   0px)',
        paddingRight:  'env(safe-area-inset-right,  0px)',
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
                  /* Active → solid terracotta fill. Inactive → outline only, no fill. */
                  background: active ? 'var(--terracotta-600)' : 'transparent',
                  border: active ? 'none' : '1.5px solid var(--terracotta-500)',
                  color: active ? 'white' : 'var(--terracotta-600)',
                  transition:'background .15s, border .15s',
                  boxSizing:'border-box',
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
            <button key={t.id} onClick={() => setTab(t.id)} className="nav-btn press"
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
      <BizPickerSheet
        open={showBizPicker}
        current={selectedBusiness}
        onSelect={id => { setSelectedBusiness(id); setShowBizPicker(false); }}
        onClose={() => setShowBizPicker(false)}
      />

      {/* ── User picker sheet ─────────────────────────────────────────── */}
      <MobileUserPicker
        open={showUserPicker}
        bizId={selectedBusiness}
        employees={employees}
        employeeRoles={employeeRoles}
        activeEmployeeId={activeEmployeeId}
        onSelect={id => { setActiveEmployee(id); setShowUserPicker(false); }}
        onClose={() => setShowUserPicker(false)}
      />
    </div>
  );
}

// ─── Biz picker ───────────────────────────────────────────────────────────────
function BizPickerSheet({ open, current, onSelect, onClose }: {
  open: boolean; current: BusinessId; onSelect: (id: BusinessId) => void; onClose: () => void;
}) {
  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={500}>
      <div style={{ width:'100%', background:'var(--paper)', borderRadius:'18px 18px 0 0', padding:'16px 14px 32px' }}>
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
    </AnimatedSheet>
  );
}

// ─── User picker ──────────────────────────────────────────────────────────────
function MobileUserPicker({ open, bizId, employees, employeeRoles, activeEmployeeId, onSelect, onClose }: {
  open: boolean; bizId: BusinessId; employees: Employee[]; employeeRoles: EmployeeRole[];
  activeEmployeeId: string | null; onSelect: (id: string | null) => void; onClose: () => void;
}) {
  const bizEmps = employees.filter(e => e.bizId === bizId && e.active);
  const roleMap = Object.fromEntries(employeeRoles.map(r => [r.id, r]));
  const sorted  = [...bizEmps].sort((a, b) => (roleMap[a.roleId]?.order ?? 99) - (roleMap[b.roleId]?.order ?? 99));

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={500}>
      <div style={{ width:'100%', background:'var(--paper)', borderRadius:'18px 18px 0 0', padding:'16px 12px 32px', maxHeight:'72dvh', overflowY:'auto' }}>
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
    </AnimatedSheet>
  );
}
