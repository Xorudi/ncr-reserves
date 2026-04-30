import React, { useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { ServiceBlock } from '@/components/desktop/ServiceBlock';
import type { ActiveStaffMember } from '@/components/desktop/ServiceBlock';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, isoDate, shiftsOverlap } from '@/data/mockData';
import type { Reservation } from '@/types';

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
  const goToday = () => setSelectedDate(new Date(2026, 3, 24));

  const navBtn: React.CSSProperties = {
    width:32, height:32, display:'grid', placeItems:'center',
    background:'transparent', border:'1px solid rgba(60,40,20,.14)',
    borderRadius:8, cursor:'pointer', color:'var(--ink-700)',
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--cream)' }}>
      {/* Header */}
      <div style={{ padding:'16px 28px 12px', borderBottom:'var(--hair)', background:'var(--cream)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:.08, color:'var(--ink-500)', textTransform:'uppercase', marginBottom:4 }}>
              {biz.name} · Reserves del dia
            </div>
            <h2 style={{ margin:0, fontFamily:'var(--font-serif)', fontSize:28, fontWeight:500, color:'var(--ink-900)', letterSpacing:'-.5px', lineHeight:1.1 }}>
              {fmtDate(selectedDate)}
            </h2>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={prevDay} style={navBtn}><Icon d={I.chevL} size={16} /></button>
            <button onClick={goToday} style={{ padding:'6px 12px', fontSize:12, fontWeight:550, background:'var(--ink-100)', color:'var(--ink-800)', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit' }}>
              Avui
            </button>
            <button onClick={nextDay} style={navBtn}><Icon d={I.chevR} size={16} /></button>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display:'flex', gap:18, marginTop:14, paddingTop:14, borderTop:'var(--hair)', alignItems:'center' }}>
          <Stat value={stats.totalRes}       label="reserves" />
          <Div /><Stat value={stats.totalPax} label="comensals" />
          <Div /><Stat value={`${stats.occupancyPct}%`} label="ocupació" accent={stats.level === 'high'} />
          <Div /><Stat value={stats.peak}     label="pic (pax)" />
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
        {dayRes.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 0', color:'var(--ink-500)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📭</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:18, color:'var(--ink-700)' }}>Cap reserva per aquest dia</div>
            <div style={{ fontSize:13, marginTop:6 }}>Fes clic a "Nova reserva" per afegir-ne una</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Div() {
  return <div style={{ width:1, background:'rgba(60,40,20,.08)', height:28, alignSelf:'center' }} />;
}
function Stat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <span style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500, color:accent?'var(--terracotta-700)':'var(--ink-900)', lineHeight:1.1 }}>{value}</span>
      <span style={{ fontSize:11, color:'var(--ink-500)', marginTop:2 }}>{label}</span>
    </div>
  );
}
