import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { initials, avIdx, isoDate, BUSINESSES, getZoneIcon, getZoneColor } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import { useDevice } from '@/hooks/useDevice';
import TableSelectorModal from '@/components/shared/TableSelectorModal';
import AnimatedSheet from '@/components/shared/AnimatedSheet';
import DatePickerPopover from '@/components/shared/DatePickerPopover';
import TimePickerPopover from '@/components/shared/TimePickerPopover';
import { ALLERGENS, allergenById } from '@/utils/allergens';
import { toast } from '@/components/shared/Toaster';
import type { Reservation, BusinessId, ReservationStatus, FloorPlan, RecurFreq } from '@/types';
import { rankCustomers as rankCustomersFn, type CustomerStats } from '@/utils/loyalty';
import { getDailyServiceCapacity } from '@/utils/businessConfig';
import SmartInsightsStrip from '@/components/shared/SmartInsightsStrip';
import InsightOfMoment from '@/components/shared/InsightOfMoment';

interface LoyaltyEntry { stats: CustomerStats; rank: number; }
interface LoyaltyLookup {
  byPhone: Map<string, LoyaltyEntry>;
  byName:  Map<string, LoyaltyEntry>;
}
function lookupLoyalty(l: LoyaltyLookup, r: Reservation): LoyaltyEntry | undefined {
  if (r.phone && l.byPhone.has(r.phone)) return l.byPhone.get(r.phone);
  return l.byName.get(r.name.trim().toLowerCase());
}

// Upper bound for party size on any reservation form. High enough for
// real-world large groups (weddings, school trips, a full bus) yet
// finite so we catch a typo like 99999 instead of silently storing it.
// The Reservation type carries `pax: number` without a constraint, so
// this is purely a UI-side guard.
const MAX_PAX = 9999;

/**
 * SwipeableRow — drag horizontally to advance a reservation's status.
 * Sonner-style: distance threshold OR velocity > 0.11 fires the action.
 * Forward only; left drag is resisted with damping but does nothing.
 *
 * The action label is shown in an overlay that grows in opacity as the
 * row is dragged. On release: trigger or snap-back (200ms ease-out).
 */
function SwipeableRow({
  children,
  onForward, forwardLabel, forwardColor, disabled,
  onBackward, backwardLabel, backwardColor, backwardDisabled,
}: {
  children: React.ReactNode;
  onForward?: () => void;
  forwardLabel: string;
  forwardColor: { bg: string; fg: string; ring: string };
  disabled?: boolean;
  onBackward?: () => void;
  backwardLabel?: string;
  backwardColor?: { bg: string; fg: string; ring: string };
  backwardDisabled?: boolean;
}) {
  const [dx, setDx]               = useState(0);
  const [animatingBack, setAnimB] = useState(false);
  const startX     = useRef(0);
  const startY     = useRef(0);
  const startTime  = useRef(0);
  // 'idle' = no commitment yet; 'horizontal' = locked, swipe row is in play;
  // 'vertical' = locked, scrolling — never engages the row swipe.
  const intent     = useRef<'idle' | 'horizontal' | 'vertical'>('idle');
  const fired      = useRef(false);
  // Higher threshold so accidental cross-motion during a vertical scroll
  // (or a soft day-swipe at the shell level) doesn't trip a row action.
  // Action fires at 96 px before; bumped to 110 + an "intent" stricter
  // gate that requires the gesture to clearly commit horizontal first.
  const TRIGGER_PX = 110;
  const INTENT_PX  = 10;            // total displacement before we decide intent
  const HORIZ_RATIO = 1.6;          // |dx| must beat |dy| by this much to claim horizontal

  function onDown(e: React.PointerEvent) {
    if (disabled && backwardDisabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX.current    = e.clientX;
    startY.current    = e.clientY;
    startTime.current = Date.now();
    intent.current    = 'idle';
    fired.current     = false;
    setAnimB(false);
  }

  function onMove(e: React.PointerEvent) {
    if (e.buttons === 0) return;
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;

    // Phase 1: decide intent. We need clear horizontal commitment before
    // locking onto the row swipe; otherwise the gesture belongs to scroll.
    if (intent.current === 'idle') {
      const adx = Math.abs(deltaX);
      const ady = Math.abs(deltaY);
      if (adx < INTENT_PX && ady < INTENT_PX) return;  // not enough yet
      if (adx > ady * HORIZ_RATIO) {
        intent.current = 'horizontal';
        try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch {}
      } else {
        intent.current = 'vertical';  // hand over to native scroll
        return;
      }
    }

    if (intent.current !== 'horizontal') return;

    let d = deltaX;
    // Right swipe (forward) — damp past threshold; resist hard if disabled
    if (d > 0) {
      if (disabled) d = d * 0.20;
      else if (d > TRIGGER_PX) d = TRIGGER_PX + (d - TRIGGER_PX) * 0.4;
    }
    // Left swipe (backward) — damp past threshold; resist hard if disabled
    if (d < 0) {
      if (backwardDisabled) d = d * 0.20;
      else if (d < -TRIGGER_PX) d = -TRIGGER_PX + (d + TRIGGER_PX) * 0.4;
    }
    setDx(d);
  }

  function onUp() {
    if (intent.current !== 'horizontal') { setDx(0); intent.current = 'idle'; return; }
    const elapsed  = Math.max(Date.now() - startTime.current, 1);
    const velocity = dx / elapsed;
    // Action fires at the explicit threshold OR at higher velocity (flick).
    // Velocity gate bumped 0.11 → 0.18 so a casual horizontal drift doesn't
    // count as "intent to flick".
    const shouldFwd = !fired.current && !disabled         && (dx >=  TRIGGER_PX || velocity >  0.18);
    const shouldBwd = !fired.current && !backwardDisabled && (dx <= -TRIGGER_PX || velocity < -0.18);
    setAnimB(true);
    if (shouldFwd && onForward) {
      fired.current = true;
      onForward();
    } else if (shouldBwd && onBackward) {
      fired.current = true;
      onBackward();
    }
    setDx(0);
    intent.current = 'idle';
  }

  const fwdOpacity = Math.min(Math.max( dx / TRIGGER_PX, 0), 1);
  const bwdOpacity = Math.min(Math.max(-dx / TRIGGER_PX, 0), 1);
  const bwdColor   = backwardColor ?? { bg:'var(--rose-50)', fg:'var(--rose-700)', ring:'rgba(194,74,74,.30)' };

  return (
    // data-swipeable signals to the shell-level day-swipe handler that this
    // surface owns its horizontal gesture and the shell must not also fire.
    // Always set: even disabled rows must absorb horizontal motion so the
    // user never accidentally jumps days while interacting with a reservation.
    <div data-swipeable="true"
      style={{ position:'relative', overflow:'hidden' }}>
      {/* Forward-action overlay revealed under the row (right swipe) */}
      <div aria-hidden style={{
        position:'absolute', inset:0,
        background: `linear-gradient(90deg, transparent 25%, ${forwardColor.bg} 65%)`,
        display:'flex', alignItems:'center', justifyContent:'flex-end',
        padding:'0 22px',
        opacity: fwdOpacity,
        pointerEvents:'none',
        transition: animatingBack ? 'opacity 200ms var(--ease-out)' : 'none',
      }}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:6,
          color: forwardColor.fg, fontWeight:700, fontSize:13,
          padding:'4px 10px', borderRadius:999,
          background:'rgba(255,255,255,.6)',
          border:`1px solid ${forwardColor.ring}`,
        }}>
          <Icon d={I.check} size={13} stroke={2.4} />
          {forwardLabel}
        </span>
      </div>
      {/* Backward-action overlay revealed under the row (left swipe) */}
      {onBackward && (
        <div aria-hidden style={{
          position:'absolute', inset:0,
          background: `linear-gradient(270deg, transparent 25%, ${bwdColor.bg} 65%)`,
          display:'flex', alignItems:'center', justifyContent:'flex-start',
          padding:'0 22px',
          opacity: bwdOpacity,
          pointerEvents:'none',
          transition: animatingBack ? 'opacity 200ms var(--ease-out)' : 'none',
        }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:6,
            color: bwdColor.fg, fontWeight:700, fontSize:13,
            padding:'4px 10px', borderRadius:999,
            background:'rgba(255,255,255,.6)',
            border:`1px solid ${bwdColor.ring}`,
          }}>
            {backwardLabel ?? 'No-show'}
          </span>
        </div>
      )}
      {/* Draggable row content */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          transform: `translateX(${dx}px)`,
          transition: animatingBack ? 'transform 220ms var(--ease-out)' : 'none',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Allergen chip — multi-select toggle that gives a satisfying scale-pop
 * the moment it becomes active (chip-tick keyframes), then settles. Going
 * from active to inactive uses the standard .press feedback only — the
 * "tick" is reserved for the positive selection.
 */
function AllergenChip({ label, emoji, active, onToggle }: {
  label: string; emoji: string; active: boolean; onToggle: () => void;
}) {
  const prev = useRef(active);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (!prev.current && active) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 260);
      prev.current = active;
      return () => clearTimeout(t);
    }
    prev.current = active;
  }, [active]);

  return (
    <button type="button" onClick={onToggle}
      className={`press ${pop ? 'chip-tick' : ''}`}
      style={{
        padding:'6px 11px', borderRadius:999,
        border: active ? '1.5px solid var(--rose-600)' : '1px solid rgba(60,40,20,.12)',
        background: active ? 'var(--rose-50)' : 'var(--paper)',
        color: active ? 'var(--rose-700)' : 'var(--ink-600)',
        fontFamily:'inherit', fontSize:12, fontWeight: active ? 700 : 550,
        cursor:'pointer',
        display:'flex', alignItems:'center', gap:4,
        transition: 'background 200ms var(--ease-in-out), border-color 200ms var(--ease-in-out), color 200ms var(--ease-in-out)',
      }}>
      <span style={{ fontSize:13, lineHeight:1 }}>{emoji}</span>
      {label}
    </button>
  );
}

/**
 * Hold-to-delete primitive — replaces tap+confirm-modal flows with a
 * deliberate 1.6s press. The clip-path overlay fills left→right while held;
 * release before completion snaps back in 200ms. On completion onConfirm
 * fires once. Press is slow (deliberate), release is fast (responsive).
 */
function HoldToDelete({ onConfirm }: { onConfirm: () => void }) {
  const [holding, setHolding]   = useState(false);
  const [done,    setDone]      = useState(false);
  const timer                   = useRef<number | null>(null);
  const HOLD_MS = 1600;

  const start = (e: React.PointerEvent) => {
    if (done) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      setDone(true);
      onConfirm();
    }, HOLD_MS);
  };
  const cancel = () => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
    setHolding(false);
  };

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      style={{
        position:'relative', overflow:'hidden',
        width:'100%', padding:'11px',
        background: done ? 'rgba(192,57,43,.85)' : 'transparent',
        border:'1px solid rgba(192,57,43,.30)',
        borderRadius:11, cursor:'pointer',
        fontFamily:'inherit', fontSize:13, fontWeight:600,
        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        transition:'transform 160ms var(--ease-out), background 220ms var(--ease-in-out)',
        transform: holding ? 'scale(0.985)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
        userSelect:'none', touchAction:'none',
      }}>
      {/* Filling overlay — clip from left, expands during hold */}
      <span aria-hidden style={{
        position:'absolute', inset:0,
        background: 'linear-gradient(180deg, #c0392b 0%, #a93020 100%)',
        clipPath: holding || done ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
        transition: holding
          ? `clip-path ${HOLD_MS}ms linear`
          : 'clip-path 200ms var(--ease-out)',
      }} />
      <span style={{
        position:'relative', display:'inline-flex', alignItems:'center', gap:7,
        color: holding || done ? '#fff' : '#c0392b',
        transition:'color 220ms var(--ease-in-out)',
      }}>
        <Icon d={I.trash} size={14} />
        {done     ? 'Reserva eliminada'
         : holding ? 'Mantingues premut…'
         :           'Mantén premut per eliminar'}
      </span>
    </button>
  );
}

/** Inline status mini-stat: dot + serif number + label. Used inside the
 *  hero card to summarise the active shift's status distribution. */
function StatusInline({ n, label, fg, dot }: {
  n: number; label: string; fg: string; dot: string;
}) {
  const dim = n === 0;
  return (
    <span style={{
      display:'inline-flex', alignItems:'baseline', gap:4,
      opacity: dim ? .45 : 1,
    }}>
      <span style={{
        width:6, height:6, borderRadius:999, background: dot,
        alignSelf:'center', flexShrink:0,
      }} />
      <span key={n} className="number-tween" style={{
        fontFamily:'var(--font-serif)', fontSize:14, fontWeight:500,
        color: fg, letterSpacing:-.005, lineHeight:1,
      }}>{n}</span>
      <span style={{ color: fg, fontWeight:550, fontSize:11.5 }}>
        {label}
      </span>
    </span>
  );
}

/** Empty-state illustration: a minimal restaurant chair in line art with a
 *  barely-perceptible idle sway. The shadow expands in sync. */
/**
 * Empty-state for the day list — gives the screen personality with messages
 * that adapt to the moment (before/during/between services, past, future)
 * plus a soft ambient glow behind the chair illustration. The "live" lines
 * are intentionally kept light so the operator never feels nagged.
 */
