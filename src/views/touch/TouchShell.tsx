/**
 * TouchShell — unified shell for mobile AND tablet (all touch-first devices).
 *
 * Single source of truth: same screens, same logic, same store, same pickers.
 * Layout adapts responsively based on the `isTablet` flag:
 *
 *   Mobile  (< 768 px)   → top header + bottom navigation bar
 *   Tablet  (≥ 768 px)   → left side rail (72 px) + no top header
 *
 * Any fix to a screen, sheet, or picker automatically applies to both.
 * Desktop remains fully independent in DesktopShell.
 */
import React, { useState, useEffect, useRef } from 'react';
import AnimatedSheet from '@/components/shared/AnimatedSheet';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, avIdx } from '@/data/mockData';
import { useDevice } from '@/hooks/useDevice';
import type { Employee, EmployeeRole, BusinessId } from '@/types';

// ── Touch screens — shared between mobile and tablet ─────────────────────────
import TouchReservationsScreen from '@/views/mobile/TodayView';
import TouchTablesScreen       from '@/views/mobile/MobileTablesScreen';
import TouchWalkInScreen       from '@/views/mobile/MobileWalkInScreen';
import TouchClientsScreen      from '@/views/mobile/MobileClientsView';
import TouchMoreScreen         from '@/views/mobile/MobileMoreScreen';

export type TouchTab = 'reservations' | 'tables' | 'walkin' | 'clients' | 'more';

// Bottom-nav tabs — "more" lives in the header on mobile, in side rail on tablet
const NAV_TABS: { id: TouchTab; label: string; ico: React.ReactNode; special?: boolean }[] = [
  { id: 'reservations', label: 'Reserves', ico: I.calendar },
  { id: 'walkin',       label: 'Walk-in',  ico: I.walkin,  special: true },
  // center slot is the "+" action button — rendered separately
  { id: 'tables',       label: 'Taules',   ico: I.tableIco },
  { id: 'clients',      label: 'Clients',  ico: I.users },
];

