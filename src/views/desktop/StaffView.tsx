import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { DAY_NAMES, DAY_NAMES_SHORT, TODAY_DOW } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { Employee, EmployeeRole } from '@/types';

export default function StaffView() {
  const [tab, setTab] = useState<'duty' | 'schedule'>('duty');
  const { selectedBusiness } = useAppStore();
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--cream)' }}>
      <div style={{ padding:'14px 24px 0', borderBottom:'var(--hair)', flexShrink:0, display:'flex', gap:0 }}>
        {([['duty','Equip avui'],['schedule','Horaris setmanals']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding:'10px 18px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight: tab===k ? 600 : 500, color: tab===k ? 'var(--ink-900)' : 'var(--ink-600)', borderBottom: tab===k ? '2px solid var(--terracotta-600)' : '2px solid transparent', marginBottom:-1 }}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'duty'     && <StaffOnDuty     bizId={selectedBusiness} />}
      {tab === 'schedule' && <ScheduleEditor  bizId={selectedBusiness} />}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
function avIdx(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 6;
}

// ═══════════════════════════════════════════════════════════════════
// Equip avui
// ═══════════════════════════════════════════════════════════════════
function StaffOnDuty({ bizId }: { bizId: string }) {
  const { employees, employeeRoles, bizShifts, weekSchedule, clockInEmployee, clockOutEmployee } = useAppStore();
  const shifts = bizShifts[bizId] ?? [];
  const [shiftId, setShiftId] = useState(() => shifts[0]?.id ?? 'M');
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);

  const activeShift = shifts.find(s => s.id === shiftId) ?? shifts[0];
  const daySchedule = weekSchedule[bizId]?.[TODAY_DOW] ?? {};
  const plannedIds   = new Set(daySchedule[shiftId] ?? []);
  const bizEmps      = employees.filter(e => e.bizId === bizId && e.active);
  const onDuty       = bizEmps.filter(e => plannedIds.has(e.id));
  const unplanned    = bizEmps.filter(e => e.clockedIn && !plannedIds.has(e.id));
  const bizRoles     = employeeRoles.filter(r => r.bizId === bizId && r.active).sort((a,b) => a.order - b.order);

  // Group by role
  const byRole: Record<string, Employee[]> = {};
  onDuty.forEach(e => { (byRole[e.roleId] ??= []).push(e); });

  const clockedCount = onDuty.filter(e => e.clockedIn).length;
  const missingCount = onDuty.filter(e => !e.clockedIn).length;

  return (
    <div className="scroll" style={{ overflowY:'auto', flex:1, padding:'18px 28px 40px' }}>
      {/* Shift selector + stats */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <div style={{ display:'flex', gap:3, padding:3, background:'var(--ink-100)', borderRadius:8 }}>
          {shifts.map(s => (
            <button key={s.id} onClick={() => setShiftId(s.id)}
              style={{ padding:'7px 16px', border:'none', borderRadius:6, background: shiftId===s.id ? 'var(--paper)' : 'transparent', color:'var(--ink-800)', fontSize:12.5, fontWeight:600, fontFamily:'inherit', cursor:'pointer', boxShadow: shiftId===s.id ? 'var(--sh-1)' : 'none' }}>
              {s.label}
              <span style={{ marginLeft:8, color:'var(--ink-500)', fontWeight:500, fontSize:11, fontFamily:'var(--font-mono)' }}>{s.start}–{s.end}</span>
            </button>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--ink-600)' }}>
          <span><b style={{ color:'var(--olive-700)' }}>{clockedCount}</b> fitxats</span>
          {missingCount > 0 && <span><b style={{ color:'var(--clay-700)' }}>{missingCount}</b> no fitxats</span>}
          {unplanned.length > 0 && <span><b style={{ color:'var(--terracotta-700)' }}>{unplanned.length}</b> no planificats</span>}
          <span style={{ color:'var(--ink-400)' }}>·</span>
          <span><b style={{ color:'var(--ink-900)' }}>{onDuty.length}</b> planificats</span>
        </div>
      </div>

      {/* Unplanned clocked-in alert */}
      {unplanned.length > 0 && (
        <div style={{ padding:'10px 14px', background:'var(--clay-50)', border:'1px solid var(--clay-200)', borderRadius:10, marginBottom:16, fontSize:12.5, color:'var(--clay-700)', display:'flex', alignItems:'center', gap:8 }}>
          ⚠ {unplanned.map(e => e.fullName).join(', ')} {unplanned.length === 1 ? 'ha fitxat' : 'han fitxat'} però no estava{unplanned.length>1?'n':''} planificat{unplanned.length>1?'s':''}
        </div>
      )}

      {/* By role */}
      {bizRoles.filter(r => byRole[r.id]?.length).map(role => (
        <div key={role.id} style={{ marginBottom:22 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10 }}>
            <span style={{ padding:'3px 10px', borderRadius:4, background:role.color, color:role.textColor, fontSize:10.5, fontWeight:700, letterSpacing:.06, textTransform:'uppercase' }}>
              {role.name}
            </span>
            <span style={{ fontSize:12, color:'var(--ink-500)' }}>
              {byRole[role.id].length} {byRole[role.id].length === 1 ? 'persona' : 'persones'}
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
            {byRole[role.id].map(emp => (
              <EmpCard key={emp.id} emp={emp} role={role}
                onClick={() => setDetailEmp(emp)}
                onClockIn={() => clockInEmployee(emp.id)}
                onClockOut={() => clockOutEmployee(emp.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {onDuty.length === 0 && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--ink-500)', fontFamily:'var(--font-serif)', fontSize:16 }}>
          Ningú planificat per a aquest torn
        </div>
      )}

      {/* Employee detail drawer */}
      {detailEmp && (
        <EmpDetailDrawer
          emp={detailEmp}
          role={bizRoles.find(r => r.id === detailEmp.roleId) ?? null}
          onClose={() => setDetailEmp(null)}
          onClockIn={() => { clockInEmployee(detailEmp.id); setDetailEmp(e => e ? { ...e, clockedIn:true } : null); }}
          onClockOut={() => { clockOutEmployee(detailEmp.id); setDetailEmp(e => e ? { ...e, clockedIn:false } : null); }}
        />
      )}
    </div>
  );
}

function EmpCard({ emp, role, onClick, onClockIn, onClockOut }: {
  emp: Employee; role: EmployeeRole | null;
  onClick: () => void; onClockIn: () => void; onClockOut: () => void;
}) {
  return (
    <div onClick={onClick}
      style={{ padding:12, background:'var(--paper)', borderRadius:12, border:'var(--hair)', boxShadow:'var(--sh-1)', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--sh-2)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--sh-1)')}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <div className={`avatar av-${avIdx(emp.fullName)}`} style={{ width:40, height:40, fontSize:13, display:'grid', placeItems:'center', borderRadius:'50%' }}>
          {emp.initials}
        </div>
        <span style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderRadius:'50%', background: emp.clockedIn ? 'var(--olive-500)' : 'var(--ink-300)', border:'2px solid var(--paper)' }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.fullName}</div>
        <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:2 }}>
          {emp.clockedIn ? `Fitxat a les ${emp.startedAt}` : 'No ha fitxat'}
        </div>
      </div>
      {!emp.clockedIn ? (
        <button onClick={e => { e.stopPropagation(); onClockIn(); }}
          style={{ fontSize:11, padding:'4px 8px', border:'var(--hair)', borderRadius:6, background:'var(--olive-50)', color:'var(--olive-700)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
          Fitxar
        </button>
      ) : (
        <button onClick={e => { e.stopPropagation(); onClockOut(); }}
          style={{ fontSize:11, padding:'4px 8px', border:'var(--hair)', borderRadius:6, background:'var(--ink-50)', color:'var(--ink-600)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
          Sortida
        </button>
      )}
    </div>
  );
}

function EmpDetailDrawer({ emp, role, onClose, onClockIn, onClockOut }: {
  emp: Employee; role: EmployeeRole | null;
  onClose: () => void; onClockIn: () => void; onClockOut: () => void;
}) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:400 }} onClick={onClose}>
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:320, background:'var(--paper)', boxShadow:'var(--sh-3)', padding:'24px 22px', display:'flex', flexDirection:'column', gap:18 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className={`avatar av-${avIdx(emp.fullName)}`} style={{ width:52, height:52, fontSize:16, display:'grid', placeItems:'center', borderRadius:'50%' }}>
            {emp.initials}
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)' }}>{emp.fullName}</div>
            {role && <span style={{ display:'inline-block', marginTop:4, padding:'3px 10px', borderRadius:20, background:role.color, color:role.textColor, fontSize:11.5, fontWeight:600 }}>{role.name}</span>}
          </div>
          <div style={{ flex:1 }} />
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-400)' }}>
            <Icon d={I.x} size={16} />
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <InfoRow label="Estat" value={emp.clockedIn ? `Fitxat a les ${emp.startedAt}` : 'No ha fitxat'} />
          {emp.phone && <InfoRow label="Telèfon" value={emp.phone} />}
          {emp.email && <InfoRow label="Email" value={emp.email} />}
          {emp.notes && <InfoRow label="Notes" value={emp.notes} />}
        </div>

        <div style={{ display:'flex', gap:8, marginTop:'auto' }}>
          {emp.clockedIn ? (
            <button onClick={onClockOut}
              style={{ flex:1, padding:'9px 0', background:'var(--ink-100)', color:'var(--ink-800)', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
              Marcar sortida
            </button>
          ) : (
            <button onClick={onClockIn}
              style={{ flex:1, padding:'9px 0', background:'var(--olive-600)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
              Marcar fitxada
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', gap:10 }}>
      <span style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-500)', textTransform:'uppercase', letterSpacing:.04, minWidth:70 }}>{label}</span>
      <span style={{ fontSize:13, color:'var(--ink-800)' }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Horaris setmanals
// ═══════════════════════════════════════════════════════════════════
function ScheduleEditor({ bizId }: { bizId: string }) {
  const { employees, employeeRoles, bizShifts, weekSchedule, setWeekShift } = useAppStore();
  const shifts    = bizShifts[bizId] ?? [];
  const bizEmps   = employees.filter(e => e.bizId === bizId && e.active).sort((a,b) => {
    const ra = employeeRoles.find(r => r.id === a.roleId)?.order ?? 99;
    const rb = employeeRoles.find(r => r.id === b.roleId)?.order ?? 99;
    return ra - rb;
  });
  const bizRoles  = employeeRoles.filter(r => r.bizId === bizId);
  const weekSched = weekSchedule[bizId] ?? {};
  const [weekOffset, setWeekOffset] = useState(0);

  // Week label (Apr 20 base)
  const baseDate  = new Date(2026, 3, 20);
  const weekStart = new Date(baseDate); weekStart.setDate(baseDate.getDate() + weekOffset * 7);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const fmtD      = (d: Date) => `${d.getDate()} ${['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'][d.getMonth()]}`;

  function toggleShift(empId: string, dow: number, shiftId: string) {
    const cur = weekSched[dow]?.[shiftId] ?? [];
    const next = cur.includes(empId) ? cur.filter(id => id !== empId) : [...cur, empId];
    setWeekShift(bizId, dow, shiftId, next);
  }

  const SHIFT_COLORS: Record<string, string> = {};
  shifts.forEach(s => { SHIFT_COLORS[s.id] = s.color; });

  return (
    <div className="scroll" style={{ overflowY:'auto', flex:1, padding:'18px 28px 40px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button onClick={() => setWeekOffset(o => o-1)}
          style={{ width:28, height:28, display:'grid', placeItems:'center', background:'transparent', border:'var(--hair)', borderRadius:8, cursor:'pointer', color:'var(--ink-700)' }}>
          <Icon d={I.chevL} size={13} />
        </button>
        <span style={{ fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500, color:'var(--ink-900)' }}>
          Setmana del {fmtD(weekStart)} – {fmtD(weekEnd)} 2026
        </span>
        <button onClick={() => setWeekOffset(o => o+1)}
          style={{ width:28, height:28, display:'grid', placeItems:'center', background:'transparent', border:'var(--hair)', borderRadius:8, cursor:'pointer', color:'var(--ink-700)' }}>
          <Icon d={I.chevR} size={13} />
        </button>
        <div style={{ flex:1 }} />
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)}
            style={{ padding:'6px 12px', background:'transparent', border:'var(--hair)', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, color:'var(--ink-700)' }}>
            Setmana actual
          </button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, marginBottom:12 }}>
        {shifts.map(s => (
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:14, height:14, borderRadius:3, background:s.color, display:'inline-block' }} />
            <span style={{ fontSize:12, color:'var(--ink-600)', fontWeight:600 }}>{s.label} <span style={{ fontFamily:'var(--font-mono)', fontWeight:400 }}>{s.start}–{s.end}</span></span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ background:'var(--paper)', borderRadius:12, border:'var(--hair)', overflow:'hidden' }}>
        {/* Header row */}
        <div style={{ display:'grid', gridTemplateColumns:`180px repeat(7, 1fr)`, borderBottom:'var(--hair)', background:'var(--ink-50)' }}>
          <div style={{ padding:'10px 12px', fontSize:10.5, fontWeight:700, letterSpacing:.06, textTransform:'uppercase', color:'var(--ink-500)' }}>Empleat</div>
          {DAY_NAMES.map((d, i) => {
            const date = new Date(weekStart); date.setDate(weekStart.getDate() + i);
            const isToday = weekOffset === 0 && i === TODAY_DOW;
            return (
              <div key={d} style={{ padding:'8px 10px', borderLeft:'var(--hair)', textAlign:'center' }}>
                <div style={{ fontSize:11, fontWeight:600, color: isToday ? 'var(--terracotta-700)' : 'var(--ink-500)' }}>
                  {DAY_NAMES_SHORT[i].toUpperCase()}
                </div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:13, color: isToday ? 'var(--terracotta-700)' : 'var(--ink-800)', fontWeight: isToday ? 700 : 400 }}>
                  {date.getDate()}
                </div>
                {isToday && <div style={{ fontSize:8, fontWeight:700, color:'var(--terracotta-600)', letterSpacing:.04 }}>AVUI</div>}
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {bizEmps.map(emp => {
          const role = bizRoles.find(r => r.id === emp.roleId);
          return (
            <div key={emp.id} style={{ display:'grid', gridTemplateColumns:`180px repeat(7, 1fr)`, borderBottom:'var(--hair)' }}>
              <div style={{ padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
                <div className={`avatar av-${avIdx(emp.fullName)}`} style={{ width:26, height:26, fontSize:9, display:'grid', placeItems:'center', borderRadius:'50%', flexShrink:0 }}>
                  {emp.initials}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.fullName}</div>
                  {role && <div style={{ fontSize:9.5, fontWeight:600, color:role.textColor }}>{role.name}</div>}
                </div>
              </div>
              {Array.from({ length:7 }).map((_, dayIdx) => {
                const isToday = weekOffset === 0 && dayIdx === TODAY_DOW;
                return (
                  <div key={dayIdx} style={{ borderLeft:'var(--hair)', padding:3, display:'flex', flexDirection:'column', gap:2, minHeight:48, background: isToday ? 'rgba(200,97,58,0.04)' : 'transparent' }}>
                    {shifts.map(sh => {
                      const cur = weekSched[dayIdx]?.[sh.id] ?? [];
                      const has = cur.includes(emp.id);
                      return (
                        <button key={sh.id} onClick={() => toggleShift(emp.id, dayIdx, sh.id)}
                          title={`${has ? 'Treure' : 'Afegir'} ${sh.label}`}
                          style={{ flex:1, padding:'3px 5px', borderRadius:5, border: has ? 'none' : '1px dashed rgba(60,40,20,.14)', background: has ? sh.color : 'transparent', color: has ? 'rgba(60,40,20,.7)' : 'var(--ink-300)', fontFamily:'inherit', fontSize:10, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                          {has ? <><span>{sh.code}</span><span style={{ fontFamily:'var(--font-mono)', fontWeight:400, fontSize:9 }}>{sh.start.slice(0,5)}–{sh.end.slice(0,5)}</span></> : sh.code}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop:12, padding:'10px 14px', background:'var(--paper)', borderRadius:8, border:'var(--hair)', display:'flex', gap:12, alignItems:'center', fontSize:12, color:'var(--ink-600)' }}>
        <span>Fes clic a cada cel·la per afegir o treure un torn</span>
        <div style={{ flex:1 }} />
        <span>Total: <b style={{ color:'var(--ink-900)' }}>
          {Object.values(weekSched).reduce((total, day) =>
            total + Object.values(day).reduce((t, ids) => t + ids.length, 0), 0)} assignacions
        </b></span>
      </div>
    </div>
  );
}
