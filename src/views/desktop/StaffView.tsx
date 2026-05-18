import React, { useState, useRef, useEffect } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { DAY_NAMES, DAY_NAMES_SHORT, TODAY_DOW, avIdx, timeToMins, BUSINESSES } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { Employee, EmployeeRole, EmployeeShift } from '@/types';

export default function StaffView() {
  const [tab, setTab] = useState<'duty' | 'schedule'>('duty');
  const { selectedBusiness } = useAppStore();
  const biz = BUSINESSES.find(b => b.id === selectedBusiness) ?? BUSINESSES[0];
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--cream)' }}>
      {/* Page header — editorial eyebrow + serif title, matches DailyView */}
      <div style={{ padding:'18px 28px 12px', borderBottom:'var(--hair)', flexShrink:0 }}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:7,
          fontSize:10.5, fontWeight:700, letterSpacing:.14,
          color:'var(--ink-500)', textTransform:'uppercase', marginBottom:6,
        }}>
          <span aria-hidden="true" style={{
            width:6, height:6, borderRadius:999, background: biz.hue,
            boxShadow: `0 0 0 3px ${biz.hueSoft}`,
          }} />
          {biz.name} <span style={{ opacity:.4 }}>·</span> Personal del torn
        </div>
        <h2 style={{
          margin:0, fontFamily:'var(--font-serif)', fontSize:30,
          fontWeight:500, color:'var(--ink-900)',
          letterSpacing:'-.018em', lineHeight:1.05,
        }}>Equip</h2>
      </div>

      {/* Tabs */}
      <div style={{ padding:'8px 24px 0', borderBottom:'var(--hair)', flexShrink:0, display:'flex', gap:2 }}>
        {([['duty','Equip avui'],['schedule','Horaris setmanals']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding:'9px 16px',
              border:'none', background:'transparent',
              cursor:'pointer', fontFamily:'inherit',
              fontSize:13, fontWeight: tab===k ? 600 : 500,
              color: tab===k ? 'var(--ink-900)' : 'var(--ink-600)',
              borderBottom: tab===k ? '2px solid var(--terracotta-600)' : '2px solid transparent',
              marginBottom:-1,
              transition:'color 160ms var(--ease-out), border-color 160ms var(--ease-out)',
              letterSpacing:'-0.005em',
            }}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'duty'     && <StaffOnDuty    key={selectedBusiness} bizId={selectedBusiness} />}
      {tab === 'schedule' && <ScheduleEditor key={selectedBusiness} bizId={selectedBusiness} />}
    </div>
  );
}

// â”€â”€â”€ Shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmtRange(s: string, e: string) { return `${s}â€“${e}`; }

