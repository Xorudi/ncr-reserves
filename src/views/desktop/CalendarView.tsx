import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { ServiceBlock } from '@/components/desktop/ServiceBlock';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, isoDate, DAY_NAMES_SHORT } from '@/data/mockData';
import type { Reservation } from '@/types';

// ─── Constants ────────────────────────────────────────────────
const MONTHS_CA = ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];
const DAYS_CA   = ['dg.','dl.','dm.','dc.','dj.','dv.','ds.'];
const MONTH_DAYS_HDR = ['Dl','Dt','Dc','Dj','Dv','Ds','Dg'];
const DEMO_TODAY = new Date(2026, 3, 24);

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
// Monday-first offset: Mon=0 … Sun=6
function firstDayOffset(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }

function fmtDayHeader(d: Date) {
  return `${DAYS_CA[d.getDay()]} ${d.getDate()} de ${MONTHS_CA[d.getMonth()].toLowerCase()} del ${d.getFullYear()}`;
}

// ─── Main view ─────────────────────────────────────────────────
export default function CalendarView() {
  const {
    selectedBusiness, selectedDate, setSelectedDate,
    reservations, selectedReservation, setSelectedReservation,
  } = useAppStore();

  const [view, setView] = useState<'month' | 'week'>('month');

  // Calendar navigation (independent of selectedDate so scrolling the calendar
  // doesn't change the selected day until user explicitly clicks)
  const [viewYear,  setViewYear]  = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const biz = BUSINESSES.find(b => b.id === selectedBusiness)!;

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  function goToday() {
    setSelectedDate(DEMO_TODAY);
    setViewYear(DEMO_TODAY.getFullYear());
    setViewMonth(DEMO_TODAY.getMonth());
  }

  function handleDayClick(day: number) {
    setSelectedDate(new Date(viewYear, viewMonth, day));
    setSelectedReservation(null);
  }

  // ── Real reservation counts per day ───────────────────────────
  const resCounts = useMemo(() => {
    const map: Record<string, number> = {};
    reservations.filter(r => r.bizId === selectedBusiness).forEach(r => {
      map[r.date] = (map[r.date] || 0) + 1;
    });
    return map;
  }, [reservations, selectedBusiness]);

  const maxCount = Math.max(...Object.values(resCounts), 1);

  // ── Day panel data ─────────────────────────────────────────────
  const selDateStr = isoDate(selectedDate);
  const dayRes = useMemo(() =>
    reservations.filter(r => r.bizId === selectedBusiness && r.date === selDateStr),
    [reservations, selectedBusiness, selDateStr]
  );
  const migdia = dayRes.filter(r => { const [h] = r.time.split(':').map(Number); return h < 18; });
  const nit    = dayRes.filter(r => { const [h] = r.time.split(':').map(Number); return h >= 18; });

  const dayStats = useMemo(() => {
    const totalPax = dayRes.reduce((s, r) => s + r.pax, 0);
    const pending   = dayRes.filter(r => r.status === 'pending').length;
    const confirmed = dayRes.filter(r => r.status === 'confirmed').length;
    const seated    = dayRes.filter(r => r.status === 'seated').length;
    return { total: dayRes.length, totalPax, pending, confirmed, seated };
  }, [dayRes]);

  const navBtn: React.CSSProperties = {
    width:28, height:28, display:'grid', placeItems:'center',
    background:'transparent', border:'1px solid rgba(60,40,20,.14)',
    borderRadius:8, cursor:'pointer', color:'var(--ink-700)',
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--cream)' }}>

      {/* ── Header ── */}
      <div style={{ padding:'14px 28px 10px', borderBottom:'var(--hair)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <button style={navBtn} onClick={prevMonth}><Icon d={I.chevL} size={13} /></button>
        <h2 style={{ margin:0, fontFamily:'var(--font-serif)', fontSize:20, fontWeight:500, color:'var(--ink-900)', minWidth:160 }}>
          {MONTHS_CA[viewMonth]} {viewYear}
        </h2>
        <button style={navBtn} onClick={nextMonth}><Icon d={I.chevR} size={13} /></button>
        <button onClick={goToday}
          style={{ padding:'4px 10px', background:'transparent', border:'1px solid rgba(60,40,20,.14)', borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:550, color:'var(--ink-700)' }}>
          Avui
        </button>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:12, color:'var(--ink-500)' }}>{biz.name}</span>
        <div style={{ display:'flex', gap:3, padding:3, background:'var(--ink-100)', borderRadius:8 }}>
          {([['month','Mes'],['week','Setmana']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ padding:'5px 12px', border:'none', borderRadius:6,
                background: view === k ? 'var(--paper)' : 'transparent',
                fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
                color:'var(--ink-800)', boxShadow: view === k ? 'var(--sh-1)' : 'none' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: calendar + day panel ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Calendar grid */}
        <div style={{ overflowY:'auto', flexShrink:0, padding:'14px 28px 0', maxHeight:'58%' }}>
          {view === 'month'
            ? <MonthGrid
                year={viewYear} month={viewMonth}
                resCounts={resCounts} maxCount={maxCount}
                selectedDate={selectedDate}
                todayDate={DEMO_TODAY}
                onDayClick={handleDayClick}
              />
            : <WeekGrid
                selectedDate={selectedDate}
                resCounts={resCounts}
                reservations={reservations}
                bizId={selectedBusiness}
                onDayClick={(d) => handleDayClick(d.getDate())}
              />
          }
        </div>

        {/* Day detail panel */}
        <div style={{ flex:1, borderTop:'var(--hair)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <DayPanel
            date={selectedDate}
            header={fmtDayHeader(selectedDate)}
            stats={dayStats}
            migdia={migdia}
            nit={nit}
            selectedResId={selectedReservation?.id}
            onSelectRes={(r) => setSelectedReservation(selectedReservation?.id === r.id ? null : r)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Month grid ────────────────────────────────────────────────
function MonthGrid({ year, month, resCounts, maxCount, selectedDate, todayDate, onDayClick }: {
  year: number; month: number;
  resCounts: Record<string, number>;
  maxCount: number;
  selectedDate: Date;
  todayDate: Date;
  onDayClick: (day: number) => void;
}) {
  const totalDays   = daysInMonth(year, month);
  const startOffset = firstDayOffset(year, month);
  const todayStr    = isoDate(todayDate);
  const selStr      = isoDate(selectedDate);

  function dayStr(d: number) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  return (
    <div style={{ background:'var(--paper)', borderRadius:14, border:'var(--hair)', overflow:'hidden', marginBottom:0 }}>
      {/* Day-of-week headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--ink-50)', borderBottom:'var(--hair)' }}>
        {MONTH_DAYS_HDR.map(d => (
          <div key={d} style={{ padding:'7px 10px', fontSize:10.5, fontWeight:700, letterSpacing:.06, textTransform:'uppercase', color:'var(--ink-500)' }}>{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
        {/* Empty leading cells */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`e${i}`} style={{ minHeight:80, borderRight:'var(--hair)', borderBottom:'var(--hair)', background:'rgba(60,40,20,0.02)' }} />
        ))}
        {/* Day cells */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day  = i + 1;
          const ds   = dayStr(day);
          const cnt  = resCounts[ds] || 0;
          const pct  = cnt / maxCount;
          const isTod = ds === todayStr;
          const isSel = ds === selStr;
          const hasRes = cnt > 0;

          return (
            <div key={day} onClick={() => onDayClick(day)}
              style={{ minHeight:80, padding:'7px 9px', borderRight:'var(--hair)', borderBottom:'var(--hair)',
                background: isSel
                  ? 'var(--terracotta-50)'
                  : hasRes ? `rgba(200,97,58,${pct * 0.18})` : 'transparent',
                cursor:'pointer', position:'relative',
                outline: isSel ? '2px solid var(--terracotta-500)' : 'none',
                outlineOffset:'-2px',
                transition:'background .1s',
              }}
              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--ink-50)'; }}
              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isSel ? 'var(--terracotta-50)' : hasRes ? `rgba(200,97,58,${pct*0.18})` : 'transparent'; }}>

              {/* Day number */}
              <span style={{
                fontFamily:'var(--font-serif)', fontSize:15, fontWeight:isTod ? 600 : 400,
                color: isTod ? '#fff' : isSel ? 'var(--terracotta-700)' : 'var(--ink-900)',
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:22, height:22, borderRadius:'50%',
                background: isTod ? 'var(--terracotta-500)' : 'transparent',
              }}>
                {day}
              </span>

              {/* Count */}
              {hasRes && (
                <div style={{ marginTop:4, fontSize:11, color:'var(--ink-700)' }}>
                  <b style={{ color:'var(--ink-900)' }}>{cnt}</b> res.
                </div>
              )}

              {/* Bar */}
              <div style={{ position:'absolute', bottom:6, left:9, right:9, height:3, borderRadius:2, background:'rgba(60,40,20,0.07)' }}>
                {hasRes && <div style={{ width:`${pct*100}%`, height:'100%', background: isSel ? 'var(--terracotta-600)' : 'var(--terracotta-400)', borderRadius:2 }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week grid ─────────────────────────────────────────────────
function WeekGrid({ selectedDate, resCounts, reservations, bizId, onDayClick }: {
  selectedDate: Date;
  resCounts: Record<string, number>;
  reservations: Reservation[];
  bizId: string;
  onDayClick: (d: Date) => void;
}) {
  // Get Monday of the week containing selectedDate
  const dow   = (selectedDate.getDay() + 6) % 7; // Mon=0
  const mon   = new Date(selectedDate); mon.setDate(selectedDate.getDate() - dow);
  const week  = Array.from({ length:7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  const hours = ['12','13','14','15','16','17','18','19','20','21','22','23'];
  const todayStr = isoDate(new Date(2026, 3, 24));
  const selStr   = isoDate(selectedDate);

  return (
    <div style={{ background:'var(--paper)', borderRadius:14, border:'var(--hair)', overflow:'hidden', marginBottom:0 }}>
      {/* Headers */}
      <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', background:'var(--ink-50)', borderBottom:'var(--hair)' }}>
        <div />
        {week.map((d, i) => {
          const ds   = isoDate(d);
          const isT  = ds === todayStr;
          const isS  = ds === selStr;
          return (
            <div key={i} onClick={() => onDayClick(d)}
              style={{ padding:'8px 10px', borderLeft:'var(--hair)', cursor:'pointer',
                background: isS ? 'var(--terracotta-50)' : 'transparent' }}>
              <span style={{ fontSize:10.5, fontWeight:600, color: isT ? 'var(--terracotta-700)' : 'var(--ink-600)', textTransform:'uppercase', letterSpacing:.04 }}>
                {DAY_NAMES_SHORT[i]}
              </span>
              <span style={{ fontFamily:'var(--font-mono)', marginLeft:5, fontSize:13, fontWeight: isT ? 700 : 400,
                color: isT ? '#fff' : isS ? 'var(--terracotta-700)' : 'var(--ink-900)',
                background: isT ? 'var(--terracotta-500)' : 'transparent',
                borderRadius:'50%', padding: isT ? '2px 4px' : '0' }}>
                {d.getDate()}
              </span>
              {resCounts[ds] > 0 && (
                <span style={{ marginLeft:4, fontSize:10, color:'var(--ink-500)' }}>{resCounts[ds]}</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Time slots */}
      {hours.map(h => (
        <div key={h} style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', borderBottom:'var(--hair)', minHeight:40 }}>
          <div style={{ padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--ink-500)', textAlign:'right', paddingTop:6 }}>{h}:00</div>
          {week.map((d, di) => {
            const ds  = isoDate(d);
            const hrs = parseInt(h);
            const slotRes = reservations.filter(r =>
              r.bizId === bizId && r.date === ds && parseInt(r.time.split(':')[0]) === hrs
            );
            return (
              <div key={di} onClick={() => onDayClick(d)}
                style={{ borderLeft:'var(--hair)', padding:'2px 4px', cursor:'pointer',
                  background: isoDate(selectedDate) === ds ? 'rgba(200,97,58,0.04)' : 'transparent' }}>
                {slotRes.map(r => (
                  <div key={r.id} style={{ padding:'2px 5px', borderRadius:4,
                    background:`var(--state-${r.status}-bg, var(--olive-100))`,
                    color:`var(--state-${r.status}-fg, var(--olive-700))`,
                    fontSize:10.5, fontWeight:600, marginBottom:2, overflow:'hidden',
                    whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {r.time} {r.name.split(' ')[0]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Day detail panel ──────────────────────────────────────────
function DayPanel({ date, header, stats, migdia, nit, selectedResId, onSelectRes }: {
  date: Date;
  header: string;
  stats: { total: number; totalPax: number; pending: number; confirmed: number; seated: number };
  migdia: Reservation[];
  nit: Reservation[];
  selectedResId?: string;
  onSelectRes: (r: Reservation) => void;
}) {
  if (stats.total === 0) {
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, color:'var(--ink-400)', padding:'24px 28px' }}>
        <div style={{ fontSize:28 }}>📭</div>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:16, color:'var(--ink-600)' }}>Cap reserva per a aquest dia</div>
        <div style={{ fontSize:12, color:'var(--ink-400)' }}>{header}</div>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ flex:1, overflowY:'auto', padding:'14px 28px 24px' }}>
      {/* Day header */}
      <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:12 }}>
        <span style={{ fontFamily:'var(--font-serif)', fontSize:17, fontWeight:500, color:'var(--ink-900)' }}>{header}</span>
        <span style={{ fontSize:12.5, color:'var(--ink-600)' }}>
          <b style={{ color:'var(--ink-900)' }}>{stats.total}</b> reserves ·{' '}
          <b style={{ color:'var(--ink-900)' }}>{stats.totalPax}</b> comensals
        </span>
        {stats.pending > 0 && (
          <span className="chip state-pending" style={{ fontSize:11 }}><span className="dot"/>{stats.pending} pendent{stats.pending > 1 ? 's' : ''}</span>
        )}
        {stats.seated > 0 && (
          <span className="chip state-seated" style={{ fontSize:11 }}><span className="dot"/>{stats.seated} a taula</span>
        )}
      </div>

      {/* Service blocks */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {migdia.length > 0 && (
          <ServiceBlock label="Migdia" sub="13:00 – 16:00" ico="☀️"
            list={migdia} selectedId={selectedResId}
            onSelect={onSelectRes}
            defaultOpen={true} />
        )}
        {nit.length > 0 && (
          <ServiceBlock label="Nit" sub="20:30 – 23:00" ico="🌙"
            list={nit} selectedId={selectedResId}
            onSelect={onSelectRes}
            defaultOpen={migdia.length === 0} />
        )}
      </div>
    </div>
  );
}
