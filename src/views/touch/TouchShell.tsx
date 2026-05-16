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
import React, { useState, useEffect, useRef, useMemo } from 'react';
import AnimatedSheet from '@/components/shared/AnimatedSheet';
import DatePickerPopover from '@/components/shared/DatePickerPopover';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, avIdx } from '@/data/mockData';
import { useVisibleBusinesses } from '@/store/usePinScope';
import { useDevice } from '@/hooks/useDevice';
import { usePullToRefresh, PULL_THRESHOLD_PX } from '@/hooks/usePullToRefresh';
import Toaster, { toast } from '@/components/shared/Toaster';
import SearchSheet from '@/components/shared/SearchSheet';
import WaitlistSheet from '@/components/shared/WaitlistSheet';
import WeatherWidget from '@/components/shared/WeatherWidget';
import { NotesSheet } from '@/views/touch/NotesSystem';
import {
  fetchForecast, DEFAULT_COORDS,
  type WeatherForecast, type WxCondition,
} from '@/lib/weather';
import type { Employee, EmployeeRole, BusinessId, Reservation } from '@/types';

// ── Touch screens — shared between mobile and tablet ─────────────────────────
import TouchReservationsScreen, { LiveServicePill } from '@/views/mobile/TodayView';
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

// Side-rail entries on tablet. Some entries open a sheet instead of switching
// tabs (e.g. "Espera"); the renderer reads `kind` to decide which onClick to
// wire. Add or reorder entries here — the rail scrolls vertically when there
// isn't enough room to fit them all.
type RailEntry =
  | { kind: 'tab';   id: TouchTab; label: string; ico: React.ReactNode }
  | { kind: 'sheet'; id: 'waitlist'; label: string; ico: React.ReactNode };