function isOnDuty(shift: EmployeeShift): boolean {
  const now   = new Date();
  const nowM  = now.getHours() * 60 + now.getMinutes();
  const startM = timeToMins(shift.startTime);
  const endM   = timeToMins(shift.endTime);
  // handle midnight-crossing (end < start in real clock = next day)
  if (endM > startM) return nowM >= startM && nowM < endM;
  return nowM >= startM || nowM < (endM % 1440);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Equip avui
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function StaffOnDuty({ bizId }: { bizId: string }) {
  const { employees, employeeRoles, employeeShifts, clockInEmployee, clockOutEmployee } = useAppStore();
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);

  const todayShifts = employeeShifts.filter(s => s.businessId === bizId && s.dow === TODAY_DOW);

  // empShifts: empId â†’ EmployeeShift[]
  const empShiftsMap: Record<string, EmployeeShift[]> = {};
  todayShifts.forEach(s => { (empShiftsMap[s.employeeId] ??= []).push(s); });

  const bizEmps  = employees.filter(e => e.bizId === bizId && e.active);
  const bizRoles = employeeRoles.filter(r => r.bizId === bizId && r.active).sort((a,b) => a.order - b.order);

  const byRole: Record<string, Employee[]> = {};
  bizEmps.forEach(e => { (byRole[e.roleId] ??= []).push(e); });

  const clockedCount  = bizEmps.filter(e => e.clockedIn).length;
  const plannedCount  = bizEmps.filter(e => empShiftsMap[e.id]?.length).length;
  const onDutyNow     = todayShifts.filter(isOnDuty).map(s => s.employeeId);
  const onDutyCount   = new Set(onDutyNow).size;
  const unplannedIn   = bizEmps.filter(e => e.clockedIn && !empShiftsMap[e.id]?.length);

  return (
    <div className="scroll" style={{ overflowY:'auto', flex:1, padding:'18px 28px 40px' }}>
      {/* Stats bar */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:18 }}>
        <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--ink-600)' }}>
          <span><b style={{ color:'var(--olive-700)' }}>{clockedCount}</b> fitxats</span>
          <span><b style={{ color:'var(--terracotta-700)' }}>{onDutyCount}</b> en servei ara</span>
          <span><b style={{ color:'var(--ink-900)' }}>{plannedCount}</b> planificats avui</span>
          <span><b style={{ color:'var(--ink-500)' }}>{bizEmps.length}</b> total</span>
        </div>
      </div>

      {unplannedIn.length > 0 && (
        <div style={{ padding:'10px 14px', background:'var(--clay-50)', border:'1px solid var(--clay-200)', borderRadius:10, marginBottom:16, fontSize:12.5, color:'var(--clay-700)' }}>
          âš  {unplannedIn.map(e => e.fullName).join(', ')} {unplannedIn.length === 1 ? 'ha fitxat' : 'han fitxat'} perÃ² no {unplannedIn.length>1?'estan':'estÃ '} planificat{unplannedIn.length>1?'s':''}
        </div>
      )}

      {bizRoles.filter(r => byRole[r.id]?.length).map(role => (
        <div key={role.id} style={{ marginBottom:22 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10 }}>
            <span style={{ padding:'3px 10px', borderRadius:4, background:role.color, color:role.textColor, fontSize:10.5, fontWeight:700, letterSpacing:.06, textTransform:'uppercase' }}>
              {role.name}
            </span>
            <span style={{ fontSize:12, color:'var(--ink-500)' }}>{byRole[role.id].length} {byRole[role.id].length===1?'persona':'persones'}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:10 }}>
            {byRole[role.id].map(emp => (
              <EmpCard key={emp.id} emp={emp} role={role}
                todayShifts={empShiftsMap[emp.id] ?? []}
                onClick={() => setDetailEmp(emp)}
                onClockIn={() => clockInEmployee(emp.id)}
                onClockOut={() => clockOutEmployee(emp.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {bizEmps.length === 0 && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--ink-500)', fontFamily:'var(--font-serif)', fontSize:16 }}>
          Cap empleat actiu en aquest negoci
        </div>
      )}

      {detailEmp && (
        <EmpDetailDrawer
          emp={detailEmp}
          role={bizRoles.find(r => r.id === detailEmp.roleId) ?? null}
          todayShifts={empShiftsMap[detailEmp.id] ?? []}
          onClose={() => setDetailEmp(null)}
          onClockIn={() => { clockInEmployee(detailEmp.id); setDetailEmp(e => e ? { ...e, clockedIn:true } : null); }}
          onClockOut={() => { clockOutEmployee(detailEmp.id); setDetailEmp(e => e ? { ...e, clockedIn:false } : null); }}
        />
      )}
    </div>
  );
}

function EmpCard({ emp, role, todayShifts, onClick, onClockIn, onClockOut }: {
  emp: Employee; role: EmployeeRole | null;
  todayShifts: EmployeeShift[];
  onClick: () => void; onClockIn: () => void; onClockOut: () => void;
}) {
  const hasShift  = todayShifts.length > 0;
  const dutyNow   = todayShifts.some(isOnDuty);
  return (
    <div onClick={onClick}
      style={{ padding:12, background:'var(--paper)', borderRadius:12, border:'var(--hair)', boxShadow:'var(--sh-1)', display:'flex', alignItems:'center', gap:12, cursor:'pointer', opacity: hasShift ? 1 : 0.6 }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--sh-2)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--sh-1)')}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <div className={`avatar av-${avIdx(emp.fullName)}`} style={{ width:40, height:40, fontSize:13, display:'grid', placeItems:'center', borderRadius:'50%' }}>
          {emp.initials}
        </div>
        <span style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderRadius:'50%', background: emp.clockedIn ? 'var(--olive-500)' : dutyNow ? 'var(--terracotta-400)' : 'var(--ink-300)', border:'2px solid var(--paper)' }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.fullName}</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:3 }}>
          {hasShift
            ? todayShifts.map(s => (
                <span key={s.id} style={{ fontSize:10.5, fontFamily:'var(--font-mono)', padding:'1px 6px', borderRadius:4, background: dutyNow && isOnDuty(s) ? 'var(--olive-100)' : 'var(--ink-100)', color: dutyNow && isOnDuty(s) ? 'var(--olive-800)' : 'var(--ink-600)' }}>
                  {fmtRange(s.startTime, s.endTime)}
                </span>
              ))
            : <span style={{ fontSize:11, color:'var(--ink-400)' }}>Sense torn avui</span>
          }
        </div>
      </div>
      {!emp.clockedIn ? (
        <button onClick={e => { e.stopPropagation(); onClockIn(); }}
          style={{ fontSize:11, padding:'4px 8px', border:'var(--hair)', borderRadius:6, background:'var(--olive-50)', color:'var(--olive-700)', cursor:'pointer', fontFamily:'inherit', fontWeight:600, flexShrink:0 }}>
          Fitxar
        </button>
      ) : (
        <button onClick={e => { e.stopPropagation(); onClockOut(); }}
          style={{ fontSize:11, padding:'4px 8px', border:'var(--hair)', borderRadius:6, background:'var(--ink-50)', color:'var(--ink-600)', cursor:'pointer', fontFamily:'inherit', fontWeight:600, flexShrink:0 }}>
          Sortida
        </button>
      )}
    </div>
  );
}

