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
import { usePullToRefresh, PULL_THRESHOLD_PX } from '@/hooks/usePullToRefresh';
import Toaster from '@/components/shared/Toaster';
import type { Employee, EmployeeRole, BusinessId } from '@/types';

// ── Touch screens — shared between mobile and tablet ─────────────────────────
import TouchReservationsScreen from '@/views/mobile/TodayView';
import TouchTablesScreen       from '@/views/mobile/MobileTablesScreen';
import TouchWalkInScreen       from '@/views/mobile/MobileWalkInScreen';
import TouchClientsScreen      from '@/views/mobile/MobileClientsView';
import TouchMoreScreen         from '@/views/mobile/MobileMoreScreen';

export type TouchTab = 'reservations' | 'tables' | 'walkin' | 'clients' | 'more';

// Header title per tab
const TAB_TITLES: Record<TouchTab, string> = {
  reservations: "Reserves d'avui",
  tables:       'Plànol de taules',
  walkin:       'Walk-in',
  clients:      'Clients',
  more:         'Configuració',
};

// Bottom-nav tabs for mobile (4 tabs split around center FAB)
const MOB_LEFT_TABS:  { id: TouchTab; label: string; ico: React.ReactNode }[] = [
  { id: 'reservations', label: 'Reserves', ico: I.calendar  },
  { id: 'tables',       label: 'Taules',   ico: I.tableIco  },
];
const MOB_RIGHT_TABS: { id: TouchTab; label: string; ico: React.ReactNode }[] = [
  { id: 'clients',      label: 'Clients',  ico: I.users     },
  { id: 'walkin',       label: 'Walk-in',  ico: I.walkin    },
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
  // Read the Visual Viewport height synchronously so the container height
  // is correct on the very first paint. visualViewport.height tracks the
  // ACTUAL visible area (under the Safari toolbar / above the home bar) —
  // unlike innerHeight or 100dvh which on first load often report the
  // larger layout viewport and cause a cream gap below the nav.
  const [appH, setAppH] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return window.visualViewport?.height ?? window.innerHeight;
  });

  function openNewReservation() {
    setTab('reservations');
    setNewResTrigger(n => n + 1);
  }

  const {
    selectedBusiness, setSelectedBusiness,
    employees, employeeRoles,
    activeEmployeeId, setActiveEmployee,
    selectedDate, setSelectedDate,
    reservations,
  } = useAppStore();

  const { isTablet, isStandalone } = useDevice();
  const biz       = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const activeEmp = employees.find(e => e.id === activeEmployeeId) ?? null;

  // ── Day-aware metrics + shift detection ─────────────────────────────────
  const dayIso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;
  const dayResAll = reservations.filter(r =>
    r.bizId === selectedBusiness && r.date === dayIso,
  );
  const pendingResCount = dayResAll.filter(r => r.status === 'pending').length;
  const totalRes = dayResAll.length;
  const totalPax = dayResAll.reduce((s, r) => s + r.pax, 0);

  // Shift detection — Migdia (13–16) / Nit (19–23:30) / fora-servei
  const now = new Date();
  const isToday =
    now.getFullYear() === selectedDate.getFullYear() &&
    now.getMonth()    === selectedDate.getMonth() &&
    now.getDate()     === selectedDate.getDate();
  const hourNow = now.getHours() + now.getMinutes() / 60;
  const inMigdia = isToday && hourNow >= 13   && hourNow < 16;
  const inNit    = isToday && hourNow >= 19   && hourNow < 23.5;
  const activeShift: { id:'M'|'N'; label:string; range:string; emoji:string; tint:string; tintFg:string } | null =
    inMigdia ? { id:'M', label:'Servei de migdia', range:'13:00 – 16:00', emoji:'☀️',
                 tint:'var(--clay-50)', tintFg:'var(--clay-700)' } :
    inNit    ? { id:'N', label:'Servei de nit',    range:'19:00 – 23:30', emoji:'🌙',
                 tint:'var(--plum-100)', tintFg:'var(--plum-700)' } :
    null;

  // Time-of-day shell tint — extremely subtle, just a tonal hint
  const todTint =
    hourNow >= 5  && hourNow < 11 ? 'rgba(90,163,192,.025)'   /* matí: sky    */ :
    hourNow >= 18 && hourNow < 22 ? 'rgba(200,97,58,.030)'    /* vespre: terr.*/ :
    hourNow >= 22 || hourNow < 5  ? 'rgba(138,79,118,.025)'   /* nit: plum    */ :
    'transparent';

  // Operator's shift label for rail footer
  const operatorShift: 'M' | 'N' | null = activeShift?.id ?? null;

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  // Triggers a custom 'app:refresh' event so any screen that wants to
  // re-fetch can listen. The visual feedback is what the user perceives;
  // when real network data is wired, the listeners can resolve a Promise
  // and the indicator will spin until they finish.
  const handleRefresh = async () => {
    window.dispatchEvent(new CustomEvent('app:refresh'));
    // The hook itself enforces a minimum visible refresh time
  };
  const pull = usePullToRefresh(handleRefresh);

  // ── FAB scroll-react ────────────────────────────────────────────────────
  // Listens (capture phase) to scroll on any descendant `.scroll` container,
  // tracks scrollTop direction with hysteresis, and toggles `fabHidden` so
  // the FAB shrinks/fades on scroll-down and returns on scroll-up or idle.
  const [fabHidden, setFabHidden] = useState(false);
  useEffect(() => {
    let lastY = 0;
    let idleTimer: number | null = null;
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || !(t instanceof HTMLElement)) return;
      if (!t.classList?.contains('scroll')) return;
      const y = t.scrollTop;
      const dy = y - lastY;
      if (y > 60 && dy > 4)       setFabHidden(true);
      else if (dy < -3 || y < 30) setFabHidden(false);
      lastY = y;
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setFabHidden(false), 1400);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      if (idleTimer !== null) window.clearTimeout(idleTimer);
    };
  }, []);

  // ── Track the true VISUAL viewport height ────────────────────────────────
  // The visual viewport is the area actually visible to the user — it shrinks
  // when iOS Safari's toolbar slides in and grows when it slides out. This
  // is the ONLY value that stays correct across page-load + toolbar state.
  // `100dvh` and `window.innerHeight` both report the LAYOUT viewport on
  // initial load on iOS, which is taller than what the user actually sees,
  // producing the cream gap below the bottom nav.
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const h = vv?.height ?? window.innerHeight;
      setAppH(h);
      // Mirror to a CSS custom property for child elements that need it
      document.documentElement.style.setProperty('--app-h', `${h}px`);
    };
    update();
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    // Run once more after first paint — iOS sometimes reports a stale value
    // synchronously on mount before the toolbar has settled.
    const t = window.setTimeout(update, 50);
    return () => {
      window.clearTimeout(t);
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // ── Swipe L/R to change date on date-aware tabs ───────────────────────────
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  // When a touch starts on an element marked [data-swipeable] (e.g. a
  // SwipeableRow advancing reservation status, or any other gesture-owning
  // surface), the shell-level day-change swipe must NOT also fire. We set
  // this flag at touchstart and check it at touchend.
  const ignoreShellSwipe = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('[data-swipeable]')) {
      ignoreShellSwipe.current = true;
      return;
    }
    ignoreShellSwipe.current = false;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (ignoreShellSwipe.current) {
      ignoreShellSwipe.current = false;
      return;
    }
    // Tables manages its own horizontal swipe (zone change), so only
    // the Reservations tab triggers date change at the shell level.
    if (tab !== 'reservations') return;
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
      {tab === 'reservations' && <TouchReservationsScreen newResTrigger={newResTrigger} hideDateNav={isTablet} />}
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
        background: `linear-gradient(180deg, ${todTint} 0%, transparent 60%), var(--cream)`,
        overflow: 'hidden',
        paddingTop: isStandalone ? 'env(safe-area-inset-top)' : undefined,
      }}>

        {/* ── Left side rail ───────────────────────────────────────────
              Diseño integrado: mismo crema que el main, sin borde duro,
              marca con identidad serif, tabs como tiles + badge en
              Reserves cuando hi ha pendents de confirmar. */}
        <nav style={{
          width: 86, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: 'var(--cream)',
          // Reemplaza el borde duro per una ombra subtil que dóna profunditat
          boxShadow: 'inset -1px 0 0 rgba(60,40,20,.05)',
          paddingTop: 14,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {/* ── Brand block — tile gros + nom curt en mono ─────────── */}
          <button onClick={() => setShowBizPicker(true)} title={`${biz.name} — canviar negoci`}
            style={{
              margin: '0 auto 4px', width: 52, height: 52, borderRadius: 14,
              background: biz.hueSoft, color: biz.hue,
              fontWeight: 600, fontSize: 18, fontFamily: 'var(--font-serif)',
              display: 'grid', placeItems: 'center',
              border: `1px solid ${biz.hue}22`,
              cursor: 'pointer', letterSpacing: -.005,
              boxShadow: '0 1px 2px rgba(60,40,20,.04)',
            }}>
            {biz.monogram}
          </button>
          <div style={{
            textAlign: 'center', fontSize: 9, fontFamily: 'var(--font-mono)',
            color: 'var(--ink-500)', fontWeight: 600, letterSpacing: .12,
            textTransform: 'uppercase', marginBottom: 18,
            padding: '0 4px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {biz.name}
          </div>

          {/* ── Mini KPIs del dia (sempre visibles al rail) ─────── */}
          <div style={{
            margin: '0 10px 12px', padding: '8px 6px',
            background: 'rgba(60,40,20,.025)', borderRadius: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <RailKpi value={totalRes} label="res" />
            <div style={{ width: 22, height: 1, background: 'rgba(60,40,20,.07)' }} />
            <RailKpi value={totalPax} label="pax" />
            <div style={{ width: 22, height: 1, background: 'rgba(60,40,20,.07)' }} />
            <RailKpi value={pendingResCount} label="pend." accent={pendingResCount > 0} />
          </div>

          {/* Hairline separator */}
          <div style={{
            margin: '0 14px 14px', height: 1,
            background: 'rgba(60,40,20,.07)',
          }} />

          {/* ── Tab buttons ──────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px' }}>
            {RAIL_TABS.map(t => {
              const active = tab === t.id;
              const showBadge = t.id === 'reservations' && pendingResCount > 0;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className="nav-btn press"
                  style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    padding: '10px 4px 9px', border: 'none', borderRadius: 12,
                    background: active ? 'var(--paper)' : 'transparent',
                    boxShadow: active ? '0 1px 3px rgba(60,40,20,.06), 0 0 0 1px rgba(60,40,20,.05)' : 'none',
                    color: active ? 'var(--terracotta-700)' : 'var(--ink-500)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Icon d={t.ico} size={22} stroke={active ? 2.1 : 1.6} />
                  <span style={{
                    fontSize: 10, fontWeight: active ? 700 : 550,
                    letterSpacing: .01,
                    color: active ? 'var(--ink-900)' : 'var(--ink-500)',
                  }}>{t.label}</span>
                  {showBadge && (
                    <span style={{
                      position: 'absolute', top: 6, right: 14,
                      minWidth: 16, height: 16, padding: '0 4px',
                      borderRadius: 999,
                      background: 'var(--terracotta-600)', color: '#fff',
                      fontSize: 9.5, fontWeight: 700,
                      display: 'grid', placeItems: 'center',
                      boxShadow: '0 1px 2px rgba(168,74,42,.32)',
                      border: '1.5px solid var(--cream)',
                    }}>{pendingResCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Active user avatar at bottom ───────────────────────── */}
          <div style={{ padding: '14px 12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%', height: 1,
              background: 'rgba(60,40,20,.07)', marginBottom: 10,
            }} />
            <button onClick={() => setShowUserPicker(true)} title={activeEmp?.fullName ?? 'Canviar usuari'}
              style={{
                width: 42, height: 42, borderRadius: 12,
                display: 'grid', placeItems: 'center',
                border: '1px solid rgba(60,40,20,.08)', cursor: 'pointer',
                background: activeEmp ? 'var(--paper)' : 'var(--ink-100)',
                color: activeEmp ? 'var(--ink-900)' : 'var(--ink-500)',
                fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-serif)',
                letterSpacing: -.005,
                boxShadow: '0 1px 2px rgba(60,40,20,.04)',
              }}>
              {activeEmp ? activeEmp.initials : <Icon d={I.users} size={16} />}
            </button>
            {activeEmp && (
              <span style={{
                fontSize: 8.5, color: 'var(--ink-500)', fontWeight: 700,
                letterSpacing: .12, textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%', padding: '0 2px',
              }}>
                {activeEmp.fullName.split(' ')[0]}
              </span>
            )}
            {/* Operator shift indicator (only when an active shift is on) */}
            {operatorShift && (
              <span style={{
                marginTop: 4,
                fontSize: 8.5, fontWeight: 700,
                letterSpacing: .1,
                color: operatorShift === 'M' ? 'var(--clay-700)' : 'var(--plum-700)',
                background: operatorShift === 'M' ? 'var(--clay-50)' : 'var(--plum-100)',
                padding: '2px 7px', borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: 999,
                  background: operatorShift === 'M' ? 'var(--clay-500)' : 'var(--plum-600)',
                }} />
                {operatorShift === 'M' ? 'Migdia' : 'Nit'}
              </span>
            )}
          </div>
        </nav>

        {/* ── Main content ────────────────────────────────────────────── */}
        <main
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <PullIndicator pullY={pull.pullY} refreshing={pull.refreshing} />

          {/* Top date-nav header — present on every tablet screen */}
          <TabletTopBar
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />

          {/* Banner de servei en marxa — només quan toca, discret però visible */}
          {activeShift && (
            <div style={{
              flexShrink: 0,
              margin: '8px 22px 0',
              padding: '8px 14px',
              borderRadius: 10,
              background: activeShift.tint,
              border: `1px solid ${activeShift.id === 'M' ? 'rgba(204,144,73,.22)' : 'rgba(138,79,118,.22)'}`,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12.5,
            }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>{activeShift.emoji}</span>
              <span style={{
                fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500,
                color: activeShift.tintFg, letterSpacing: -.005,
              }}>
                {activeShift.label}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11.5, color: activeShift.tintFg,
                opacity: .75, fontWeight: 600,
              }}>· {activeShift.range}</span>
              <span style={{ flex: 1 }} />
              <span style={{
                fontSize: 11.5, color: activeShift.tintFg, fontWeight: 600,
                letterSpacing: .02,
              }}>
                <span key={`r-${totalRes}`} className="number-tween"
                      style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>
                  {totalRes}
                </span> reserves
                {' · '}
                <span key={`p-${totalPax}`} className="number-tween"
                      style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>
                  {totalPax}
                </span> pax
              </span>
            </div>
          )}

          {screenContent}

          {/* FAB bottom-right — opens new reservation */}
          <button
            onClick={openNewReservation}
            className={`press fab-tablet ${fabHidden ? 'fab-hidden' : ''}`}
            aria-label="Nova reserva"
            style={{
              position: 'absolute',
              right: 28,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
              width: 64, height: 64, borderRadius: 999,
              zIndex: 60,
              background: 'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)',
              color: '#fff',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(168,74,42,.38), 0 2px 6px rgba(168,74,42,.18)',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 280ms var(--ease-out), opacity 220ms var(--ease-out), box-shadow 220ms var(--ease-out)',
            }}>
            <Icon d={I.plus} size={28} stroke={2.4} />
          </button>
        </main>

        {pickers}
        <Toaster />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  //
  // Height strategy:
  //   `appH` comes from window.visualViewport.height (see useEffect above).
  //   This is the ACTUAL visible area at every moment — when the iOS Safari
  //   toolbar is visible appH is the smaller value, when it's hidden appH
  //   grows. We do NOT use 100dvh or innerHeight because both report the
  //   layout viewport on first paint, leaving a cream gap below the nav.
  //
  // Nav strategy: IN-FLOW (flexShrink:0)
  //   Sits at the bottom of the flex column. Because the wrapper is exactly
  //   visualViewport.height tall, the nav always aligns with the visible edge.
  //   paddingBottom:env(safe-area-inset-bottom) fills the home-indicator zone.
  //
  // FAB strategy: position:absolute inside position:relative wrapper
  //   bottom:calc(env(safe-area-inset-bottom)+14px) overlaps the tab bar
  //   from above — the classic "FAB centered on tab bar top" pattern.
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: 'relative',                 // FAB anchor
      display: 'flex', flexDirection: 'column',
      height: `${appH}px`,                  // tracks visualViewport.height live
      width: '100%',
      background: 'var(--cream)', overflow: 'hidden',
    }}>


      {/* ── Top header ──────────────────────────────────────────────── */}
      <header style={{
        paddingTop:    isStandalone ? 'calc(env(safe-area-inset-top) + 14px)' : '54px',
        paddingBottom: '14px',
        paddingLeft:   '18px',
        paddingRight:  '18px',
        borderBottom:  'var(--hair)',
        background:    'var(--cream)',
        flexShrink:    0,
        display:       'flex',
        alignItems:    'flex-end',
        gap:           12,
      }}>
        <button onClick={() => setShowUserPicker(true)}
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: activeEmp ? 'var(--terracotta-600)' : 'var(--ink-200)',
            color: activeEmp ? '#fff' : 'var(--ink-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-serif)',
            border: 'none', cursor: 'pointer',
          }}>
          {activeEmp ? activeEmp.initials : <Icon d={I.users} size={16} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <button onClick={() => setShowBizPicker(true)} style={{
            fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
            letterSpacing: 0.4, textTransform: 'uppercase',
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', fontFamily: 'inherit', display: 'block',
          }}>
            {biz.name.toUpperCase()}
          </button>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500,
            color: 'var(--ink-900)', letterSpacing: -0.3, lineHeight: 1.1, marginTop: 2,
          }}>
            {TAB_TITLES[tab]}
          </div>
        </div>

        <button onClick={() => setTab('more')}
          style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(60,40,20,.14)',
            background: tab === 'more' ? 'var(--terracotta-50)' : 'var(--paper)',
            color: tab === 'more' ? 'var(--terracotta-600)' : 'var(--ink-500)',
            cursor: 'pointer',
          }}>
          <Icon d={I.dotsH} size={18} stroke={1.8} />
        </button>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <PullIndicator pullY={pull.pullY} refreshing={pull.refreshing} />
        {screenContent}
      </main>

      {/* ── In-flow bottom nav ──────────────────────────────────────── */}
      {/*   flexShrink:0 keeps it at exact tab height at the bottom.    */}
      {/*   paddingBottom fills the home-indicator / gesture-bar zone.  */}
      <nav style={{
        flexShrink: 0,
        zIndex: 50,
        background: '#ffffff',
        borderTop: '1px solid rgba(60,40,20,.08)',
        display: 'flex', alignItems: 'flex-start',
        paddingTop: 6,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft:  'env(safe-area-inset-left,  0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}>
        {MOB_LEFT_TABS.map(t => (
          <MobNavBtn key={t.id} id={t.id} tab={tab} setTab={setTab} label={t.label} ico={t.ico} />
        ))}
        <div style={{ width: 68, flexShrink: 0 }} aria-hidden />
        {MOB_RIGHT_TABS.map(t => (
          <MobNavBtn key={t.id} id={t.id} tab={tab} setTab={setTab} label={t.label} ico={t.ico} />
        ))}
      </nav>

      {/* ── FAB — absolute, overlaps the center of the tab bar ─────── */}
      <button
        onClick={openNewReservation}
        className={`press fab-mobile ${fabHidden ? 'fab-hidden' : ''}`}
        aria-label="Nova reserva"
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
          transform: 'translateX(-50%)',
          width: 60, height: 60, borderRadius: 999,
          zIndex: 60,
          background: 'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)',
          color: '#fff',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          // Layered shadow gives lift without the dated white-ring outline
          boxShadow:
            '0 0 0 4px var(--cream),' +              /* "halo" cut from bg (no hard ring) */
            ' 0 6px 18px rgba(168,74,42,.42),' +
            ' 0 2px 4px rgba(168,74,42,.22)',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform 280ms var(--ease-out), opacity 220ms var(--ease-out), box-shadow 220ms var(--ease-out)',
        }}>
        <Icon d={I.plus} size={26} stroke={2.4} />
      </button>

      {pickers}
      <Toaster />
    </div>
  );
}