const RAIL_ENTRIES: RailEntry[] = [
  { kind: 'tab',   id: 'reservations', label: 'Reserves', ico: I.calendar },
  { kind: 'tab',   id: 'walkin',       label: 'Walk-in',  ico: I.walkin },
  { kind: 'sheet', id: 'waitlist',     label: 'Espera',   ico: I.clock },
  { kind: 'tab',   id: 'clients',      label: 'Clients',  ico: I.users },
  { kind: 'tab',   id: 'tables',       label: 'Taules',   ico: I.tableIco },
  { kind: 'tab',   id: 'more',         label: 'Més',      ico: I.dotsH },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function TouchShell() {
  const [tab, setTab]                       = useState<TouchTab>('reservations');
  const [showBizPicker,  setShowBizPicker]  = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showNotesSheet, setShowNotesSheet] = useState(false);
  const [showSearch,     setShowSearch]     = useState(false);
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
    closeOutPastDays,
    showWaitlist, setShowWaitlist,
    setSelectedReservation,
    waitlist,
  } = useAppStore();

  // Close out yesterday automatically — runs once on mount, when the tab
  // becomes visible again (operator left the iPad on overnight), and any time
  // selectedDate changes (so navigating into today triggers cleanup too).
  useEffect(() => {
    closeOutPastDays();
    const onVis = () => { if (!document.hidden) closeOutPastDays(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [closeOutPastDays]);
  useEffect(() => { closeOutPastDays(); }, [selectedDate, closeOutPastDays]);

  const { isTablet, isStandalone, isLargeScreen } = useDevice();
  // Large touch screen (≥1280px wide and touch) — typical restaurant
  // counter-top monitor or kiosk. Bumps rail width, icon/label sizes and
  // tap targets so the operator can hit them reliably while standing.
  const railWide = isLargeScreen;
  const visibleBusinesses = useVisibleBusinesses();
  const biz       = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const activeEmp = employees.find(e => e.id === activeEmployeeId) ?? null;

  // ── Day-aware metrics + shift detection ─────────────────────────────────
  const dayIso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;
  const dayResAll = reservations.filter(r =>
    r.bizId === selectedBusiness && r.date === dayIso,
  );
  const pendingResCount = dayResAll.filter(r => r.status === 'pending').length;
  // Queue badge reflects only the currently-viewed day — queues are inherently
  // a per-day, real-time concept.
  const waitlistCountForBiz = waitlist.filter(w => {
    if (w.bizId !== selectedBusiness) return false;
    const d = new Date(w.addedAt);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return iso === dayIso;
  }).length;
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
  // Honest pull-to-refresh: while no cloud round-trip is wired in, the gesture
  // still re-evaluates derived data (auto-close past days) and shows a toast
  // so the user knows their action was acknowledged. When real cloud sync
  // exists, this is the natural place to await it and surface errors.
  const handleRefresh = async () => {
    window.dispatchEvent(new CustomEvent('app:refresh'));
    closeOutPastDays();
    toast('Tot al dia', { icon: 'check', tone: 'olive', ms: 1600 });
  };
  const pull = usePullToRefresh(handleRefresh);

  // ── FAB visibility ──────────────────────────────────────────────────────
  // The FAB shrinks/fades on scroll-down (returns on scroll-up or idle) AND
  // hides while any bottom sheet is open — sheets often have action buttons
  // at the bottom that the FAB would otherwise obscure.
  const [fabHidden, setFabHidden] = useState(false);
  const [openSheets, setOpenSheets] = useState(0);
  useEffect(() => {
    const onOpen  = () => setOpenSheets(n => n + 1);
    const onClose = () => setOpenSheets(n => Math.max(0, n - 1));
    window.addEventListener('app:sheet:opened', onOpen);
    window.addEventListener('app:sheet:closed', onClose);
    return () => {
      window.removeEventListener('app:sheet:opened', onOpen);
      window.removeEventListener('app:sheet:closed', onClose);
    };
  }, []);
  const fabSuppressed = fabHidden || openSheets > 0;
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
    // Stricter intent: require ≥90 px of horizontal travel AND a dominant
    // horizontal component (dx must beat dy by 1.8×). Previously a 50 px
    // / 1.5× threshold was triggering on casual horizontal drift while
    // the operator was actually scrolling vertically.
    if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + (dx < 0 ? 1 : -1));
    setSelectedDate(next);
  };

  // ── Shared: screen content (remounts on tab change for enter animation) ───
  // On a large touchscreen (≥1280 px wide, e.g. the 1920 px restaurant
  // counter monitor) we cap the visible content width to ~1100 px and
  // centre it, so reservation rows / walk-in PAX grids / settings cards
  // don't stretch into uncomfortable giants. The Taules tab opts out
  // because the floor-plan canvas needs every pixel.
  const capMain = isLargeScreen && tab !== 'tables';
  const screenContent = (
    <div key={tab} className="tab-enter"
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        ...(capMain ? {
          maxWidth: 1100, width: '100%', alignSelf: 'center',
          // Treat the centered content as a single card on the cream
          // canvas so the paper-coloured inner panels stop creating a
          // hard vertical edge against the cream surround. Soft top
          // rounding only — the bottom blends into the page scroll.
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          background: 'var(--surface-base)',
          boxShadow: '0 1px 0 rgba(60,40,20,.04), 0 8px 28px rgba(60,40,20,.05)',
          marginTop: 12,
        } : null),
      }}>
      {tab === 'reservations' && (
        <TouchReservationsScreen
          newResTrigger={newResTrigger}
          hideDateNav={isTablet}
          onOpenNotes={() => setShowNotesSheet(true)}
        />
      )}
      {tab === 'tables'       && <TouchTablesScreen />}
      {tab === 'walkin'       && <TouchWalkInScreen onSwitchTab={setTab} />}
      {tab === 'clients'      && <TouchClientsScreen />}
      {tab === 'more'         && (
        <TouchMoreScreen
          onSwitchTab={setTab}
          onOpenNotes={() => setShowNotesSheet(true)}
          onSwitchUser={() => setShowUserPicker(true)}
        />
      )}
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
              Uses the new matte "rail" surface — slightly warmer + darker
              than the canvas so the content area visually advances. The
              inset shadow on the right edge gives a soft "the content sits
              in front" reading without a hard border. */}
        <nav className="surface-rail" style={{
          width: railWide ? 128 : 86, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          paddingTop: railWide ? 18 : 14,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {/* ── Brand block — tile gros + nom curt en mono ─────────── */}
          <button onClick={() => setShowBizPicker(true)} title={`${biz.name} — canviar negoci`}
            style={{
              flexShrink: 0,
              margin: '0 auto 4px',
              width: railWide ? 64 : 52, height: railWide ? 64 : 52,
              borderRadius: railWide ? 16 : 14,
              background: biz.hueSoft, color: biz.hue,
              fontWeight: 600, fontSize: railWide ? 22 : 18, fontFamily: 'var(--font-serif)',
              display: 'grid', placeItems: 'center',
              border: `1px solid ${biz.hue}22`,
              cursor: 'pointer', letterSpacing: -.005,
              boxShadow: '0 1px 2px rgba(60,40,20,.04)',
            }}>
            {biz.monogram}
          </button>
          <div style={{
            flexShrink: 0,
            textAlign: 'center', fontSize: railWide ? 10.5 : 9, fontFamily: 'var(--font-mono)',
            color: 'var(--ink-500)', fontWeight: 600, letterSpacing: .12,
            textTransform: 'uppercase', marginBottom: railWide ? 22 : 18,
            padding: '0 4px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {biz.name}
          </div>

          {/* ── Mini KPIs del dia (sempre visibles al rail) ─────── */}
          <div style={{
            flexShrink: 0,
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
            flexShrink: 0,
            margin: '0 14px 14px', height: 1,
            background: 'rgba(60,40,20,.07)',
          }} />

          {/* ── Tab buttons — vertical-scrollable so any number fits ── */}
          <div
            className="scroll rail-scroll"
            style={{
              flex: 1, minHeight: 0,
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '0 10px 8px',
              overflowY: 'auto',
              // Smooth fade at the bottom edge as a hint that there's more
              maskImage: 'linear-gradient(180deg, #000 0%, #000 calc(100% - 14px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 calc(100% - 14px), transparent 100%)',
            }}>
            {RAIL_ENTRIES.map(entry => {
              // For tab entries: active state + on-click swaps tab.
              // For sheet entries (currently Espera): always non-active, on-click opens sheet.
              const isTab = entry.kind === 'tab';
              const active = isTab && tab === entry.id;
              const onClick = isTab
                ? () => setTab(entry.id)
                : () => { if (entry.id === 'waitlist') setShowWaitlist(true); };

              // Badge sources: pending reservations for Reserves; queue size for Espera.
              const badge =
                isTab && entry.id === 'reservations' ? pendingResCount :
                !isTab && entry.id === 'waitlist'    ? waitlistCountForBiz :
                0;

              return (
                <button key={entry.id} onClick={onClick} className="nav-btn press"
                  style={{
                    position: 'relative', flexShrink: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: railWide ? 7 : 5,
                    padding: railWide ? '14px 6px 13px' : '10px 4px 9px',
                    border: 'none', borderRadius: railWide ? 14 : 12,
                    background: active ? 'var(--surface-elevated)' : 'transparent',
                    boxShadow: active
                      ? 'var(--shadow-md), var(--shadow-ring), var(--shadow-inset-top)'
                      : 'none',
                    color: active ? 'var(--ink-900)' : 'var(--ink-500)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    minHeight: railWide ? 64 : undefined,
                  }}>
                  <Icon d={entry.ico} size={railWide ? 28 : 22} stroke={active ? 2.1 : 1.6} />
                  <span style={{
                    fontSize: railWide ? 12 : 10, fontWeight: active ? 700 : 550,
                    letterSpacing: .01,
                    color: active ? 'var(--ink-900)' : 'var(--ink-500)',
                  }}>{entry.label}</span>
                  {badge > 0 && (
                    <span style={{
                      position: 'absolute', top: 6, right: 14,
                      minWidth: 16, height: 16, padding: '0 4px',
                      borderRadius: 999,
                      background: 'var(--terracotta-600)', color: '#fff',
                      fontSize: 9.5, fontWeight: 700,
                      display: 'grid', placeItems: 'center',
                      boxShadow: '0 1px 2px rgba(168,74,42,.32)',
                      border: '1.5px solid var(--cream)',
                    }}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Search button — sits just above the avatar ───────── */}
          <div style={{ flexShrink: 0, padding: '0 12px 10px', display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setShowSearch(true)} title="Cerca global"
              className="press"
              style={{
                width: railWide ? 54 : 42, height: railWide ? 54 : 42,
                borderRadius: railWide ? 14 : 12,
                display: 'grid', placeItems: 'center',
                border: '1px solid rgba(60,40,20,.08)', cursor: 'pointer',
                background: 'var(--paper)', color: 'var(--ink-700)',
                boxShadow: '0 1px 2px rgba(60,40,20,.04)',
              }}>
              <Icon d={I.search} size={railWide ? 22 : 16} stroke={1.9} />
            </button>
          </div>

          {/* ── Active user avatar at bottom ───────────────────────── */}
          <div style={{ flexShrink: 0, padding: '14px 12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%', height: 1,
              background: 'rgba(60,40,20,.07)', marginBottom: 10,
            }} />
            <button onClick={() => setShowUserPicker(true)} title={activeEmp?.fullName ?? 'Canviar usuari'}
              style={{
                width: railWide ? 54 : 42, height: railWide ? 54 : 42,
                borderRadius: railWide ? 14 : 12,
                display: 'grid', placeItems: 'center',
                border: '1px solid rgba(60,40,20,.08)', cursor: 'pointer',
                background: activeEmp ? 'var(--paper)' : 'var(--ink-100)',
                color: activeEmp ? 'var(--ink-900)' : 'var(--ink-500)',
                fontWeight: 700, fontSize: railWide ? 14 : 12, fontFamily: 'var(--font-serif)',
                letterSpacing: -.005,
                boxShadow: '0 1px 2px rgba(60,40,20,.04)',
              }}>
              {activeEmp ? activeEmp.initials : <Icon d={I.users} size={railWide ? 20 : 16} />}
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

          {/* Banner de servei en marxa — només quan toca, discret però visible.
              On large touchscreens (capMain) the LiveSidePanel on the right
              already shows the active shift + the day's reserves/pax KPIs,
              so we hide this full-width banner to avoid (a) duplicating
              the info and (b) overlapping the side panels which extend
              into the banner's horizontal margin. */}
          {activeShift && !capMain && (
            <div style={{
              position: 'relative',
              flexShrink: 0,
              margin: '10px 22px 0',
              padding: '9px 14px 9px 16px',
              borderRadius: 12,
              // Paper surface + subtle tint wash + colored left accent —
              // matches the new visual language used by insight chips and
              // the waitlist banner. The previous full tint fill was loud.
              background: `linear-gradient(180deg, var(--surface-elevated) 0%, var(--surface-elevated) 65%), ${activeShift.tint}`,
              boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12.5,
              overflow: 'hidden',
            }}>
              {/* Shift accent bar — clay for migdia, plum for nit */}
              <span aria-hidden style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                background: activeShift.id === 'M' ? 'var(--clay-500)' : 'var(--plum-600)',
              }} />
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

          {/* Side accent panels — only on large touchscreens. Fill the empty
              space on either side of the centered content with quiet,
              "alive" widgets (live clock, current shift). The cream tint
              and the time-of-day glow already live underneath; these
              cards just give the operator something to glance at when
              looking up from the form. */}
          {capMain && (
            <>
              <OpsLeftPanel
                reservations={dayResAll}
                waitlistCount={waitlistCountForBiz}
                onOpenWaitlist={() => setShowWaitlist(true)}
                onOpenReservation={r => { setSelectedReservation(r); setTab('reservations'); }}
              />
              <LiveSidePanel
                activeShift={activeShift}
                totalRes={totalRes}
                totalPax={totalPax}
                pendingResCount={pendingResCount}
                selectedDate={selectedDate}
              />
            </>
          )}

          {/* FAB bottom-right — opens new reservation */}
          <button
            onClick={openNewReservation}
            className={`press fab-tablet ${fabSuppressed ? 'fab-hidden' : ''}`}
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
        <NotesSheet
          open={showNotesSheet}
          bizId={selectedBusiness}
          date={selectedDate}
          authorName={activeEmp?.fullName ?? ''}
          onClose={() => setShowNotesSheet(false)}
        />
        <SearchSheet
          open={showSearch}
          onClose={() => setShowSearch(false)}
          onNavigate={t => setTab(t)}
        />
        <WaitlistSheet
          open={showWaitlist}
          onClose={() => setShowWaitlist(false)}
          onSeated={(res) => {
            // Jump to Reserves with the newly-seated walk-in selected so the
            // operator can immediately assign a table from the detail sheet.
            setSelectedDate(new Date(res.date + 'T00:00:00'));
            setSelectedReservation(res);
            setTab('reservations');
          }}
        />
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
      // Transparent so the body's atmospheric gradient shows through.
      overflow: 'hidden',
    }}>


      {/* ── Top header ── glass material so the canvas gradient shows
            through with a soft blur. Bottom inset shadow replaces the
            hairline border for a softer plane separation. */}
      <header style={{
        paddingTop:    isStandalone ? 'calc(env(safe-area-inset-top) + 14px)' : '54px',
        paddingBottom: '14px',
        paddingLeft:   '18px',
        paddingRight:  '18px',
        background:    'rgba(255,255,255,.55)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        backdropFilter:       'blur(16px) saturate(140%)',
        boxShadow:     'inset 0 -1px 0 rgba(40,28,16,.06), 0 1px 0 rgba(255,255,255,.4)',
        flexShrink:    0,
        display:       'flex',
        alignItems:    'flex-end',
        gap:           12,
        position:      'relative',
        zIndex:        5,
      }}>
        <button onClick={() => setShowUserPicker(true)}
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            // Soft ink gradient + ring instead of solid terracotta — the
            // avatar identifies WHO without screaming a brand color.
            background: activeEmp
              ? 'linear-gradient(160deg, var(--ink-700) 0%, var(--ink-800) 100%)'
              : 'var(--ink-200)',
            color: activeEmp ? '#fef9ee' : 'var(--ink-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-serif)',
            border: 'none', cursor: 'pointer',
            boxShadow: 'var(--shadow-sm), var(--shadow-inset-top)',
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

        <WeatherWidget compact />
        <button onClick={() => setShowSearch(true)} aria-label="Cerca"
          style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(60,40,20,.14)',
            background: 'var(--paper)', color: 'var(--ink-500)',
            cursor: 'pointer',
          }}>
          <Icon d={I.search} size={17} stroke={2} />
        </button>
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
        // Glass material — translucent paper + backdrop blur, so the canvas
        // gradient shows through softly. Replaces the flat white + hairline
        // top border.
        background: 'rgba(255,255,255,.78)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        backdropFilter: 'blur(20px) saturate(140%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6), 0 -8px 24px rgba(40,28,16,.06)',
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
        className={`press fab-mobile ${fabSuppressed ? 'fab-hidden' : ''}`}
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
      <NotesSheet
        open={showNotesSheet}
        bizId={selectedBusiness}
        date={selectedDate}
        authorName={activeEmp?.fullName ?? ''}
        onClose={() => setShowNotesSheet(false)}
      />
      <SearchSheet
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onNavigate={t => setTab(t)}
      />
      <WaitlistSheet
        open={showWaitlist}
        onClose={() => setShowWaitlist(false)}
        onSeated={(res) => {
          setSelectedDate(new Date(res.date + 'T00:00:00'));
          setSelectedReservation(res);
          setTab('reservations');
        }}
      />
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

  // Custom date popover state. Anchored to the date label below.
  const labelRef = useRef<HTMLLabelElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
      // Glass material on top of the canvas — translucent paper with a real
      // backdrop blur. Soft inset bottom shadow as a separator instead of a
      // hard border. Reads as "the content scrolls under the header".
      background: 'rgba(255,255,255,.55)',
      WebkitBackdropFilter: 'blur(16px) saturate(140%)',
      backdropFilter: 'blur(16px) saturate(140%)',
      boxShadow: 'inset 0 -1px 0 rgba(40,28,16,.06), 0 1px 0 rgba(255,255,255,.4)',
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
      position: 'relative', zIndex: 5,
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

      {/* Date label — opens the custom DatePickerPopover anchored below.
          Pointer events drive the hover/press tint so the highlight ALSO
          fires on desktop touchscreens (they emit pointerenter/leave but
          no mouseenter/leave from a finger tap). */}
      <label
        ref={labelRef}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          cursor: 'pointer', position: 'relative',
          padding: '6px 14px', borderRadius: 10,
          transition: 'background 160ms var(--ease-ios)',
        }}
        onClick={() => setPickerOpen(o => !o)}
        onPointerEnter={e => (e.currentTarget.style.background = 'rgba(60,40,20,.04)')}
        onPointerLeave={e => (e.currentTarget.style.background = 'transparent')}
        onPointerDown={e => (e.currentTarget.style.background = 'rgba(60,40,20,.08)')}
        onPointerUp={e => (e.currentTarget.style.background = 'rgba(60,40,20,.04)')}
      >
        {isToday && <LiveServicePill />}
        <span key={selIso} className="date-label-in" style={{
          fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.005, textTransform: 'capitalize',
        }}>
          {dayLabel}
        </span>
        <span style={{ color: 'var(--ink-500)', display: 'flex' }}>
          <Icon d={I.calendar} size={16} stroke={1.7} />
        </span>
      </label>

      <DatePickerPopover
        open={pickerOpen}
        selected={d}
        onSelect={setSelectedDate}
        onClose={() => setPickerOpen(false)}
        anchorRef={labelRef}
      />

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

      {/* Weather pill — forecast for the selected day */}
      <WeatherWidget />

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
  const { reservations } = useAppStore();
  const visibleBusinesses = useVisibleBusinesses();
  const todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const hourNow = new Date().getHours() + new Date().getMinutes() / 60;
  const inMigdia = hourNow >= 13 && hourNow < 16;
  const inNit    = hourNow >= 19 && hourNow < 23.5;

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={500}>
      <div style={{
        width: '100%',
        background: 'linear-gradient(180deg, var(--paper) 0%, var(--ink-50) 100%)',
        borderRadius: '22px 22px 0 0',
        padding: '10px 16px 28px',
        boxShadow: '0 -8px 32px rgba(60,40,20,.18)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
      }}>
        <div style={{
          width: 38, height: 4, borderRadius: 2,
          background: 'var(--ink-200)', margin: '8px auto 16px',
        }} />

        {/* Header — serif title + mono subtitle */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '0 4px', marginBottom: 18,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
            }}>
              Quin negoci?
            </div>
            <div style={{
              fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
              letterSpacing: .08, textTransform: 'uppercase', marginTop: 4,
              fontFamily: 'var(--font-mono)',
            }}>
              {visibleBusinesses.length} actius · canvia el context
            </div>
          </div>
          <button onClick={onClose} aria-label="Tancar"
            className="press"
            style={{
              width: 34, height: 34, borderRadius: 999,
              background: 'var(--cream)', border: '1px solid rgba(60,40,20,.08)',
              cursor: 'pointer', color: 'var(--ink-600)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
            <Icon d={I.x} size={15} />
          </button>
        </div>

        {/* Business cards — staggered entrance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleBusinesses.map((b, i) => {
            const isCur = b.id === current;
            const dayRes = reservations.filter(r => r.bizId === b.id && r.date === todayIso);
            const totalRes = dayRes.length;
            const totalPax = dayRes.reduce((s, r) => s + r.pax, 0);
            const seated   = dayRes.filter(r => r.status === 'seated').length;
            const shiftLbl = inMigdia ? 'Servei migdia' : inNit ? 'Servei nit' : 'Fora servei';
            const shiftColor = inMigdia
              ? { bg: 'var(--clay-50)', fg: 'var(--clay-700)', dot: 'var(--clay-500)' }
              : inNit
                ? { bg: 'var(--plum-100)', fg: 'var(--plum-700)', dot: 'var(--plum-600)' }
                : { bg: 'var(--ink-100)', fg: 'var(--ink-500)', dot: 'var(--ink-400)' };
            return (
              <div key={b.id}
                className="row-stagger"
                style={{ ['--row-i' as string]: i }}>
                <button onClick={() => onSelect(b.id)}
                  className="press"
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 10,
                    width: '100%', padding: '14px 14px 12px',
                    border: isCur ? `1.5px solid ${b.hue}` : '1px solid rgba(60,40,20,.08)',
                    borderRadius: 14,
                    background: isCur
                      ? `linear-gradient(180deg, ${b.hueSoft} 0%, var(--paper) 100%)`
                      : 'var(--paper)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    boxShadow: isCur
                      ? `0 2px 8px ${b.hue}22, 0 1px 2px rgba(60,40,20,.04)`
                      : '0 1px 2px rgba(60,40,20,.04)',
                    transition: 'background 220ms var(--ease-in-out), border-color 220ms var(--ease-in-out), box-shadow 220ms var(--ease-in-out)',
                  }}>
                  {/* Top row: monogram + name + kind + check */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width: 46, height: 46, borderRadius: 12,
                      background: b.hueSoft, color: b.hue,
                      fontWeight: 600, fontSize: 17, fontFamily: 'var(--font-serif)',
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                      letterSpacing: -.005,
                      border: `1px solid ${b.hue}22`,
                    }}>
                      {b.monogram}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500,
                        color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
                      }}>
                        {b.name}
                      </div>
                      <div style={{
                        fontSize: 10.5, color: 'var(--ink-500)', fontWeight: 600,
                        letterSpacing: .08, textTransform: 'uppercase', marginTop: 3,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {b.kind ?? 'Negoci'}
                      </div>
                    </div>
                    {isCur && (
                      <span style={{
                        width: 26, height: 26, borderRadius: 999,
                        background: b.hue, color: '#fff',
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                        boxShadow: `0 2px 6px ${b.hue}55`,
                      }}>
                        <Icon d={I.check} size={14} stroke={2.6} />
                      </span>
                    )}
                  </div>

                  {/* KPI strip — inline metrics + shift indicator */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    paddingTop: 10,
                    borderTop: '1px dashed rgba(60,40,20,.10)',
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 999,
                      background: shiftColor.bg, color: shiftColor.fg,
                      fontSize: 10.5, fontWeight: 700, letterSpacing: .03,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: 999, background: shiftColor.dot }} />
                      {shiftLbl}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-500)', fontWeight: 600 }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-900)', fontWeight: 500 }}>
                        {totalRes}
                      </span>{' '}res
                      <span style={{ color: 'var(--ink-300)', margin: '0 5px' }}>·</span>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-900)', fontWeight: 500 }}>
                        {totalPax}
                      </span>{' '}pax
                      {seated > 0 && (
                        <>
                          <span style={{ color: 'var(--ink-300)', margin: '0 5px' }}>·</span>
                          <span style={{ color: 'var(--terracotta-700)', fontWeight: 700 }}>
                            {seated} a taula
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </AnimatedSheet>
  );
}

