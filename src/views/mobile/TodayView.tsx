import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { initials, avIdx, isoDate, BUSINESSES, getZoneIcon, getZoneColor } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import TableSelectorModal from '@/components/shared/TableSelectorModal';
import AnimatedSheet from '@/components/shared/AnimatedSheet';
import type { Reservation, BusinessId, ReservationStatus, FloorPlan } from '@/types';

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
const MONTHS_SHORT = ['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'];

function parseH(t: string) { return parseInt(t.split(':')[0], 10); }

// ─── Main view ────────────────────────────────────────────────────────────────
interface TodayViewProps { newResTrigger?: number; hideDateNav?: boolean; }

export default function MobileTodayView({ newResTrigger = 0, hideDateNav = false }: TodayViewProps) {
  const {
    selectedBusiness, reservations, selectedDate, setSelectedDate,
    addReservation, floorPlans,
  } = useAppStore();
  const plan = floorPlans[selectedBusiness];

  const [sel, setSel]         = useState<Reservation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [shift, setShift]     = useState<'M' | 'N'>(() => new Date().getHours() >= 18 ? 'N' : 'M');
  const dayDirRef             = useRef<'next' | 'prev' | null>(null);
  const prevTrigger = useRef(-1);

  // Open new-reservation sheet when parent increments the trigger
  useEffect(() => {
    if (newResTrigger > 0 && newResTrigger !== prevTrigger.current) {
      prevTrigger.current = newResTrigger;
      setSel(null);
      setShowNew(true);
    }
  }, [newResTrigger]);

  const dateStr  = isoDate(selectedDate);
  const d        = selectedDate;
  const isToday  = isoDate(new Date()) === dateStr;
  const dayLabel = `${DAYS_CA[d.getDay()]}, ${d.getDate()} de ${MONTHS_CA[d.getMonth()]}`;

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
  const activeList = effectiveShift === 'N' ? nit : migdia;

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

          <button onClick={() => setShowCal(true)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', padding:'4px 0' }}>
            <span className="mono" style={{ fontSize:13, fontWeight:600, color:'var(--ink-800)' }}>{dayLabel}</span>
            <Icon d={I.calendar} size={14} />
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

        {/* Segmented control + count */}
        {(migdia.length > 0 || nit.length > 0) && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:10 }}>
            <div style={{ display:'inline-flex', padding:3, background:'rgba(60,40,20,.06)', borderRadius:999, gap:2 }}>
              {[
                { v: 'M', label: 'Migdia', count: migdia.length },
                { v: 'N', label: 'Nit',    count: nit.length    },
              ].map(o => {
                const a = effectiveShift === o.v;
                return (
                  <button key={o.v} onClick={() => setShift(o.v as 'M' | 'N')}
                    style={{
                      padding:'7px 14px', borderRadius:999, border:'none',
                      background: a ? 'var(--paper)' : 'transparent',
                      color: a ? 'var(--ink-900)' : 'var(--ink-500)',
                      fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                      boxShadow: a ? 'var(--sh-1)' : 'none',
                      transition:'background .15s, box-shadow .15s',
                    }}>
                    {o.label}
                    <span style={{ marginLeft:5, fontSize:11, opacity:.7, fontWeight:500 }}>{o.count}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize:11.5, color:'var(--ink-500)', fontWeight:600 }}>
              {activeList.length} res · {activePax} pax
            </div>
          </div>
        )}
      </div>

      {/* ── Stat boxes — Confirmades / Pendents / A taula ───────────────── */}
      {activeList.length > 0 && (
        <div style={{ flexShrink:0, background:'var(--cream)', padding:'0 14px 10px',
                      display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {([
            ['Confirmades', activeList.filter(r => r.status === 'confirmed').length, 'var(--olive-700)',       'var(--olive-50)'],
            ['Pendents',    activeList.filter(r => r.status === 'pending').length,   'var(--clay-700)',        'var(--clay-50)'],
            ['A taula',     activeList.filter(r => r.status === 'seated').length,    'var(--terracotta-700)', 'var(--terracotta-50)'],
          ] as [string, number, string, string][]).map(([label, n, fg, bg]) => (
            <div key={label} style={{ background:bg, borderRadius:12, padding:'10px 12px' }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500, color:fg, lineHeight:1 }}>{n}</div>
              <div style={{ fontSize:10.5, color:fg, fontWeight:600, marginTop:4, opacity:.85 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Reservation list ────────────────────────────────────────────── */}
      <div
        key={`${dateStr}-${effectiveShift}`}
        className={`scroll mob-scroll ${dayDirRef.current === 'next' ? 'day-next' : dayDirRef.current === 'prev' ? 'day-prev' : 'tab-enter'}`}
        style={{ flex:1, overflowY:'auto' }}
      >
        {dayRes.length === 0 && (
          <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--ink-500)' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🔭</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:17, color:'var(--ink-700)' }}>Cap reserva per a aquest dia</div>
            <div style={{ fontSize:13, marginTop:6 }}>Prem "+" per afegir-ne una</div>
          </div>
        )}

        {dayRes.length > 0 && activeList.length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 20px', color:'var(--ink-500)' }}>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:16, color:'var(--ink-600)' }}>
              Cap reserva per al {effectiveShift === 'M' ? 'migdia' : 'vespre'}
            </div>
          </div>
        )}

        {activeList.map((r, i) => {
          const prev = i > 0 ? activeList[i - 1] : null;
          const showTimeHeader = !prev || prev.time !== r.time;
          return (
            <React.Fragment key={r.id}>
              {showTimeHeader && (() => {
                const isLunch = parseH(r.time) < 18;
                const dotColor = isLunch ? 'var(--clay-500)' : 'var(--plum-600)';
                const lineColor = isLunch ? 'rgba(204,144,73,.18)' : 'rgba(138,79,118,.18)';
                return (
                  <div style={{ padding:'14px 18px 6px', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{
                      width:7, height:7, borderRadius:999, background:dotColor, flexShrink:0,
                      boxShadow:`0 0 0 3px ${isLunch ? 'rgba(204,144,73,.14)' : 'rgba(138,79,118,.14)'}`,
                    }} />
                    <span className="mono" style={{ fontSize:13, fontWeight:600, color:'var(--ink-800)', flexShrink:0 }}>{r.time}</span>
                    <div style={{
                      flex:1, height:1,
                      background: `linear-gradient(90deg, ${lineColor} 0%, rgba(60,40,20,.04) 100%)`,
                    }} />
                  </div>
                );
              })()}
              <ResRow
                res={r}
                selected={sel?.id === r.id}
                onSel={r => setSel(prev => prev?.id === r.id ? null : r)}
                plan={plan}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Sheets — AnimatedSheet handles slide-up/down with backdrop ── */}
      <ResDetailSheet
        open={!!(sel && !showNew && !showCal)}
        res={sel}
        onClose={() => setSel(null)}
      />
      <NewResSheet
        open={showNew}
        bizId={selectedBusiness}
        defaultDate={dateStr}
        addReservation={addReservation}
        onClose={() => setShowNew(false)}
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
function ResStatePill({ state }: { state: ReservationStatus }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pending:   { bg:'var(--clay-50)',        fg:'var(--clay-700)',        label:'Pendent'    },
    confirmed: { bg:'var(--olive-50)',       fg:'var(--olive-700)',       label:'Confirmada' },
    seated:    { bg:'var(--terracotta-50)',  fg:'var(--terracotta-700)',  label:'A taula'    },
    completed: { bg:'var(--ink-100)',        fg:'var(--ink-600)',         label:'Acabada'    },
    cancelled: { bg:'#f2ebe4',              fg:'var(--ink-500)',         label:'Cancel·lada' },
    noshow:    { bg:'var(--rose-50)',        fg:'var(--rose-700)',        label:'No-show'    },
  };
  const s = map[state] ?? map.pending;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      padding:'3px 9px', borderRadius:999,
      background:s.bg, color:s.fg,
      fontSize:11.5, fontWeight:600, whiteSpace:'nowrap',
      ...(state === 'cancelled' ? { textDecoration:'line-through' } : {}),
    }}>{s.label}</span>
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

function ResRow({ res: r, selected, onSel, plan }: {
  res: Reservation; selected: boolean; onSel: (r: Reservation) => void;
  plan?: FloorPlan;
}) {
  const tl   = buildTableLine(r, plan);
  const tint = STATUS_TINT[r.status] ?? STATUS_TINT.pending;

  return (
    <button onClick={() => onSel(r)} className="press"
      style={{
        width:'100%', textAlign:'left',
        background: selected ? 'var(--terracotta-50)' : tint.rowTint,
        border:'none', borderTop:'var(--hair)',
        padding:'12px 18px', cursor:'pointer',
        display:'flex', gap:12, alignItems:'center',
        transition:'background 160ms var(--ease-ios)',
      }}>

      {/* Pax circle — Fraunces serif amb anell de color segons estat */}
      <div style={{
        width:42, height:42, borderRadius:12, flexShrink:0,
        background: tint.paxBg,
        boxShadow: `inset 0 0 0 1.5px ${tint.paxRing}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500,
        color: tint.paxFg,
      }}>{r.pax}</div>

      {/* Name + zone/table */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Name line */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:15, fontWeight:600, color:'var(--ink-900)' }}>{r.name}</span>
          {r.tags?.includes('vip') && (
            <span style={{ fontSize:9.5, padding:'2px 5px', borderRadius:4, background:'#2a2119', color:'#f3dca6', fontWeight:700, letterSpacing:.3 }}>VIP</span>
          )}
          {r.tags?.includes('allergy') && (
            <span style={{ fontSize:9.5, padding:'2px 5px', borderRadius:4, background:'var(--rose-50)', color:'var(--rose-700)', fontWeight:700, letterSpacing:.3 }}>AL·LÈRGIA</span>
          )}
          {r.tags?.includes('birthday') && (
            <span style={{ fontSize:10.5 }}>🎂</span>
          )}
        </div>

        {/* Zone + table / notes line */}
        <div style={{ fontSize:12.5, color:'var(--ink-500)', marginTop:4, display:'flex', gap:6, alignItems:'center', overflow:'hidden', whiteSpace:'nowrap' }}>
          {tl ? (
            <>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:3,
                fontSize:10.5, fontWeight:600, padding:'1px 6px', borderRadius:5,
                background:tl.bg, color:tl.color, flexShrink:0,
              }}>{tl.icon} {tl.zone}</span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{tl.tableStr}</span>
            </>
          ) : r.notes ? (
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', fontStyle:'italic', color:'var(--ink-400)' }}>{r.notes}</span>
          ) : (
            <span style={{ fontStyle:'italic', color:'var(--ink-400)' }}>Sense taula</span>
          )}

        </div>
      </div>

      {/* State pill */}
      <ResStatePill state={r.status} />
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

        {/* Quick buttons */}
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
      </div>
    </AnimatedSheet>
  );
}

// ─── Detail bottom sheet ──────────────────────────────────────────────────────
function ResDetailSheet({ open, res, onClose }: { open: boolean; res: Reservation | null; onClose: () => void }) {
  const { updateReservationStatus, deleteReservation, assignTablesToReservation, floorPlans } = useAppStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTableSel, setShowTableSel] = useState(false);
  // Snapshot: preserve last reservation so content stays visible during close animation
  const [snap, setSnap] = useState(res);
  if (res && res !== snap) setSnap(res);
  const r = snap;

  const plan = r ? floorPlans[r.bizId] : undefined;
  const assignedTableNames = (r?.tableIds ?? [])
    .map(id => plan?.tables.find(t => t.id === id)?.name ?? id)
    .join(' + ');

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
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <span className={`avatar lg av-${avIdx(r.name)}`}>{initials(r.name)}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)' }}>{r.name}</div>
            <div style={{ fontSize:12.5, color:'var(--ink-600)', marginTop:2 }}>
              {r.time} · {r.pax} pax{r.source ? ` · ${r.source}` : ''}
            </div>
          </div>
          <ResStatePill state={r.status} />
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', padding:4 }}>
            <Icon d={I.x} size={18} />
          </button>
        </div>
        {r.notes && (
          <div style={{ background:'rgba(250,230,120,.2)', borderRadius:8, padding:'8px 11px', fontSize:13, color:'#5a4a1a', marginBottom:12, border:'1px solid rgba(200,170,50,.25)' }}>
            {r.notes}
          </div>
        )}
        {r.phone && (
          <div style={{ fontSize:12.5, color:'var(--ink-600)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
            <Icon d={I.phone} size={13} /> {r.phone}
          </div>
        )}
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          {r.phone && (
            <a href={`tel:${r.phone}`}
              style={{ flex:1, padding:'10px', textAlign:'center', background:'var(--ink-100)', borderRadius:11, textDecoration:'none', fontSize:13, fontWeight:600, color:'var(--ink-800)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon d={I.phone} size={14} /> Trucar
            </a>
          )}
          {r.status !== 'seated' && (
            <button onClick={() => { updateReservationStatus(r.id, 'seated'); onClose(); }}
              style={{ flex:2, padding:'10px', background:'var(--ink-900)', color:'var(--cream)', border:'none', borderRadius:11, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
              A taula →
            </button>
          )}
        </div>
        {/* ── Table assignment row ─────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderTop:'var(--hair)', marginBottom:8 }}>
          <Icon d={I.tableIco} size={14} />
          <span style={{ flex:1, fontSize:13, color: r.tableIds && r.tableIds.length > 0 ? 'var(--ink-900)' : 'var(--ink-500)', fontStyle: r.tableIds && r.tableIds.length > 0 ? 'normal' : 'italic', fontWeight: r.tableIds && r.tableIds.length > 0 ? 600 : 400 }}>
            {r.tableIds && r.tableIds.length > 0 ? assignedTableNames : 'Sense taula assignada'}
          </span>
          <button onClick={() => setShowTableSel(true)}
            style={{ padding:'4px 10px', fontSize:12, background:'transparent', border:'1px solid rgba(60,40,20,.15)', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontWeight:600, color:'var(--ink-700)' }}>
            {r.tableIds && r.tableIds.length > 0 ? 'Canviar' : 'Assignar taula'}
          </button>
        </div>

        <button onClick={() => setConfirmDelete(true)}
          style={{ width:'100%', padding:'10px', background:'transparent', border:'1px solid rgba(200,50,50,0.25)', borderRadius:11, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'#c0392b', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <Icon d={I.trash} size={14} /> Eliminar reserva
        </button>
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
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex:1, padding:'13px', background:'var(--ink-100)', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:'var(--ink-800)' }}>
                Cancel·lar
              </button>
              <button onClick={handleDelete}
                style={{ flex:1, padding:'13px', background:'#c0392b', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, color:'white' }}>
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
          onSave={ids => assignTablesToReservation(r.id, ids)}
          onClose={() => setShowTableSel(false)}
        />
      )}
    </AnimatedSheet>
  );
}

// ─── New reservation bottom sheet ─────────────────────────────────────────────
function NewResSheet({ open, bizId, defaultDate, addReservation, onClose }: {
  open: boolean;
  bizId: BusinessId;
  defaultDate: string;
  addReservation: (r: Omit<Reservation, 'id'>) => void;
  onClose: () => void;
}) {
  const biz = BUSINESSES.find(b => b.id === bizId)!;
  const { customers, floorPlans } = useAppStore();
  const plan = floorPlans[bizId];

  // Sempre obre el formulari amb data + hora del moment exacte
  const nowDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const nowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const [form, setForm] = useState({
    date:   nowDate(),
    time:   nowTime(),
    name:   '',
    phone:  '',
    pax:    2,
    notes:  '',
    status: 'pending' as ReservationStatus,
    source: 'directe',
  });
  const [saved,         setSaved]         = useState(false);
  const [touched,       setTouched]       = useState(false);
  const [clientQuery,   setClientQuery]   = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [editingPax,       setEditingPax]       = useState(false);
  const [paxInput,         setPaxInput]         = useState('');
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [showTableSel,     setShowTableSel]     = useState(false);

  // ── Reset form every time the sheet opens ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setForm({ date: nowDate(), time: nowTime(), name: '', phone: '', pax: 2, notes: '', status: 'pending' as ReservationStatus, source: 'directe' });
    setSaved(false);
    setTouched(false);
    setClientQuery('');
    setShowDropdown(false);
    setEditingPax(false);
    setSelectedTableIds([]);
    setShowTableSel(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }

  function handleSave() {
    setTouched(true);
    if (!form.name.trim()) return;
    addReservation({
      bizId,
      date:     form.date,
      time:     form.time,
      name:     form.name.trim(),
      pax:      form.pax,
      status:   form.status,
      phone:    form.phone || undefined,
      notes:    form.notes || undefined,
      source:   form.source,
      tableIds: selectedTableIds.length > 0 ? selectedTableIds : undefined,
    });
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
                Nova reserva
              </div>
              <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:3,
                            textTransform:'uppercase', letterSpacing:.08, fontWeight:600 }}>
                {biz.name}
              </div>
            </div>
            <button onClick={onClose} className="press"
              aria-label="Tancar"
              style={{ background:'var(--cream)', border:'1px solid rgba(60,40,20,.08)',
                       cursor:'pointer', color:'var(--ink-600)',
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
              {/* DATA — label envoltant per fer clic a tota la tile */}
              <label style={{
                position:'relative', display:'flex', flexDirection:'column', gap:2,
                background:'var(--paper)', borderRadius:10,
                border:'1px solid rgba(60,40,20,.10)',
                padding:'10px 12px', cursor:'pointer', minWidth:0, overflow:'hidden',
              }}>
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
                <input type="date" value={form.date} onChange={e => upd('date', e.target.value)}
                  style={{
                    position:'absolute', inset:0, opacity:0, cursor:'pointer',
                    border:'none', background:'transparent', fontFamily:'inherit',
                    color:'transparent',
                  }} />
              </label>

              {/* HORA */}
              <label style={{
                position:'relative', display:'flex', flexDirection:'column', gap:2,
                background:'var(--paper)', borderRadius:10,
                border:'1px solid rgba(60,40,20,.10)',
                padding:'10px 12px', cursor:'pointer', minWidth:0, overflow:'hidden',
              }}>
                <span style={{ ...lbl, marginBottom:0 }}>Hora</span>
                <span style={{
                  fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
                  color:'var(--ink-900)', whiteSpace:'nowrap',
                  letterSpacing:.005,
                }}>
                  {form.time}
                </span>
                <input type="time" value={form.time} onChange={e => upd('time', e.target.value)}
                  style={{
                    position:'absolute', inset:0, opacity:0, cursor:'pointer',
                    border:'none', background:'transparent', fontFamily:'inherit',
                    color:'transparent',
                  }} />
              </label>
            </div>
          </section>

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
                      value={paxInput} autoFocus
                      onChange={e => setPaxInput(e.target.value)}
                      onBlur={() => {
                        const n = parseInt(paxInput, 10);
                        if (n >= 1 && n <= 99) upd('pax', n);
                        setEditingPax(false);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = parseInt(paxInput, 10);
                          if (n >= 1 && n <= 99) upd('pax', n);
                          setEditingPax(false);
                        }
                      }}
                      style={{
                        width:54, height:34, textAlign:'center',
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
                  <button onClick={() => upd('pax', form.pax + 1)} className="press"
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
                  style={{ ...inp, padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:14 }} />
              </div>
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

              {/* Notes */}
              <div>
                <label style={lbl}>Notes</label>
                <textarea rows={2} placeholder="Al·lèrgies, ocasió especial…" value={form.notes}
                  onChange={e => upd('notes', e.target.value)}
                  onFocus={() => setShowDropdown(false)}
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
          <button onClick={handleSave} disabled={saved} className="press"
            style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:15, fontWeight:650, letterSpacing:.005,
              color:'white',
              background: saved
                ? 'var(--olive-600)'
                : 'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)',
              boxShadow: saved
                ? '0 2px 8px rgba(116,133,74,.32)'
                : '0 4px 14px rgba(168,74,42,.32), 0 1px 2px rgba(168,74,42,.18)',
              transition:'background 300ms var(--ease-ios), box-shadow 300ms var(--ease-ios)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
            {saved ? (
              <>
                <Icon d={I.check} size={17} stroke={2.4} />
                Reserva creada
              </>
            ) : 'Crear reserva'}
          </button>
        </div>
      </div>

      {showTableSel && (
        <TableSelectorModal
          bizId={bizId}
          pax={form.pax}
          currentIds={selectedTableIds}
          onSave={ids => { setSelectedTableIds(ids); setShowTableSel(false); }}
          onClose={() => setShowTableSel(false)}
        />
      )}
    </AnimatedSheet>
  );
}