function EmptyDayState({ dateStr, effectiveShift, variant }: {
  dateStr: string;
  effectiveShift: 'M' | 'N';
  variant: 'day' | 'shift';
}) {
  const today = new Date();
  const todayIso = isoDate(today);
  const isToday  = dateStr === todayIso;
  const isPast   = dateStr < todayIso;
  const isFuture = dateStr > todayIso;
  const hourNow  = today.getHours() + today.getMinutes() / 60;

  // Pick a title + sub from the context. Order matters — earlier branches win.
  let title: string;
  let sub: string;
  let glow: string;  // background glow color tied to the moment

  if (variant === 'shift') {
    // Other shifts exist today, this one is empty
    if (effectiveShift === 'M') {
      title = 'Migdia tranquil';
      sub   = "Cap reserva per ara · perfecte per repassar la nit";
    } else {
      title = 'Nit lliure';
      sub   = 'Cap reserva al vespre · moment de pausa';
    }
    glow = 'rgba(116,133,74,.30)';
  } else if (isPast) {
    title = 'Cap reserva aquest dia';
    sub   = 'Visualització històrica · només lectura';
    glow  = 'rgba(60,40,20,.10)';
  } else if (isFuture) {
    title = 'Encara per omplir';
    sub   = 'Cap reserva per a aquest dia';
    glow  = 'rgba(90,163,192,.22)';
  } else {
    // It's TODAY — pick by time of day
    if (hourNow < 11) {
      title = 'Tot preparat pel servei ✨';
      sub   = 'Bon matí · cap reserva entrada encara';
      glow  = 'rgba(204,144,73,.28)';
    } else if (hourNow >= 11 && hourNow < 13) {
      title = 'Última hora abans de migdia';
      sub   = 'Cap reserva per a aquest torn de moment';
      glow  = 'rgba(204,144,73,.30)';
    } else if (hourNow >= 13 && hourNow < 16) {
      title = 'Migdia en marxa · sala tranquil·la';
      sub   = 'No hi ha reserves obertes ara';
      glow  = 'rgba(200,97,58,.25)';
    } else if (hourNow >= 16 && hourNow < 19) {
      title = 'Pausa entre serveis';
      sub   = 'Moment de calma abans del vespre';
      glow  = 'rgba(116,133,74,.22)';
    } else if (hourNow >= 19 && hourNow < 21) {
      title = 'Preparant la nit ✨';
      sub   = 'Cap reserva entrada encara';
      glow  = 'rgba(138,79,118,.28)';
    } else if (hourNow >= 21 && hourNow < 23.5) {
      title = 'Servei nocturn · sala buida';
      sub   = 'Cap reserva activa ara mateix';
      glow  = 'rgba(138,79,118,.28)';
    } else {
      title = 'Servei finalitzat';
      sub   = 'Bona nit · descansa el merescut';
      glow  = 'rgba(60,40,20,.16)';
    }
  }

  const showActionHint = isToday && variant === 'day';

  return (
    <div style={{
      position: 'relative',
      textAlign: 'center', padding: '64px 20px',
      color: 'var(--ink-500)',
      overflow: 'hidden',  // keeps the glow clipped to the area
    }}>
      {/* Ambient glow — soft, breathing, behind everything */}
      <div className="empty-glow"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          marginTop: -100, marginRight: -100 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <span className="empty-breath"><EmptyChair /></span>
        <div className="empty-text-in" style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
          color: 'var(--ink-800)', marginTop: 16, letterSpacing: -.005,
          lineHeight: 1.25,
        }}>{title}</div>
        <div className="empty-text-in-2" style={{
          fontSize: 13, marginTop: 6, color: 'var(--ink-500)',
          maxWidth: 280, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.4,
        }}>{sub}</div>
        {showActionHint && (
          <div className="empty-text-in-2" style={{
            fontSize: 12, marginTop: 18, color: 'var(--ink-500)',
            fontFamily: 'var(--font-mono)', letterSpacing: .04,
          }}>
            Prem <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--terracotta-700)' }}>+</span> per afegir la primera reserva
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Live-service pill — shown next to the date title when viewing today AND
 * during an active service window (lunch 13–16 / dinner 19–23:30). A soft
 * pulsing dot signals "the system is reacting in real time".
 */
export function LiveServicePill() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const inMigdia = h >= 13 && h < 16;
  const inNit    = h >= 19 && h < 23.5;
  if (!inMigdia && !inNit) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 999,
      background: 'var(--terracotta-50)',
      color: 'var(--terracotta-700)',
      border: '1px solid rgba(168,74,42,.22)',
      fontSize: 10.5, fontWeight: 700, letterSpacing: .06,
      textTransform: 'uppercase',
    }}>
      <span className="live-dot" />
      En directe
    </span>
  );
}

function EmptyChair() {
  return (
    <svg width="76" height="92" viewBox="0 0 76 92" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g className="chair-body">
        {/* Chair back */}
        <path d="M22 8 Q22 4 26 4 H50 Q54 4 54 8 V40 H22 Z"
          stroke="var(--ink-400)" strokeWidth="1.6" fill="var(--cream)" />
        {/* Vertical slats */}
        <path d="M30 12 V36 M38 12 V36 M46 12 V36"
          stroke="var(--ink-300)" strokeWidth="1.2" strokeLinecap="round" />
        {/* Seat */}
        <path d="M16 44 H60 Q62 44 62 46 V52 Q62 54 60 54 H16 Q14 54 14 52 V46 Q14 44 16 44 Z"
          stroke="var(--ink-400)" strokeWidth="1.6" fill="var(--ink-50)" />
        {/* Legs */}
        <path d="M20 54 V84 M56 54 V84 M28 54 V72 M48 54 V72"
          stroke="var(--ink-400)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* Floor shadow — sways out of phase to feel grounded */}
      <ellipse className="chair-shadow"
        cx="38" cy="86" rx="22" ry="2" fill="var(--ink-200)" />
    </svg>
  );
}

function buildTableLine(res: Reservation, plan: FloorPlan | undefined): { icon: string; zone: string; tableStr: string; bg: string; color: string } | null {
  if (!plan || !res.tableIds || res.tableIds.length === 0) return null;
  const tables = res.tableIds
    .map(id => plan.tables.find(t => t.id === id))
    .filter(Boolean) as NonNullable<ReturnType<typeof plan.tables.find>>[];
  if (tables.length === 0) return null;
  const zoneId   = tables[0].zone;
  const zone     = plan.zones.find(z => z.id === zoneId);
  const zoneLabel = zone?.label ?? zoneId;
  const names    = tables.map(t => t.name ?? t.id);
  const tableStr = names.length === 1 ? `Taula ${names[0]}` : `Taules ${names.join(' + ')}`;
  return { icon: getZoneIcon(zoneLabel), zone: zoneLabel, tableStr, ...getZoneColor(zoneLabel) };
}

const DAYS_CA   = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
const MONTHS_CA = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
const MONTHS_SHORT = ['gen','feb','mar','abr','maig','jun','jul','ago','set','oct','nov','des'];

function parseH(t: string) { return parseInt(t.split(':')[0], 10); }

// ─── Main view ────────────────────────────────────────────────────────────────
interface TodayViewProps {
  newResTrigger?: number;
  hideDateNav?: boolean;
  onOpenNotes?: () => void;
}

