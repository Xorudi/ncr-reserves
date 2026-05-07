import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip } from '@/components/shared/StatusChip';
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
interface TodayViewProps { newResTrigger?: number; }

export default function MobileTodayView({ newResTrigger = 0 }: TodayViewProps) {
  const {
    selectedBusiness, reservations, selectedDate, setSelectedDate,
    addReservation, businessConfigs, floorPlans,
  } = useAppStore();
  const plan = floorPlans[selectedBusiness];

  const [sel, setSel]         = useState<Reservation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showCal, setShowCal] = useState(false);
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

  const totalRes = dayRes.length;
  const totalPax = dayRes.reduce((s, r) => s + r.pax, 0);
  const cap      = businessConfigs[selectedBusiness]?.capacity
                ?? BUSINESSES.find(b => b.id === selectedBusiness)?.capacity ?? 80;
  const occ      = cap > 0 ? Math.min(100, Math.round(totalPax / cap * 100)) : 0;
  const pending  = dayRes.filter(r => r.status === 'pending');

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

      {/* ── Date nav + KPI header ──────────────────────────────────────── */}
      <div style={{ flexShrink:0, background:'var(--paper)', borderBottom:'var(--hair)', padding:'10px 14px 12px' }}>

        {/* Date navigation row */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:11 }}>
          <button onClick={() => changeDay(-1)} className="day-btn"
            style={{ width:32, height:32, borderRadius:8, border:'none', background:'var(--cream)', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-600)' }}>
            <Icon d={I.chevL} size={16} stroke={2} />
          </button>

          <button onClick={() => setShowCal(true)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', padding:'4px 0' }}>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--ink-800)' }}>{dayLabel}</span>
            <Icon d={I.calendar} size={14} />
          </button>

          <button onClick={() => changeDay(1)} className="day-btn"
            style={{ width:32, height:32, borderRadius:8, border:'none', background:'var(--cream)', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-600)' }}>
            <Icon d={I.chevR} size={16} stroke={2} />
          </button>

          {!isToday && (
            <button onClick={goToday}
              style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid var(--terracotta-500)', background:'transparent', color:'var(--terracotta-600)', fontFamily:'inherit', fontSize:11.5, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              Avui
            </button>
          )}
        </div>

        {/* KPI strip — 3 equal columns, border separators */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', background:'var(--cream)', borderRadius:12, overflow:'hidden', border:'1px solid rgba(60,40,20,.07)' }}>
          <KpiCell value={totalRes} label="reserves" />
          <KpiCell value={totalPax} label="pax" dividers />
          <KpiCell value={`${occ}%`} label="ocupació" accent={occ >= 80} />
        </div>

        {pending.length > 0 && (
          <div style={{ marginTop:9, padding:'7px 11px', background:'rgba(185,90,30,.1)', borderRadius:8, fontSize:12, color:'var(--clay-700)', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
            <span>⚠️</span>
            <span>{pending.length} {pending.length === 1 ? 'reserva pendent' : 'reserves pendents'} de confirmar</span>
          </div>
        )}
      </div>

      {/* ── Reservation list — key forces remount + direction animation on day change ── */}
      <div
        key={dateStr}
        className={`scroll ${dayDirRef.current === 'next' ? 'day-next' : dayDirRef.current === 'prev' ? 'day-prev' : 'tab-enter'}`}
        style={{ flex:1, overflowY:'auto', paddingBottom: 24 }}

      >

        {dayRes.length === 0 && (
          <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--ink-500)' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🔭</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:17, color:'var(--ink-700)' }}>Cap reserva per a aquest dia</div>
            <div style={{ fontSize:13, marginTop:6 }}>Prem "+" per afegir-ne una</div>
          </div>
        )}

        {migdia.length > 0 && (
          <ServiceSection label="Servei de migdia" hours="13:00 – 16:00" ico="☀️" isMigdia={true}
            list={migdia} selId={sel?.id ?? null} onSel={r => setSel(prev => prev?.id === r.id ? null : r)} plan={plan} />
        )}

        {nit.length > 0 && (
          <ServiceSection label="Servei de nit" hours="20:30 – 00:00" ico="🌙" isMigdia={false}
            list={nit} selId={sel?.id ?? null} onSel={r => setSel(prev => prev?.id === r.id ? null : r)} plan={plan} />
        )}
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

// ─── KPI cell ─────────────────────────────────────────────────────────────────
function KpiCell({ value, label, accent, dividers }: { value: string | number; label: string; accent?: boolean; dividers?: boolean }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'12px 6px 10px',
      borderLeft:  dividers ? '1px solid rgba(60,40,20,.09)' : undefined,
      borderRight: dividers ? '1px solid rgba(60,40,20,.09)' : undefined,
    }}>
      <span style={{
        fontFamily:'var(--font-serif)', fontSize:28, fontWeight:500, lineHeight:1,
        color: accent ? 'var(--terracotta-700)' : 'var(--ink-900)',
        letterSpacing:'-0.02em',
      }}>
        {value}
      </span>
      <span style={{ fontSize:10.5, color:'var(--ink-500)', fontWeight:500, marginTop:4, textAlign:'center' }}>{label}</span>
    </div>
  );
}

