/**
 * TabletShell — portrait tablet layout (768–1024 px)
 *
 * Left side rail (72 px) with icon + label tabs.
 * Reuses every mobile screen component unchanged — they use flexible CSS
 * grids that naturally expand to fill the wider content area.
 *
 * Biz picker and user picker are the same bottom-sheets as MobileShell.
 */
import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, avIdx } from '@/data/mockData';
import { useDevice } from '@/hooks/useDevice';
import type { Employee, EmployeeRole, BusinessId } from '@/types';

// Reuse mobile screen components — they're device-agnostic
import MobileTodayView    from '@/views/mobile/TodayView';
import MobileTablesScreen from '@/views/mobile/MobileTablesScreen';
import MobileWalkInScreen from '@/views/mobile/MobileWalkInScreen';
import MobileClientsView  from '@/views/mobile/MobileClientsView';
import MobileMoreScreen   from '@/views/mobile/MobileMoreScreen';

export type TabletTab = 'reservations' | 'tables' | 'walkin' | 'clients' | 'more';

const TABS: { id: TabletTab; label: string; ico: React.ReactNode; accent?: boolean }[] = [
  { id: 'reservations', label: 'Reserves', ico: I.calendar },
  { id: 'tables',       label: 'Taules',    ico: I.tableIco },
  { id: 'walkin',       label: 'Walk-in',  ico: I.walkin,  accent: true },
  { id: 'clients',      label: 'Clients',  ico: I.users },
  { id: 'more',         label: 'Més',      ico: I.dotsH },
];

// ─── Shell ────────────────────────────────────────────────────────────────────
export default function TabletShell() {
  const [tab, setTab]               = useState<TabletTab>('reservations');
  const [showBizPicker, setShowBizPicker] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const {
    selectedBusiness, setSelectedBusiness,
    employees, employeeRoles,
    activeEmployeeId, setActiveEmployee,
  } = useAppStore();

  const { isStandalone } = useDevice();
  const biz      = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const activeEmp = employees.find(e => e.id === activeEmployeeId) ?? null;

  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      background: 'var(--cream)',
      overflow: 'hidden',
      // Safe area for notched/punched-hole tablets in standalone mode
      paddingTop:   isStandalone ? 'env(safe-area-inset-top)'  : undefined,
    }}>

      {/* ── Left side rail ─────────────────────────────────────────────── */}
      <nav style={{
        width: 72,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--paper)',
        borderRight: 'var(--hair)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingTop: 8,
      }}>
        {/* Biz avatar — tap to switch */}
        <button
          onClick={() => setShowBizPicker(true)}
          title={biz.name}
          style={{
            margin: '0 auto 12px',
            width: 44, height: 44, borderRadius: 11, flexShrink: 0,
            background: biz.hueSoft, color: biz.hue,
            fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-serif)',
            display: 'grid', placeItems: 'center',
            border: 'none', cursor: 'pointer',
          }}>
          {biz.monogram}
        </button>

        {/* Tab buttons */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 6px' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            if (t.accent) {
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    padding: '8px 4px', border: 'none', borderRadius: 10,
                    background: active ? 'var(--terracotta-600)' : 'var(--terracotta-50)',
                    color: active ? 'white' : 'var(--terracotta-600)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s',
                  }}>
                  <Icon d={t.ico} size={22} stroke={active ? 2.2 : 1.7} />
                  <span style={{ fontSize: 9.5, fontWeight: 600 }}>{t.label}</span>
                </button>
              );
            }
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
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
        <button
          onClick={() => setShowUserPicker(true)}
          title={activeEmp?.fullName ?? 'Usuari'}
          style={{
            margin: '0 auto 10px',
            width: 38, height: 38, borderRadius: '50%',
            background: activeEmp ? 'var(--terracotta-50)' : 'var(--ink-100)',
            color: activeEmp ? 'var(--terracotta-700)' : 'var(--ink-500)',
            fontWeight: 700, fontSize: 11,
            display: 'grid', placeItems: 'center',
            border: 'none', cursor: 'pointer',
          }}>
          {activeEmp ? activeEmp.initials : <Icon d={I.users} size={16} />}
        </button>
      </nav>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {tab === 'reservations' && <MobileTodayView />}
        {tab === 'tables'       && <MobileTablesScreen />}
        {tab === 'walkin'       && <MobileWalkInScreen onSwitchTab={t => setTab(t as TabletTab)} />}
        {tab === 'clients'      && <MobileClientsView />}
        {tab === 'more'         && <MobileMoreScreen onSwitchTab={t => setTab(t as TabletTab)} />}
      </main>

      {/* ── Biz picker ─────────────────────────────────────────────────── */}
      {showBizPicker && (
        <BizPickerSheet
          current={selectedBusiness}
          onSelect={id => { setSelectedBusiness(id); setShowBizPicker(false); }}
          onClose={() => setShowBizPicker(false)}
        />
      )}

      {/* ── User picker ────────────────────────────────────────────────── */}
      {showUserPicker && (
        <UserPickerSheet
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div style={{ width: '100%', background: 'var(--paper)', borderRadius: '18px 18px 0 0', padding: '16px 14px calc(32px + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2 }}>
          Canviar negoci
        </div>
        {BUSINESSES.map(b => (
          <button key={b.id} onClick={() => onSelect(b.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '13px 12px', border: b.id === current ? `1.5px solid ${b.hue}` : '1px solid rgba(60,40,20,.1)',
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
              <span style={{ marginLeft: 'auto', color: b.hue }}><Icon d={I.check} size={18} stroke={2.5} /></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── User picker ──────────────────────────────────────────────────────────────
function UserPickerSheet({ bizId, employees, employeeRoles, activeEmployeeId, onSelect, onClose }: {
  bizId: BusinessId; employees: Employee[]; employeeRoles: EmployeeRole[];
  activeEmployeeId: string | null; onSelect: (id: string | null) => void; onClose: () => void;
}) {
  const bizEmps = employees.filter(e => e.bizId === bizId && e.active);
  const roleMap = Object.fromEntries(employeeRoles.map(r => [r.id, r]));
  const sorted  = [...bizEmps].sort((a, b) => (roleMap[a.roleId]?.order ?? 99) - (roleMap[b.roleId]?.order ?? 99));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div style={{ width: '100%', background: 'var(--paper)', borderRadius: '18px 18px 0 0', padding: '16px 12px calc(32px + env(safe-area-inset-bottom))', maxHeight: '72vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 12, paddingLeft: 4 }}>
          Usuari actiu
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {sorted.map(emp => {
            const role     = roleMap[emp.roleId];
            const isActive = emp.id === activeEmployeeId;
            return (
              <button key={emp.id} onClick={() => onSelect(emp.id)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px',
                  border: isActive ? '2px solid var(--terracotta-500)' : '1.5px solid rgba(60,40,20,.1)',
                  borderRadius: 12, background: isActive ? 'var(--terracotta-50)' : 'var(--cream)',
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
    </div>
  );
}