// Side-rail tabs on tablet (includes Més)
const RAIL_TABS: { id: TouchTab; label: string; ico: React.ReactNode; special?: boolean }[] = [
  { id: 'reservations', label: 'Reserves', ico: I.calendar },
  { id: 'walkin',       label: 'Walk-in',  ico: I.walkin,  special: true },
  { id: 'tables',       label: 'Taules',   ico: I.tableIco },
  { id: 'clients',      label: 'Clients',  ico: I.users },
  { id: 'more',         label: 'Més',      ico: I.dotsH },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function TouchShell() {
  const [tab, setTab]                       = useState<TouchTab>('reservations');
  const [showBizPicker,  setShowBizPicker]  = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [newResTrigger,  setNewResTrigger]  = useState(0);
  // Read innerHeight synchronously so the container height is correct on
  // the very first paint — avoids iOS Safari dvh/layout-viewport mismatch.
  const [appH, setAppH] = useState(() => window.innerHeight);

  function openNewReservation() {
    setTab('reservations');
    setNewResTrigger(n => n + 1);
  }

  const {
    selectedBusiness, setSelectedBusiness,
    employees, employeeRoles,
    activeEmployeeId, setActiveEmployee,
    selectedDate, setSelectedDate,
  } = useAppStore();

  const { isTablet, isStandalone } = useDevice();
  const biz       = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const activeEmp = employees.find(e => e.id === activeEmployeeId) ?? null;

  // ── Track true viewport height (iOS Safari dvh ≠ innerHeight on first paint)
  useEffect(() => {
    const update = () => setAppH(window.innerHeight);
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // ── Swipe L/R to change date on date-aware tabs ───────────────────────────
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
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + (dx < 0 ? 1 : -1));
    setSelectedDate(next);
  };

  // ── Shared: screen content (remounts on tab change for enter animation) ───
  const screenContent = (
    <div key={tab} className="tab-enter"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {tab === 'reservations' && <TouchReservationsScreen newResTrigger={newResTrigger} />}
      {tab === 'tables'       && <TouchTablesScreen />}
      {tab === 'walkin'       && <TouchWalkInScreen onSwitchTab={setTab} />}
      {tab === 'clients'      && <TouchClientsScreen />}
      {tab === 'more'         && <TouchMoreScreen onSwitchTab={setTab} />}
    </div>
  );

  // ── Shared: animated picker sheets ────────────────────────────────────────
  const pickers = (
    <>
      <BizPickerSheet
        open={showBizPicker}
        current={selectedBusiness}
        onSelect={id => { setSelectedBusiness(id); setShowBizPicker(false); }}
        onClose={() => setShowBizPicker(false)}
      />
      <UserPickerSheet
        open={showUserPicker}
        bizId={selectedBusiness}
        employees={employees}
        employeeRoles={employeeRoles}
        activeEmployeeId={activeEmployeeId}
        onSelect={id => { setActiveEmployee(id); setShowUserPicker(false); }}
        onClose={() => setShowUserPicker(false)}
      />
    </>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TABLET LAYOUT — left side rail (72 px), no top header
  // ══════════════════════════════════════════════════════════════════════════
  if (isTablet) {
    return (
      <div style={{
        display: 'flex', height: '100dvh',
        background: 'var(--cream)', overflow: 'hidden',
        paddingTop: isStandalone ? 'env(safe-area-inset-top)' : undefined,
      }}>

        {/* ── Left side rail ──────────────────────────────────────────── */}
        <nav style={{
          width: 72, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: 'var(--paper)', borderRight: 'var(--hair)',
          paddingTop: 8,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {/* Biz monogram — tap to switch */}
          <button onClick={() => setShowBizPicker(true)} title={biz.name}
            style={{
              margin: '0 auto 12px', width: 44, height: 44, borderRadius: 11,
              background: biz.hueSoft, color: biz.hue,
              fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-serif)',
              display: 'grid', placeItems: 'center',
              border: 'none', cursor: 'pointer',
            }}>
            {biz.monogram}
          </button>

          {/* Tab buttons */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 6px' }}>
            {/* "+" action button at top of rail */}
            <button onClick={openNewReservation} className="nav-btn press"
              title="Nova reserva"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '8px 4px', border: 'none', borderRadius: 10,
                background: 'var(--terracotta-600)', color: 'white',
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6,
              }}>
              <Icon d={I.plus} size={22} stroke={2.2} />
              <span style={{ fontSize: 9.5, fontWeight: 700 }}>Nova</span>
            </button>

            {RAIL_TABS.map(t => {
              const active = tab === t.id;
              if (t.special) {
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} className="nav-btn press"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      padding: '8px 4px', border: 'none', borderRadius: 10,
                      background: active ? 'var(--terracotta-600)' : 'var(--terracotta-50)',
                      color: active ? 'white' : 'var(--terracotta-600)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    <Icon d={t.ico} size={22} stroke={active ? 2.2 : 1.7} />
                    <span style={{ fontSize: 9.5, fontWeight: 600 }}>{t.label}</span>
                  </button>
                );
              }
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className="nav-btn press"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    padding: '9px 4px', border: 'none', borderRadius: 10,
                    background: active ? 'rgba(60,40,20,.07)' : 'transparent',
                    color: active ? 'var(--terracotta-600)' : 'var(--ink-500)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Icon d={t.ico} size={22} stroke={active ? 2.1 : 1.6} />
                  <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500 }}>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active user avatar at bottom */}
          <button onClick={() => setShowUserPicker(true)} title={activeEmp?.fullName ?? 'Usuari'}
            style={{
              margin: '0 auto 10px', width: 38, height: 38, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              border: 'none', cursor: 'pointer',
              background: activeEmp ? 'var(--terracotta-50)' : 'var(--ink-100)',
              color: activeEmp ? 'var(--terracotta-700)' : 'var(--ink-500)',
              fontWeight: 700, fontSize: 11,
            }}>
            {activeEmp ? activeEmp.initials : <Icon d={I.users} size={16} />}
          </button>
        </nav>

        {/* ── Main content ────────────────────────────────────────────── */}
        <main
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {screenContent}
        </main>

        {pickers}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT — top header + fixed bottom navigation bar
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: appH,
      background: 'var(--cream)', overflow: 'hidden',
    }}>

      {/* ── Top header ──────────────────────────────────────────────── */}
      <header style={{
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
        <button onClick={() => setShowBizPicker(true)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left', padding: 0,
          }}>
          <span style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: biz.hueSoft, color: biz.hue,
            fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-serif)',
            display: 'grid', placeItems: 'center',
          }}>
            {biz.monogram}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {biz.name}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-500)', lineHeight: 1.1 }}>{biz.kind}</div>
          </div>
          <Icon d={I.chevD} size={13} />
        </button>

        {/* Més button — moved from bottom nav to header */}
        <button onClick={() => setTab('more')}
          style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            border: '1px solid rgba(60,40,20,.12)',
            background: tab === 'more' ? 'var(--terracotta-50)' : 'var(--cream)',
            color: tab === 'more' ? 'var(--terracotta-600)' : 'var(--ink-500)',
            cursor: 'pointer',
          }}>
          <Icon d={I.dotsH} size={18} stroke={1.8} />
        </button>

        {/* User pill */}
        <button onClick={() => setShowUserPicker(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px 4px 5px',
            border: '1px solid rgba(60,40,20,.12)', borderRadius: 20,
            background: 'var(--cream)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}>
          {activeEmp ? (
            <>
              <span className={`avatar av-${avIdx(activeEmp.fullName)}`}
                style={{ width: 22, height: 22, fontSize: 8.5, display: 'grid', placeItems: 'center', borderRadius: '50%' }}>
                {activeEmp.initials}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-800)' }}>
                {activeEmp.fullName.split(' ')[0]}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Usuari</span>
          )}
        </button>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {screenContent}
      </main>

      {/* ── Bottom nav — in-flow flex child, stable from first frame ── */}
      <nav style={{
        flexShrink: 0, zIndex: 50,
        borderTop: 'var(--hair)', background: 'var(--paper)',
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft:   'env(safe-area-inset-left,   0px)',
        paddingRight:  'env(safe-area-inset-right,  0px)',
      }}>
        {/* Reserves */}
        <NavBtn id="reservations" tab={tab} setTab={setTab} label="Reserves" ico={I.calendar} />
        {/* Walk-in */}
        <NavBtn id="walkin" tab={tab} setTab={setTab} label="Walk-in" ico={I.walkin} special />
        {/* Centre: "+" action button — not a nav tab */}
        <button
          onClick={openNewReservation}
          className="press"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
            padding: '6px 4px 8px',
          }}>
          <span style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--terracotta-600)',
            boxShadow: '0 4px 14px rgba(160,60,20,.45)',
            display: 'grid', placeItems: 'center',
            color: 'white',
            flexShrink: 0,
          }}>
            <Icon d={I.plus} size={24} stroke={2.2} />
          </span>
        </button>
        {/* Taules */}
        <NavBtn id="tables" tab={tab} setTab={setTab} label="Taules" ico={I.tableIco} />
        {/* Clients */}
        <NavBtn id="clients" tab={tab} setTab={setTab} label="Clients" ico={I.users} />
      </nav>

      {pickers}
    </div>
  );
}