// ─── Mobile nav button (new design: dark icon when active, terracotta label) ──
function MobNavBtn({ id, tab, setTab, label, ico }: {
  id: TouchTab; tab: TouchTab; setTab: (t: TouchTab) => void;
  label: string; ico: React.ReactNode;
}) {
  const active = tab === id;
  return (
    <button onClick={() => setTab(id)} className="nav-btn press"
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3,
        background: 'transparent', border: 'none', padding: '8px 0 6px',
        cursor: 'pointer', minHeight: 50,
        WebkitTapHighlightColor: 'transparent',
        color: active ? 'var(--ink-900)' : 'var(--ink-400)',
      }}>
      <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
        <Icon d={ico} size={22} stroke={active ? 2.1 : 1.6} />
      </div>
      <span style={{
        fontSize: 10.5, fontWeight: active ? 650 : 500,
        color: active ? 'var(--terracotta-700)' : 'var(--ink-500)',
        letterSpacing: 0.05, lineHeight: 1,
      }}>{label}</span>
    </button>
  );
}

// ─── Tablet rail nav button — unchanged ──────────────────────────────────────
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

// ─── Pull-to-refresh indicator — circular progress while pulling, spinning
// while refreshing. Sized by current pullY so it grows with the gesture.
function PullIndicator({ pullY, refreshing }: { pullY: number; refreshing: boolean }) {
  if (pullY <= 0 && !refreshing) return null;
  const progress = Math.min(pullY / PULL_THRESHOLD_PX, 1);
  // Stroke-dasharray progress on a 26px circle (radius 11)
  const C = 2 * Math.PI * 11; // ≈ 69.115
  const dashOffset = C * (1 - progress);
  return (
    <div className="ptr-indicator" style={{ height: pullY, opacity: Math.min(progress + 0.15, 1) }}>
      <svg className={`ptr-indicator__circle ${refreshing ? 'ptr-indicator__circle--spinning' : ''}`}
           viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="13" r="11" stroke="rgba(168,74,42,.15)" strokeWidth="2.5" />
        <circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={refreshing ? C * 0.65 : dashOffset}
                transform="rotate(-90 13 13)" />
      </svg>
      <span className="ptr-indicator__label">
        {refreshing
          ? 'Actualitzant…'
          : progress >= 1 ? 'Allibera per actualitzar'
          : 'Estira per actualitzar'}
      </span>
    </div>
  );
}