// ─── User picker sheet — elevated, with clocked-in status + role hierarchy ───
function UserPickerSheet({ open, bizId, employees, employeeRoles, activeEmployeeId, onSelect, onClose }: {
  open: boolean; bizId: BusinessId;
  employees: Employee[]; employeeRoles: EmployeeRole[];
  activeEmployeeId: string | null;
  onSelect: (id: string | null) => void; onClose: () => void;
}) {
  const bizEmps = employees.filter(e => e.bizId === bizId && e.active);
  const roleMap = Object.fromEntries(employeeRoles.map(r => [r.id, r]));
  const sorted  = [...bizEmps].sort((a, b) => (roleMap[a.roleId]?.order ?? 99) - (roleMap[b.roleId]?.order ?? 99));

  // How many are clocked in right now — shown in the header subtitle
  const inCount = bizEmps.filter(e => e.clockedIn).length;

  // Format an HH:MM "started X ago" for clocked-in operators
  const startedLabel = (startedAt?: string | null) => {
    if (!startedAt) return null;
    try {
      const t = new Date(startedAt);
      const diff = Math.max(0, Date.now() - t.getTime());
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `Des de fa ${mins} min`;
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem === 0 ? `Des de fa ${hrs}h` : `Des de fa ${hrs}h ${rem}m`;
    } catch { return null; }
  };

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={500}>
      <div style={{
        width: '100%',
        background: 'linear-gradient(180deg, var(--paper) 0%, var(--ink-50) 100%)',
        borderRadius: '22px 22px 0 0',
        padding: '10px 16px 24px',
        boxShadow: '0 -8px 32px rgba(60,40,20,.18)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
        maxHeight: '82dvh', overflowY: 'auto',
      }}>
        <div style={{
          width: 38, height: 4, borderRadius: 2,
          background: 'var(--ink-200)', margin: '8px auto 16px',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '0 4px', marginBottom: 18,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
            }}>
              Qui hi és?
            </div>
            <div style={{
              fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
              letterSpacing: .08, textTransform: 'uppercase', marginTop: 4,
              fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {inCount > 0 ? (
                <>
                  <span style={{
                    width: 5, height: 5, borderRadius: 999,
                    background: 'var(--olive-600)',
                    boxShadow: '0 0 0 3px rgba(116,133,74,.18)',
                  }} />
                  {inCount} fitxat{inCount !== 1 ? 's' : ''} · {sorted.length} actius
                </>
              ) : (
                <>{sorted.length} actius · ningú fitxat</>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Tancar" className="press"
            style={{
              width: 34, height: 34, borderRadius: 999,
              background: 'var(--cream)', border: '1px solid rgba(60,40,20,.08)',
              cursor: 'pointer', color: 'var(--ink-600)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
            <Icon d={I.x} size={15} />
          </button>
        </div>

        {/* Operator cards — stacked, staggered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((emp, i) => {
            const role     = roleMap[emp.roleId];
            const isActive = emp.id === activeEmployeeId;
            const inShift  = !!emp.clockedIn;
            const since    = inShift ? startedLabel(emp.startedAt) : null;
            return (
              <div key={emp.id}
                className="row-stagger"
                style={{ ['--row-i' as string]: Math.min(i, 7) }}>
                <button onClick={() => onSelect(emp.id)} className="press"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '12px 14px',
                    border: isActive ? '1.5px solid var(--terracotta-500)' : '1px solid rgba(60,40,20,.08)',
                    borderRadius: 14,
                    background: isActive
                      ? 'linear-gradient(180deg, var(--terracotta-50) 0%, var(--paper) 100%)'
                      : 'var(--paper)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    boxShadow: isActive
                      ? '0 2px 8px rgba(168,74,42,.16), 0 1px 2px rgba(60,40,20,.04)'
                      : '0 1px 2px rgba(60,40,20,.04)',
                    transition: 'background 220ms var(--ease-in-out), border-color 220ms var(--ease-in-out), box-shadow 220ms var(--ease-in-out)',
                  }}>
                  {/* Avatar with subtle clocked-in ring */}
                  <span style={{ position: 'relative', flexShrink: 0 }}>
                    <span className={`avatar av-${avIdx(emp.fullName)}`}
                      style={{
                        width: 44, height: 44, fontSize: 14,
                        fontFamily: 'var(--font-serif)', fontWeight: 500,
                        display: 'grid', placeItems: 'center',
                        borderRadius: '50%',
                        boxShadow: inShift ? '0 0 0 2px var(--olive-500)' : 'none',
                      }}>
                      {emp.initials}
                    </span>
                    {inShift && (
                      <span style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 12, height: 12, borderRadius: 999,
                        background: 'var(--olive-600)',
                        border: '2px solid var(--paper)',
                      }} />
                    )}
                  </span>

                  {/* Name + role + since */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500,
                        color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
                      }}>
                        {emp.fullName}
                      </span>
                      {role && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px',
                          borderRadius: 5, background: role.color, color: role.textColor,
                          letterSpacing: .04, textTransform: 'uppercase',
                        }}>
                          {role.name}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 11.5, color: 'var(--ink-500)', fontWeight: 550,
                      marginTop: 4, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {inShift ? (
                        <>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            color: 'var(--olive-700)', fontWeight: 700,
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: 999,
                              background: 'var(--olive-600)',
                            }} />
                            Fitxat
                          </span>
                          {since && (
                            <>
                              <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-300)' }} />
                              <span style={{ fontFamily: 'var(--font-mono)' }}>{since}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--ink-400)' }}>
                          Fora de torn
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active marker */}
                  {isActive && (
                    <span style={{
                      width: 26, height: 26, borderRadius: 999,
                      background: 'var(--terracotta-600)', color: '#fff',
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(168,74,42,.30)',
                    }}>
                      <Icon d={I.check} size={14} stroke={2.6} />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Continue without active operator */}
        {activeEmployeeId && (
          <button onClick={() => onSelect(null)} className="press"
            style={{
              marginTop: 14, width: '100%', padding: '12px 14px',
              border: '1px dashed rgba(60,40,20,.18)',
              borderRadius: 12, background: 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, color: 'var(--ink-500)', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
            <Icon d={I.x} size={13} />
            Continuar sense usuari actiu
          </button>
        )}
      </div>
    </AnimatedSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveSidePanel — quiet "alive" widget that fills the right-side empty margin
// next to the centered content on a 1920 px restaurant touchscreen.
//
// Three vertically-stacked tiles, all read-only:
//   1. Live clock (HH:MM, ticks every minute) + current weekday + day number
//   2. Active shift (Migdia / Nit) with a coloured accent — empty state shows
//      "Fora de servei" so the operator sees at a glance whether the dining
//      room is "on"
//   3. Mini KPI line (reserves · pax · pendents)
//
// Pinned to the right edge with safe-area padding and clear of the FAB.
// Returns null on phones / iPads — only renders on large touchscreens where
// the screen content has been width-capped.
// ─────────────────────────────────────────────────────────────────────────────
type ShiftLite = { id: 'M'|'N'; label: string; range: string; emoji: string; tint: string; tintFg: string } | null;

function LiveSidePanel({
  activeShift, totalRes, totalPax, pendingResCount, selectedDate,
}: {
  activeShift: ShiftLite;
  totalRes: number;
  totalPax: number;
  pendingResCount: number;
  selectedDate: Date;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Tick once a minute on the wall-clock minute boundary, so the displayed
    // HH:MM updates exactly when the minute rolls over (not on a random offset).
    const align = () => {
      const d = new Date();
      const msToNextMinute = 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds());
      return msToNextMinute;
    };
    let interval: number | null = null;
    const t = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, align());
    return () => {
      window.clearTimeout(t);
      if (interval !== null) window.clearInterval(interval);
    };
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const weekday = now.toLocaleDateString('ca-ES', { weekday: 'long' });
  const dayNum  = now.getDate();
  const monthShort = now.toLocaleDateString('ca-ES', { month: 'short' });

  // Hourly forecast for the *currently visible date* — useful to glance at
  // how the next service hours will feel (rain coming in at 20h?).
  const dateIso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchForecast({ date: dateIso, lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng })
      .then(f => { if (!cancelled) setForecast(f); });
    return () => { cancelled = true; };
  }, [dateIso]);

  // Pick the next 4 hourly slots starting from the current hour (or, if
  // the user is viewing a future date, the start of the day).
  const nextHours = useMemo(() => {
    if (!forecast?.hourly) return [];
    const now = new Date();
    const sameDay = isoDateLocal(now) === dateIso;
    const startHour = sameDay ? now.getHours() : 12;
    return forecast.hourly.filter(h => h.hour >= startHour).slice(0, 4);
  }, [forecast, dateIso]);

  return (
    <aside
      style={{
        position: 'absolute',
        top: 84,                          // sit below the date header
        right: 18,
        width: 192,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 5,
      }}>

      {/* ── Tile 1: Live clock ─────────────────────────────────────────── */}
      <div style={{
        padding: '14px 16px 16px',
        background: 'var(--surface-elevated)',
        border: '1px solid rgba(60,40,20,.08)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-sm), var(--shadow-inset-top)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 34, fontWeight: 500, lineHeight: 1,
          color: 'var(--ink-900)', letterSpacing: -.01,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {hh}:{mm}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: .06,
          color: 'var(--ink-500)', textTransform: 'uppercase',
          fontFamily: 'var(--font-sans)',
        }}>
          {weekday} · {dayNum} {monthShort}
        </div>
      </div>

      {/* ── Tile 2: Active shift ───────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        padding: '12px 14px 12px 16px',
        background: activeShift ? `linear-gradient(180deg, var(--surface-elevated) 0%, var(--surface-elevated) 65%), ${activeShift.tint}` : 'var(--surface-base)',
        border: '1px solid rgba(60,40,20,.08)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm), var(--shadow-inset-top)',
        display: 'flex', flexDirection: 'column', gap: 4,
        overflow: 'hidden',
      }}>
        {activeShift && (
          <span aria-hidden style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: activeShift.id === 'M' ? 'var(--clay-500)' : 'var(--plum-600)',
          }} />
        )}
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: .08,
          color: 'var(--ink-500)', textTransform: 'uppercase',
        }}>
          Torn
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500,
          color: activeShift ? activeShift.tintFg : 'var(--ink-700)',
          letterSpacing: -.005,
        }}>
          {activeShift && <span style={{ fontSize: 14 }}>{activeShift.emoji}</span>}
          {activeShift ? activeShift.label.replace('Servei de ', '') : 'Fora de servei'}
        </div>
        {activeShift && (
          <div style={{
            fontSize: 11, color: activeShift.tintFg, opacity: .8, fontWeight: 600,
            fontFamily: 'var(--font-mono)',
          }}>
            {activeShift.range}
          </div>
        )}
      </div>

      {/* ── Tile 3: Next-hours weather ─────────────────────────────────── */}
      {nextHours.length > 0 && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--surface-elevated)',
          border: '1px solid rgba(60,40,20,.08)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-sm), var(--shadow-inset-top)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: .08,
            color: 'var(--ink-500)', textTransform: 'uppercase',
          }}>
            Pròximes hores
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
            {nextHours.map(h => (
              <div key={h.hour} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--ink-500)',
                  fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                }}>{String(h.hour).padStart(2,'0')}h</div>
                <div style={{ fontSize: 18, lineHeight: 1 }}>{emojiForCondition(h.condition)}</div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 500,
                  color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums',
                }}>{Math.round(h.temp)}°</div>
                {h.precipProb >= 30 && (
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: .04,
                    color: 'var(--sky-700)',
                  }}>{h.precipProb}%</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tile 4: Mini KPI strip ─────────────────────────────────────── */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--surface-elevated)',
        border: '1px solid rgba(60,40,20,.08)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm), var(--shadow-inset-top)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <KpiRow label="Reserves" value={totalRes} />
        <KpiRow label="Comensals" value={totalPax} />
        <KpiRow label="Pendents" value={pendingResCount}
                accent={pendingResCount > 0} />
      </div>
    </aside>
  );
}

