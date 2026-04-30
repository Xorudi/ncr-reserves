import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { isoDate, BUSINESSES } from '@/data/mockData';
import type { MobileTab } from './MobileShell';

type SubScreen = 'menu' | 'alerts' | 'calendar';

export default function MobileMoreScreen({ onSwitchTab }: { onSwitchTab: (tab: MobileTab) => void }) {
  const [sub, setSub] = useState<SubScreen>('menu');

  if (sub === 'alerts')   return <AlertsScreen onBack={() => setSub('menu')} />;
  if (sub === 'calendar') return <CalendarScreen onBack={() => setSub('menu')} />;

  return <MoreMenu onSub={setSub} onSwitchTab={onSwitchTab} />;
}

// ─── More menu ───────────────────────────────────────────────────────────────
function MoreMenu({ onSub, onSwitchTab }: {
  onSub: (s: SubScreen) => void;
  onSwitchTab: (tab: MobileTab) => void;
}) {
  const { selectedBusiness, employees, employeeRoles, activeEmployeeId } = useAppStore();
  const biz     = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const emp     = employees.find(e => e.id === activeEmployeeId) ?? null;
  const roleMap = Object.fromEntries(employeeRoles.map(r => [r.id, r]));
  const role    = emp ? roleMap[emp.roleId] : null;

  const MENU_ITEMS: { label: string; desc: string; ico: React.ReactNode; action: () => void }[] = [
    {
      label: 'Alertes',
      desc:  'Reserves pendents, notes de torn, esdeveniments',
      ico:   I.bell,
      action: () => onSub('alerts'),
    },
    {
      label: 'Calendari',
      desc:  'Vista mensual de reserves',
      ico:   I.calendar,
      action: () => onSub('calendar'),
    },
    {
      label: 'Reserves',
      desc:  'Tornar a la llista de reserves',
      ico:   I.list,
      action: () => onSwitchTab('reservations'),
    },
  ];

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px var(--scroll-pad-bottom)' }}>

      {/* User card */}
      {emp ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 14, background: 'var(--paper)',
          border: '1px solid rgba(60,40,20,.1)', marginBottom: 20,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: role?.color ?? 'var(--terracotta-50)',
            color: role?.textColor ?? 'var(--terracotta-700)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 15,
          }}>
            {emp.initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>{emp.fullName}</div>
            {role && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                background: role.color, color: role.textColor,
              }}>
                {role.name}
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{biz.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>{biz.kind}</div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '13px 16px', borderRadius: 14, background: 'var(--paper)',
          border: '1px solid rgba(60,40,20,.1)', marginBottom: 20,
          fontSize: 13, color: 'var(--ink-500)',
        }}>
          Cap usuari actiu · {biz.name}
        </div>
      )}

      {/* Menu items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MENU_ITEMS.map(item => (
          <button key={item.label} onClick={item.action}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 13,
              border: '1px solid rgba(60,40,20,.1)', background: 'var(--paper)',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
            <span style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'var(--cream)', color: 'var(--terracotta-600)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon d={item.ico} size={20} stroke={1.7} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{item.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{item.desc}</div>
            </div>
            <Icon d={I.chevR} size={16} />
          </button>
        ))}
      </div>

      {/* App version */}
      <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: 'var(--ink-300)' }}>
        NCR RESERVES · v0.1
      </div>
    </div>
  );
}

// ─── Alerts screen ────────────────────────────────────────────────────────────
function AlertsScreen({ onBack }: { onBack: () => void }) {
  const { selectedBusiness, reservations, shiftNotes, appEvents, selectedDate } = useAppStore();
  const todayStr = isoDate(selectedDate);

  const pending = reservations.filter(r =>
    r.bizId === selectedBusiness && r.date === todayStr && r.status === 'pending',
  );
  const notes = shiftNotes.filter(n => n.bizId === selectedBusiness && n.date === todayStr);
  const events = appEvents.filter(e => e.bizId === selectedBusiness && e.date === todayStr);

  const totalAlerts = pending.length + notes.length + events.length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 11px', background: 'var(--paper)', borderBottom: 'var(--hair)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-600)', display: 'grid', placeItems: 'center' }}>
          <Icon d={I.chevL} size={20} stroke={2} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', flex: 1 }}>Alertes</span>
        {totalAlerts > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'rgba(190,100,20,.12)', color: '#b05a00' }}>
            {totalAlerts}
          </span>
        )}
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px var(--scroll-pad-bottom)' }}>

        {/* Pending reservations */}
        {pending.length > 0 && (
          <Section title={`Reserves pendents (${pending.length})`} color="#b05a00">
            {pending.map(r => (
              <AlertCard key={r.id}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                  {r.time} · {r.pax} pax{r.phone ? ` · ${r.phone}` : ''}
                </div>
              </AlertCard>
            ))}
          </Section>
        )}

        {/* Events */}
        {events.length > 0 && (
          <Section title="Esdeveniments d'avui" color="#1a4ea0">
            {events.map(ev => (
              <AlertCard key={ev.id}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{ev.title}</div>
                {ev.description && (
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{ev.description}</div>
                )}
              </AlertCard>
            ))}
          </Section>
        )}

        {/* Shift notes */}
        {notes.length > 0 && (
          <Section title="Notes de torn" color="#2e7040">
            {notes.map(n => (
              <AlertCard key={n.id}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 2 }}>{n.author}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-800)' }}>{n.body}</div>
              </AlertCard>
            ))}
          </Section>
        )}

        {totalAlerts === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-400)', fontSize: 14 }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>✅</div>
            Tot en ordre · Cap alerta avui
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: .06, textTransform: 'uppercase', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {children}
      </div>
    </div>
  );
}

function AlertCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '11px 14px', borderRadius: 11, background: 'var(--paper)', border: '1px solid rgba(60,40,20,.09)' }}>
      {children}
    </div>
  );
}

// ─── Calendar screen ──────────────────────────────────────────────────────────
function CalendarScreen({ onBack }: { onBack: () => void }) {
  const { selectedBusiness, reservations } = useAppStore();
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset]);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthLabel = viewDate.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });

  // Compute cells
  const cells = useMemo(() => {
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = firstDow + daysInMonth;
    const rows  = Math.ceil(total / 7);
    const arr: (number | null)[] = Array(rows * 7).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr[firstDow + d - 1] = d;
    return arr;
  }, [year, month]);

  // Count reservations per day
  const countByDay = useMemo(() => {
    const m: Record<string, number> = {};
    reservations.filter(r => r.bizId === selectedBusiness).forEach(r => {
      const [ry, rm] = r.date.split('-').map(Number);
      if (ry === year && rm === month + 1) m[r.date] = (m[r.date] ?? 0) + 1;
    });
    return m;
  }, [reservations, selectedBusiness, year, month]);

  const [selDay, setSelDay] = useState<number | null>(null);

  const selDate  = selDay ? isoDate(new Date(year, month, selDay)) : null;
  const dayRes   = selDate
    ? reservations
        .filter(r => r.bizId === selectedBusiness && r.date === selDate)
        .sort((a, b) => a.time.localeCompare(b.time))
    : [];

  const todayStr = isoDate(today);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 11px', background: 'var(--paper)', borderBottom: 'var(--hair)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-600)', display: 'grid', placeItems: 'center' }}>
          <Icon d={I.chevL} size={20} stroke={2} />
        </button>
        <button onClick={() => setMonthOffset(m => m - 1)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', color: 'var(--ink-500)' }}>
          <Icon d={I.chevL} size={16} />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', textTransform: 'capitalize' }}>
          {monthLabel}
        </span>
        <button onClick={() => setMonthOffset(m => m + 1)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', color: 'var(--ink-500)' }}>
          <Icon d={I.chevR} size={16} />
        </button>
        <button onClick={() => { setMonthOffset(0); setSelDay(today.getDate()); }}
          style={{ padding: '4px 10px', borderRadius: 7, border: '1.5px solid rgba(60,40,20,.15)', background: 'var(--cream)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer' }}>
          Avui
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 10px var(--scroll-pad-bottom)' }}>
        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
          {['Dl','Dt','Dc','Dj','Dv','Ds','Dg'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-400)', paddingBottom: 4 }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const ds      = isoDate(new Date(year, month, day));
            const count   = countByDay[ds] ?? 0;
            const isToday = ds === todayStr;
            const isSel   = day === selDay;
            return (
              <button key={i} onClick={() => setSelDay(day === selDay ? null : day)}
                style={{
                  padding: '6px 2px 7px',
                  borderRadius: 9,
                  border: isSel ? '2px solid var(--terracotta-600)' : '1.5px solid transparent',
                  background: isSel ? 'var(--terracotta-50)' : isToday ? 'rgba(60,40,20,.06)' : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                <span style={{
                  fontSize: 13, fontWeight: isToday ? 800 : isSel ? 700 : 500,
                  color: isSel ? 'var(--terracotta-700)' : isToday ? 'var(--terracotta-600)' : 'var(--ink-800)',
                }}>
                  {day}
                </span>
                {count > 0 && (
                  <span style={{
                    width: 16, height: 5, borderRadius: 3,
                    background: isSel ? 'var(--terracotta-500)' : 'var(--terracotta-300)',
                    fontSize: 9, color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Day panel */}
        {selDay && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 8 }}>
              {new Date(year, month, selDay).toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}{dayRes.length} reserva{dayRes.length !== 1 ? 'es' : ''}
            </div>
            {dayRes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ink-400)', fontSize: 13 }}>
                Cap reserva
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {dayRes.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 13px', borderRadius: 10,
                    background: 'var(--paper)', border: '1px solid rgba(60,40,20,.09)',
                  }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-700)', flexShrink: 0 }}>{r.time}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--ink-500)', flexShrink: 0 }}>{r.pax}p</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