function EmpDetailDrawer({ emp, role, todayShifts, onClose, onClockIn, onClockOut }: {
  emp: Employee; role: EmployeeRole | null;
  todayShifts: EmployeeShift[];
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
          {todayShifts.length > 0 && (
            <InfoRow label="Avui" value={todayShifts.map(s => fmtRange(s.startTime, s.endTime)).join(' Â· ')} />
          )}
          {emp.phone && <InfoRow label="TelÃ¨fon" value={emp.phone} />}
          {emp.email && <InfoRow label="Email" value={emp.email} />}
          {emp.notes && <InfoRow label="Notes" value={emp.notes} />}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:'auto' }}>
          {emp.clockedIn ? (
            <button onClick={onClockOut} style={{ flex:1, padding:'9px 0', background:'var(--ink-100)', color:'var(--ink-800)', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
              Marcar sortida
            </button>
          ) : (
            <button onClick={onClockIn} style={{ flex:1, padding:'9px 0', background:'var(--olive-600)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Horaris setmanals â€” editor de chips amb intervals reals
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function ScheduleEditor({ bizId }: { bizId: string }) {
  const { employees, employeeRoles, employeeShifts, addEmployeeShift, updateEmployeeShift, deleteEmployeeShift } = useAppStore();

  const bizEmps  = employees.filter(e => e.bizId === bizId && e.active).sort((a, b) => {
    const ra = employeeRoles.find(r => r.id === a.roleId)?.order ?? 99;
    const rb = employeeRoles.find(r => r.id === b.roleId)?.order ?? 99;
    return ra - rb;
  });
  const bizRoles = employeeRoles.filter(r => r.bizId === bizId);
  const roleMap  = Object.fromEntries(bizRoles.map(r => [r.id, r]));

  const [weekOffset, setWeekOffset] = useState(0);
  // editing: { shiftId } to edit existing | { empId, dow } to add new
  const [editing, setEditing] = useState<{ shiftId?: string; empId?: string; dow?: number } | null>(null);

    const _now = new Date(); const _d = _now.getDay();
  const baseDate  = new Date(_now); baseDate.setDate(_now.getDate() - (_d === 0 ? 6 : _d - 1)); baseDate.setHours(0,0,0,0);
  const weekStart = new Date(baseDate); weekStart.setDate(baseDate.getDate() + weekOffset * 7);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const fmtD      = (d: Date) => `${d.getDate()} ${['gen','feb','mar','abr','maig','jun','jul','ago','set','oct','nov','des'][d.getMonth()]}`;

  // Group shifts by empId+dow
  const shiftsByEmpDow: Record<string, EmployeeShift[]> = {};
  employeeShifts
    .filter(s => s.businessId === bizId)
    .forEach(s => {
      const key = `${s.employeeId}-${s.dow}`;
      (shiftsByEmpDow[key] ??= []).push(s);
    });

  function totalAssignments() {
    return employeeShifts.filter(s => s.businessId === bizId).length;
  }

  return (
    <div className="scroll" style={{ overflowY:'auto', flex:1, padding:'18px 28px 40px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button onClick={() => setWeekOffset(o => o-1)}
          style={{ width:28, height:28, display:'grid', placeItems:'center', background:'transparent', border:'var(--hair)', borderRadius:8, cursor:'pointer', color:'var(--ink-700)' }}>
          <Icon d={I.chevL} size={13} />
        </button>
        <span style={{ fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500, color:'var(--ink-900)' }}>
          Setmana del {fmtD(weekStart)} â€“ {fmtD(weekEnd)} 2026
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

      {/* Grid */}
      <div style={{ background:'var(--paper)', borderRadius:12, border:'var(--hair)', overflow:'visible' }}>
        {/* Header row */}
        <div style={{ display:'grid', gridTemplateColumns:'170px repeat(7, 1fr)', borderBottom:'var(--hair)', background:'var(--ink-50)', borderRadius:'12px 12px 0 0' }}>
          <div style={{ padding:'10px 12px', fontSize:10.5, fontWeight:700, letterSpacing:.06, textTransform:'uppercase', color:'var(--ink-500)' }}>Empleat</div>
          {DAY_NAMES.map((d, i) => {
            const date   = new Date(weekStart); date.setDate(weekStart.getDate() + i);
            const isToday = weekOffset === 0 && i === TODAY_DOW;
            return (
              <div key={d} style={{ padding:'8px 8px', borderLeft:'var(--hair)', textAlign:'center' }}>
                <div style={{ fontSize:11, fontWeight:600, color: isToday ? 'var(--terracotta-700)' : 'var(--ink-500)' }}>
                  {DAY_NAMES_SHORT[i].toUpperCase()}
                </div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--terracotta-700)' : 'var(--ink-800)' }}>
                  {date.getDate()}
                </div>
                {isToday && <div style={{ fontSize:8, fontWeight:700, color:'var(--terracotta-600)', letterSpacing:.04 }}>AVUI</div>}
              </div>
            );
          })}
        </div>

        {/* Employee rows */}
        {bizEmps.map((emp, empIdx) => {
          const role = roleMap[emp.roleId];
          return (
            <div key={emp.id} style={{ display:'grid', gridTemplateColumns:'170px repeat(7, 1fr)', borderBottom: empIdx < bizEmps.length-1 ? 'var(--hair)' : 'none' }}>
              {/* Employee name col */}
              <div style={{ padding:'8px 10px', display:'flex', alignItems:'center', gap:7, borderRight:'var(--hair)' }}>
                <div className={`avatar av-${avIdx(emp.fullName)}`} style={{ width:26, height:26, fontSize:9, display:'grid', placeItems:'center', borderRadius:'50%', flexShrink:0 }}>
                  {emp.initials}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.fullName}</div>
                  {role && <div style={{ fontSize:9.5, fontWeight:600, color:role.textColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{role.name}</div>}
                </div>
              </div>

              {/* Day cells */}
              {Array.from({ length:7 }).map((_, dow) => {
                const isToday = weekOffset === 0 && dow === TODAY_DOW;
                const key     = `${emp.id}-${dow}`;
                const shifts  = shiftsByEmpDow[key] ?? [];
                const isEditing = editing?.empId === emp.id && editing?.dow === dow && !editing?.shiftId;

                return (
                  <div key={dow} style={{ borderLeft:'var(--hair)', padding:'5px 5px', minHeight:52, display:'flex', flexDirection:'column', gap:3, background: isToday ? 'rgba(200,97,58,0.04)' : 'transparent', position:'relative', overflow:'visible' }}>
                    {/* Existing shift chips */}
                    {shifts.map(sh => (
                      <ShiftChip
                        key={sh.id}
                        shift={sh}
                        role={role ?? null}
                        isEditing={editing?.shiftId === sh.id}
                        onStartEdit={() => setEditing({ shiftId: sh.id })}
                        onSave={(start, end) => { updateEmployeeShift(sh.id, { startTime: start, endTime: end }); setEditing(null); }}
                        onDelete={() => { deleteEmployeeShift(sh.id); setEditing(null); }}
                        onCancel={() => setEditing(null)}
                      />
                    ))}

                    {/* Add button / inline form */}
                    {isEditing ? (
                      <AddShiftForm
                        onAdd={(start, end) => {
                          addEmployeeShift({ employeeId: emp.id, businessId: bizId as any, dow, startTime: start, endTime: end });
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setEditing({ empId: emp.id, dow })}
                        title="Afegir torn"
                        style={{ alignSelf:'flex-start', padding:'2px 6px', border:'1px dashed rgba(60,40,20,.18)', borderRadius:4, background:'transparent', color:'var(--ink-400)', cursor:'pointer', fontSize:13, lineHeight:1.2, fontFamily:'inherit', transition:'all .1s' }}
                        onMouseEnter={e => { (e.currentTarget.style.borderColor = 'var(--terracotta-400)'); (e.currentTarget.style.color = 'var(--terracotta-600)'); }}
                        onMouseLeave={e => { (e.currentTarget.style.borderColor = 'rgba(60,40,20,.18)'); (e.currentTarget.style.color = 'var(--ink-400)'); }}>
                        +
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop:12, padding:'10px 14px', background:'var(--paper)', borderRadius:8, border:'var(--hair)', display:'flex', gap:12, alignItems:'center', fontSize:12, color:'var(--ink-600)' }}>
        <span>Fes clic a un horari per editar-lo Â· <b>+</b> per afegir un nou tram</span>
        <div style={{ flex:1 }} />
        <span>Total: <b style={{ color:'var(--ink-900)' }}>{totalAssignments()} assignacions</b></span>
      </div>
    </div>
  );
}

// â”€â”€â”€ Shift chip (existing shift with inline editor) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ShiftChip({ shift, role, isEditing, onStartEdit, onSave, onDelete, onCancel }: {
  shift: EmployeeShift;
  role: EmployeeRole | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (start: string, end: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState(shift.startTime);
  const [end,   setEnd]   = useState(shift.endTime);
  // reset local state when edit opens
  useEffect(() => { if (isEditing) { setStart(shift.startTime); setEnd(shift.endTime); } }, [isEditing]);

  const chipBg  = role?.color ?? 'var(--ink-100)';
  const chipFg  = role?.textColor ?? 'var(--ink-600)';

  if (isEditing) {
    return (
      <div style={{ padding:'5px 6px', background:'var(--cream)', border:'1.5px solid var(--terracotta-300)', borderRadius:7, display:'flex', flexDirection:'column', gap:4, zIndex:10, position:'relative' }}>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <input type="time" value={start} onChange={e => setStart(e.target.value)}
            style={{ flex:1, padding:'3px 4px', border:'var(--hair)', borderRadius:4, fontFamily:'var(--font-mono)', fontSize:11, outline:'none' }} />
          <span style={{ fontSize:10, color:'var(--ink-400)' }}>â€“</span>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)}
            style={{ flex:1, padding:'3px 4px', border:'var(--hair)', borderRadius:4, fontFamily:'var(--font-mono)', fontSize:11, outline:'none' }} />
        </div>
        <div style={{ display:'flex', gap:3 }}>
          <button onClick={() => onSave(start, end)}
            style={{ flex:1, padding:'3px 0', background:'var(--terracotta-600)', color:'white', border:'none', borderRadius:4, cursor:'pointer', fontFamily:'inherit', fontSize:10, fontWeight:600 }}>
            âœ“
          </button>
          <button onClick={onDelete}
            style={{ padding:'3px 6px', background:'var(--rose-50)', color:'var(--rose-600)', border:'1px solid var(--rose-200)', borderRadius:4, cursor:'pointer', fontFamily:'inherit', fontSize:10 }}>
            âœ•
          </button>
          <button onClick={onCancel}
            style={{ padding:'3px 6px', background:'transparent', color:'var(--ink-500)', border:'var(--hair)', borderRadius:4, cursor:'pointer', fontFamily:'inherit', fontSize:10 }}>
            esc
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={onStartEdit}
      title="Clic per editar Â· âœ• per eliminar"
      style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 6px 2px 5px', borderRadius:4, border:'none', background:chipBg, color:chipFg, cursor:'pointer', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:600, transition:'opacity .1s', textAlign:'left' }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
      <span style={{ fontSize:9 }}>â±</span>
      {fmtRange(shift.startTime, shift.endTime)}
    </button>
  );
}

// â”€â”€â”€ Add shift form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AddShiftForm({ onAdd, onCancel }: {
  onAdd: (start: string, end: string) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState('09:00');
  const [end,   setEnd]   = useState('17:00');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector('input');
    el?.focus();
  }, []);

  return (
    <div ref={ref} style={{ padding:'5px 6px', background:'var(--cream)', border:'1.5px solid var(--terracotta-300)', borderRadius:7, display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <input type="time" value={start} onChange={e => setStart(e.target.value)}
          style={{ flex:1, padding:'3px 4px', border:'var(--hair)', borderRadius:4, fontFamily:'var(--font-mono)', fontSize:11, outline:'none' }} />
        <span style={{ fontSize:10, color:'var(--ink-400)' }}>â€“</span>
        <input type="time" value={end} onChange={e => setEnd(e.target.value)}
          style={{ flex:1, padding:'3px 4px', border:'var(--hair)', borderRadius:4, fontFamily:'var(--font-mono)', fontSize:11, outline:'none' }} />
      </div>
      <div style={{ display:'flex', gap:3 }}>
        <button onClick={() => onAdd(start, end)}
          style={{ flex:1, padding:'3px 0', background:'var(--terracotta-600)', color:'white', border:'none', borderRadius:4, cursor:'pointer', fontFamily:'inherit', fontSize:10, fontWeight:600 }}>
          Afegir
        </button>
        <button onClick={onCancel}
          style={{ padding:'3px 8px', background:'transparent', color:'var(--ink-500)', border:'var(--hair)', borderRadius:4, cursor:'pointer', fontFamily:'inherit', fontSize:10 }}>
          esc
        </button>
      </div>
    </div>
  );
}