// ── Local helpers used by both side panels ──────────────────────────────────
function isoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function emojiForCondition(c: WxCondition): string {
  switch (c) {
    case 'clear':    return '☀️';
    case 'cloudy':   return '🌤';
    case 'overcast': return '☁️';
    case 'fog':      return '🌫';
    case 'drizzle':
    case 'rain':
    case 'showers':  return '🌧';
    case 'thunder':  return '⛈';
    case 'snow':     return '❄️';
    default:         return '·';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OpsLeftPanel — operational widgets pinned to the LEFT margin on large
// touchscreens: next upcoming reservation (with countdown) and a waitlist
// preview. Both are interactive — the next-res card opens the reservation
// detail and the waitlist card opens the waitlist sheet.
// ─────────────────────────────────────────────────────────────────────────────
function OpsLeftPanel({
  reservations, waitlistCount, onOpenWaitlist, onOpenReservation,
}: {
  reservations: Reservation[];
  waitlistCount: number;
  onOpenWaitlist: () => void;
  onOpenReservation: (r: Reservation) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  // Recompute the next-reservation countdown every 30 s so the text stays
  // fresh ("d'aquí 5 min" → "d'aquí 4 min") without jittery 1-Hz updates.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Next upcoming reservation today — first one whose time hasn't passed
  // and that isn't already seated/completed/cancelled.
  const todayIso = isoDateLocal(now);
  const next = useMemo(() => {
    return reservations
      .filter(r => r.date === todayIso)
      .filter(r => r.status === 'pending' || r.status === 'confirmed')
      .filter(r => {
        const [h, m] = r.time.split(':').map(Number);
        const t = new Date(); t.setHours(h, m, 0, 0);
        return t.getTime() >= now.getTime() - 5 * 60_000; // include reservations within the last 5 min
      })
      .sort((a, b) => a.time.localeCompare(b.time))[0] ?? null;
  }, [reservations, todayIso, now]);

  // Countdown phrase — "d'aquí 1h 6m", "d'aquí 8 min", "ara mateix"
  function countdown(timeStr: string): string {
    const [h, m] = timeStr.split(':').map(Number);
    const t = new Date(); t.setHours(h, m, 0, 0);
    const diffMin = Math.round((t.getTime() - now.getTime()) / 60_000);
    if (diffMin <= 0)   return 'Ara mateix';
    if (diffMin < 60)   return `d'aquí ${diffMin} min`;
    const h2 = Math.floor(diffMin / 60);
    const m2 = diffMin % 60;
    return m2 === 0 ? `d'aquí ${h2}h` : `d'aquí ${h2}h ${m2}m`;
  }

  return (
    <aside
      style={{
        position: 'absolute',
        top: 84,
        left: 18,
        width: 192,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 5,
      }}>

      {/* ── Tile: Next reservation ─────────────────────────────────────── */}
      <button
        onClick={() => next && onOpenReservation(next)}
        disabled={!next}
        className={next ? 'press' : ''}
        style={{
          textAlign: 'left',
          padding: '14px 16px',
          background: next
            ? 'linear-gradient(180deg, var(--surface-elevated) 0%, var(--surface-elevated) 60%), var(--terracotta-50)'
            : 'var(--surface-base)',
          border: '1px solid rgba(60,40,20,.08)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-sm), var(--shadow-inset-top)',
          display: 'flex', flexDirection: 'column', gap: 4,
          cursor: next ? 'pointer' : 'default',
          fontFamily: 'inherit',
          position: 'relative', overflow: 'hidden',
        }}>
        {next && (
          <span aria-hidden style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: 'var(--terracotta-600)',
          }} />
        )}
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: .08,
          color: 'var(--ink-500)', textTransform: 'uppercase',
        }}>
          Pròxima reserva
        </div>
        {next ? (
          <>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {next.name}
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--ink-600)', fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span>{next.time}</span>
              <span style={{ opacity: .5 }}>·</span>
              <span>{next.pax}p</span>
            </div>
            <div style={{
              marginTop: 2,
              fontSize: 11, fontWeight: 650,
              color: 'var(--terracotta-700)',
            }}>
              {countdown(next.time)}
            </div>
          </>
        ) : (
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500,
            color: 'var(--ink-600)', letterSpacing: -.005,
          }}>
            Cap reserva propera
          </div>
        )}
      </button>

      {/* ── Tile: Waitlist preview ─────────────────────────────────────── */}
      <button
        onClick={onOpenWaitlist}
        className="press"
        style={{
          textAlign: 'left',
          padding: '14px 16px',
          background: waitlistCount > 0
            ? 'linear-gradient(180deg, var(--surface-elevated) 0%, var(--surface-elevated) 60%), var(--clay-50)'
            : 'var(--surface-elevated)',
          border: '1px solid rgba(60,40,20,.08)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-sm), var(--shadow-inset-top)',
          display: 'flex', flexDirection: 'column', gap: 4,
          cursor: 'pointer', fontFamily: 'inherit',
          position: 'relative', overflow: 'hidden',
        }}>
        {waitlistCount > 0 && (
          <span aria-hidden style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: 'var(--clay-600)',
          }} />
        )}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: .08,
            color: 'var(--ink-500)', textTransform: 'uppercase',
          }}>
            Cua d'espera
          </span>
          {waitlistCount > 0 && (
            <span key={waitlistCount} className="number-tween" style={{
              fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500,
              color: 'var(--clay-700)', letterSpacing: -.005,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {waitlistCount}
            </span>
          )}
        </div>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500,
          color: waitlistCount > 0 ? 'var(--ink-900)' : 'var(--ink-600)',
          letterSpacing: -.005,
        }}>
          {waitlistCount === 0
            ? 'Cap grup esperant'
            : waitlistCount === 1
              ? '1 grup esperant taula'
              : `${waitlistCount} grups esperant`}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          letterSpacing: .02,
        }}>
          Toca per veure la cua
        </div>
      </button>
    </aside>
  );
}

function KpiRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: .06,
        color: 'var(--ink-500)', textTransform: 'uppercase',
      }}>{label}</span>
      <span key={`${label}-${value}`} className="number-tween" style={{
        fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500,
        color: accent ? 'var(--terracotta-700)' : 'var(--ink-900)',
        letterSpacing: -.005,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  );
}