// ─── Service section ──────────────────────────────────────────────────────────
function ServiceSection({ label, hours, ico, isMigdia, list, selId, onSel, plan }: {
  label: string; hours: string; ico: string; isMigdia: boolean;
  list: Reservation[]; selId: string | null; onSel: (r: Reservation) => void;
  plan?: FloorPlan;
}) {
  const totalPax  = list.reduce((s, r) => s + r.pax, 0);
  const accentBg  = isMigdia ? 'rgba(180,130,40,.07)' : 'rgba(60,30,100,.05)';
  const accentTxt = isMigdia ? 'var(--clay-700)' : 'var(--plum-700)';

  return (
    <div>
      <div style={{ padding:'11px 16px 9px', background:accentBg, borderBottom:'var(--hair)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:17 }}>{ico}</span>
          <div>
            <div style={{ fontSize:14.5, fontFamily:'var(--font-serif)', fontWeight:500, color:'var(--ink-900)' }}>
              {label}
              <span style={{ fontSize:11.5, fontWeight:400, color:'var(--ink-500)', marginLeft:6 }}>· {hours}</span>
            </div>
            <div style={{ fontSize:11.5, color:'var(--ink-600)', marginTop:1 }}>
              <b style={{ color:accentTxt }}>{list.length}</b> reserves
              <span style={{ margin:'0 5px', color:'var(--ink-300)' }}>·</span>
              <b style={{ color:accentTxt }}>{totalPax}</b> pax
            </div>
          </div>
        </div>
      </div>
      {list.map(r => <ResRow key={r.id} res={r} selected={selId === r.id} onSel={onSel} plan={plan} />)}
    </div>
  );
}

// ─── Reservation row ──────────────────────────────────────────────────────────
function ResRow({ res: r, selected, onSel, plan }: {
  res: Reservation; selected: boolean; onSel: (r: Reservation) => void;
  plan?: FloorPlan;
}) {
  const tl = buildTableLine(r, plan);

  return (
    <button onClick={() => onSel(r)} className="press"
      style={{
        display:'flex', alignItems:'center', gap:10, width:'100%',
        padding:'11px 16px',
        background: selected ? 'var(--ink-100)' : 'transparent',
        border:'none', borderBottom:'var(--hair)',
        cursor:'pointer', fontFamily:'inherit', textAlign:'left',
        transition:'background 160ms var(--ease-ios), transform var(--dur-press) var(--ease-ios-fast), opacity var(--dur-press) linear',
      }}>
      {/* Time */}
      <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--ink-700)', width:40, flex:'none' }}>
        {r.time}
      </span>

      {/* Avatar */}
      <span className={`avatar av-${avIdx(r.name)}`} style={{ flex:'none' }}>{initials(r.name)}</span>

      {/* Name + zone/table */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3 }}>
        {/* Name line */}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.name}
          </span>
          {r.tags?.includes('vip') && (
            <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:'#c9a227', color:'white' }}>VIP</span>
          )}
          {r.tags?.includes('birthday') && <span style={{ fontSize:11 }}>🎂</span>}
        </div>

        {/* Zone + table line */}
        {tl ? (
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:3,
              fontSize:10.5, fontWeight:600, padding:'1px 6px', borderRadius:5,
              background: tl.bg, color: tl.color,
            }}>
              {tl.icon} {tl.zone}
            </span>
            <span style={{ fontSize:11.5, color:'var(--ink-600)', fontWeight:500 }}>
              {tl.tableStr}
            </span>
          </div>
        ) : (
          <div style={{ fontSize:11, color:'var(--ink-400)', fontStyle:'italic' }}>
            🪑 Sense assignar
          </div>
        )}

        {/* Notes */}
        {r.notes && (
          <div style={{ fontSize:11, color:'var(--ink-400)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.notes}
          </div>
        )}
      </div>

      {/* Status + pax */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flex:'none' }}>
        <StatusChip state={r.status} size="sm" />
        <span style={{ fontSize:12, color:'var(--ink-600)', fontWeight:500 }}>{r.pax} pax</span>
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
          <StatusChip state={r.status} />
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

  const [form, setForm] = useState({
    date:   defaultDate,
    time:   '13:00',
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
    setForm({ date: defaultDate, time: '13:00', name: '', phone: '', pax: 2, notes: '', status: 'pending' as ReservationStatus, source: 'directe' });
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
    width:'100%', padding:'11px 12px', border:'1px solid rgba(60,40,20,.15)',
    borderRadius:10, fontFamily:'inherit', fontSize:15, color:'var(--ink-900)',
    background:'var(--cream)', boxSizing:'border-box', outline:'none',
  };
  const lbl: React.CSSProperties = {
    fontSize:11, fontWeight:700, color:'var(--ink-500)',
    textTransform:'uppercase', letterSpacing:.07, marginBottom:5, display:'block',
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
        background:'var(--paper)', borderRadius:'20px 20px 0 0',
        boxShadow:'0 -4px 32px rgba(0,0,0,.2)',
        display:'flex', flexDirection:'column',
        maxHeight:'calc(100dvh - env(safe-area-inset-top, 0px) - 20px)',
        overflow:'hidden',
        width:'100%',
      }}>

        {/* ── Sticky header ─────────────────────────────────────────── */}
        <div style={{ flexShrink:0, padding:'12px 18px 10px', borderBottom:'var(--hair)' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 12px' }} />
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500, color:'var(--ink-900)', lineHeight:1.2 }}>Nova reserva</div>
              <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:1 }}>{biz.name}</div>
            </div>
            <button onClick={onClose} className="press"
              style={{ background:'var(--cream)', border:'none', cursor:'pointer', color:'var(--ink-500)',
                       padding:8, borderRadius:8, display:'grid', placeItems:'center', flexShrink:0 }}>
              <Icon d={I.x} size={18} />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ────────────────────────────────────── */}
        <div className="scroll" style={{
          flex:1, overflowY:'auto', overflowX:'hidden',
          padding:'16px 18px 8px',
          display:'flex', flexDirection:'column', gap:14,
          minHeight:0,
        }}>

          {/* Data + Hora */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, minWidth:0 }}>
            <div style={{ minWidth:0 }}>
              <label style={lbl}>Data</label>
              <input type="date" value={form.date} onChange={e => upd('date', e.target.value)}
                style={{ ...inp, minWidth:0 }} />
            </div>
            <div style={{ minWidth:0 }}>
              <label style={lbl}>Hora</label>
              <input type="time" value={form.time} onChange={e => upd('time', e.target.value)}
                style={{ ...inp, minWidth:0 }} />
            </div>
          </div>

          {/* Persones — chips en scroll horitzontal intern + stepper */}
          <div>
            <label style={lbl}>Persones</label>
            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
              <div style={{
                display:'flex', gap:6, overflowX:'auto', flex:1, paddingBottom:3,
                scrollbarWidth:'none', msOverflowStyle:'none', minWidth:0,
              }}>
                {[1,2,3,4,5,6,7,8].map(n => (
                  <button key={n} onClick={() => upd('pax', n)} className="press"
                    style={{
                      flexShrink:0, width:38, height:38, borderRadius:9,
                      border: form.pax === n ? '2px solid var(--terracotta-600)' : '1.5px solid rgba(60,40,20,.15)',
                      background: form.pax === n ? 'var(--terracotta-50)' : 'var(--cream)',
                      color: form.pax === n ? 'var(--terracotta-700)' : 'var(--ink-700)',
                      fontWeight: form.pax === n ? 700 : 500,
                      fontSize:14, cursor:'pointer', fontFamily:'inherit',
                    }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', flexShrink:0,
                            border:'1.5px solid rgba(60,40,20,.15)', borderRadius:9, overflow:'hidden' }}>
                <button onClick={() => upd('pax', Math.max(1, form.pax - 1))}
                  style={{ width:32, height:38, border:'none', background:'var(--cream)', cursor:'pointer',
                           fontFamily:'inherit', fontSize:17, fontWeight:600, color:'var(--ink-700)',
                           display:'flex', alignItems:'center', justifyContent:'center' }}>
                  −
                </button>
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
                      width:42, height:38, textAlign:'center', fontSize:14, fontWeight:700,
                      color:'var(--terracotta-700)', background:'var(--terracotta-50)',
                      border:'none', outline:'2px solid var(--terracotta-400)',
                      borderLeft:'1px solid rgba(60,40,20,.1)', borderRight:'1px solid rgba(60,40,20,.1)',
                      fontFamily:'inherit',
                    }}
                  />
                ) : (
                  <button
                    onClick={() => { setEditingPax(true); setPaxInput(String(form.pax)); }}
                    title="Toca per escriure"
                    style={{
                      minWidth:42, height:38, textAlign:'center', fontSize:13, fontWeight:700,
                      color:'var(--terracotta-700)', background:'var(--terracotta-50)',
                      borderLeft:'1px solid rgba(60,40,20,.1)', borderRight:'1px solid rgba(60,40,20,.1)',
                      border:'none', cursor:'text', fontFamily:'inherit',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                    {form.pax}
                  </button>
                )}
                <button onClick={() => upd('pax', form.pax + 1)}
                  style={{ width:32, height:38, border:'none', background:'var(--cream)', cursor:'pointer',
                           fontFamily:'inherit', fontSize:17, fontWeight:600, color:'var(--ink-700)',
                           display:'flex', alignItems:'center', justifyContent:'center' }}>
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Client de la cartera */}
          <div style={{ position:'relative' }}>
            <label style={lbl}>Client de la cartera</label>
            <div style={{ position:'relative' }}>
              <input type="text" placeholder="Cerca per nom o telèfon…"
                value={clientQuery}
                onFocus={() => setShowDropdown(true)}
                onChange={e => { setClientQuery(e.target.value); setShowDropdown(true); }}
                style={{ ...inp, paddingLeft:36 }} />
              <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
                             color:'var(--ink-400)', pointerEvents:'none', display:'flex' }}>
                <Icon d={I.search} size={15} />
              </span>
            </div>
            {showDropdown && clientMatches.length > 0 && (
              <div style={{
                position:'absolute', left:0, right:0, top:'100%', marginTop:4, zIndex:200,
                background:'var(--paper)', borderRadius:12,
                boxShadow:'0 4px 20px rgba(0,0,0,.15)',
                border:'1px solid rgba(60,40,20,.1)', overflow:'hidden',
              }}>
                {clientMatches.map(c => (
                  <button key={c.id}
                    onMouseDown={e => { e.preventDefault(); selectClient(c); }}
                    style={{
                      width:'100%', padding:'10px 14px', border:'none', background:'transparent',
                      cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                      borderBottom:'1px solid rgba(60,40,20,.06)', fontFamily:'inherit',
                    }}>
                    <span className={`avatar av-${avIdx(c.name)}`} style={{ flexShrink:0 }}>{initials(c.name)}</span>
                    <div style={{ flex:1, textAlign:'left', minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize:12, color:'var(--ink-500)', fontFamily:'monospace', marginTop:1 }}>{c.phone}</div>}
                    </div>
                    {c.tags?.includes('vip') && (
                      <span style={{ fontSize:10, fontWeight:700, color:'var(--terracotta-600)',
                                     background:'var(--terracotta-50)', padding:'2px 6px', borderRadius:4, flexShrink:0 }}>VIP</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nom */}
          <div>
            <label style={lbl}>Nom *</label>
            <input type="text" placeholder="Nom del client" value={form.name}
              onChange={e => upd('name', e.target.value)}
              onFocus={() => setShowDropdown(false)}
              style={{ ...inp, borderColor: touched && !form.name.trim() ? 'var(--terracotta-500)' : undefined }} />
            {touched && !form.name.trim() && (
              <div style={{ fontSize:11, color:'var(--terracotta-600)', marginTop:3 }}>El nom és obligatori</div>
            )}
          </div>

          {/* Telèfon */}
          <div>
            <label style={lbl}>Telèfon</label>
            <input type="tel" placeholder="+34 600 000 000" value={form.phone}
              onChange={e => upd('phone', e.target.value)}
              onFocus={() => setShowDropdown(false)}
              style={inp} />
          </div>

          {/* Estat + Origen */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, minWidth:0 }}>
            <div style={{ minWidth:0 }}>
              <label style={lbl}>Estat</label>
              <select value={form.status} onChange={e => upd('status', e.target.value as ReservationStatus)}
                style={{ ...inp, paddingRight:6, minWidth:0 }}>
                <option value="pending">Pendent</option>
                <option value="confirmed">Confirmat</option>
                <option value="seated">A taula</option>
              </select>
            </div>
            <div style={{ minWidth:0 }}>
              <label style={lbl}>Origen</label>
              <select value={form.source} onChange={e => upd('source', e.target.value)}
                style={{ ...inp, paddingRight:6, minWidth:0 }}>
                <option value="directe">Directe</option>
                <option value="telèfon">Telèfon</option>
                <option value="web">Web</option>
                <option value="walk-in">Walk-in</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <textarea rows={2} placeholder="Al·lèrgies, ocasió especial…" value={form.notes}
              onChange={e => upd('notes', e.target.value)}
              onFocus={() => setShowDropdown(false)}
              style={{ ...inp, resize:'none', lineHeight:1.5 }} />
          </div>

          {/* Taula */}
          {plan && (
            <div>
              <label style={lbl}>Taula</label>
              <button onClick={() => setShowTableSel(true)} className="press"
                style={{
                  ...inp, display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                  textAlign:'left', padding:'10px 12px',
                  color: assignedTableNames ? 'var(--ink-900)' : 'var(--ink-400)',
                }}>
                <Icon d={I.tableIco} size={16} />
                <span style={{ flex:1, fontSize:14, fontStyle: assignedTableNames ? 'normal' : 'italic',
                               fontWeight: assignedTableNames ? 600 : 400 }}>
                  {assignedTableNames ?? 'Sense taula assignada (opcional)'}
                </span>
                {assignedTableNames && (
                  <span onClick={e => { e.stopPropagation(); setSelectedTableIds([]); }}
                    style={{ padding:'2px 6px', fontSize:11, borderRadius:5,
                             background:'rgba(60,40,20,.08)', color:'var(--ink-500)', cursor:'pointer' }}>
                    ✕
                  </span>
                )}
              </button>
            </div>
          )}

        </div>

        {/* ── Sticky footer — "Crear reserva" always visible ────────── */}
        <div style={{
          flexShrink:0,
          padding:'12px 18px',
          paddingBottom:'max(env(safe-area-inset-bottom, 0px), 16px)',
          borderTop:'var(--hair)',
          background:'var(--paper)',
        }}>
          <button onClick={handleSave} disabled={saved} className="press"
            style={{
              width:'100%', padding:'14px', borderRadius:12, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:15, fontWeight:700, color:'white',
              background: saved ? 'var(--olive-600)' : 'var(--terracotta-600)',
              transition:'background 300ms var(--ease-ios)',
            }}>
            {saved ? '✓  Reserva creada!' : 'Crear reserva'}
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
