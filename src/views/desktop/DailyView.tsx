import React, { useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { ServiceBlock } from '@/components/desktop/ServiceBlock';
import type { ActiveStaffMember } from '@/components/desktop/ServiceBlock';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, isoDate, shiftsOverlap } from '@/data/mockData';
import type { Reservation } from '@/types';

// Day-name helper for the "today/tomorrow" detection — keeps the
// composed empty state contextual.
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

const DAYS_CA   = ['dg.','dl.','dm.','dc.','dj.','dv.','ds.'];
const MONTHS_CA = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];

function fmtDate(d: Date) {
  return `${DAYS_CA[d.getDay()]} ${d.getDate()} de ${MONTHS_CA[d.getMonth()]} del ${d.getFullYear()}`;
}

export default function DailyView() {
  const {
    selectedBusiness, selectedDate, setSelectedDate,
    reservations, selectedReservation, setSelectedReservation,
    employeeShifts, employees, employeeRoles,
  } = useAppStore();

  const biz     = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const dateStr = isoDate(selectedDate);

  // ── Reserves filtrades per negoci + data ──────────────────────
  const dayRes = useMemo(() =>
    reservations.filter(r => r.bizId === selectedBusiness && r.date === dateStr),
    [reservations, selectedBusiness, dateStr]
  );

  const migdia = dayRes.filter(r => { const [h] = r.time.split(':').map(Number); return h < 18; });
  const nit    = dayRes.filter(r => { const [h] = r.time.split(':').map(Number); return h >= 18; });

  // ── Estadístiques en viu ───────────────────────────────────────
  const stats = useMemo(() => {
    const totalRes = dayRes.length;
    const totalPax = dayRes.reduce((s, r) => s + r.pax, 0);
    const capacity  = biz.capacity;
    const occupancyPct = capacity > 0 ? Math.round(totalPax / capacity * 100) : 0;
    // Pic: màxim de comensals en qualsevol franja de 30 min
    const slots: Record<string, number> = {};
    dayRes.forEach(r => {
      const [h, m] = r.time.split(':').map(Number);
      const slot = `${h}:${m < 30 ? '00' : '30'}`;
      slots[slot] = (slots[slot] || 0) + r.pax;
    });
    const peak  = totalRes > 0 ? Math.max(...Object.values(slots)) : 0;
    const level = occupancyPct >= 80 ? 'high' : occupancyPct >= 50 ? 'medium' : 'low';
    return { totalRes, totalPax, occupancyPct, peak, level };
  }, [dayRes, biz]);

  // ── Hora "ara" (per resaltar la franja actual) ─────────────────
  const nowTime = useMemo(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = now.getMinutes() < 30 ? '00' : '30';
    return `${h}:${m}`;
  }, []);

  // ── Personal actiu per servei ──────────────────────────────────
  // JS getDay(): 0=Sun, 1=Mon … 6=Sat → our DOW: 0=Mon…6=Sun
  const todayDow = (selectedDate.getDay() + 6) % 7;

  const roleMap  = useMemo(() => Object.fromEntries(employeeRoles.map(r => [r.id, r.name])), [employeeRoles]);
  const empMap   = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])),         [employees]);

  const bizShiftsForDay = useMemo(() =>
    employeeShifts.filter(s => s.businessId === selectedBusiness && s.dow === todayDow),
    [employeeShifts, selectedBusiness, todayDow]
  );

  function staffForWindow(winStart: string, winEnd: string): ActiveStaffMember[] {
    return bizShiftsForDay
      .filter(s => shiftsOverlap(s.startTime, s.endTime, winStart, winEnd))
      .map(s => {
        const emp  = empMap[s.employeeId];
        if (!emp || !emp.active) return null;
        return {
          name:  emp.fullName,
          role:  roleMap[s.roleId ?? emp.roleId] ?? '—',
          hours: `${s.startTime}–${s.endTime}`,
        } as ActiveStaffMember;
      })
      .filter((x): x is ActiveStaffMember => x !== null);
  }

  const migdiaStaff = useMemo(() => staffForWindow('13:00', '16:00'), [bizShiftsForDay, empMap, roleMap]);
  const nitStaff    = useMemo(() => staffForWindow('20:30', '23:00'), [bizShiftsForDay, empMap, roleMap]);

  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); };
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); };
  const goToday = () => setSelectedDate(new Date());

  // Elevated nav-arrow button — visually consistent with the touch
  // shell's pill controls (subtle elevation, hairline border, lift on hover).
  const navBtn: React.CSSProperties = {
    width: 34, height: 34,
    display: 'grid', placeItems: 'center',
    background: 'var(--paper)',
    border: '1px solid rgba(60,40,20,.10)',
    borderRadius: 9,
    cursor: 'pointer',
    color: 'var(--ink-700)',
    boxShadow: 'var(--sh-1)',
    transition: 'background 160ms var(--ease-out), box-shadow 160ms var(--ease-out), transform 160ms var(--ease-out)',
  };

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <div className="daily-view" style={{ flex:1, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--cream)' }}>
      {/* Header */}
      <div style={{ padding:'18px 28px 14px', borderBottom:'var(--hair)', background:'var(--cream)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ flex:1 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:7,
              fontSize:10.5, fontWeight:700, letterSpacing:.14,
              color:'var(--ink-500)', textTransform:'uppercase', marginBottom:6,
            }}>
              <span style={{
                width:6, height:6, borderRadius:999, background: biz.hue,
                boxShadow: `0 0 0 3px ${biz.hueSoft}`,
              }} />
              {biz.name} <span style={{ opacity:.4 }}>·</span> Reserves del dia
            </div>
            <h2 style={{ margin:0, fontFamily:'var(--font-serif)', fontSize:30, fontWeight:500, color:'var(--ink-900)', letterSpacing:'-.018em', lineHeight:1.05 }}>
              {fmtDate(selectedDate)}
            </h2>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={prevDay} style={navBtn}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--sh-2)'; e.currentTarget.style.background = 'var(--cream)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--sh-1)'; e.currentTarget.style.background = 'var(--paper)'; }}
              aria-label="Dia anterior">
              <Icon d={I.chevL} size={16} />
            </button>
            <button onClick={goToday} aria-pressed={isToday}
              style={{
                padding:'7px 14px',
                fontSize:12, fontWeight:600,
                background: isToday ? 'var(--ink-900)' : 'var(--paper)',
                color:    isToday ? 'var(--cream)' : 'var(--ink-800)',
                border:   'none', borderRadius:9, cursor:'pointer',
                fontFamily:'inherit',
                boxShadow: isToday ? 'var(--sh-2)' : 'var(--sh-1)',
                transition: 'all 160ms var(--ease-out)',
                letterSpacing:'-0.005em',
              }}>
              Avui
            </button>
            <button onClick={nextDay} style={navBtn}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--sh-2)'; e.currentTarget.style.background = 'var(--cream)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--sh-1)'; e.currentTarget.style.background = 'var(--paper)'; }}
              aria-label="Dia següent">
              <Icon d={I.chevR} size={16} />
            </button>
          </div>
        </div>

        {/* Stats strip — composed pills instead of inline numbers with dividers. */}
        <div style={{
          display:'flex', gap:8, marginTop:16, alignItems:'stretch',
        }}>
          <StatPill value={stats.totalRes}                 label="reserves"  />
          <StatPill value={stats.totalPax}                 label="comensals" />
          <StatPill value={`${stats.occupancyPct}%`}       label="ocupació"  level={stats.level as 'low' | 'medium' | 'high'} />
          <StatPill value={stats.peak}                     label="pic (pax)" />
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
            {(['pending','confirmed','seated'] as const).map(s => {
              const n = dayRes.filter(r => r.status === s).length;
              return n > 0
                ? <span key={s} className={`chip state-${s}`} style={{ fontSize:11.5 }}><span className="dot"/>{n}</span>
                : null;
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="scroll" style={{ flex:1, overflowY:'auto', padding:'18px 28px 32px', display:'flex', flexDirection:'column', gap:14 }}>
        {migdia.length > 0 && (
          <ServiceBlock label="Migdia" sub="13:00 – 16:00" ico="☀️"
            list={migdia} selectedId={selectedReservation?.id}
            onSelect={(r: Reservation) => setSelectedReservation(selectedReservation?.id === r.id ? null : r)}
            nowTime={nowTime} defaultOpen={true}
            activeStaff={migdiaStaff} />
        )}
        {nit.length > 0 && (
          <ServiceBlock label="Nit" sub="20:30 – 23:00" ico="🌙"
            list={nit} selectedId={selectedReservation?.id}
            onSelect={(r: Reservation) => setSelectedReservation(selectedReservation?.id === r.id ? null : r)}
            defaultOpen={migdia.length === 0}
            activeStaff={nitStaff} />
        )}
        {dayRes.length === 0 && <EmptyDayState bizName={biz.name} isToday={isToday} />}
      </div>
    </div>
  );
}

// ─── KPI pill ──────────────────────────────────────────────────────────────────
type Level = 'low' | 'medium' | 'high';
function StatPill({ value, label, level }: { value: string | number; label: string; level?: Level }) {
  // Tone the value color subtly by occupancy level — never garish.
  const valueColor =
    level === 'high'   ? 'var(--terracotta-700)' :
    level === 'medium' ? 'var(--clay-700)'       :
                         'var(--ink-900)';
  // A 2px accent bar at the bottom only on the ocupació pill, to make
  // the live state legible without competing with the headline numbers.
  const accentBar =
    level === 'high'   ? 'var(--terracotta-500)' :
    level === 'medium' ? 'var(--clay-500)'       :
    level === 'low'    ? 'var(--olive-500)'      :
                         'transparent';
  return (
    <div className="card-flat" style={{
      flex: '1 1 0', minWidth: 0,
      padding: '10px 14px 11px',
      display: 'flex', flexDirection: 'column',
      borderRadius: 11,
      position: 'relative', overflow: 'hidden',
    }}>
      <span style={{
        fontFamily:'var(--font-serif)', fontSize:23, fontWeight:500,
        color: valueColor, lineHeight:1.05, letterSpacing:'-.01em',
      }}>{value}</span>
      <span style={{
        fontSize:10.5, fontWeight:600, color:'var(--ink-500)',
        marginTop:3, letterSpacing:.04, textTransform:'lowercase',
      }}>{label}</span>
      {level && (
        <span aria-hidden="true" style={{
          position:'absolute', left:0, right:0, bottom:0,
          height:2, background: accentBar,
          opacity: .8,
        }} />
      )}
    </div>
  );
}

// ─── Composed empty state ─────────────────────────────────────────────────────
function EmptyDayState({ bizName, isToday }: { bizName: string; isToday: boolean }) {
  // Dispatch the same window event used by the global Cmd+K handler /
  // sidebar to trigger the New Reservation flow without prop-drilling.
  const newRes = () => window.dispatchEvent(new CustomEvent('app:new-reservation'));
  const walkin = () => window.dispatchEvent(new CustomEvent('app:open-walkin'));
  return (
    <div className="card-flat" style={{
      margin: '40px auto', maxWidth: 460, width: '100%',
      padding: '32px 28px 26px',
      borderRadius: 18, textAlign: 'center',
      background: 'var(--paper)',
    }}>
      <div aria-hidden="true" style={{
        width: 56, height: 56, margin: '0 auto 14px',
        borderRadius: 16,
        background: 'linear-gradient(180deg, var(--cream) 0%, #f4ead4 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6), var(--sh-1)',
        display: 'grid', placeItems: 'center',
        fontSize: 24,
      }}>📭</div>
      <h3 style={{
        margin: 0, fontFamily:'var(--font-serif)', fontWeight: 500,
        fontSize: 22, color: 'var(--ink-900)', letterSpacing:'-.01em',
      }}>
        {isToday ? 'Encara cap reserva avui' : 'Cap reserva per aquest dia'}
      </h3>
      <p style={{
        margin: '8px 0 20px', fontSize: 13.5, color: 'var(--ink-600)',
        lineHeight: 1.55, textWrap: 'balance' as React.CSSProperties['textWrap'],
      }}>
        El llibre de <strong style={{ color:'var(--ink-800)', fontWeight:600 }}>{bizName}</strong> està buit.
        Pots començar afegint una reserva o seientar un walk-in.
      </p>
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        <button onClick={newRes} className="press" style={{
          padding:'10px 16px', borderRadius: 11, border:'none',
          background:'var(--terracotta-600)', color:'#fff',
          fontFamily:'inherit', fontSize:13, fontWeight:600,
          cursor:'pointer', boxShadow:'var(--sh-1)',
          transition:'background 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--terracotta-700)'; e.currentTarget.style.boxShadow = 'var(--sh-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--terracotta-600)'; e.currentTarget.style.boxShadow = 'var(--sh-1)'; }}>
          + Nova reserva
        </button>
        <button onClick={walkin} className="press" style={{
          padding:'10px 16px', borderRadius: 11,
          border:'1px solid rgba(60,40,20,.14)', background:'var(--paper)',
          color:'var(--ink-800)', fontFamily:'inherit', fontSize:13, fontWeight:600,
          cursor:'pointer', boxShadow:'var(--sh-1)',
          transition:'background 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--cream)'; e.currentTarget.style.boxShadow = 'var(--sh-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--paper)'; e.currentTarget.style.boxShadow = 'var(--sh-1)'; }}>
          Walk-in
        </button>
      </div>
    </div>
  );
}