// ─── Rail KPI — vertical mini stat shown under the brand block ──────────────
// The number itself is keyed so it re-mounts on each value change, replaying
// the .number-tween keyframes (drop-in from above with a short blur). The
// label stays static.
function RailKpi({ value, label, accent }: {
  value: number; label: string; accent?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
      lineHeight: 1,
    }}>
      <span
        key={value}
        className="number-tween"
        style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
          color: accent && value > 0 ? 'var(--terracotta-700)' : 'var(--ink-900)',
          letterSpacing: -.005,
          transition: 'color 220ms var(--ease-in-out)',
        }}
      >{value}</span>
      <span style={{
        fontSize: 8.5, fontWeight: 700, letterSpacing: .08,
        color: accent && value > 0 ? 'var(--terracotta-600)' : 'var(--ink-500)',
        textTransform: 'uppercase',
        transition: 'color 220ms var(--ease-in-out)',
      }}>{label}</span>
    </div>
  );
}

// ─── Tablet top bar — global date navigator (matches mockup) ────────────────
const DAYS_CA   = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
const MONTHS_CA = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];

function TabletTopBar({
  selectedDate, setSelectedDate,
}: {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
}) {
  const d = selectedDate;
  // Local-date ISO (avoids UTC off-by-one in CET/CEST)
  const localIso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  const todayIso = localIso(new Date());
  const selIso   = localIso(d);
  const isToday  = todayIso === selIso;
  const dayLabel = `${DAYS_CA[d.getDay()]}, ${d.getDate()} de ${MONTHS_CA[d.getMonth()]}`;

  function shiftDay(delta: number) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + delta);
    setSelectedDate(nd);
  }

  return (
    <header style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 22px',
      background: 'var(--cream)',
      borderBottom: '1px solid rgba(60,40,20,.06)',
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
    }}>
      {/* Prev day */}
      <button onClick={() => shiftDay(-1)} className="day-btn press"
        aria-label="Dia anterior"
        style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--paper)', border: '1px solid rgba(60,40,20,.10)',
          color: 'var(--ink-700)', cursor: 'pointer',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: 'var(--sh-1)',
        }}>
        <Icon d={I.chevL} size={18} stroke={2} />
      </button>

      {/* Date label — clicable, opens native date picker */}
      <label style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        cursor: 'pointer', position: 'relative',
        padding: '6px 14px', borderRadius: 10,
        transition: 'background 160ms var(--ease-ios)',
      }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(60,40,20,.04)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.005, textTransform: 'capitalize',
        }}>
          {dayLabel}
        </span>
        <span style={{ color: 'var(--ink-500)', display: 'flex' }}>
          <Icon d={I.calendar} size={16} stroke={1.7} />
        </span>
        {/* Hidden native date input — tapping the label opens the picker */}
        <input type="date"
          value={selIso}
          onChange={e => {
            if (!e.target.value) return;
            const [y, m, dd] = e.target.value.split('-').map(Number);
            setSelectedDate(new Date(y, (m || 1) - 1, dd || 1));
          }}
          style={{
            position: 'absolute', inset: 0,
            opacity: 0, cursor: 'pointer',
            border: 'none', background: 'transparent',
            color: 'transparent', fontFamily: 'inherit',
          }}
        />
      </label>

      {/* Next day */}
      <button onClick={() => shiftDay(1)} className="day-btn press"
        aria-label="Dia següent"
        style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--paper)', border: '1px solid rgba(60,40,20,.10)',
          color: 'var(--ink-700)', cursor: 'pointer',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: 'var(--sh-1)',
        }}>
        <Icon d={I.chevR} size={18} stroke={2} />
      </button>

      {/* Avui button — only when not today */}
      <button onClick={() => setSelectedDate(new Date())}
        disabled={isToday}
        className="press"
        style={{
          padding: '0 16px', height: 38, borderRadius: 10,
          border: '1.5px solid var(--terracotta-500)',
          background: isToday ? 'transparent' : 'var(--terracotta-50)',
          color: 'var(--terracotta-700)',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          cursor: isToday ? 'default' : 'pointer',
          opacity: isToday ? .5 : 1,
          flexShrink: 0,
        }}>
        Avui
      </button>
    </header>
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