// ─── Nav button — reusable tab button for bottom nav ──────────────────────────
function NavBtn({ id, tab, setTab, label, ico, special }: {
  id: TouchTab; tab: TouchTab; setTab: (t: TouchTab) => void;
  label: string; ico: React.ReactNode; special?: boolean;
}) {
  const active = tab === id;
  if (special) {
    return (
      <button onClick={() => setTab(id)} className="nav-btn press"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '8px 4px 10px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
        <span style={{
          width: 42, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center',
          background: active ? 'var(--terracotta-600)' : 'transparent',
          border: active ? 'none' : '1.5px solid var(--terracotta-500)',
          color: active ? 'white' : 'var(--terracotta-600)',
          transition: 'background .15s, border .15s', boxSizing: 'border-box',
        }}>
          <Icon d={ico} size={20} stroke={active ? 2.2 : 1.8} />
        </span>
        <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? 'var(--terracotta-600)' : 'var(--ink-500)' }}>
          {label}
        </span>
      </button>
    );
  }
  return (
    <button onClick={() => setTab(id)} className="nav-btn press"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '10px 4px 10px', border: 'none', background: 'transparent',
        cursor: 'pointer', fontFamily: 'inherit',
        color: active ? 'var(--terracotta-600)' : 'var(--ink-500)',
      }}>
      <Icon d={ico} size={22} stroke={active ? 2.1 : 1.6} />
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