export default function MobileTodayView({
  newResTrigger = 0,
  hideDateNav = false,
  onOpenNotes,
}: TodayViewProps) {
  const {
    selectedBusiness, reservations, selectedDate, setSelectedDate,
    addReservation, floorPlans, updateReservationStatus,
    shiftNotes, customers, businessConfigs,
    waitlist, setShowWaitlist,
  } = useAppStore();

  // Precompute loyalty lookup once per (customers, reservations, biz) so each
  // ResRow can render a level pill in O(1). Index by phone first, name as
  // fallback — matches the heuristic used in computeCustomerStats.
  const loyaltyLookup = useMemo(() => {
    const ranked = rankCustomersFn(customers, reservations, selectedBusiness as any);
    const byPhone = new Map<string, LoyaltyEntry>();
    const byName  = new Map<string, LoyaltyEntry>();
    for (const r of ranked) {
      const entry: LoyaltyEntry = { stats: r.stats, rank: r.rank };
      if (r.customer.phone) byPhone.set(r.customer.phone, entry);
      byName.set(r.customer.name.trim().toLowerCase(), entry);
    }
    return { byPhone, byName };
  }, [customers, reservations, selectedBusiness]);

  // Forward status progression for swipe-to-advance + confirmation toast
  function advanceStatus(r: Reservation) {
    const next: Partial<Record<ReservationStatus, ReservationStatus>> = {
      pending:   'confirmed',
      confirmed: 'seated',
      seated:    'completed',
    };
    const ns = next[r.status];
    if (!ns) return;
    updateReservationStatus(r.id, ns);
    const labels: Record<string, string> = {
      confirmed: 'Confirmada',
      seated:    'A taula',
      completed: 'Acabada',
    };
    const tones: Record<string, 'olive' | 'terracotta' | 'ink'> = {
      confirmed: 'olive',
      seated:    'terracotta',
      completed: 'ink',
    };
    toast(`${r.name} · ${labels[ns]}`, { icon: 'check', tone: tones[ns] });
  }

  function markNoShow(r: Reservation) {
    const prevStatus = r.status;
    updateReservationStatus(r.id, 'noshow');
    toast(`${r.name} · No-show`, {
      icon: 'alert',
      tone: 'rose',
      ms: 5000,  // Extra time to react
      action: {
        label: 'Desfer',
        onClick: () => updateReservationStatus(r.id, prevStatus),
      },
    });
  }
  function swipeMetaFor(r: Reservation): {
    label: string; bg: string; fg: string; ring: string; disabled: boolean;
  } {
    if (r.status === 'pending')   return { label:'Confirmar',  bg:'var(--olive-50)',      fg:'var(--olive-700)',      ring:'rgba(116,133,74,.30)',  disabled:false };
    if (r.status === 'confirmed') return { label:'A taula',    bg:'var(--terracotta-50)', fg:'var(--terracotta-700)', ring:'rgba(168,74,42,.28)',   disabled:false };
    if (r.status === 'seated')    return { label:'Acabar',     bg:'var(--ink-100)',       fg:'var(--ink-700)',        ring:'rgba(60,40,20,.18)',    disabled:false };
    return { label:'', bg:'transparent', fg:'transparent', ring:'transparent', disabled:true };
  }
  const plan = floorPlans[selectedBusiness];

  const [sel, setSel]         = useState<Reservation | null>(null);
  const [showNew, setShowNew] = useState(false);
  // When set, NewResSheet opens in edit mode pre-filled with this reservation
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [showCal, setShowCal] = useState(false);
  const [shift, setShift]     = useState<'M' | 'N'>(() => new Date().getHours() >= 18 ? 'N' : 'M');

  // ── Scroll-driven density mode ────────────────────────────────────────
  // When the operator scrolls into the list, dispatch a window event so
  // TouchShell can collapse its top "Reserves d'avui" header. We also
  // toggle a local `compact` flag to show the sticky 1-liner summary
  // strip that replaces the hero card visually. Hysteresis: enter at
  // 56 px, exit at 12 px — prevents jitter when the list bounces at top.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const lastScrolledRef = useRef(false);
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const y = (e.target as HTMLDivElement).scrollTop;
    const next = lastScrolledRef.current ? y > 12 : y > 56;
    if (next !== lastScrolledRef.current) {
      lastScrolledRef.current = next;
      setScrolled(next);
      try {
        window.dispatchEvent(new CustomEvent('app:reserves-scrolled', { detail: { scrolled: next } }));
      } catch { /* noop */ }
    }
  }
  // Make sure the shell knows we're no longer scrolled when this view
  // unmounts (e.g. switching tabs) so the header expands back cleanly.
  useEffect(() => {
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('app:reserves-scrolled', { detail: { scrolled: false } }));
      } catch { /* noop */ }
    };
  }, []);
  // On a large touchscreen the left side panel already shows the Notes
  // del torn and the Tendència insight — hide their center-content
  // counterparts to avoid duplicated info.
  const { isLargeScreen: isLargeTouchScreen, isMobile: isMobileDevice } = useDevice();
  // Zone filter — null means "all zones". The reset effect lives further
  // down, after `dateStr` is in scope.
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const dayDirRef             = useRef<'next' | 'prev' | null>(null);
  // Initialize with the current trigger value so a remount (e.g. user
  // navigates away and back to the Reserves tab) doesn't re-fire the sheet
  // for a stale trigger from a previous FAB tap.
  const prevTrigger = useRef(newResTrigger);

  // Open new-reservation sheet only when the parent ACTUALLY increments the
  // trigger after mount — never on the first render.
  useEffect(() => {
    if (newResTrigger !== prevTrigger.current) {
      prevTrigger.current = newResTrigger;
      if (newResTrigger > 0) {
        setSel(null);
        setShowNew(true);
      }
    }
  }, [newResTrigger]);

  const dateStr  = isoDate(selectedDate);
  // Reset zone filter whenever the day or shift changes so the operator
  // always lands on the full list rather than an inherited filter.
  useEffect(() => { setZoneFilter(null); }, [dateStr, shift]);
  const d        = selectedDate;
  const isToday  = isoDate(new Date()) === dateStr;
  const dayLabel = `${DAYS_CA[d.getDay()]}, ${d.getDate()} de ${MONTHS_CA[d.getMonth()]}`;

  // Shift notes count for today's date — drives the small pill next to the
  // Migdia/Nit toggle. Only shown on Reserves tab (this view).
  const todayNotes = useMemo(
    () => shiftNotes.filter(n => n.bizId === selectedBusiness && n.date === dateStr),
    [shiftNotes, selectedBusiness, dateStr],
  );
  const notesCount = todayNotes.length;
  const firstNote  = todayNotes.sort((a, b) => b.createdAt - a.createdAt)[0];

  const dayRes = useMemo(() =>
    reservations
      .filter(r => r.bizId === selectedBusiness && r.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time)),
    [reservations, selectedBusiness, dateStr],
  );

  const migdia = dayRes.filter(r => parseH(r.time) < 18);
  const nit    = dayRes.filter(r => parseH(r.time) >= 18);

  // Active shift list — auto-promote to migdia/nit if only one service exists
  const effectiveShift = migdia.length === 0 && nit.length > 0 ? 'N'
                       : nit.length   === 0 && migdia.length > 0 ? 'M'
                       : shift;
  const shiftList = effectiveShift === 'N' ? nit : migdia;

  // Reservation → zone resolver. A reservation can have multiple tables
  // (joined tables), but for filter purposes the first table's zone is
  // representative — adjacent tables in a join always belong to the same
  // zone. Returns null when the reservation has no table assigned yet.
  const reservationZone = (r: Reservation): string | null => {
    if (!plan || !r.tableIds || r.tableIds.length === 0) return null;
    const t = plan.tables.find(x => x.id === r.tableIds![0]);
    return t?.zone ?? null;
  };

  // Build the zone chips from the floor plan. Each chip carries its count
  // for the current shift so the operator sees at a glance how the night
  // splits across the dining room / bar / terrace.
  const zoneCounts = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const r of shiftList) {
      const z = reservationZone(r);
      m.set(z, (m.get(z) ?? 0) + 1);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftList, plan]);

  // Final filtered list applied to the visible rows.
  const activeList = useMemo(() => {
    if (!zoneFilter) return shiftList;
    if (zoneFilter === '__none__') return shiftList.filter(r => reservationZone(r) === null);
    return shiftList.filter(r => reservationZone(r) === zoneFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftList, zoneFilter, plan]);

  const totalRes = dayRes.length;
  const totalPax = dayRes.reduce((s, r) => s + r.pax, 0);
  const activePax = activeList.reduce((s, r) => s + r.pax, 0);

  function changeDay(delta: number) {
    dayDirRef.current = delta > 0 ? 'next' : 'prev';
    const nd = new Date(selectedDate);
    nd.setDate(nd.getDate() + delta);
    setSelectedDate(nd);
    setSel(null);
  }

  function goToday() {
    dayDirRef.current = null;
    setSelectedDate(new Date());
    setSel(null);
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

      {/* ── Date nav + segment control ──────────────────────────────────── */}
      <div style={{ flexShrink:0, background:'var(--cream)', padding:'10px 14px 0' }}>

        {/* Date navigation row — hidden on tablet (shell renders one) */}
        {!hideDateNav && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
          <button onClick={() => changeDay(-1)} className="day-btn"
            style={{ width:32, height:32, borderRadius:8, border:'none', background:'var(--paper)', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-600)', boxShadow:'var(--sh-1)' }}>
            <Icon d={I.chevL} size={16} stroke={2} />
          </button>

          <button onClick={() => setShowCal(true)} className="press"
            style={{
              flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              background:'var(--paper)',
              border:'1px solid rgba(60,40,20,.10)',
              borderRadius: 10,
              cursor:'pointer', fontFamily:'inherit',
              padding:'8px 12px',
              boxShadow:'var(--sh-1)',
              minHeight: 40,
            }}>
            {isToday && <LiveServicePill />}
            <span key={dateStr} className="date-label-in" style={{
              fontFamily:'var(--font-serif)', fontSize:15, fontWeight:500,
              color:'var(--ink-900)', letterSpacing:-.005, textTransform:'capitalize',
            }}>{dayLabel}</span>
            <Icon d={I.calendar} size={15} stroke={1.7} />
          </button>

          <button onClick={() => changeDay(1)} className="day-btn"
            style={{ width:32, height:32, borderRadius:8, border:'none', background:'var(--paper)', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-600)', boxShadow:'var(--sh-1)' }}>
            <Icon d={I.chevR} size={16} stroke={2} />
          </button>

          {!isToday && (
            <button onClick={goToday}
              style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid var(--terracotta-500)', background:'transparent', color:'var(--terracotta-600)', fontFamily:'inherit', fontSize:11.5, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              Avui
            </button>
          )}
        </div>
        )}

        {/* Shift toggle — left: pill segmented, right: notes pill (Reserves only) */}
        {(migdia.length > 0 || nit.length > 0 || onOpenNotes) && (
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            paddingBottom:10, gap:8,
          }}>
            <div style={{
              display:'inline-flex', padding:3,
              // Slightly warmer track than the canvas so the pill segments
              // feel "set into" a tray. The active segment will pop with
              // proper elevation.
              background:'rgba(60,40,20,.045)',
              boxShadow: 'inset 0 1px 2px rgba(40,28,16,.05)',
              borderRadius:999, gap:2,
            }}>
              {[
                { v: 'M', label: 'Migdia', count: migdia.length, color:'#9c5d1f', halo:'rgba(204,144,73,.18)' },
                { v: 'N', label: 'Nit',    count: nit.length,    color:'#3a4a6e', halo:'rgba(58,74,110,.16)' },
              ].map(o => {
                const a = effectiveShift === o.v;
                return (
                  <button key={o.v} onClick={() => setShift(o.v as 'M' | 'N')}
                    className="tac-seg-btn"
                    data-active={a ? 'true' : 'false'}
                    style={{
                      padding:'7px 14px',
                      fontSize:13, fontWeight:650,
                      display:'inline-flex', alignItems:'center', gap:6,
                    }}>
                    <span style={{
                      width:14, height:14, borderRadius:999,
                      background: a ? o.halo : 'transparent',
                      color: a ? o.color : 'var(--ink-400)',
                      display:'grid', placeItems:'center',
                    }}>
                      {o.v === 'M' ? (
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="2.6" fill="currentColor" />
                          <path d="M7 1.6V3 M7 11v1.4 M1.6 7H3 M11 7h1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                          <path d="M11.2 9.6 a4.6 4.6 0 1 1 -1.2 -8 a3.6 3.6 0 0 0 1.2 8 z" fill="currentColor" />
                        </svg>
                      )}
                    </span>
                    {o.label}
                    <span key={o.count} className="number-tween" style={{
                      fontFamily:'var(--font-serif)', fontSize:13, fontWeight:500,
                      color: a ? o.color : 'var(--ink-500)', marginLeft:1,
                    }}>{o.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Notes pill — only on Reserves (where onOpenNotes is provided).
                Shows the first note inline when there are notes, or a small
                "+ Nota" ghost when empty. Tap opens the global NotesSheet.
                Hidden on large touchscreens where the left side panel
                already shows the same note as a dedicated tile. */}
            {onOpenNotes && !isLargeTouchScreen && (
              notesCount > 0 ? (
                <button onClick={onOpenNotes} className="press"
                  aria-label="Notes del torn"
                  style={{
                    flex: 1, minWidth: 0, maxWidth: 360,
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px 6px 11px',
                    borderRadius: 999,
                    background: 'linear-gradient(180deg, #fff8e6 0%, #fbf2d3 100%)',
                    border: '1px solid rgba(180,140,40,.20)',
                    boxShadow: '0 1px 2px rgba(180,140,40,.06)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: 999,
                    background: '#c89a3a', flexShrink: 0,
                    boxShadow: '0 0 0 2px rgba(200,154,58,.18)',
                  }} />
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: .06,
                    color: '#8a6a10', textTransform: 'uppercase',
                    fontFamily: 'var(--font-sans)', flexShrink: 0,
                  }}>
                    Nota torn
                  </span>
                  <span style={{
                    flex: 1, minWidth: 0,
                    fontFamily: 'var(--font-serif)', fontSize: 12.5, fontWeight: 500,
                    color: '#5e4708', letterSpacing: -.005,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {firstNote?.body}
                  </span>
                  {notesCount > 1 && (
                    <span key={notesCount} className="number-tween"
                      style={{
                        fontSize: 10, fontWeight: 700, color: '#8a6a10',
                        background: 'rgba(200,154,58,.20)',
                        padding: '1px 6px', borderRadius: 999,
                        fontFamily: 'var(--font-mono)', flexShrink: 0,
                      }}>
                      +{notesCount - 1}
                    </span>
                  )}
                </button>
              ) : (
                <button onClick={onOpenNotes} className="press"
                  aria-label="Afegir nota del torn"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 11px',
                    borderRadius: 999,
                    background: 'transparent',
                    border: '1px dashed rgba(180,140,40,.40)',
                    color: '#8a6a10',
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 11.5, fontWeight: 650, letterSpacing: .02,
                    flexShrink: 0,
                  }}>
                  <Icon d={I.plus} size={11} stroke={2.4} />
                  Nota torn
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Zone filter chips — horizontal strip, one chip per zone with
            its count for the current shift. "Totes" resets the filter.
            Only shown when there is at least one reservation in the
            current shift AND the floor plan has zones (so we don't
            render an empty strip on businesses with no plan). */}
      {shiftList.length > 0 && plan && plan.zones.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 16px 12px',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          <ZoneChip
            label="Totes" count={shiftList.length}
            active={zoneFilter === null}
            onClick={() => setZoneFilter(null)}
            tone="all"
          />
          {[...plan.zones].sort((a, b) => a.order - b.order).map(z => {
            const c = zoneCounts.get(z.id) ?? 0;
            if (c === 0) return null;
            return (
              <ZoneChip key={z.id}
                label={z.label} count={c}
                active={zoneFilter === z.id}
                onClick={() => setZoneFilter(z.id)}
                tone="zone"
              />
            );
          })}
          {(zoneCounts.get(null) ?? 0) > 0 && (
            <ZoneChip
              label="Sense taula" count={zoneCounts.get(null) ?? 0}
              active={zoneFilter === '__none__'}
              onClick={() => setZoneFilter('__none__')}
              tone="empty"
            />
          )}
        </div>
      )}

      {/* ─── Scrollable canvas ────────────────────────────────────────────
            The hero summary, smart-insights strip, waitlist banner AND the
            row list now scroll together as a single column. The operator
            can pull the summary card out of view to gain ~225 px of list
            density on long days. A scroll listener dispatches a window
            event so TouchShell can collapse its big top header in sync. */}
      <div
        data-mobile-scroll
        ref={scrollRef}
        onScroll={onScroll}
        className={`scroll mob-scroll ${dayDirRef.current === 'next' ? 'day-next' : dayDirRef.current === 'prev' ? 'day-prev' : 'tab-enter'}`}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
      >

      {/* Sticky compact summary strip — only when scrolled past the hero.
          One-line replacement for the hero card while in dense scroll mode. */}
      {activeList.length > 0 && (() => {
        const cap = getDailyServiceCapacity(selectedBusiness, businessConfigs);
        const confirmed = activeList.filter(r => r.status === 'confirmed').length;
        const pending   = activeList.filter(r => r.status === 'pending').length;
        const seated    = activeList.filter(r => r.status === 'seated').length;
        const completed = activeList.filter(r => r.status === 'completed').length;
        const occupancy = cap > 0 ? Math.min(100, Math.round((activePax / cap) * 100)) : 0;
        return (
          <div
            aria-hidden={!scrolled}
            style={{
              position: 'sticky', top: 0, zIndex: 6,
              padding: '6px 14px',
              background: 'rgba(253,249,242,.86)',
              WebkitBackdropFilter: 'blur(14px) saturate(140%)',
              backdropFilter:       'blur(14px) saturate(140%)',
              boxShadow: 'inset 0 -1px 0 rgba(40,28,16,.06)',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11.5, fontWeight: 600,
              opacity: scrolled ? 1 : 0,
              transform: scrolled ? 'translateY(0)' : 'translateY(-4px)',
              pointerEvents: scrolled ? 'auto' : 'none',
              transition: 'opacity 180ms var(--ease-out), transform 180ms var(--ease-out)',
              minHeight: 30,
              fontFamily: 'var(--font-mono)',
              letterSpacing: .02,
              color: 'var(--ink-700)',
              whiteSpace: 'nowrap',
              overflowX: 'auto', scrollbarWidth: 'none',
            }}>
            <span style={{ color: 'var(--ink-900)', fontWeight: 700 }}>{activeList.length}</span>
            <span style={{ color: 'var(--ink-400)' }}>res</span>
            <span style={{ color: 'var(--ink-300)' }}>·</span>
            <span style={{ color: 'var(--ink-900)', fontWeight: 700 }}>{activePax}</span>
            <span style={{ color: 'var(--ink-400)' }}>pax</span>
            <span style={{ color: 'var(--ink-300)' }}>·</span>
            <span style={{
              color: occupancy >= 85 ? 'var(--terracotta-700)'
                   : occupancy >= 60 ? 'var(--clay-700)'
                   : occupancy >= 30 ? 'var(--olive-700)'
                   : 'var(--ink-700)',
              fontWeight: 700,
            }}>{occupancy}%</span>
            {confirmed > 0 && (<>
              <span style={{ color: 'var(--ink-300)' }}>·</span>
              <span style={{ color: 'var(--olive-700)' }}>{confirmed} conf</span>
            </>)}
            {pending > 0 && (<>
              <span style={{ color: 'var(--ink-300)' }}>·</span>
              <span style={{ color: 'var(--clay-700)' }}>{pending} pend</span>
            </>)}
            {seated > 0 && (<>
              <span style={{ color: 'var(--ink-300)' }}>·</span>
              <span style={{ color: 'var(--terracotta-700)' }}>{seated} taula</span>
            </>)}
            {completed > 0 && (<>
              <span style={{ color: 'var(--ink-300)' }}>·</span>
              <span style={{ color: 'var(--ink-500)' }}>{completed} acab</span>
            </>)}
          </div>
        );
      })()}

      {/* ── Hero stat card — replaces the three flat stat boxes ────────── */}
      {activeList.length > 0 && (() => {
        const cap = getDailyServiceCapacity(selectedBusiness, businessConfigs);
        const confirmed = activeList.filter(r => r.status === 'confirmed').length;
        const pending   = activeList.filter(r => r.status === 'pending').length;
        const seated    = activeList.filter(r => r.status === 'seated').length;
        const completed = activeList.filter(r => r.status === 'completed').length;
        const occupancy = cap > 0 ? Math.min(100, Math.round((activePax / cap) * 100)) : 0;

        // Find next upcoming reservation for the active shift
        const nowIso = isoDate(new Date());
        const isToday = dateStr === nowIso;
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const upcoming = activeList
          .filter(r => r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'noshow')
          .find(r => {
            if (!isToday) return true;
            const [h, m] = r.time.split(':').map(Number);
            return (h * 60 + m) >= nowMin;
          });
        let countdown: string | null = null;
        if (upcoming && isToday) {
          const [h, m] = upcoming.time.split(':').map(Number);
          const diff = (h * 60 + m) - nowMin;
          if (diff > 0 && diff < 24 * 60) {
            const hh = Math.floor(diff / 60);
            const mm = diff % 60;
            countdown = hh > 0 ? `d'aquí ${hh}h ${mm}m` : `d'aquí ${mm} min`;
          } else if (diff >= -30 && diff <= 0) {
            countdown = 'ara mateix';
          }
        }

        // Pax distribution percentages for the bar (clamped to total cap)
        const pctPax = (n: number) => Math.min(100, (n / cap) * 100);

        return (
          <div style={{
            flexShrink:0, padding:'0 14px 12px',
          }}>
            <div style={{
              // Hero card — soft top-to-bottom gradient + layered shadow.
              // Reads as the "first surface" of the screen, distinct from
              // the canvas without needing a hard border.
              background: 'linear-gradient(180deg, var(--surface-elevated) 0%, var(--cream) 100%)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-md), var(--shadow-ring), var(--shadow-inset-top)',
              padding: '15px 16px 13px',
              display: 'flex', flexDirection: 'column', gap: 11,
            }}>
              {/* Top: hero numbers in serif */}
              <div style={{
                display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap',
              }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span key={`r-${activeList.length}`} className="number-tween" style={{
                    fontFamily:'var(--font-serif)', fontSize:32, fontWeight:500,
                    color:'var(--ink-900)', letterSpacing:-.015, lineHeight:1,
                  }}>{activeList.length}</span>
                  <span style={{
                    fontSize:11, fontWeight:700, letterSpacing:.08,
                    color:'var(--ink-500)', textTransform:'uppercase',
                    fontFamily:'var(--font-mono)',
                  }}>res</span>
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span key={`p-${activePax}`} className="number-tween" style={{
                    fontFamily:'var(--font-serif)', fontSize:28, fontWeight:500,
                    color:'var(--ink-900)', letterSpacing:-.01, lineHeight:1,
                  }}>{activePax}</span>
                  <span style={{
                    fontSize:11, fontWeight:700, letterSpacing:.08,
                    color:'var(--ink-500)', textTransform:'uppercase',
                    fontFamily:'var(--font-mono)',
                  }}>pax</span>
                </div>
                <span style={{ flex:1 }} />
                <div style={{
                  display:'flex', alignItems:'baseline', gap:3,
                  padding:'4px 10px', borderRadius:999,
                  background: occupancy >= 85 ? 'var(--terracotta-50)'
                            : occupancy >= 60 ? 'var(--clay-50)'
                            : occupancy >= 30 ? 'var(--olive-50)'
                            : 'var(--ink-100)',
                }}>
                  <span key={`o-${occupancy}`} className="number-tween" style={{
                    fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
                    color: occupancy >= 85 ? 'var(--terracotta-700)'
                         : occupancy >= 60 ? 'var(--clay-700)'
                         : occupancy >= 30 ? 'var(--olive-700)'
                         : 'var(--ink-700)',
                    letterSpacing:-.005,
                  }}>{occupancy}</span>
                  <span style={{
                    fontSize:10, fontWeight:700, letterSpacing:.04,
                    color: occupancy >= 85 ? 'var(--terracotta-700)'
                         : occupancy >= 60 ? 'var(--clay-700)'
                         : occupancy >= 30 ? 'var(--olive-700)'
                         : 'var(--ink-500)',
                  }}>%</span>
                  <span style={{
                    marginLeft:4,
                    fontSize:10, fontWeight:700, letterSpacing:.06,
                    color: occupancy >= 85 ? 'var(--terracotta-700)'
                         : occupancy >= 60 ? 'var(--clay-700)'
                         : occupancy >= 30 ? 'var(--olive-700)'
                         : 'var(--ink-500)',
                    textTransform:'uppercase',
                    fontFamily:'var(--font-mono)',
                  }}>ocup</span>
                </div>
              </div>

              {/* Multi-segment occupancy bar */}
              <div style={{
                position:'relative', height:8, borderRadius:999,
                background:'rgba(60,40,20,.06)', overflow:'hidden',
                display:'flex',
              }}>
                {/* Order: seated → confirmed → pending (most committed first) */}
                {seated > 0 && (
                  <div style={{
                    width:`${pctPax(activeList.filter(r => r.status === 'seated').reduce((s, r) => s + r.pax, 0))}%`,
                    background:'var(--terracotta-600)',
                    transition:'width 320ms var(--ease-in-out)',
                  }} />
                )}
                {confirmed > 0 && (
                  <div style={{
                    width:`${pctPax(activeList.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.pax, 0))}%`,
                    background:'var(--olive-600)',
                    transition:'width 320ms var(--ease-in-out)',
                  }} />
                )}
                {pending > 0 && (
                  <div style={{
                    width:`${pctPax(activeList.filter(r => r.status === 'pending').reduce((s, r) => s + r.pax, 0))}%`,
                    background:'var(--clay-500)',
                    transition:'width 320ms var(--ease-in-out)',
                  }} />
                )}
              </div>

              {/* Inline status mini-stats */}
              <div style={{
                display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
                fontSize:11.5, fontWeight:600,
              }}>
                <StatusInline n={confirmed}  label="confirmada"  fg="var(--olive-700)"      dot="var(--olive-600)" />
                <StatusInline n={pending}    label="pendent"     fg="var(--clay-700)"       dot="var(--clay-500)" />
                <StatusInline n={seated}     label="a taula"     fg="var(--terracotta-700)" dot="var(--terracotta-600)" />
                {completed > 0 && (
                  <StatusInline n={completed} label="acabada"    fg="var(--ink-600)"        dot="var(--ink-400)" />
                )}
              </div>

              {/* Next-up strip */}
              {upcoming && (
                <div style={{
                  marginTop:2, paddingTop:10,
                  borderTop:'1px dashed rgba(60,40,20,.10)',
                  display:'flex', alignItems:'center', gap:10,
                }}>
                  <span style={{
                    width:6, height:6, borderRadius:999,
                    background:'var(--terracotta-600)',
                    boxShadow:'0 0 0 3px rgba(168,74,42,.16)',
                    flexShrink:0,
                  }} />
                  <span style={{
                    fontSize:10.5, fontWeight:700, letterSpacing:.08,
                    color:'var(--ink-500)', textTransform:'uppercase',
                    fontFamily:'var(--font-mono)',
                  }}>Pròxima</span>
                  <span style={{
                    fontFamily:'var(--font-mono)', fontWeight:700, fontSize:13,
                    color:'var(--ink-800)',
                  }}>{upcoming.time}</span>
                  <span style={{ width:3, height:3, borderRadius:999, background:'var(--ink-300)' }} />
                  <span style={{
                    fontSize:13, fontWeight:650, color:'var(--ink-900)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    flex:1, minWidth:0, letterSpacing:-.005,
                  }}>{upcoming.name}</span>
                  <span style={{
                    fontSize:11, fontWeight:700, color:'var(--ink-500)',
                    fontFamily:'var(--font-mono)', flexShrink:0,
                  }}>{upcoming.pax}p</span>
                  {countdown && (
                    <span style={{
                      fontSize:10.5, fontWeight:700, letterSpacing:.04,
                      color:'var(--terracotta-700)',
                      background:'var(--terracotta-50)',
                      padding:'2px 7px', borderRadius:999,
                      fontFamily:'var(--font-mono)',
                      flexShrink:0,
                    }}>{countdown}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Insight del moment — only on true mobile (phone). On tablet the
            TouchShell already mounts the hero above screenContent. */}
      {isMobileDevice && <InsightOfMoment compact />}

      {/* ── Smart insights strip — auto-generated from history, weather, queue ─ */}
      <SmartInsightsStrip />

      {/* ── Waitlist banner — only for entries added on the selected day ── */}
      {(() => {
        const queue = waitlist.filter(w => {
          if (w.bizId !== selectedBusiness) return false;
          const d = new Date(w.addedAt);
          const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          return iso === dateStr;
        });
        if (queue.length === 0) return null;
        const totalPax = queue.reduce((s, w) => s + w.pax, 0);
        const oldest = queue.reduce((min, w) => Math.min(min, w.addedAt), Date.now());
        const oldestMin = Math.max(0, Math.floor((Date.now() - oldest) / 60_000));
        // Tone escalates with how long the oldest party has been waiting:
        // calm clay under 15 min, terracotta past 15 min (real attention).
        const isUrgent = oldestMin >= 15;
        const accent  = isUrgent ? 'var(--terracotta-500)' : 'var(--clay-500)';
        const fgUrgent = isUrgent ? 'var(--terracotta-700)' : 'var(--ink-500)';
        return (
          <button onClick={() => setShowWaitlist(true)} className="press"
            style={{
              position: 'relative',
              margin: '0 14px 10px', padding: '12px 14px 12px 16px',
              borderRadius: 12,
              background: 'var(--surface-elevated)',
              border: 'none',
              boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              width: 'calc(100% - 28px)',
              display: 'flex', alignItems: 'center', gap: 12,
              overflow: 'hidden',
            }}>
            {/* Left accent bar — color escalates with wait pressure */}
            <span aria-hidden style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: 3, background: accent,
            }} />
            <span style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'var(--ink-50)', color: 'var(--ink-700)',
              display: 'grid', placeItems: 'center', fontSize: 18,
            }}>🚶</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', letterSpacing: -.005 }}>
                {queue.length} {queue.length === 1 ? 'grup' : 'grups'} a la cua · {totalPax} pax
              </div>
              <div style={{
                fontSize: 11, color: fgUrgent,
                marginTop: 2, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: .04,
              }}>
                espera més antiga: {oldestMin === 0 ? 'ara mateix' : `${oldestMin} min`}
              </div>
            </div>
            <Icon d={I.chevR} size={14} stroke={2} />
          </button>
        );
      })()}

      {/* ── Reservation list (inside the outer scroll) ───────────────────
            Keeps the day/shift key so the row-stagger animation fires on
            day or shift change — no overflow of its own, the outer wrapper
            scrolls everything together. */}
      <div
        key={`${dateStr}-${effectiveShift}`}
        className={dayDirRef.current === 'next' ? 'day-next' : dayDirRef.current === 'prev' ? 'day-prev' : 'tab-enter'}
      >
        {dayRes.length === 0 && (
          <EmptyDayState dateStr={dateStr} effectiveShift={effectiveShift} variant="day" />
        )}

        {dayRes.length > 0 && activeList.length === 0 && (
          <EmptyDayState dateStr={dateStr} effectiveShift={effectiveShift} variant="shift" />
        )}

        {/* listKey re-mounts every row when day or shift changes,
            so the row-stagger animation replays from the top. */}
        {activeList.map((r, i) => {
          const prev = i > 0 ? activeList[i - 1] : null;
          const showTimeHeader = !prev || prev.time !== r.time;
          const listKey = `${dateStr}-${effectiveShift}-${r.id}`;
          const staggerIdx = Math.min(i, 7);
          return (
            <React.Fragment key={listKey}>
              {showTimeHeader && (() => {
                const isLunch = parseH(r.time) < 18;
                // Day → sun in clay (warm ochre); night → moon in deep indigo.
                // Replaces the previous lilac plum dot which read as dull.
                const fg     = isLunch ? '#9c5d1f' : '#3a4a6e';
                const haloBg = isLunch ? 'rgba(204,144,73,.18)' : 'rgba(58,74,110,.16)';
                const lineCol = isLunch ? 'rgba(204,144,73,.20)' : 'rgba(58,74,110,.18)';
                return (
                  <div style={{ padding:'14px 18px 6px', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{
                      width:18, height:18, borderRadius:999,
                      background: haloBg, flexShrink:0, color: fg,
                      display:'grid', placeItems:'center',
                    }}>
                      {isLunch ? (
                        // Sun: solid disc + four short rays
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="2.6" fill="currentColor" />
                          <path d="M7 1.6 V3 M7 11 V12.4 M1.6 7 H3 M11 7 H12.4
                                   M3.1 3.1 L4 4 M10 10 L10.9 10.9
                                   M3.1 10.9 L4 10 M10 4 L10.9 3.1"
                            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      ) : (
                        // Moon: crescent via subtraction
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M11.2 9.6 a4.6 4.6 0 1 1 -1.2 -8 a3.6 3.6 0 0 0 1.2 8 z"
                            fill="currentColor" />
                        </svg>
                      )}
                    </span>
                    <span className="mono" style={{
                      fontSize:13, fontWeight:650, color:'var(--ink-800)',
                      flexShrink:0, letterSpacing:.005,
                    }}>{r.time}</span>
                    <div style={{
                      flex:1, height:1,
                      background: `linear-gradient(90deg, ${lineCol} 0%, rgba(60,40,20,.04) 100%)`,
                    }} />
                  </div>
                );
              })()}
              <div
                className="row-stagger"
                style={{ ['--row-i' as string]: staggerIdx }}
              >
                {(() => {
                  const meta = swipeMetaFor(r);
                  const canNoShow = r.status !== 'noshow' && r.status !== 'completed' && r.status !== 'cancelled';
                  return (
                    <SwipeableRow
                      forwardLabel={meta.label}
                      forwardColor={{ bg: meta.bg, fg: meta.fg, ring: meta.ring }}
                      disabled={meta.disabled}
                      onForward={() => advanceStatus(r)}
                      backwardLabel="No-show"
                      backwardDisabled={!canNoShow}
                      onBackward={() => markNoShow(r)}
                    >
                      <ResRow
                        res={r}
                        selected={sel?.id === r.id}
                        onSel={r => setSel(prev => prev?.id === r.id ? null : r)}
                        plan={plan}
                        loyalty={lookupLoyalty(loyaltyLookup, r)}
                      />
                    </SwipeableRow>
                  );
                })()}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Spacer so the last row clears the FAB. The bottom nav lives
          OUTSIDE this scrollable and handles env(safe-area-inset-bottom)
          itself — NEVER duplicate the safe-area inset here. The FAB
          (60 px) floats ~18 px above the nav so 28 px gives the last row
          comfortable air without producing a phantom cream gap. */}
      <div aria-hidden style={{ height: 28 }} />
      </div>{/* /scrollable canvas */}

      {/* ── Sheets — AnimatedSheet handles slide-up/down with backdrop ── */}
      <ResDetailSheet
        open={!!(sel && !showNew && !showCal && !editingRes)}
        res={sel}
        onClose={() => setSel(null)}
        onEditFull={(r) => { setEditingRes(r); setSel(null); }}
      />
      <NewResSheet
        open={showNew || !!editingRes}
        bizId={selectedBusiness}
        defaultDate={dateStr}
        addReservation={addReservation}
        editRes={editingRes ?? undefined}
        onClose={() => { setShowNew(false); setEditingRes(null); }}
      />
      <DatePickerSheet
        open={showCal}
        selected={selectedDate}
        onSelect={d => { setSelectedDate(d); setSel(null); setShowCal(false); }}
        onClose={() => setShowCal(false)}
        reservations={reservations}
        bizId={selectedBusiness}
      />
    </div>
  );
}

// ─── Status pill (mobile style — no dot, just coloured label) ────────────────
// ─── Zone filter chip ────────────────────────────────────────────────────────
// One pill in the horizontal zone-filter strip. Three tonal variants:
//   - "all"   → the unfiltered "Totes" pill (ink-toned dark active state)
//   - "zone"  → a real zone (terracotta accent when active)
//   - "empty" → the "Sense taula" bucket (clay accent — a warning tone for
//               reservations that haven't been assigned a table yet)
function ZoneChip({
  label, count, active, onClick, tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone: 'all' | 'zone' | 'empty';
}) {
  const palette = tone === 'all'
    ? { bgActive: 'var(--ink-900)',         fgActive: '#fff',                 countActive: 'rgba(255,255,255,.78)' }
    : tone === 'empty'
      ? { bgActive: 'var(--clay-600)',       fgActive: '#fff',                 countActive: 'rgba(255,255,255,.82)' }
      : { bgActive: 'var(--terracotta-600)', fgActive: '#fff',                 countActive: 'rgba(255,255,255,.82)' };
  return (
    <button onClick={onClick} className="press"
      style={{
        flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', borderRadius: 999,
        border: active ? 'none' : '1px solid rgba(60,40,20,.12)',
        background: active ? palette.bgActive : 'var(--paper)',
        color: active ? palette.fgActive : 'var(--ink-700)',
        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 650,
        letterSpacing: .01, cursor: 'pointer',
        boxShadow: active ? '0 1px 2px rgba(60,40,20,.10), inset 0 1px 0 rgba(255,255,255,.10)' : 'var(--sh-1)',
        transition: 'background 160ms var(--ease-out), color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
      }}>
      <span>{label}</span>
      <span style={{
        fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 500,
        color: active ? palette.countActive : 'var(--ink-500)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: -.005,
      }}>{count}</span>
    </button>
  );
}

function ResStatePill({ state }: { state: ReservationStatus }) {
  // Each state gets a bg + fg + a "dot" color for the leading indicator.
  // The dot is the same hue as the foreground but at a more saturated mid
  // tone, mirroring how Linear/Stripe render status chips.
  const map: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
    pending:   { bg:'var(--clay-50)',        fg:'var(--clay-700)',        dot: 'var(--clay-500)',       label:'Pendent'    },
    confirmed: { bg:'var(--olive-50)',       fg:'var(--olive-700)',       dot: 'var(--olive-500)',      label:'Confirmada' },
    seated:    { bg:'var(--terracotta-50)',  fg:'var(--terracotta-700)',  dot: 'var(--terracotta-500)', label:'A taula'    },
    completed: { bg:'var(--ink-100)',        fg:'var(--ink-600)',         dot: 'var(--ink-400)',        label:'Acabada'    },
    cancelled: { bg:'#f2ebe4',              fg:'var(--ink-500)',         dot: 'var(--ink-400)',        label:'Cancel·lada' },
    noshow:    { bg:'var(--rose-50)',        fg:'var(--rose-700)',        dot: 'var(--rose-600)',       label:'No-show'    },
  };
  const s = map[state] ?? map.pending;

  // Detect status changes and trigger a brief blur+scale morph so the colour
  // swap reads as a single transformation rather than a hard snap.
  const prev = useRef(state);
  const [morphing, setMorphing] = useState(false);
  useEffect(() => {
    if (prev.current === state) return;
    prev.current = state;
    setMorphing(true);
    const t = setTimeout(() => setMorphing(false), 240);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <span
      // key={state} is intentional: when the value changes, React re-mounts
      // the span so the .status-morph keyframes always fire from the top.
      key={state}
      className={morphing ? 'status-morph' : undefined}
      style={{
        display:'inline-flex', alignItems:'center', gap: 5,
        padding:'3px 10px 3px 8px', borderRadius:999,
        background:s.bg, color:s.fg,
        fontSize:11.5, fontWeight:600, whiteSpace:'nowrap',
        transition:'background 220ms var(--ease-in-out), color 220ms var(--ease-in-out)',
        ...(state === 'cancelled' ? { textDecoration:'line-through' } : {}),
      }}
    >
      <span aria-hidden style={{
        width: 6, height: 6, borderRadius: '50%',
        background: s.dot, flexShrink: 0,
      }} />
      {s.label}
    </span>
  );
}

// ─── Reservation row (new design) ─────────────────────────────────────────────
// Colors per estat — il·luminen la fila amb un toc subtil del color de l'estat
const STATUS_TINT: Record<string, { paxBg: string; paxFg: string; paxRing: string; rowTint: string }> = {
  pending:   { paxBg:'var(--clay-50)',       paxFg:'var(--clay-700)',       paxRing:'var(--clay-500)',       rowTint:'rgba(204,144,73,.04)'   },
  confirmed: { paxBg:'var(--olive-50)',      paxFg:'var(--olive-700)',      paxRing:'var(--olive-600)',      rowTint:'rgba(116,133,74,.04)'   },
  seated:    { paxBg:'var(--terracotta-50)', paxFg:'var(--terracotta-700)', paxRing:'var(--terracotta-600)', rowTint:'rgba(200,97,58,.05)'    },
  completed: { paxBg:'var(--ink-100)',       paxFg:'var(--ink-700)',        paxRing:'var(--ink-500)',        rowTint:'transparent'            },
  cancelled: { paxBg:'#f2ebe4',              paxFg:'var(--ink-500)',        paxRing:'var(--ink-400)',        rowTint:'transparent'            },
  noshow:    { paxBg:'var(--rose-50)',       paxFg:'var(--rose-700)',       paxRing:'var(--rose-600)',       rowTint:'rgba(194,74,74,.04)'    },
};

function ResRow({ res: r, selected, onSel, plan, loyalty }: {
  res: Reservation; selected: boolean; onSel: (r: Reservation) => void;
  plan?: FloorPlan;
  loyalty?: LoyaltyEntry;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const effectiveStatus: ReservationStatus =
    r.status === 'noshow' && r.date < today ? 'completed' : r.status;
  const tl   = buildTableLine(r, plan);
  const tint = STATUS_TINT[effectiveStatus] ?? STATUS_TINT.pending;
  const allergens = r.allergens ?? [];
  const hasAllergens = allergens.length > 0 || r.tags?.includes('allergy');

  // Status-tied left accent — a 3px colored bar gives an at-a-glance read
  // of the reservation state without painting the whole card (which used
  // to make every row look like a different mood). The legacy tint.rowTint
  // is dropped — the status pill + accent bar carry enough signal.
  const accentColor =
    effectiveStatus === 'seated'    ? 'var(--terracotta-500)' :
    effectiveStatus === 'confirmed' ? 'var(--olive-500)'      :
    effectiveStatus === 'pending'   ? 'var(--clay-500)'       :
    effectiveStatus === 'noshow'    ? 'var(--rose-500, #c24a4a)' :
    'transparent';
  return (
    <button onClick={() => onSel(r)} className="press"
      style={{
        position: 'relative',
        width: 'calc(100% - 16px)', margin: '0 8px 5px',
        textAlign: 'left',
        background: selected ? 'var(--terracotta-50)' : 'var(--surface-elevated)',
        border: 'none', borderRadius: 12,
        boxShadow: selected
          ? '0 0 0 1.5px var(--terracotta-500), var(--shadow-md), var(--shadow-inset-top)'
          : 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
        padding: '10px 14px 10px 16px',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        transition:
          'background 160ms var(--ease-ios), ' +
          'box-shadow 160ms var(--ease-ios), ' +
          'transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
      {/* Status accent — colored bar pinned to the left edge */}
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: accentColor,
      }} />

      {/* Pax tile — denser (46×46 vs 54×54) keeps signal without robbing
          ~8 px of vertical per row. */}
      <div style={{
        width:46, height:46, borderRadius:11, flexShrink:0,
        background: tint.paxBg,
        boxShadow: `inset 0 0 0 1.5px ${tint.paxRing}`,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:0,
      }}>
        <span style={{
          fontFamily:'var(--font-serif)', fontSize:19, fontWeight:500,
          color: tint.paxFg, lineHeight:1,
        }}>{r.pax}</span>
        <span style={{
          fontSize:8, fontWeight:700, color: tint.paxFg, opacity:.7,
          letterSpacing:.08, marginTop:1,
        }}>PAX</span>
      </div>

      {/* Body — name, meta, zone, allergens, notes (tighter gap) */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3 }}>

        {/* Name line + tags */}
        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          <span style={{
            fontSize:16, fontWeight:650, color:'var(--ink-900)', letterSpacing:-.005,
          }}>{r.name}</span>
          {r.tags?.includes('vip') && (
            <span style={{
              fontSize:9.5, padding:'2px 6px', borderRadius:4, fontWeight:700, letterSpacing:.4,
              background:'#2a2119', color:'#f3dca6',
            }}>VIP</span>
          )}
          {r.tags?.includes('birthday') && (
            <span style={{ fontSize:13, lineHeight:1 }} aria-label="Aniversari">🎂</span>
          )}
          {r.seriesId && (
            <span title="Part d'una reserva recurrent"
              style={{ fontSize:11, lineHeight:1, opacity:.7 }} aria-label="Recurrent">🔁</span>
          )}
        </div>

        {/* Meta line: time · phone · source */}
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          fontSize:12.5, color:'var(--ink-500)', flexWrap:'wrap',
        }}>
          <span style={{
            fontFamily:'var(--font-mono)', fontWeight:650, color:'var(--ink-700)',
          }}>{r.time}</span>
          {r.phone && (
            <>
              <span style={{ width:3, height:3, borderRadius:999, background:'var(--ink-300)' }} />
              <span style={{ fontFamily:'var(--font-mono)' }}>{r.phone}</span>
            </>
          )}
          {r.source && (
            <>
              <span style={{ width:3, height:3, borderRadius:999, background:'var(--ink-300)' }} />
              <span style={{ textTransform:'capitalize' }}>{r.source}</span>
            </>
          )}
        </div>

        {/* Zone + table line */}
        {tl && (
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginTop:1 }}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:4,
              fontSize:11, fontWeight:650, padding:'2px 8px', borderRadius:6,
              background:tl.bg, color:tl.color,
            }}>{tl.icon} {tl.zone}</span>
            <span style={{
              fontSize:12, color:'var(--ink-600)', fontFamily:'var(--font-mono)', fontWeight:550,
            }}>{tl.tableStr.replace(/^Taules?\s/, '')}</span>
          </div>
        )}

        {/* Allergens — prominent rose banner */}
        {hasAllergens && (
          <div style={{
            display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
            marginTop:3, padding:'4px 9px',
            background:'var(--rose-50)', borderRadius:7,
            border:'1px solid rgba(194,74,74,.18)',
            alignSelf:'flex-start', maxWidth:'100%',
          }}>
            <span style={{ fontSize:11, lineHeight:1 }}>⚠️</span>
            <span style={{
              fontSize:10, fontWeight:800, letterSpacing:.06,
              color:'var(--rose-700)', textTransform:'uppercase',
            }}>Al·lèrgens</span>
            {allergens.length > 0 ? (
              <span style={{
                fontSize:11.5, color:'var(--rose-700)', fontWeight:600,
                display:'inline-flex', alignItems:'center', gap:5, flexWrap:'wrap',
              }}>
                {allergens.slice(0, 4).map((id, i) => {
                  const a = allergenById(id);
                  if (!a) return null;
                  return (
                    <span key={id} style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                      <span style={{ fontSize:12, lineHeight:1 }}>{a.emoji}</span>
                      <span>{a.label}</span>
                      {i < Math.min(allergens.length, 4) - 1 && (
                        <span style={{ color:'var(--rose-600)', opacity:.5, marginLeft:2 }}>·</span>
                      )}
                    </span>
                  );
                })}
                {allergens.length > 4 && (
                  <span style={{ opacity:.7 }}>+{allergens.length - 4}</span>
                )}
              </span>
            ) : (
              <span style={{ fontSize:11.5, color:'var(--rose-700)', fontWeight:600 }}>
                Cal preguntar
              </span>
            )}
          </div>
        )}

        {/* Notes preview */}
        {r.notes && (
          <div style={{
            fontSize:12, color:'var(--ink-500)', fontStyle:'italic',
            marginTop:2, overflow:'hidden', textOverflow:'ellipsis',
            display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' as const,
          }}>
            “{r.notes}”
          </div>
        )}
      </div>

      {/* Right side — status pill + loyalty level (visible reference for the customer) */}
      <div style={{ flexShrink:0, alignSelf:'flex-start', marginTop:2, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5 }}>
        <ResStatePill state={effectiveStatus} />
        {loyalty && (
          <span title={`${loyalty.stats.points} punts · rang #${loyalty.rank}`} style={{
            display:'inline-flex', alignItems:'center', gap:3,
            padding:'2px 7px', borderRadius:999,
            background: loyalty.stats.level.bg,
            color: loyalty.stats.level.color,
            border: `1px solid ${loyalty.stats.level.color}33`,
            fontSize:10, fontWeight:700, letterSpacing:.2,
            whiteSpace:'nowrap',
          }}>
            <span style={{ fontSize:11 }}>{loyalty.stats.level.icon}</span>
            <span>{loyalty.stats.level.name}</span>
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Date picker bottom sheet ─────────────────────────────────────────────────
function DatePickerSheet({ open, selected, onSelect, onClose, reservations, bizId }: {
  open: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
  reservations: Reservation[];
  bizId: BusinessId;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const base  = new Date();
  const year  = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1).getFullYear();
  const month = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1).getMonth();

  const monthLabel = new Date(year, month, 1).toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(Math.ceil((firstDow + daysInMonth) / 7) * 7).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells[firstDow + d - 1] = d;

  const countByDay = useMemo(() => {
    const m: Record<string, number> = {};
    reservations.filter(r => r.bizId === bizId).forEach(r => {
      const [ry, rm] = r.date.split('-').map(Number);
      if (ry === year && rm === month + 1) m[r.date] = (m[r.date] ?? 0) + 1;
    });
    return m;
  }, [reservations, bizId, year, month]);

  const todayStr = isoDate(new Date());
  const selStr   = isoDate(selected);

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={201}>
      <div style={{
        background:'var(--paper)', borderRadius:'20px 20px 0 0',
        padding:'14px 14px calc(24px + env(safe-area-inset-bottom))',
        boxShadow:'0 -4px 24px rgba(0,0,0,.18)',
      }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 12px' }} />

        {/* Month nav */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:10 }}>
          <button onClick={() => setMonthOffset(m => m - 1)}
            style={{ width:32, height:32, border:'none', background:'transparent', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-500)' }}>
            <Icon d={I.chevL} size={16} />
          </button>
          <span style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:700, color:'var(--ink-900)', textTransform:'capitalize' }}>{monthLabel}</span>
          <button onClick={() => setMonthOffset(m => m + 1)}
            style={{ width:32, height:32, border:'none', background:'transparent', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-500)' }}>
            <Icon d={I.chevR} size={16} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
          {['Dl','Dt','Dc','Dj','Dv','Ds','Dg'].map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:10.5, fontWeight:600, color:'var(--ink-400)' }}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} style={{ height:38 }} />;
            const ds      = isoDate(new Date(year, month, day));
            const count   = countByDay[ds] ?? 0;
            const isSel   = ds === selStr;
            const isToday = ds === todayStr;
            return (
              <button key={i} onClick={() => onSelect(new Date(year, month, day))}
                style={{
                  height:38, borderRadius:8, padding:'0 2px',
                  border: isSel ? '2px solid var(--terracotta-600)' : isToday ? '1.5px solid rgba(60,40,20,.2)' : '1.5px solid transparent',
                  background: isSel ? 'var(--terracotta-50)' : 'transparent',
                  cursor:'pointer', fontFamily:'inherit',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                }}>
                <span style={{
                  fontSize:13, fontWeight: isSel ? 700 : isToday ? 800 : 400,
                  color: isSel ? 'var(--terracotta-700)' : isToday ? 'var(--terracotta-600)' : 'var(--ink-800)',
                }}>
                  {day}
                </span>
                {count > 0 && (
                  <span style={{ width:4, height:4, borderRadius:'50%', background: isSel ? 'var(--terracotta-500)' : 'var(--terracotta-400)' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick buttons — row 1: day-by-day + jump to today */}
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <button onClick={() => { const nd = new Date(selected); nd.setDate(nd.getDate()-1); onSelect(nd); }}
            style={{ flex:1, padding:'10px 0', borderRadius:10, border:'var(--hair)', background:'var(--cream)', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'var(--ink-700)', cursor:'pointer' }}>
            ← Ahir
          </button>
          <button onClick={() => onSelect(new Date())}
            style={{ flex:1, padding:'10px 0', borderRadius:10, border:'var(--hair)', background:'var(--cream)', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'var(--terracotta-600)', cursor:'pointer' }}>
            Avui
          </button>
          <button onClick={() => { const nd = new Date(selected); nd.setDate(nd.getDate()+1); onSelect(nd); }}
            style={{ flex:1, padding:'10px 0', borderRadius:10, border:'var(--hair)', background:'var(--cream)', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'var(--ink-700)', cursor:'pointer' }}>
            Demà →
          </button>
        </div>
        {/* Quick buttons — row 2: week-sized jumps for longer-range planning */}
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button onClick={() => { const nd = new Date(selected); nd.setDate(nd.getDate()-7); onSelect(nd); }}
            style={{ flex:1, padding:'9px 0', borderRadius:10, border:'var(--hair)', background:'transparent', fontFamily:'inherit', fontSize:12, fontWeight:600, color:'var(--ink-600)', cursor:'pointer' }}>
            ‹‹ −7 dies
          </button>
          <button onClick={() => { const nd = new Date(selected); nd.setDate(nd.getDate()+7); onSelect(nd); }}
            style={{ flex:1, padding:'9px 0', borderRadius:10, border:'var(--hair)', background:'transparent', fontFamily:'inherit', fontSize:12, fontWeight:600, color:'var(--ink-600)', cursor:'pointer' }}>
            +7 dies ››
          </button>
        </div>
      </div>
    </AnimatedSheet>
  );
}

// ─── Detail bottom sheet ──────────────────────────────────────────────────────
function ResDetailSheet({ open, res, onClose, onEditFull }: {
  open: boolean;
  res: Reservation | null;
  onClose: () => void;
  onEditFull?: (r: Reservation) => void;
}) {
  const {
    updateReservationStatus, deleteReservation,
    assignTablesToReservation, floorPlans, customers, addCustomer,
  } = useAppStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTableSel, setShowTableSel] = useState(false);
  // Snapshot: preserve last reservation so content stays visible during close animation
  const [snap, setSnap] = useState(res);
  if (res && res !== snap) setSnap(res);
  const r = snap;

  const today = new Date().toISOString().slice(0, 10);
  const effectiveStatus: ReservationStatus | undefined = r
    ? (r.status === 'noshow' && r.date < today ? 'completed' : r.status)
    : undefined;

  const plan = r ? floorPlans[r.bizId] : undefined;
  const assignedTableNames = (r?.tableIds ?? [])
    .map(id => plan?.tables.find(t => t.id === id)?.name ?? id)
    .join(' + ');

  // Detect if the client is already in the cartera
  const existingCustomer = useMemo(() => {
    if (!r) return undefined;
    const phone = (r.phone ?? '').replace(/\s/g, '');
    const bizClients = customers.filter(c => c.biz.includes(r.bizId));
    if (phone.length >= 6) {
      const m = bizClients.find(c => (c.phone || '').replace(/\s/g, '') === phone);
      if (m) return m;
    }
    return bizClients.find(c => c.name.toLowerCase() === r.name.toLowerCase());
  }, [r, customers]);

  function addToCartera() {
    if (!r) return;
    addCustomer({
      name:      r.name,
      phone:     r.phone ?? '',
      email:     '',
      visits:    1,
      lastVisit: r.date,
      spend:     0,
      tags:      r.allergens && r.allergens.length > 0 ? ['allergy'] : [],
      biz:       [r.bizId],
      notes:     r.notes ?? '',
    });
    toast(`${r.name} afegit a la cartera`, { icon: 'check', tone: 'olive' });
  }

  function handleDelete() {
    if (!r) return;
    deleteReservation(r.id);
    onClose();
  }

  if (!r) return null;

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={100}>
      <div style={{
        background:'var(--paper)', borderRadius:'18px 18px 0 0',
        boxShadow:'0 -4px 24px rgba(0,0,0,.15)',
        padding:'14px 18px',
        paddingBottom:'max(env(safe-area-inset-bottom, 0px), 16px)',
      }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 14px' }} />

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <span className={`avatar lg av-${avIdx(r.name)}`}>{initials(r.name)}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)' }}>{r.name}</div>
            <div style={{ fontSize:12.5, color:'var(--ink-600)', marginTop:2 }}>
              {r.time} · {r.pax} pax{r.source ? ` · ${r.source}` : ''}
            </div>
          </div>
          <ResStatePill state={effectiveStatus ?? r.status} />
          {onEditFull && (
            <button onClick={() => onEditFull(r)} aria-label="Editar" className="press"
              style={{
                width:34, height:34, borderRadius:999,
                background:'var(--cream)', border:'1px solid rgba(60,40,20,.10)',
                cursor:'pointer', color:'var(--ink-700)',
                display:'grid', placeItems:'center', flexShrink:0,
              }}>
              <Icon d={I.pencil} size={14} stroke={1.9} />
            </button>
          )}
          <button onClick={onClose}
            style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', padding:4 }}>
            <Icon d={I.x} size={18} />
          </button>
        </div>

        <>
            {r.notes && (
              <div style={{
                background:'rgba(250,230,120,.2)', borderRadius:8,
                padding:'8px 11px', fontSize:13, color:'#5a4a1a', marginBottom:12,
                border:'1px solid rgba(200,170,50,.25)',
              }}>
                {r.notes}
              </div>
            )}
            {r.phone && (
              <div style={{
                fontSize:12.5, color:'var(--ink-600)', marginBottom:12,
                display:'flex', alignItems:'center', gap:6,
              }}>
                <Icon d={I.phone} size={13} />
                <span style={{ fontFamily:'var(--font-mono)' }}>{r.phone}</span>
              </div>
            )}

            {/* Cartera status — Ja en cartera o CTA Desar com a client */}
            {(r.phone || r.name) && (
              existingCustomer ? (
                <div style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'8px 11px', borderRadius:9, marginBottom:12,
                  background:'var(--olive-50)',
                  border:'1px solid rgba(116,133,74,.20)',
                  fontSize:12.5, color:'var(--olive-700)', fontWeight:600,
                }}>
                  <Icon d={I.check} size={13} stroke={2.4} />
                  Ja és a la cartera ({existingCustomer.visits} visites)
                </div>
              ) : (
                <button onClick={addToCartera} className="press"
                  style={{
                    display:'flex', alignItems:'center', gap:9,
                    padding:'9px 12px', borderRadius:10, marginBottom:12,
                    background:'transparent',
                    border:'1px dashed rgba(116,133,74,.40)',
                    cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                    width:'100%', color:'var(--olive-700)',
                    fontSize:13, fontWeight:650,
                  }}>
                  <Icon d={I.users} size={14} stroke={1.9} />
                  <span style={{ flex:1 }}>Desar com a client a la cartera</span>
                  <Icon d={I.plus} size={12} stroke={2.4} />
                </button>
              )
            )}

            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              {r.phone && (
                <a href={`tel:${r.phone}`} className="tac-btn"
                  style={{
                    flex:1, padding:'10px', textAlign:'center',
                    borderRadius:11,
                    textDecoration:'none', fontSize:13, fontWeight:600,
                    color:'var(--ink-800)',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  }}>
                  <Icon d={I.phone} size={14} /> Trucar
                </a>
              )}
              {r.status !== 'seated' && (
                <button onClick={() => { updateReservationStatus(r.id, 'seated'); onClose(); }}
                  className="tac-btn tac-btn--accent"
                  style={{
                    flex:2, padding:'10px',
                    borderRadius:11,
                    fontSize:13, fontWeight:700,
                  }}>
                  A taula →
                </button>
              )}
            </div>

            {/* ── Table assignment row ─────────────────────── */}
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'8px 0', borderTop:'var(--hair)', marginBottom:8,
            }}>
              <Icon d={I.tableIco} size={14} />
              <span style={{
                flex:1, fontSize:13,
                color: r.tableIds && r.tableIds.length > 0 ? 'var(--ink-900)' : 'var(--ink-500)',
                fontStyle: r.tableIds && r.tableIds.length > 0 ? 'normal' : 'italic',
                fontWeight: r.tableIds && r.tableIds.length > 0 ? 600 : 400,
              }}>
                {r.tableIds && r.tableIds.length > 0 ? assignedTableNames : 'Sense taula assignada'}
              </span>
              <button onClick={() => setShowTableSel(true)} className="tac-btn"
                style={{
                  padding:'4px 10px', fontSize:12,
                  borderRadius:7,
                  fontWeight:600, color:'var(--ink-700)',
                }}>
                {r.tableIds && r.tableIds.length > 0 ? 'Canviar' : 'Assignar taula'}
              </button>
            </div>

            <HoldToDelete onConfirm={handleDelete} />
        </>
      </div>

      {/* ── Confirm delete ───────────────────────────────────────── */}
      {confirmDelete && (
        <div style={{ position:'fixed', inset:0, zIndex:110, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', background:'var(--paper)', padding:'20px 18px calc(env(safe-area-inset-bottom) + 24px)', borderRadius:'20px 20px 0 0' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--ink-900)', marginBottom:6 }}>Eliminar reserva</div>
            <div style={{ fontSize:13.5, color:'var(--ink-600)', marginBottom:20, lineHeight:1.55 }}>
              Segur que vols eliminar la reserva de <b>{r.name}</b>?<br />
              <span style={{ color:'var(--ink-400)', fontSize:12.5 }}>Aquesta acció no es pot desfer.</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmDelete(false)} className="tac-btn"
                style={{ flex:1, padding:'13px', borderRadius:12, fontSize:14, fontWeight:600, color:'var(--ink-800)' }}>
                Cancel·lar
              </button>
              <button onClick={handleDelete} className="tac-btn"
                style={{ flex:1, padding:'13px', borderRadius:12, fontSize:14, fontWeight:700, color:'#c0392b' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table selector modal ─────────────────────────────────── */}
      {showTableSel && (
        <TableSelectorModal
          bizId={r.bizId}
          pax={r.pax}
          currentIds={r.tableIds ?? []}
          date={r.date}
          onSave={ids => assignTablesToReservation(r.id, ids)}
          onClose={() => setShowTableSel(false)}
        />
      )}
    </AnimatedSheet>
  );
}

// ─── New reservation bottom sheet ─────────────────────────────────────────────
function NewResSheet({ open, bizId, defaultDate, addReservation, onClose, editRes }: {
  open: boolean;
  bizId: BusinessId;
  defaultDate: string;
  addReservation: (r: Omit<Reservation, 'id'>) => void;
  onClose: () => void;
  /** When provided, the sheet enters edit mode: form is pre-filled, the
   *  title says "Editar reserva", and Crear becomes Desar canvis. */
  editRes?: Reservation;
}) {
  const biz = BUSINESSES.find(b => b.id === bizId)!;
  const { customers, floorPlans, addCustomer, updateCustomer, updateReservation, addReservationSeries } = useAppStore();
  const plan = floorPlans[bizId];
  const isEdit = !!editRes;

  // Form initial date defaults to the day currently being viewed in the
  // calendar (passed as `defaultDate` from the parent), NOT to today.
  // Operators routinely scroll forward to plan tomorrow's service — and
  // they expect "+" to create a reservation for that day. Time still
  // defaults to "now" because it's a reasonable starting point: most
  // walk-in / phone reservations are happening at the time of entry.
  const nowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const [form, setForm] = useState({
    date:      defaultDate,
    time:      nowTime(),
    name:      '',
    phone:     '',
    pax:       2,
    notes:     '',
    status:    'pending' as ReservationStatus,
    source:    'directe',
    allergens: [] as string[],
  });
  const [saved,         setSaved]         = useState(false);
  const [touched,       setTouched]       = useState(false);
  const [clientQuery,   setClientQuery]   = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [editingPax,       setEditingPax]       = useState(false);
  const [paxInput,         setPaxInput]         = useState('');
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [showTableSel,     setShowTableSel]     = useState(false);
  // Tracks whether the operator picked an existing client from the cartera
  // (so we don't ask to "save to cartera" for someone already in it)
  const [pickedFromCartera, setPickedFromCartera] = useState(false);
  // Default ON when the user is typing a fresh client; toggle is hidden
  // when there's no name+phone yet, or when picked from cartera, or when
  // a customer with that exact phone already exists.
  const [saveToCartera,     setSaveToCartera]     = useState(true);
  // Recurring series — only available when creating (not editing).
  const [recurring,         setRecurring]         = useState(false);
  const [recurFreq,         setRecurFreq]         = useState<RecurFreq>('weekly');
  const [recurOccurrences,  setRecurOccurrences]  = useState(8);

  // Custom DatePickerPopover for the DATA tile.
  const dateTileRef = useRef<HTMLLabelElement | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  // Custom TimePickerPopover for the HORA tile.
  const timeTileRef = useRef<HTMLLabelElement | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);

  // ── Reset form every time the sheet opens ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (editRes) {
      // Edit mode — pre-fill from the reservation being edited
      setForm({
        date:      editRes.date,
        time:      editRes.time,
        name:      editRes.name,
        phone:     editRes.phone ?? '',
        pax:       editRes.pax,
        notes:     editRes.notes ?? '',
        status:    editRes.status,
        source:    editRes.source ?? 'directe',
        allergens: editRes.allergens ?? [],
      });
      setSelectedTableIds(editRes.tableIds ?? []);
      setPickedFromCartera(true);  // hide cartera toggle while editing
    } else {
      // New reservation — pick up the date the operator is currently
      // looking at, not "today". Without this, navigating to a future
      // date in the calendar and tapping "+" silently snaps the form
      // back to today's date and the operator ends up creating the
      // reservation in the wrong day.
      setForm({ date: defaultDate, time: nowTime(), name: '', phone: '', pax: 2, notes: '', status: 'pending' as ReservationStatus, source: 'directe', allergens: [] });
      setSelectedTableIds([]);
      setPickedFromCartera(false);
    }
    setSaved(false);
    setTouched(false);
    setClientQuery('');
    setShowDropdown(false);
    setEditingPax(false);
    setShowTableSel(false);
    setSaveToCartera(true);
  }, [open, editRes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed: names of selected tables
  const allTables = plan ? plan.tables : [];
  const assignedTableNames = selectedTableIds.length > 0
    ? selectedTableIds
        .map(id => allTables.find(t => t.id === id))
        .filter(Boolean)
        .map(t => t!.name || t!.id)
        .join(', ')
    : null;

  function upd<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // Clients filtered by business + search query
  const bizClients = useMemo(() =>
    customers.filter(c => c.biz.includes(bizId)),
    [customers, bizId]
  );
  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return bizClients.slice(0, 6);
    return bizClients.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
    ).slice(0, 6);
  }, [bizClients, clientQuery]);

  function selectClient(c: typeof customers[number]) {
    upd('name',  c.name);
    upd('phone', c.phone || '');
    setClientQuery('');
    setShowDropdown(false);
    setPickedFromCartera(true);
  }

  // Match existing customer by phone (preferred) or exact name
  const existingCustomer = useMemo(() => {
    const phone = form.phone.replace(/\s/g, '');
    if (phone.length >= 6) {
      const m = bizClients.find(c => (c.phone || '').replace(/\s/g, '') === phone);
      if (m) return m;
    }
    const name = form.name.trim().toLowerCase();
    if (name.length >= 3) {
      return bizClients.find(c => c.name.toLowerCase() === name);
    }
    return undefined;
  }, [bizClients, form.phone, form.name]);

  // Show the "Desar a la cartera" toggle only when the operator typed a
  // fresh client (didn't pick from cartera, no exact existing match yet,
  // and at least a phone OR a 3+-char name has been entered).
  const showCarteraToggle = !pickedFromCartera && !existingCustomer
    && (form.phone.replace(/\s/g,'').length >= 6 || form.name.trim().length >= 3);

  function handleSave() {
    setTouched(true);
    if (!form.name.trim()) return;
    const payload = {
      bizId,
      date:      form.date,
      time:      form.time,
      name:      form.name.trim(),
      pax:       form.pax,
      status:    form.status,
      phone:     form.phone || undefined,
      notes:     form.notes || undefined,
      source:    form.source,
      tableIds:  selectedTableIds.length > 0 ? selectedTableIds : undefined,
      allergens: form.allergens.length > 0 ? form.allergens : undefined,
    };
    if (isEdit && editRes) {
      updateReservation(editRes.id, payload);
    } else if (recurring && recurOccurrences > 1) {
      // Strip date from template — the series action assigns it per occurrence.
      const { date: _ignored, ...rest } = payload;
      addReservationSeries(rest, payload.date, {
        freq: recurFreq,
        occurrences: recurOccurrences,
      });
    } else {
      addReservation(payload);
    }
    // Optionally add the client to the cartera so the next reservation can
    // pick them with one tap from the search dropdown.
    if (showCarteraToggle && saveToCartera) {
      addCustomer({
        name:      form.name.trim(),
        phone:     form.phone.trim(),
        email:     '',
        visits:    1,
        lastVisit: form.date,
        spend:     0,
        tags:      form.allergens.length > 0 ? ['allergy'] : [],
        biz:       [bizId],
        notes:     form.notes || '',
      });
    } else if (existingCustomer) {
      // The reservation matches an existing client in the cartera. Patch
      // any fields the operator changed in the form so we don't silently
      // drop new info — most importantly the phone, which the user
      // reported as being lost on edit. Only updates fields that DIFFER
      // and that the operator has explicitly filled in.
      const updates: Partial<typeof existingCustomer> = {};
      const formPhone = form.phone.replace(/\s/g, '');
      const cusPhone  = (existingCustomer.phone || '').replace(/\s/g, '');
      if (formPhone && formPhone !== cusPhone) {
        updates.phone = form.phone.trim();
      }
      const formName = form.name.trim();
      if (formName && formName !== existingCustomer.name) {
        updates.name = formName;
      }
      if (form.allergens.length > 0) {
        const tags = new Set([...(existingCustomer.tags || []), 'allergy']);
        const next = Array.from(tags);
        if (next.length !== (existingCustomer.tags || []).length) {
          updates.tags = next;
        }
      }
      if (Object.keys(updates).length > 0) {
        updateCustomer(existingCustomer.id, updates);
      }
    }
    setSaved(true);
    setTimeout(onClose, 700);
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'12px 14px', border:'1px solid rgba(60,40,20,.12)',
    borderRadius:12, fontFamily:'inherit', fontSize:15, color:'var(--ink-900)',
    background:'var(--paper)', boxSizing:'border-box', outline:'none',
    transition:'border-color 160ms var(--ease-ios), background 160ms var(--ease-ios)',
  };
  const lbl: React.CSSProperties = {
    fontSize:10.5, fontWeight:700, color:'var(--ink-500)',
    textTransform:'uppercase', letterSpacing:.08, marginBottom:7, display:'block',
  };
  const sectionTitle: React.CSSProperties = {
    fontFamily:'var(--font-serif)', fontSize:13, fontWeight:500,
    color:'var(--ink-700)', letterSpacing:.01, marginBottom:10,
    display:'flex', alignItems:'center', gap:8,
  };
  const sectionDot: React.CSSProperties = {
    width:4, height:4, borderRadius:999, background:'var(--terracotta-600)', flexShrink:0,
  };
  const card: React.CSSProperties = {
    background:'var(--cream)', borderRadius:14, padding:14,
    border:'1px solid rgba(60,40,20,.06)',
  };

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={100}>
      {/*
       * Layout: flex-column inside AnimatedSheet (which is position:fixed bottom:0)
       *   1. Sticky header  — drag handle + title + close
       *   2. Scrollable body — all form fields, no horizontal overflow
       *   3. Sticky footer  — "Crear reserva" always visible
       */}
      <div style={{
        background:'var(--ink-50)', borderRadius:'22px 22px 0 0',
        boxShadow:'0 -4px 32px rgba(0,0,0,.22)',
        display:'flex', flexDirection:'column',
        maxHeight:'calc(100dvh - env(safe-area-inset-top, 0px) - 16px)',
        overflow:'hidden',
        width:'100%',
      }}>

        {/* ── Sticky header ─────────────────────────────────────────── */}
        <div style={{ flexShrink:0, padding:'10px 18px 14px',
                      borderBottom:'1px solid rgba(60,40,20,.06)',
                      background:'var(--paper)' }}>
          <div style={{ width:38, height:4, borderRadius:2, background:'var(--ink-200)',
                        margin:'0 auto 14px' }} />
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500,
                            color:'var(--ink-900)', lineHeight:1.1, letterSpacing:-.005 }}>
                {isEdit ? 'Editar reserva' : 'Nova reserva'}
              </div>
              <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:3,
                            textTransform:'uppercase', letterSpacing:.08, fontWeight:600 }}>
                {biz.name}
              </div>
            </div>
            <button onClick={onClose} className="tac-btn"
              aria-label="Tancar"
              style={{ color:'var(--ink-600)',
                       width:36, height:36, borderRadius:999,
                       display:'grid', placeItems:'center', flexShrink:0 }}>
              <Icon d={I.x} size={16} />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ────────────────────────────────────── */}
        <div className="scroll" style={{
          flex:1, overflowY:'auto', overflowX:'hidden',
          padding:'14px 16px 12px',
          display:'flex', flexDirection:'column', gap:18,
          minHeight:0,
        }}>

          {/* ───── Group 1: Quan ─ tiles que mostren la data/hora formatada
                i amaguen el input natiu darrere (no desborda la card) ───── */}
          <section>
            <div style={sectionTitle}>
              <span style={sectionDot} />Quan
              <span style={{ marginLeft:'auto', fontSize:11, color:'var(--ink-500)',
                             fontWeight:550, letterSpacing:.04 }}>
                Ara mateix
              </span>
            </div>
            <div style={{ ...card, display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:8, padding:8 }}>
              {/* DATA — opens the custom DatePickerPopover anchored below. */}
              <label
                ref={dateTileRef}
                style={{
                  position:'relative', display:'flex', flexDirection:'column', gap:2,
                  background:'var(--paper)', borderRadius:10,
                  border:'1px solid rgba(60,40,20,.10)',
                  padding:'10px 12px', cursor:'pointer', minWidth:0, overflow:'hidden',
                }}
                onClick={() => setDateOpen(o => !o)}>
                <span style={{ ...lbl, marginBottom:0 }}>Data</span>
                <span style={{
                  fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
                  color:'var(--ink-900)', whiteSpace:'nowrap',
                  overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  {(() => {
                    const [y,m,dd] = form.date.split('-').map(Number);
                    const dt = new Date(y, (m||1)-1, dd||1);
                    return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
                  })()}
                </span>
              </label>
              <DatePickerPopover
                open={dateOpen}
                selected={(() => {
                  const [y,m,dd] = form.date.split('-').map(Number);
                  return new Date(y, (m||1)-1, dd||1);
                })()}
                onSelect={d => {
                  const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  upd('date', iso);
                }}
                onClose={() => setDateOpen(false)}
                anchorRef={dateTileRef}
              />

              {/* HORA — opens the custom TimePickerPopover anchored below. */}
              <label
                ref={timeTileRef}
                style={{
                  position:'relative', display:'flex', flexDirection:'column', gap:2,
                  background:'var(--paper)', borderRadius:10,
                  border:'1px solid rgba(60,40,20,.10)',
                  padding:'10px 12px', cursor:'pointer', minWidth:0, overflow:'hidden',
                }}
                onClick={() => setTimeOpen(o => !o)}>
                <span style={{ ...lbl, marginBottom:0 }}>Hora</span>
                <span style={{
                  fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
                  color:'var(--ink-900)', whiteSpace:'nowrap',
                  letterSpacing:.005,
                }}>
                  {form.time}
                </span>
              </label>
              <TimePickerPopover
                open={timeOpen}
                value={form.time}
                onChange={t => upd('time', t)}
                onClose={() => setTimeOpen(false)}
                anchorRef={timeTileRef}
              />
            </div>
          </section>

          {/* ───── Recurring series — only when creating, never when editing ───── */}
          {!isEdit && (
            <section>
              <div style={sectionTitle}>
                <span style={sectionDot} />Repetir
                {recurring && (
                  <span style={{
                    marginLeft:'auto', fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
                    color:'var(--terracotta-700)', lineHeight:1,
                  }}>{recurOccurrences}×</span>
                )}
              </div>
              <div style={card}>
                {/* Toggle row */}
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  paddingBottom: recurring ? 10 : 0,
                  borderBottom: recurring ? '1px dashed rgba(60,40,20,.10)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)' }}>Reserva recurrent</div>
                    <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:2 }}>
                      Genera múltiples reserves d'un cop (mateix dia de la setmana, hora i taula)
                    </div>
                  </div>
                  <button onClick={() => setRecurring(v => !v)} className="press"
                    aria-label={recurring ? 'Desactivar' : 'Activar'}
                    style={{
                      width:46, height:28, borderRadius:999, flexShrink:0,
                      border:'none', cursor:'pointer',
                      background: recurring ? 'var(--terracotta-600)' : 'var(--ink-200)',
                      position:'relative',
                      transition:'background 180ms var(--ease-ios)',
                    }}>
                    <span style={{
                      position:'absolute', top:2, left: recurring ? 20 : 2,
                      width:24, height:24, borderRadius:'50%', background:'#fff',
                      boxShadow:'0 1px 3px rgba(0,0,0,.18)',
                      transition:'left 200ms var(--ease-ios)',
                    }} />
                  </button>
                </div>

                {recurring && (
                  <>
                    {/* Frequency picker */}
                    <div style={{ marginTop:12 }}>
                      <div style={{ fontSize:10.5, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, textTransform:'uppercase', marginBottom:6 }}>
                        Freqüència
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
                        {([
                          ['weekly',   'Setmanal',   'cada 7 dies'],
                          ['biweekly', 'Quinzenal',  'cada 14 dies'],
                          ['monthly',  'Mensual',    'cada mes'],
                        ] as const).map(([id, label, sub]) => {
                          const active = recurFreq === id;
                          return (
                            <button key={id} onClick={() => setRecurFreq(id)} className="press"
                              style={{
                                padding:'9px 6px', borderRadius:10,
                                border: active ? '1.5px solid var(--terracotta-600)' : '1px solid rgba(60,40,20,.10)',
                                background: active ? 'var(--terracotta-50)' : 'var(--paper)',
                                color: active ? 'var(--terracotta-700)' : 'var(--ink-700)',
                                fontFamily:'inherit', cursor:'pointer',
                                display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                                transition:'background 140ms var(--ease-ios), border-color 140ms var(--ease-ios)',
                              }}>
                              <span style={{ fontSize:13, fontWeight:650 }}>{label}</span>
                              <span style={{ fontSize:10, opacity:.7 }}>{sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Occurrences */}
                    <div style={{ marginTop:14 }}>
                      <div style={{ fontSize:10.5, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, textTransform:'uppercase', marginBottom:6 }}>
                        Repeticions
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <button onClick={() => setRecurOccurrences(n => Math.max(2, n - 1))} className="press"
                          style={{
                            width:36, height:36, borderRadius:10,
                            border:'1px solid rgba(60,40,20,.10)', background:'var(--paper)',
                            color:'var(--ink-700)', cursor:'pointer',
                            display:'grid', placeItems:'center',
                          }}>
                          <Icon d={I.chevL} size={14} stroke={2.4} />
                        </button>
                        <div style={{ flex:1, textAlign:'center' }}>
                          <span style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500, color:'var(--ink-900)' }}>
                            {recurOccurrences}
                          </span>
                          <span style={{ fontSize:12, color:'var(--ink-500)', marginLeft:4 }}>
                            reserves
                          </span>
                        </div>
                        <button onClick={() => setRecurOccurrences(n => Math.min(52, n + 1))} className="press"
                          style={{
                            width:36, height:36, borderRadius:10,
                            border:'1px solid rgba(60,40,20,.10)', background:'var(--paper)',
                            color:'var(--ink-700)', cursor:'pointer',
                            display:'grid', placeItems:'center',
                          }}>
                          <Icon d={I.chevR} size={14} stroke={2.4} />
                        </button>
                      </div>
                      {/* Preview: last date in the series */}
                      <div style={{
                        marginTop:8, fontSize:11.5, color:'var(--ink-500)', textAlign:'center',
                        fontFamily:'var(--font-mono)', letterSpacing:.04,
                      }}>
                        última: {(() => {
                          const start = new Date(form.date + 'T00:00:00');
                          const end = new Date(start);
                          if (recurFreq === 'weekly')   end.setDate(end.getDate() + (recurOccurrences - 1) * 7);
                          else if (recurFreq === 'biweekly') end.setDate(end.getDate() + (recurOccurrences - 1) * 14);
                          else                                end.setMonth(end.getMonth() + (recurOccurrences - 1));
                          return end.toLocaleDateString('ca-ES', { day:'numeric', month:'short', year: end.getFullYear() !== start.getFullYear() ? 'numeric' : undefined });
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ───── Group 2: Persones — pill grid amb wrap, sense overflow ───── */}
          <section>
            <div style={sectionTitle}>
              <span style={sectionDot} />Persones
              <span style={{
                marginLeft:'auto', fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500,
                color:'var(--terracotta-700)', lineHeight:1,
              }}>{form.pax}</span>
            </div>
            <div style={card}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(8, 1fr)', gap:6 }}>
                {[1,2,3,4,5,6,7,8].map(n => (
                  <button key={n} onClick={() => { upd('pax', n); setEditingPax(false); }} className="press"
                    style={{
                      aspectRatio:'1/1', minHeight:0, borderRadius:10,
                      border: form.pax === n ? '1.5px solid var(--terracotta-600)' : '1px solid rgba(60,40,20,.10)',
                      background: form.pax === n ? 'var(--terracotta-600)' : 'var(--paper)',
                      color: form.pax === n ? '#fff' : 'var(--ink-800)',
                      fontFamily:'var(--font-serif)', fontWeight:500,
                      fontSize:15, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'background 140ms var(--ease-ios), border-color 140ms var(--ease-ios), color 140ms var(--ease-ios)',
                    }}>
                    {n}
                  </button>
                ))}
              </div>
              {/* Stepper inline per 9+ */}
              <div style={{
                marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between',
                gap:10, paddingTop:10, borderTop:'1px dashed rgba(60,40,20,.10)',
              }}>
                <span style={{ fontSize:11.5, color:'var(--ink-500)', fontWeight:550 }}>Més de 8</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => upd('pax', Math.max(1, form.pax - 1))} className="press"
                    style={{
                      width:34, height:34, borderRadius:999, border:'1px solid rgba(60,40,20,.12)',
                      background:'var(--paper)', cursor:'pointer', fontSize:17, fontWeight:500,
                      color:'var(--ink-700)', display:'grid', placeItems:'center',
                    }}>−</button>
                  {editingPax ? (
                    <input
                      type="number" inputMode="numeric" pattern="[0-9]*"
                      min={1} max={MAX_PAX}
                      value={paxInput} autoFocus
                      onChange={e => setPaxInput(e.target.value)}
                      onBlur={() => {
                        // Clamp to [1, MAX_PAX] but accept any integer in
                        // between. MAX_PAX is high enough (9999) for any
                        // real-world party — buses, weddings, etc. — but
                        // bounded to catch fat-finger entries like 99999.
                        const n = parseInt(paxInput, 10);
                        if (Number.isFinite(n) && n >= 1) {
                          upd('pax', Math.min(MAX_PAX, n));
                        }
                        setEditingPax(false);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = parseInt(paxInput, 10);
                          if (Number.isFinite(n) && n >= 1) {
                            upd('pax', Math.min(MAX_PAX, n));
                          }
                          setEditingPax(false);
                        }
                      }}
                      style={{
                        // Auto-grow with the digit count so 99 doesn't crop
                        // 9999 — minWidth keeps the small case looking the same.
                        minWidth: 54,
                        width: `${Math.max(54, 24 + String(paxInput || form.pax).length * 12)}px`,
                        height:34, textAlign:'center',
                        fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
                        color:'var(--ink-900)', background:'var(--paper)',
                        border:'1.5px solid var(--terracotta-500)', borderRadius:8, outline:'none',
                      }}
                    />
                  ) : (
                    <button onClick={() => { setEditingPax(true); setPaxInput(String(form.pax)); }}
                      style={{
                        minWidth:54, height:34, padding:'0 10px',
                        fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
                        color:'var(--ink-900)', background:'var(--paper)',
                        border:'1px solid rgba(60,40,20,.12)', borderRadius:8,
                        cursor:'text', display:'grid', placeItems:'center',
                      }}>
                      {form.pax}
                    </button>
                  )}
                  <button onClick={() => upd('pax', Math.min(MAX_PAX, form.pax + 1))} className="press"
                    style={{
                      width:34, height:34, borderRadius:999, border:'1px solid rgba(60,40,20,.12)',
                      background:'var(--paper)', cursor:'pointer', fontSize:17, fontWeight:500,
                      color:'var(--ink-700)', display:'grid', placeItems:'center',
                    }}>+</button>
                </div>
              </div>
            </div>
          </section>

          {/* ───── Group 3: Client ───── */}
          <section>
            <div style={sectionTitle}><span style={sectionDot} />Client</div>
            <div style={{ ...card, padding:12, display:'flex', flexDirection:'column', gap:10 }}>
              {/* Cerca a la cartera */}
              <div>
                <label style={lbl}>Cerca a la cartera</label>
                <div style={{ position:'relative' }}>
                  <input type="text" placeholder="Nom o telèfon…"
                    value={clientQuery}
                    onFocus={() => setShowDropdown(true)}
                    onChange={e => { setClientQuery(e.target.value); setShowDropdown(true); }}
                    style={{ ...inp, paddingLeft:38, padding:'10px 12px 10px 38px' }} />
                  <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
                                 color:'var(--ink-400)', pointerEvents:'none', display:'flex' }}>
                    <Icon d={I.search} size={15} />
                  </span>
                  {clientQuery && (
                    <button onClick={() => { setClientQuery(''); setShowDropdown(false); }}
                      style={{
                        position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                        background:'rgba(60,40,20,.08)', border:'none', borderRadius:999,
                        width:22, height:22, display:'grid', placeItems:'center', cursor:'pointer',
                        color:'var(--ink-500)',
                      }}>
                      <Icon d={I.x} size={12} />
                    </button>
                  )}
                </div>
                {/* Inline results — empenyen el contingut, no el tapen */}
                {showDropdown && clientMatches.length > 0 && (
                  <div style={{
                    marginTop:6, background:'var(--paper)', borderRadius:10,
                    border:'1px solid rgba(60,40,20,.10)',
                    boxShadow:'0 2px 8px rgba(60,40,20,.06)',
                    maxHeight:200, overflowY:'auto', overflowX:'hidden',
                  }}>
                    {clientMatches.map((c, i) => (
                      <button key={c.id}
                        onMouseDown={e => { e.preventDefault(); selectClient(c); }}
                        style={{
                          width:'100%', padding:'10px 12px', border:'none', background:'transparent',
                          cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                          borderBottom: i < clientMatches.length - 1 ? '1px solid rgba(60,40,20,.05)' : 'none',
                          fontFamily:'inherit', textAlign:'left',
                        }}>
                        <span className={`avatar av-${avIdx(c.name)}`} style={{ flexShrink:0 }}>{initials(c.name)}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)',
                                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                          {c.phone && <div style={{ fontSize:11.5, color:'var(--ink-500)',
                                                    fontFamily:'var(--font-mono)', marginTop:1 }}>{c.phone}</div>}
                        </div>
                        {c.tags?.includes('vip') && (
                          <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:.06,
                                         color:'var(--terracotta-700)', background:'var(--terracotta-50)',
                                         padding:'2px 6px', borderRadius:4, flexShrink:0 }}>VIP</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ height:1, background:'rgba(60,40,20,.06)', margin:'2px 0' }} />

              {/* Nom + Telèfon */}
              <div>
                <label style={lbl}>Nom <span style={{ color:'var(--terracotta-600)' }}>*</span></label>
                <input type="text" placeholder="Nom del client" value={form.name}
                  onChange={e => upd('name', e.target.value)}
                  onFocus={() => setShowDropdown(false)}
                  maxLength={80} autoComplete="name"
                  style={{
                    ...inp, padding:'10px 12px',
                    borderColor: touched && !form.name.trim() ? 'var(--terracotta-500)' : 'rgba(60,40,20,.12)',
                    background: touched && !form.name.trim() ? 'var(--terracotta-50)' : 'var(--paper)',
                  }} />
                {touched && !form.name.trim() && (
                  <div style={{ fontSize:11, color:'var(--terracotta-700)', marginTop:5,
                                display:'flex', alignItems:'center', gap:5 }}>
                    El nom és obligatori
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Telèfon</label>
                <input type="tel" placeholder="+34 600 000 000" value={form.phone}
                  onChange={e => upd('phone', e.target.value)}
                  onFocus={() => setShowDropdown(false)}
                  maxLength={30} inputMode="tel" autoComplete="tel"
                  pattern="^[+0-9 ()\-\.]{6,30}$"
                  style={{ ...inp, padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:14 }} />
              </div>

              {/* Save-to-cartera toggle — appears only for fresh clients */}
              {showCarteraToggle && (
                <button type="button"
                  onClick={() => setSaveToCartera(v => !v)}
                  className="press"
                  style={{
                    display:'flex', alignItems:'center', gap:11,
                    padding:'10px 12px', borderRadius:11,
                    border:'1px solid rgba(60,40,20,.08)',
                    background: saveToCartera ? 'var(--olive-50)' : 'var(--paper)',
                    cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                    transition:'background 200ms var(--ease-in-out), border-color 200ms var(--ease-in-out)',
                  }}>
                  {/* Custom checkbox */}
                  <span style={{
                    width:22, height:22, borderRadius:6,
                    border: saveToCartera
                      ? '1.5px solid var(--olive-600)'
                      : '1.5px solid rgba(60,40,20,.18)',
                    background: saveToCartera ? 'var(--olive-600)' : 'var(--paper)',
                    color:'#fff', flexShrink:0,
                    display:'grid', placeItems:'center',
                    transition:'background 180ms var(--ease-out), border-color 180ms var(--ease-out)',
                  }}>
                    {saveToCartera && <Icon d={I.check} size={13} stroke={2.6} />}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      fontSize:13.5, fontWeight:650, color:'var(--ink-900)',
                      letterSpacing:-.005,
                    }}>
                      Desar a la cartera
                    </div>
                    <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:2 }}>
                      Crea el client perquè la propera reserva sigui un toc
                    </div>
                  </div>
                </button>
              )}

              {/* Existing-customer hint — replaces the toggle when found */}
              {!pickedFromCartera && existingCustomer && (
                <div style={{
                  display:'flex', alignItems:'center', gap:9,
                  padding:'9px 12px', borderRadius:11,
                  background:'var(--olive-50)',
                  border:'1px solid rgba(116,133,74,.20)',
                  fontSize:12.5, color:'var(--olive-700)', fontWeight:600,
                }}>
                  <Icon d={I.check} size={14} stroke={2.4} />
                  <span style={{ flex:1, minWidth:0,
                                 overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    Ja és a la cartera ({existingCustomer.visits} visites)
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* ───── Group 4: Detalls ───── */}
          <section>
            <div style={sectionTitle}><span style={sectionDot} />Detalls</div>
            <div style={{ ...card, padding:12, display:'flex', flexDirection:'column', gap:12 }}>

              {/* Estat — segmented pills */}
              <div>
                <label style={lbl}>Estat</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {([
                    { v:'pending',   label:'Pendent',   bg:'var(--clay-50)',       fg:'var(--clay-700)',       dot:'var(--clay-500)'      },
                    { v:'confirmed', label:'Confirmat', bg:'var(--olive-50)',      fg:'var(--olive-700)',      dot:'var(--olive-600)'     },
                    { v:'seated',    label:'A taula',   bg:'var(--terracotta-50)', fg:'var(--terracotta-700)', dot:'var(--terracotta-600)' },
                  ] as const).map(o => {
                    const active = form.status === o.v;
                    return (
                      <button key={o.v} onClick={() => upd('status', o.v as ReservationStatus)} className="press"
                        style={{
                          padding:'9px 6px', borderRadius:9,
                          border: active ? `1.5px solid ${o.dot}` : '1px solid rgba(60,40,20,.10)',
                          background: active ? o.bg : 'var(--paper)',
                          color: active ? o.fg : 'var(--ink-600)',
                          fontFamily:'inherit', fontSize:12.5, fontWeight: active ? 700 : 550,
                          cursor:'pointer',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                        }}>
                        <span style={{ width:6, height:6, borderRadius:999, background:o.dot, flexShrink:0 }} />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Origen — segmented pills */}
              <div>
                <label style={lbl}>Origen</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                  {(['directe','telèfon','web','walk-in'] as const).map(o => {
                    const active = form.source === o;
                    return (
                      <button key={o} onClick={() => upd('source', o)} className="press"
                        style={{
                          padding:'8px 4px', borderRadius:9,
                          border: active ? '1.5px solid var(--ink-700)' : '1px solid rgba(60,40,20,.10)',
                          background: active ? 'var(--ink-900)' : 'var(--paper)',
                          color: active ? '#fff' : 'var(--ink-600)',
                          fontFamily:'inherit', fontSize:11.5, fontWeight: active ? 700 : 550,
                          cursor:'pointer', textTransform:'capitalize',
                        }}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Al·lèrgens — selector multi-chip */}
              <div>
                <label style={lbl}>
                  Al·lèrgens i intoleràncies
                  {form.allergens.length > 0 && (
                    <span style={{ color:'var(--rose-700)', marginLeft:6, fontWeight:700 }}>
                      · {form.allergens.length}
                    </span>
                  )}
                </label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {ALLERGENS.map(a => (
                    <AllergenChip
                      key={a.id}
                      label={a.label}
                      emoji={a.emoji}
                      active={form.allergens.includes(a.id)}
                      onToggle={() => upd('allergens',
                        form.allergens.includes(a.id)
                          ? form.allergens.filter(x => x !== a.id)
                          : [...form.allergens, a.id])}
                    />
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={lbl}>Notes</label>
                <textarea rows={2} placeholder="Ocasió especial, preferències…" value={form.notes}
                  onChange={e => upd('notes', e.target.value)}
                  onFocus={() => setShowDropdown(false)}
                  maxLength={1000}
                  style={{ ...inp, padding:'10px 12px', resize:'none', lineHeight:1.5, fontSize:14 }} />
              </div>

              {/* Taula */}
              {plan && (
                <div>
                  <label style={lbl}>Taula</label>
                  <button onClick={() => setShowTableSel(true)} className="press"
                    style={{
                      ...inp, padding:'10px 12px',
                      display:'flex', alignItems:'center', gap:10, cursor:'pointer', textAlign:'left',
                      borderStyle: assignedTableNames ? 'solid' : 'dashed',
                      borderColor: assignedTableNames ? 'var(--olive-600)' : 'rgba(60,40,20,.18)',
                      background: assignedTableNames ? 'var(--olive-50)' : 'var(--paper)',
                      color: assignedTableNames ? 'var(--olive-700)' : 'var(--ink-500)',
                    }}>
                    <Icon d={I.tableIco} size={16} />
                    <span style={{ flex:1, fontSize:13.5, fontWeight: assignedTableNames ? 600 : 500 }}>
                      {assignedTableNames ?? 'Assignar taula (opcional)'}
                    </span>
                    {assignedTableNames ? (
                      <span onClick={e => { e.stopPropagation(); setSelectedTableIds([]); }}
                        style={{ padding:'3px 7px', fontSize:11, borderRadius:6,
                                 background:'rgba(60,40,20,.08)', color:'var(--ink-600)', cursor:'pointer' }}>
                        Treure
                      </span>
                    ) : (
                      <Icon d={I.chevR} size={14} />
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>

        </div>

        {/* ── Sticky footer — "Crear reserva" always visible ────────── */}
        <div style={{
          flexShrink:0,
          padding:'12px 16px',
          paddingBottom:'max(env(safe-area-inset-bottom, 0px), 14px)',
          borderTop:'1px solid rgba(60,40,20,.08)',
          background:'var(--paper)',
        }}>
          <button onClick={handleSave} disabled={saved}
            className={`press ${saved ? 'save-button-pulse' : ''}`}
            style={{
              position:'relative',
              width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:15, fontWeight:650, letterSpacing:.005,
              color:'white', overflow:'hidden',
              background: saved
                ? 'linear-gradient(180deg, var(--olive-600) 0%, var(--olive-700) 100%)'
                : 'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)',
              boxShadow: saved
                ? '0 4px 14px rgba(116,133,74,.30), 0 1px 2px rgba(116,133,74,.18)'
                : '0 4px 14px rgba(168,74,42,.32), 0 1px 2px rgba(168,74,42,.18)',
              transition:'background 320ms var(--ease-in-out), box-shadow 320ms var(--ease-in-out)',
              minHeight:50,
            }}>
            {/* Two stacked labels — the inactive one fades + blurs out, the
                active one rises into place. key={saved} forces remount so
                the keyframes always run from the start. */}
            <span
              key={saved ? 'saved' : 'idle'}
              className={saved ? 'save-success-in' : undefined}
              style={{
                position:'absolute', inset:0,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
              {saved ? (
                <>
                  <Icon d={I.check} size={18} stroke={2.5} />
                  {isEdit ? 'Canvis desats' : (recurring && recurOccurrences > 1 ? `${recurOccurrences} reserves creades` : 'Reserva creada')}
                </>
              ) : (isEdit ? 'Desar canvis' : (recurring && recurOccurrences > 1 ? `Crear ${recurOccurrences} reserves` : 'Crear reserva'))}
            </span>
          </button>
        </div>
      </div>

      {showTableSel && (
        <TableSelectorModal
          bizId={bizId}
          pax={form.pax}
          currentIds={selectedTableIds}
          date={form.date}
          onSave={ids => { setSelectedTableIds(ids); setShowTableSel(false); }}
          onClose={() => setShowTableSel(false)}
        />
      )}
    </AnimatedSheet>
  );
}