// ─── Biz picker sheet — animated, shared ─────────────────────────────────────
function BizPickerSheet({ open, current, onSelect, onClose }: {
  open: boolean; current: BusinessId;
  onSelect: (id: BusinessId) => void; onClose: () => void;
}) {
  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={500}>
      <div style={{
        width: '100%', background: 'var(--paper)',
        borderRadius: '18px 18px 0 0', padding: '16px 14px 32px',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2 }}>
          Canviar negoci
        </div>
        {BUSINESSES.map(b => (
          <button key={b.id} onClick={() => onSelect(b.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '13px 12px',
              border: b.id === current ? `1.5px solid ${b.hue}` : '1px solid rgba(60,40,20,.1)',
              borderRadius: 12, marginBottom: 8,
              background: b.id === current ? b.hueSoft : 'var(--cream)',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: b.hueSoft, color: b.hue, fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-serif)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {b.monogram}
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{b.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{b.kind}</div>
            </div>
            {b.id === current && (
              <span style={{ marginLeft: 'auto', color: b.hue }}>
                <Icon d={I.check} size={18} stroke={2.5} />
              </span>
            )}
          </button>
        ))}
      </div>
    </AnimatedSheet>
  );
}

// ─── User picker sheet — animated, shared ────────────────────────────────────
function UserPickerSheet({ open, bizId, employees, employeeRoles, activeEmployeeId, onSelect, onClose }: {
  open: boolean; bizId: BusinessId;
  employees: Employee[]; employeeRoles: EmployeeRole[];
  activeEmployeeId: string | null;
  onSelect: (id: string | null) => void; onClose: () => void;
}) {
  const bizEmps = employees.filter(e => e.bizId === bizId && e.active);
  const roleMap = Object.fromEntries(employeeRoles.map(r => [r.id, r]));
  const sorted  = [...bizEmps].sort((a, b) => (roleMap[a.roleId]?.order ?? 99) - (roleMap[b.roleId]?.order ?? 99));

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={500}>
      <div style={{
        width: '100%', background: 'var(--paper)',
        borderRadius: '18px 18px 0 0', padding: '16px 12px 32px',
        maxHeight: '72dvh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 12, paddingLeft: 4 }}>
          Usuari actiu
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {sorted.map(emp => {
            const role     = roleMap[emp.roleId];
            const isActive = emp.id === activeEmployeeId;
            return (
              <button key={emp.id} onClick={() => onSelect(emp.id)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px',
                  border: isActive ? '2px solid var(--terracotta-500)' : '1.5px solid rgba(60,40,20,.1)',
                  borderRadius: 12,
                  background: isActive ? 'var(--terracotta-50)' : 'var(--cream)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <span className={`avatar av-${avIdx(emp.fullName)}`}
                  style={{ width: 32, height: 32, fontSize: 11, display: 'grid', placeItems: 'center', borderRadius: '50%' }}>
                  {emp.initials}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--terracotta-700)' : 'var(--ink-900)' }}>
                    {emp.fullName}
                  </div>
                  {role && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: role.color, color: role.textColor }}>
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
            style={{ marginTop: 14, width: '100%', padding: '10px 0', border: 'var(--hair)', borderRadius: 10, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink-500)' }}>
            Continuar sense usuari actiu
          </button>
        )}
      </div>
    </AnimatedSheet>
  );
}
