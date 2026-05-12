import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { isoDate, BUSINESSES } from '@/data/mockData';
import type { MobileTab } from './MobileShell';
import { useBackupStore } from '@/backup/useBackupStore';
import {
  createLocalBackup, restoreFromId, exportCurrentToFile, exportBackupToFile,
  importBackupFromFile, restoreFromBackup, deleteBackupById,
} from '@/backup/backupService';
import { idbGet } from '@/backup/indexedDB';
import { rankCustomers } from '@/utils/loyalty';

type SubScreen = 'menu' | 'alerts' | 'calendar' | 'backups' | 'stats';

export default function MobileMoreScreen({ onSwitchTab, onOpenNotes, onSwitchUser }: {
  onSwitchTab: (tab: MobileTab) => void;
  onOpenNotes?: () => void;
  onSwitchUser?: () => void;
}) {
  const [sub, setSub] = useState<SubScreen>('menu');

  if (sub === 'alerts')   return <AlertsScreen  onBack={() => setSub('menu')} />;
  if (sub === 'calendar') return <CalendarScreen onBack={() => setSub('menu')} />;
  if (sub === 'backups')  return <MobileBackupScreen onBack={() => setSub('menu')} />;
  if (sub === 'stats')    return <StatsScreen onBack={() => setSub('menu')} />;

  return <MoreMenu onSub={setSub} onSwitchTab={onSwitchTab} onOpenNotes={onOpenNotes} onSwitchUser={onSwitchUser} />;
}

// ─── More menu ───────────────────────────────────────────────────────────────
function MoreMenu({ onSub, onSwitchTab, onOpenNotes, onSwitchUser }: {
  onSub: (s: SubScreen) => void;
  onSwitchTab: (tab: MobileTab) => void;
  onOpenNotes?: () => void;
  onSwitchUser?: () => void;
}) {
  const {
    selectedBusiness, employees, employeeRoles, activeEmployeeId,
    reservations, shiftNotes, appEvents, selectedDate,
  } = useAppStore();
  const biz     = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const emp     = employees.find(e => e.id === activeEmployeeId) ?? null;
  const roleMap = Object.fromEntries(employeeRoles.map(r => [r.id, r]));
  const role    = emp ? roleMap[emp.roleId] : null;

  // Live counts for menu badges
  const todayIso     = isoDate(selectedDate);
  const pendingCount = reservations.filter(r =>
    r.bizId === selectedBusiness && r.date === todayIso && r.status === 'pending').length;
  const eventsCount  = appEvents.filter(e =>
    e.bizId === selectedBusiness && e.date === todayIso).length;
  const notesCount   = shiftNotes.filter(n =>
    n.bizId === selectedBusiness && n.date === todayIso).length;
  const alertsCount  = pendingCount + eventsCount;

  type MenuItem = {
    label: string; desc: string; ico: React.ReactNode;
    action: () => void; badge?: number; tone?: 'olive' | 'clay' | 'terracotta' | 'sky';
  };
  const OPERATIONAL: MenuItem[] = [
    {
      label: 'Notes del torn',
      desc:  'Avís ràpid per al servei (sense calamars, plat especial…)',
      ico:   I.note ?? I.pencil,
      action: () => onOpenNotes?.(),
      badge: notesCount, tone: 'clay',
    },
    {
      label: 'Alertes',
      desc:  'Reserves pendents i esdeveniments d\'avui',
      ico:   I.bell,
      action: () => onSub('alerts'),
      badge: alertsCount, tone: 'terracotta',
    },
    {
      label: 'Calendari',
      desc:  'Vista mensual de reserves',
      ico:   I.calendar,
      action: () => onSub('calendar'),
      tone: 'sky',
    },
    {
      label: 'Estadístiques',
      desc:  'KPIs, tendències i top clients',
      ico:   I.barChart ?? I.calendar,
      action: () => onSub('stats'),
      tone: 'olive',
    },
  ];
  const SYSTEM: MenuItem[] = [
    {
      label: 'Còpies de seguretat',
      desc:  'Backup local, exportar i importar dades',
      ico:   I.shield,
      action: () => onSub('backups'),
      tone: 'olive',
    },
  ];

  function renderItem(item: MenuItem) {
    const toneBg =
      item.tone === 'olive'      ? 'var(--olive-50)'      :
      item.tone === 'clay'       ? 'var(--clay-50)'       :
      item.tone === 'terracotta' ? 'var(--terracotta-50)' :
      item.tone === 'sky'        ? 'var(--sky-50)'        :
      'var(--cream)';
    const toneFg =
      item.tone === 'olive'      ? 'var(--olive-700)'      :
      item.tone === 'clay'       ? 'var(--clay-700)'       :
      item.tone === 'terracotta' ? 'var(--terracotta-700)' :
      item.tone === 'sky'        ? 'var(--sky-700)'        :
      'var(--terracotta-600)';
    return (
      <button key={item.label} onClick={item.action} className="press"
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', borderRadius: 14,
          border: '1px solid rgba(60,40,20,.08)',
          background: 'var(--paper)',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          width: '100%',
          boxShadow: '0 1px 2px rgba(60,40,20,.04)',
          transition: 'background 200ms var(--ease-in-out)',
        }}>
        <span style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: toneBg, color: toneFg,
          display: 'grid', placeItems: 'center',
          border: `1px solid ${toneFg}22`,
        }}>
          <Icon d={item.ico} size={19} stroke={1.9} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            fontSize: 14.5, fontWeight: 650, color: 'var(--ink-900)',
            letterSpacing: -.005,
          }}>
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span key={item.badge} className="number-tween" style={{
                fontSize: 10, fontWeight: 700, letterSpacing: .04,
                padding: '2px 7px', borderRadius: 999,
                background: toneFg, color: '#fff',
                fontFamily: 'var(--font-mono)',
              }}>
                {item.badge}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3 }}>{item.desc}</div>
        </div>
        <Icon d={I.chevR} size={15} />
      </button>
    );
  }

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px var(--scroll-pad-bottom)' }}>

      {/* Header — serif title */}
      <div style={{ padding: '0 4px 16px' }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
        }}>
          Més
        </div>
        <div style={{
          fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
          letterSpacing: .08, textTransform: 'uppercase', marginTop: 4,
          fontFamily: 'var(--font-mono)',
        }}>
          Operacions, dades i configuració
        </div>
      </div>

      {/* User + biz card */}
      {emp ? (
        <button onClick={() => onSwitchUser?.()} className="press"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 14px', borderRadius: 16,
            background: `linear-gradient(180deg, ${biz.hueSoft} 0%, var(--paper) 70%)`,
            border: `1px solid ${biz.hue}22`,
            marginBottom: 20, width: '100%',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            boxShadow: `0 2px 8px ${biz.hue}14`,
          }}>
          <span style={{
            position: 'relative',
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
            background: role?.color ?? 'var(--terracotta-50)',
            color: role?.textColor ?? 'var(--terracotta-700)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 17,
            boxShadow: emp.clockedIn ? '0 0 0 2px var(--olive-500)' : 'none',
          }}>
            {emp.initials}
            {emp.clockedIn && (
              <span style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 13, height: 13, borderRadius: 999,
                background: 'var(--olive-600)',
                border: '2px solid var(--paper)',
              }} />
            )}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
            }}>
              {emp.fullName}
            </div>
            <div style={{
              fontSize: 10.5, color: 'var(--ink-500)', fontWeight: 600,
              letterSpacing: .06, textTransform: 'uppercase', marginTop: 4,
              fontFamily: 'var(--font-mono)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {role && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                  background: role.color, color: role.textColor,
                }}>{role.name}</span>
              )}
              <span style={{ color: biz.hue, opacity: .85 }}>{biz.name}</span>
            </div>
          </div>
          <span style={{
            fontSize: 11, color: 'var(--ink-500)', fontWeight: 700,
            letterSpacing: .04,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            Canviar
            <Icon d={I.chevR} size={13} />
          </span>
        </button>
      ) : (
        <button onClick={() => onSwitchUser?.()} className="press"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderRadius: 16,
            background: 'var(--paper)',
            border: '1px dashed rgba(60,40,20,.20)',
            marginBottom: 20, width: '100%',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            color: 'var(--ink-500)',
          }}>
          <span style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'var(--ink-100)', color: 'var(--ink-500)',
            display: 'grid', placeItems: 'center',
          }}>
            <Icon d={I.users} size={18} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500,
              color: 'var(--ink-700)',
            }}>Cap usuari fitxat</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>
              Toca per fitxar · {biz.name}
            </div>
          </div>
          <Icon d={I.chevR} size={14} />
        </button>
      )}

      {/* Operational group */}
      <SectionLabel>Operacional</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {OPERATIONAL.map(renderItem)}
      </div>

      {/* System group */}
      <SectionLabel>Sistema</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SYSTEM.map(renderItem)}
      </div>

      {/* App version */}
      <div style={{
        marginTop: 28, textAlign: 'center',
        fontSize: 10, color: 'var(--ink-400)',
        fontFamily: 'var(--font-mono)', fontWeight: 600,
        letterSpacing: .12, textTransform: 'uppercase',
      }}>
        NCR Reserves · v0.1
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)',
      letterSpacing: .08, textTransform: 'uppercase',
      padding: '0 4px 8px',
    }}>
      {children}
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
  const { selectedBusiness, reservations, appEvents, setSelectedDate } = useAppStore();
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });

  // Cells (Mon-first calendar)
  const cells = useMemo(() => {
    const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total       = firstDow + daysInMonth;
    const rows        = Math.ceil(total / 7);
    const arr: (number | null)[] = Array(rows * 7).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr[firstDow + d - 1] = d;
    return arr;
  }, [year, month]);

  // Per-day stats: reservations, pax, migdia/nit split, has event
  type DayStat = { count: number; pax: number; migdia: number; nit: number; hasEvent: boolean };
  const statsByDay = useMemo(() => {
    const m: Record<string, DayStat> = {};
    reservations.filter(r => r.bizId === selectedBusiness).forEach(r => {
      const [ry, rm] = r.date.split('-').map(Number);
      if (ry !== year || rm !== month + 1) return;
      const s = m[r.date] ?? { count: 0, pax: 0, migdia: 0, nit: 0, hasEvent: false };
      s.count++;
      s.pax += r.pax;
      const h = parseInt(r.time.split(':')[0] ?? '0', 10);
      if (h < 18) s.migdia += r.pax; else s.nit += r.pax;
      m[r.date] = s;
    });
    appEvents.filter(e => e.bizId === selectedBusiness).forEach(e => {
      const [ry, rm] = e.date.split('-').map(Number);
      if (ry !== year || rm !== month + 1) return;
      m[e.date] = { ...(m[e.date] ?? { count: 0, pax: 0, migdia: 0, nit: 0, hasEvent: false }), hasEvent: true };
    });
    return m;
  }, [reservations, appEvents, selectedBusiness, year, month]);

  // Month totals (header KPIs) + busiest day
  const monthTotals = useMemo(() => {
    let count = 0, pax = 0, busiest = 0, busyDay: number | null = null;
    Object.entries(statsByDay).forEach(([ds, s]) => {
      count += s.count; pax += s.pax;
      if (s.pax > busiest) { busiest = s.pax; busyDay = parseInt(ds.split('-')[2], 10); }
    });
    const maxPax = Math.max(0, ...Object.values(statsByDay).map(s => s.pax));
    return { count, pax, busyDay, busiest, maxPax };
  }, [statsByDay]);

  const [selDay, setSelDay] = useState<number | null>(today.getDate());

  const selIsoDate = selDay ? isoDate(new Date(year, month, selDay)) : null;
  const dayRes = selIsoDate
    ? reservations
        .filter(r => r.bizId === selectedBusiness && r.date === selIsoDate)
        .sort((a, b) => a.time.localeCompare(b.time))
    : [];
  const dayStat = selIsoDate ? statsByDay[selIsoDate] ?? null : null;

  const todayStr = isoDate(today);

  // Heatmap intensity (terracotta single-hue) — pax / max
  function intensityFor(s?: DayStat) {
    if (!s || s.pax === 0) return 0;
    if (monthTotals.maxPax === 0) return 0;
    const ratio = s.pax / monthTotals.maxPax;
    return Math.min(0.18 + ratio * 0.7, 0.92);
  }

  function jumpToDay(day: number) {
    setSelectedDate(new Date(year, month, day));
    onBack();
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header — serif title + month nav + Avui pill ──────────────── */}
      <div style={{
        padding: '14px 16px 12px',
        background: 'var(--paper)', borderBottom: 'var(--hair)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={onBack} className="press"
            style={{
              width: 34, height: 34, borderRadius: 999,
              background: 'var(--cream)', border: '1px solid rgba(60,40,20,.08)',
              cursor: 'pointer', color: 'var(--ink-700)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
            <Icon d={I.chevL} size={16} stroke={2} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.05,
              textTransform: 'capitalize',
            }}>
              {monthLabel}
            </div>
            <div style={{
              fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
              letterSpacing: .08, textTransform: 'uppercase', marginTop: 4,
              fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            }}>
              <span key={`mc-${monthTotals.count}`} className="number-tween"
                style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 500, color: 'var(--ink-900)' }}>
                {monthTotals.count}
              </span>
              <span>reserves</span>
              <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-300)' }} />
              <span key={`mp-${monthTotals.pax}`} className="number-tween"
                style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 500, color: 'var(--ink-900)' }}>
                {monthTotals.pax}
              </span>
              <span>pax</span>
              {monthTotals.busyDay && (
                <>
                  <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-300)' }} />
                  <span style={{ color: 'var(--terracotta-700)' }}>
                    pic dia{' '}
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 500 }}>
                      {monthTotals.busyDay}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Month navigation row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setMonthOffset(m => m - 1)} className="press"
            style={navBtn}>
            <Icon d={I.chevL} size={15} stroke={2} />
          </button>
          <button onClick={() => setMonthOffset(m => m + 1)} className="press"
            style={navBtn}>
            <Icon d={I.chevR} size={15} stroke={2} />
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={() => { setMonthOffset(0); setSelDay(today.getDate()); }}
            disabled={monthOffset === 0 && selDay === today.getDate()}
            className="press"
            style={{
              padding: '6px 13px', borderRadius: 8,
              border: '1.5px solid var(--terracotta-500)',
              background: 'var(--terracotta-50)', color: 'var(--terracotta-700)',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              opacity: (monthOffset === 0 && selDay === today.getDate()) ? .5 : 1,
            }}>
            Avui
          </button>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 10px var(--scroll-pad-bottom)' }}>

        {/* ── Day-of-week headers ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6, padding: '0 4px' }}>
          {['Dl','Dt','Dc','Dj','Dv','Ds','Dg'].map((d, i) => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: 10, fontWeight: 700,
              letterSpacing: .12, textTransform: 'uppercase',
              color: i >= 5 ? 'var(--terracotta-700)' : 'var(--ink-500)',
              fontFamily: 'var(--font-mono)',
              paddingBottom: 4,
            }}>{d}</div>
          ))}
        </div>

        {/* ── Heatmap grid ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, padding: '0 4px' }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const ds      = isoDate(new Date(year, month, day));
            const stat    = statsByDay[ds];
            const intensity = intensityFor(stat);
            const isToday = ds === todayStr;
            const isSel   = day === selDay;
            const dow     = (new Date(year, month, day).getDay() + 6) % 7;
            const isWknd  = dow >= 5;
            return (
              <button key={i}
                onClick={() => setSelDay(day === selDay ? null : day)}
                className="press"
                style={{
                  position: 'relative',
                  aspectRatio: '1/1.05', minHeight: 0,
                  borderRadius: 10,
                  border: isSel
                    ? '2px solid var(--terracotta-600)'
                    : isToday
                      ? '1.5px solid var(--terracotta-500)'
                      : '1px solid rgba(60,40,20,.06)',
                  background: intensity > 0
                    ? `rgba(168,74,42,${intensity})`
                    : isWknd ? 'var(--cream)' : 'var(--paper)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'flex-start',
                  padding: '6px 2px 5px',
                  transition: 'border-color 200ms var(--ease-out), background 220ms var(--ease-out)',
                  overflow: 'hidden',
                }}>
                <span style={{
                  fontFamily: 'var(--font-serif)', fontSize: 14,
                  fontWeight: 500, lineHeight: 1, letterSpacing: -.005,
                  color: intensity > 0.45
                    ? '#fff'
                    : isSel ? 'var(--terracotta-700)'
                    : isToday ? 'var(--terracotta-600)'
                    : 'var(--ink-900)',
                }}>
                  {day}
                </span>

                {/* Pax tally — shown on busy days */}
                {stat && stat.pax > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, marginTop: 3,
                    fontFamily: 'var(--font-mono)', letterSpacing: .04,
                    color: intensity > 0.45 ? 'rgba(255,255,255,.85)' : 'var(--terracotta-700)',
                  }}>
                    {stat.pax}p
                  </span>
                )}

                {/* Bottom split-bar — clay vs plum proportions of pax */}
                {stat && stat.pax > 0 && (
                  <span style={{
                    position: 'absolute', left: 4, right: 4, bottom: 3,
                    height: 2, borderRadius: 999,
                    background: 'rgba(255,255,255,.2)',
                    overflow: 'hidden', display: 'flex',
                  }}>
                    <span style={{
                      width: `${(stat.migdia / stat.pax) * 100}%`,
                      background: intensity > 0.45 ? 'rgba(255,255,255,.9)' : '#c89a3a',
                    }} />
                    <span style={{
                      width: `${(stat.nit / stat.pax) * 100}%`,
                      background: intensity > 0.45 ? 'rgba(255,255,255,.55)' : '#6b3e5c',
                    }} />
                  </span>
                )}

                {/* Event marker — small dot top-right */}
                {stat?.hasEvent && (
                  <span style={{
                    position: 'absolute', top: 3, right: 3,
                    width: 5, height: 5, borderRadius: 999,
                    background: '#1a4ea0',
                    boxShadow: intensity > 0.45 ? '0 0 0 1.5px rgba(255,255,255,.6)' : '0 0 0 1.5px var(--paper)',
                  }} />
                )}

                {/* Today underline accent */}
                {isToday && !isSel && (
                  <span style={{
                    position: 'absolute', top: 3, left: 3,
                    width: 4, height: 4, borderRadius: 999,
                    background: 'var(--terracotta-600)',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Heatmap legend ───────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '14px 8px 4px',
          fontSize: 10.5, color: 'var(--ink-500)', fontWeight: 600,
          letterSpacing: .04,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Menys</span>
          {[0.12, 0.30, 0.50, 0.70, 0.90].map(v => (
            <span key={v} style={{
              width: 14, height: 14, borderRadius: 4,
              background: `rgba(168,74,42,${v})`,
              border: '1px solid rgba(60,40,20,.05)',
            }} />
          ))}
          <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Més</span>
          <span style={{ flex: 1 }} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: '#1a4ea0' }} />
            Esdev.
          </span>
        </div>

        {/* ── Day panel — selected day's reservations ──────────────── */}
        {selDay && (
          <div style={{ marginTop: 18, padding: '0 4px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500,
                  color: 'var(--ink-900)', letterSpacing: -.005,
                  textTransform: 'capitalize',
                }}>
                  {new Date(year, month, selDay).toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
                  letterSpacing: .06, marginTop: 3,
                  fontFamily: 'var(--font-mono)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{dayRes.length} reserves</span>
                  {dayStat && (
                    <>
                      <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--ink-300)' }} />
                      <span>{dayStat.pax} pax</span>
                      {dayStat.migdia > 0 && (
                        <span style={{ color: '#9c5d1f' }}> · {dayStat.migdia} migdia</span>
                      )}
                      {dayStat.nit > 0 && (
                        <span style={{ color: 'var(--plum-700)' }}> · {dayStat.nit} nit</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <button onClick={() => jumpToDay(selDay)} className="press"
                style={{
                  marginLeft: 'auto',
                  padding: '7px 12px', borderRadius: 9, border: 'none',
                  background: 'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)',
                  color: '#fff', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  boxShadow: '0 2px 6px rgba(168,74,42,.28)',
                  flexShrink: 0,
                }}>
                Anar al dia
                <Icon d={I.chevR} size={12} stroke={2.4} />
              </button>
            </div>

            {dayRes.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px 0',
                color: 'var(--ink-400)', fontSize: 13,
                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              }}>
                Cap reserva aquest dia
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayRes.map((r, i) => (
                  <div key={r.id}
                    className="row-stagger"
                    style={{ ['--row-i' as string]: Math.min(i, 7) }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 13px', borderRadius: 11,
                      background: 'var(--paper)',
                      border: '1px solid rgba(60,40,20,.07)',
                      boxShadow: '0 1px 2px rgba(60,40,20,.03)',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700,
                        color: 'var(--ink-700)', flexShrink: 0,
                      }}>{r.time}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13.5, fontWeight: 650, color: 'var(--ink-900)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          letterSpacing: -.005,
                        }}>{r.name}</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
                        flexShrink: 0, fontFamily: 'var(--font-mono)',
                      }}>{r.pax}p</span>
                    </div>
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

const navBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9,
  border: '1px solid rgba(60,40,20,.10)',
  background: 'var(--paper)', cursor: 'pointer',
  color: 'var(--ink-700)',
  display: 'grid', placeItems: 'center',
  boxShadow: 'var(--sh-1)',
};

// ─── Mobile Backup Screen ─────────────────────────────────────────────────────
function MobileBackupScreen({ onBack }: { onBack: () => void }) {
  const { status, statusMessage, isWorking, lastBackupAt, history, setStatus, loadHistory } = useBackupStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadHistory(); }, []);
  useEffect(() => {
    if (status === 'saved' || status === 'restored') {
      const t = setTimeout(() => useBackupStore.getState().clearStatus(), 4000);
      return () => clearTimeout(t);
    }
  }, [status]);

  async function doManual() {
    setStatus('saving', 'Creant backup…');
    try {
      const b = await createLocalBackup('manual');
      await loadHistory();
      setStatus('saved', b ? `Backup desat · ${fmtB(b.sizeBytes)}` : 'Sense canvis');
    } catch { setStatus('error', 'Error al crear backup'); }
  }

  async function doRestore(id: string) {
    setConfirmId(null);
    setStatus('restoring', 'Restaurant…');
    try {
      await restoreFromId(id);
      await loadHistory();
      setStatus('restored', 'Restauració completada');
    } catch (e: any) { setStatus('error', e.message ?? 'Error'); }
  }

  async function doDownload(id: string) {
    const full = await idbGet(id);
    if (full) exportBackupToFile(full);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const backup = await importBackupFromFile(file);
      setConfirmId(`import:${backup.id}`);
      (window as any).__pendingImport = backup;
    } catch (err: any) { setStatus('error', err.message ?? 'Fitxer invàlid'); }
    e.target.value = '';
  }

  async function confirmImport() {
    const backup = (window as any).__pendingImport;
    if (!backup) return;
    setConfirmId(null);
    setStatus('restoring', 'Aplicant backup importat…');
    try {
      await restoreFromBackup(backup);
      await loadHistory();
      setStatus('restored', 'Backup importat i restaurat');
    } catch (e: any) { setStatus('error', e.message ?? 'Error'); }
    delete (window as any).__pendingImport;
  }

  const statusColor = status === 'error' ? 'var(--rose-600)' : 'var(--olive-700)';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 14px 10px', borderBottom:'1px solid rgba(60,40,20,.09)', flexShrink:0 }}>
        <button onClick={onBack} style={{ width:34, height:34, borderRadius:9, border:'1px solid rgba(60,40,20,.14)', background:'transparent', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-700)' }}>
          <Icon d={I.chevL} size={18} />
        </button>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:17, fontWeight:500, color:'var(--ink-900)' }}>Còpies de seguretat</div>
      </div>

      <div className="scroll" style={{ flex:1, overflowY:'auto', padding:'16px 14px 32px' }}>
        <div style={{ background:'var(--paper)', borderRadius:14, padding:'16px', marginBottom:16, border:'1px solid rgba(60,40,20,.09)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', textTransform:'uppercase', letterSpacing:.06, marginBottom:4 }}>Últim backup</div>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--ink-900)', marginBottom:2 }}>
            {lastBackupAt ? fmtDate(lastBackupAt) : 'Cap backup desat'}
          </div>
          {lastBackupAt && <div style={{ fontSize:12, color:'var(--ink-500)', marginBottom:12 }}>{timeAgoS(lastBackupAt)} · {history.length} snapshots</div>}
          {statusMessage && (
            <div style={{ fontSize:12.5, fontWeight:600, color:statusColor, marginBottom:12 }}>
              {status === 'error' ? '⚠️' : '✓'} {statusMessage}
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={doManual} disabled={isWorking}
              style={{ flex:1, padding:'11px', borderRadius:10, border:'none', background:'var(--terracotta-600)', color:'white', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:isWorking?'not-allowed':'pointer', opacity:isWorking?.6:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon d={I.shield} size={14} /> {isWorking ? 'Treballant…' : 'Backup ara'}
            </button>
            <button onClick={exportCurrentToFile}
              style={{ flex:1, padding:'11px', borderRadius:10, border:'1px solid rgba(60,40,20,.14)', background:'var(--cream)', color:'var(--ink-700)', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon d={I.download} size={14} /> Exportar
            </button>
          </div>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ marginTop:8, width:'100%', padding:'10px', borderRadius:10, border:'1px solid rgba(60,40,20,.14)', background:'var(--cream)', color:'var(--ink-700)', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <Icon d={I.upload} size={14} /> Importar fitxer JSON
          </button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImport} />
        </div>

        {confirmId?.startsWith('import:') && (
          <div style={{ background:'var(--terracotta-50)', border:'1.5px solid var(--terracotta-400)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--terracotta-800)', marginBottom:8 }}>Aplicar backup importat?</div>
            <div style={{ fontSize:12.5, color:'var(--terracotta-700)', marginBottom:12 }}>Això reemplaçarà totes les dades actuals.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={confirmImport} style={{ flex:1, padding:'10px', borderRadius:9, border:'none', background:'var(--terracotta-600)', color:'white', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer' }}>Aplicar</button>
              <button onClick={() => { setConfirmId(null); delete (window as any).__pendingImport; }} style={{ flex:1, padding:'10px', borderRadius:9, border:'1px solid rgba(60,40,20,.14)', background:'transparent', color:'var(--ink-700)', fontFamily:'inherit', fontSize:13, cursor:'pointer' }}>Cancel·lar</button>
            </div>
          </div>
        )}

        <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', textTransform:'uppercase', letterSpacing:.06, marginBottom:10 }}>Historial ({history.length})</div>
        {history.length === 0 && <div style={{ textAlign:'center', padding:'24px 0', color:'var(--ink-400)', fontSize:13 }}>Cap backup local</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {history.map(meta => (
            <div key={meta.id} style={{ background:'var(--paper)', borderRadius:12, padding:'12px 14px', border:'1px solid rgba(60,40,20,.09)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:30, height:30, borderRadius:7, background:meta.type==='manual'?'var(--terracotta-50)':'var(--ink-50)', color:meta.type==='manual'?'var(--terracotta-600)':'var(--ink-400)', display:'grid', placeItems:'center', flexShrink:0 }}>
                  <Icon d={meta.type==='manual'?I.shield:I.history} size={13} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-900)' }}>{fmtDate(meta.createdAt)}</div>
                  <div style={{ fontSize:11.5, color:'var(--ink-500)' }}>{timeAgoS(meta.createdAt)} · {fmtB(meta.sizeBytes)}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:3, background:meta.type==='manual'?'var(--terracotta-50)':'var(--ink-100)', color:meta.type==='manual'?'var(--terracotta-700)':'var(--ink-500)' }}>
                  {meta.type==='manual'?'Manual':'Auto'}
                </span>
              </div>
              {confirmId === meta.id ? (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => doRestore(meta.id)} style={{ flex:2, padding:'9px', borderRadius:9, border:'none', background:'var(--terracotta-600)', color:'white', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer' }}>Restaurar</button>
                  <button onClick={() => setConfirmId(null)} style={{ flex:1, padding:'9px', borderRadius:9, border:'1px solid rgba(60,40,20,.14)', background:'transparent', color:'var(--ink-700)', fontFamily:'inherit', fontSize:12, cursor:'pointer' }}>Cancel·lar</button>
                </div>
              ) : (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => setConfirmId(meta.id)} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid rgba(60,40,20,.14)', background:'transparent', fontFamily:'inherit', fontSize:12, fontWeight:600, color:'var(--ink-700)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Icon d={I.history} size={12} /> Restaurar
                  </button>
                  <button onClick={() => doDownload(meta.id)} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid rgba(60,40,20,.14)', background:'transparent', fontFamily:'inherit', fontSize:12, fontWeight:600, color:'var(--ink-700)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Icon d={I.download} size={12} /> Baixar
                  </button>
                  <button onClick={() => deleteBackupById(meta.id).then(loadHistory)} style={{ width:34, padding:'8px', borderRadius:8, border:'1px solid rgba(60,40,20,.14)', background:'transparent', fontFamily:'inherit', fontSize:12, color:'var(--rose-500)', cursor:'pointer', display:'grid', placeItems:'center' }}>
                    <Icon d={I.trash} size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtB(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)}KB`;
  return `${(bytes/1024/1024).toFixed(2)}MB`;
}
function timeAgoS(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1)  return 'ara';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h/24)}d`;
}

// ─── Estadístiques ───────────────────────────────────────────────────────────
function StatsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 11px', background: 'var(--paper)', borderBottom: 'var(--hair)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-600)', display: 'grid', placeItems: 'center' }}>
          <Icon d={I.chevL} size={20} stroke={2} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', flex: 1 }}>Estadístiques</span>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px var(--scroll-pad-bottom)' }}>
        <KPIsTodayBlock />
        <TrendBlock />
        <TopClientsBlock />
        <OperationalInsightsBlock />
      </div>
    </div>
  );
}

// ── Helper: format date label "Dl 12" style ──────────────────────────────────
function shortDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dows = ['Dg','Dl','Dt','Dc','Dj','Dv','Ds'];
  return `${dows[d.getDay()]} ${d.getDate()}`;
}

// ─── Block 1: KPIs avui ──────────────────────────────────────────────────────
function KPIsTodayBlock() {
  const { selectedBusiness, reservations, selectedDate } = useAppStore();
  const biz = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const todayIso = isoDate(selectedDate);

  const data = useMemo(() => {
    const todayRes = reservations.filter(r => r.bizId === selectedBusiness && r.date === todayIso);
    const activeToday = todayRes.filter(r => r.status !== 'cancelled' && r.status !== 'noshow');
    const pax = activeToday.reduce((s, r) => s + r.pax, 0);
    const noshow = todayRes.filter(r => r.status === 'noshow').length;
    const cap = biz.capacity || 1;
    const occupancy = Math.min(100, Math.round((pax / cap) * 100));

    // 7-day rolling averages for comparison
    const t = new Date(todayIso + 'T00:00:00').getTime();
    const sevenDayRes: number[] = [];
    const sevenDayPax: number[] = [];
    for (let i = 1; i <= 7; i++) {
      const iso = new Date(t - i * 86400000).toISOString().slice(0, 10);
      const dayRes = reservations.filter(r => r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled');
      sevenDayRes.push(dayRes.length);
      sevenDayPax.push(dayRes.reduce((s, r) => s + r.pax, 0));
    }
    const avgRes = sevenDayRes.reduce((s, n) => s + n, 0) / 7;
    const avgPax = sevenDayPax.reduce((s, n) => s + n, 0) / 7;

    return {
      res: activeToday.length,
      pax,
      noshow,
      occupancy,
      diffRes: activeToday.length - avgRes,
      diffPax: pax - avgPax,
    };
  }, [reservations, selectedBusiness, todayIso, biz]);

  return (
    <div style={{ marginBottom: 22 }}>
      <Section title="🎯 Avui" color="var(--terracotta-700)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <KPICard value={data.res} label="Reserves" delta={data.diffRes} unit="" tone="terracotta" />
          <KPICard value={data.pax} label="Pax" delta={data.diffPax} unit="" tone="olive" />
          <KPICard value={`${data.occupancy}%`} label="Ocupació" tone={data.occupancy >= 85 ? 'rose' : 'sky'} />
          <KPICard value={data.noshow} label="No-shows" tone={data.noshow > 0 ? 'rose' : 'ink'} />
        </div>
      </Section>
    </div>
  );
}

function KPICard({ value, label, delta, unit, tone }: {
  value: number | string; label: string; delta?: number; unit?: string;
  tone: 'terracotta' | 'olive' | 'sky' | 'rose' | 'ink';
}) {
  const palette = {
    terracotta: { bg: 'var(--terracotta-50)', fg: 'var(--terracotta-700)' },
    olive:      { bg: 'var(--olive-50)',      fg: 'var(--olive-700)' },
    sky:        { bg: 'var(--sky-50)',        fg: 'var(--sky-700)' },
    rose:       { bg: 'var(--rose-50)',       fg: 'var(--rose-700)' },
    ink:        { bg: 'var(--ink-100)',       fg: 'var(--ink-700)' },
  }[tone];
  const deltaStr = delta !== undefined
    ? (delta > 0.5 ? `▲ +${delta.toFixed(0)}${unit ?? ''}` : delta < -0.5 ? `▼ ${delta.toFixed(0)}${unit ?? ''}` : '= vs mitjana')
    : null;
  const deltaCol = delta === undefined ? 'var(--ink-500)' : delta > 0.5 ? 'var(--olive-700)' : delta < -0.5 ? 'var(--rose-700)' : 'var(--ink-500)';
  return (
    <div style={{
      padding: '13px 14px', borderRadius: 13,
      background: palette.bg, border: `1px solid ${palette.fg}22`,
    }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500, color: palette.fg, lineHeight: 1, letterSpacing: -.01 }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginTop: 6 }}>
        {label}
      </div>
      {deltaStr && (
        <div style={{ fontSize: 10.5, color: deltaCol, marginTop: 4, fontWeight: 600 }}>
          {deltaStr}
        </div>
      )}
    </div>
  );
}

// ─── Block 2: Tendència 30 dies ──────────────────────────────────────────────
function TrendBlock() {
  const { selectedBusiness, reservations, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const { days, maxCount, bestDow, peakHour } = useMemo(() => {
    const t = new Date(todayIso + 'T00:00:00').getTime();
    const days: { iso: string; count: number; pax: number; isWeekend: boolean }[] = [];
    for (let i = 29; i >= 0; i--) {
      const iso = new Date(t - i * 86400000).toISOString().slice(0, 10);
      const dr = reservations.filter(r => r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled');
      const d = new Date(iso + 'T00:00:00');
      days.push({ iso, count: dr.length, pax: dr.reduce((s, r) => s + r.pax, 0), isWeekend: d.getDay() === 0 || d.getDay() === 6 });
    }
    const maxCount = Math.max(1, ...days.map(d => d.count));

    // Best weekday (by avg count)
    const dowTotals = [0, 0, 0, 0, 0, 0, 0];
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    days.forEach(d => {
      const dow = new Date(d.iso + 'T00:00:00').getDay();
      dowTotals[dow] += d.count;
      dowCounts[dow] += 1;
    });
    const dowAvgs = dowTotals.map((t, i) => dowCounts[i] ? t / dowCounts[i] : 0);
    const bestDowIdx = dowAvgs.indexOf(Math.max(...dowAvgs));
    const dowNames = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
    const bestDow = { name: dowNames[bestDowIdx], avg: dowAvgs[bestDowIdx] };

    // Peak hour
    const hourBuckets: Record<number, number> = {};
    reservations.forEach(r => {
      if (r.bizId !== selectedBusiness || r.status === 'cancelled') return;
      if (new Date(r.date + 'T00:00:00').getTime() < t - 30 * 86400000) return;
      const h = parseInt(r.time.split(':')[0], 10);
      hourBuckets[h] = (hourBuckets[h] || 0) + 1;
    });
    const peakEntry = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
    const peakHour = peakEntry ? { hour: parseInt(peakEntry[0], 10), count: peakEntry[1] } : null;

    return { days, maxCount, bestDow, peakHour };
  }, [reservations, selectedBusiness, todayIso]);

  return (
    <div style={{ marginBottom: 22 }}>
      <Section title="📊 Últims 30 dies" color="var(--olive-700)">
        <div style={{ padding: '14px 14px 10px', borderRadius: 13, background: 'var(--paper)', border: '1px solid rgba(60,40,20,.09)' }}>
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90, paddingBottom: 4 }}>
            {days.map((d, i) => {
              const h = (d.count / maxCount) * 100;
              const isToday = i === days.length - 1;
              return (
                <div key={d.iso}
                  title={`${shortDayLabel(d.iso)} · ${d.count} reserves · ${d.pax} pax`}
                  style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: `${h}%`,
                    minHeight: d.count > 0 ? 3 : 0,
                    background: isToday ? 'var(--terracotta-600)' : d.isWeekend ? 'var(--olive-500)' : 'var(--ink-300)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 320ms ease',
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
            <span>{shortDayLabel(days[0].iso)}</span>
            <span>{shortDayLabel(days[days.length - 1].iso)}</span>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10.5, color: 'var(--ink-600)', fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ink-300)' }} /> Setmana
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--olive-500)' }} /> Cap de setmana
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--terracotta-600)' }} /> Avui
            </span>
          </div>
        </div>

        {/* Insights */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <InsightCard icon="📅" label="Millor dia"  value={bestDow.name}             sub={`${bestDow.avg.toFixed(1)} reserves/dia (mitjana)`} />
          <InsightCard icon="⏰" label="Hora punta"  value={peakHour ? `${peakHour.hour}:00` : '—'} sub={peakHour ? `${peakHour.count} reserves` : 'Sense dades'} />
        </div>
      </Section>
    </div>
  );
}

function InsightCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div style={{ padding: '12px 13px', borderRadius: 13, background: 'var(--paper)', border: '1px solid rgba(60,40,20,.09)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase' }}>
        <span style={{ fontSize: 14 }}>{icon}</span> {label}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, color: 'var(--ink-900)', marginTop: 4, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

// ─── Block 3: Top 5 clients del mes ──────────────────────────────────────────
function TopClientsBlock() {
  const { selectedBusiness, customers, reservations } = useAppStore();

  const top = useMemo(() => {
    return rankCustomers(customers, reservations, selectedBusiness).slice(0, 5);
  }, [customers, reservations, selectedBusiness]);

  return (
    <div style={{ marginBottom: 22 }}>
      <Section title="🏆 Top 5 clients" color="#a37314">
        {top.length === 0 ? (
          <AlertCard>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', textAlign: 'center', padding: '4px 0' }}>
              Encara no hi ha prou dades.
            </div>
          </AlertCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top.map((row: any) => {
              const podium = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `${row.rank}.`;
              return (
                <div key={row.customer.id} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '10px 13px', borderRadius: 11,
                  background: 'var(--paper)', border: '1px solid rgba(60,40,20,.09)',
                }}>
                  <span style={{
                    width: 30, textAlign: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: row.rank <= 3 ? 18 : 13,
                    fontWeight: 700,
                    color: row.rank <= 3 ? 'var(--ink-900)' : 'var(--ink-400)',
                  }}>{podium}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-900)' }}>{row.customer.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
                      {row.stats.completed} visites · {row.stats.points} pt
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700,
                    padding: '3px 8px', borderRadius: 999,
                    background: row.stats.level.bg, color: row.stats.level.color,
                    border: `1px solid ${row.stats.level.color}33`,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <span>{row.stats.level.icon}</span>{row.stats.level.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Block 4: Alertes operatives ─────────────────────────────────────────────
function OperationalInsightsBlock() {
  const { selectedBusiness, reservations, customers, floorPlans, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const data = useMemo(() => {
    const t = new Date(todayIso + 'T00:00:00').getTime();
    const startMonth = new Date(t - 30 * 86400000).toISOString().slice(0, 10);

    // No-show rate (last 30 days)
    const recent = reservations.filter(r =>
      r.bizId === selectedBusiness && r.date >= startMonth && r.date <= todayIso
    );
    const recentFinal = recent.filter(r => r.status === 'completed' || r.status === 'noshow');
    const noshows30 = recent.filter(r => r.status === 'noshow').length;
    const noshowRate = recentFinal.length > 0 ? Math.round((noshows30 / recentFinal.length) * 100) : 0;

    // Zone distribution (today)
    const plan = floorPlans[selectedBusiness];
    const todayRes = reservations.filter(r => r.bizId === selectedBusiness && r.date === todayIso && r.status !== 'cancelled');
    const zoneCounts: Record<string, number> = {};
    if (plan) {
      todayRes.forEach(r => {
        (r.tableIds ?? []).forEach(tid => {
          const tbl = plan.tables.find(x => x.id === tid);
          if (tbl) zoneCounts[tbl.zone] = (zoneCounts[tbl.zone] || 0) + 1;
        });
      });
    }
    const zoneRows = plan
      ? plan.zones
          .map(z => ({ label: z.label, count: zoneCounts[z.id] || 0 }))
          .filter(z => z.count > 0)
          .sort((a, b) => b.count - a.count)
      : [];

    // Birthdays this week — fuzzy via customer.tags 'birthday'
    const weekEnd = new Date(t + 7 * 86400000).toISOString().slice(0, 10);
    const birthdayRes = reservations.filter(r =>
      r.bizId === selectedBusiness && r.date >= todayIso && r.date <= weekEnd
    ).filter(r => {
      const c = customers.find(c =>
        (c.phone && c.phone === r.phone) ||
        c.name.trim().toLowerCase() === r.name.trim().toLowerCase()
      );
      return c?.tags.includes('birthday') || r.tags?.includes('birthday') || r.notes?.toLowerCase().includes('aniversari');
    });

    // Large groups upcoming (pax >= 8, next 14 days)
    const twoWeeks = new Date(t + 14 * 86400000).toISOString().slice(0, 10);
    const largeGroups = reservations.filter(r =>
      r.bizId === selectedBusiness && r.date >= todayIso && r.date <= twoWeeks
      && r.pax >= 8 && r.status !== 'cancelled' && r.status !== 'noshow'
    ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    return { noshowRate, noshows30, zoneRows, birthdayRes, largeGroups };
  }, [reservations, customers, floorPlans, selectedBusiness, todayIso]);

  const maxZone = Math.max(1, ...data.zoneRows.map(z => z.count));

  return (
    <div style={{ marginBottom: 22 }}>
      <Section title="⚠️ Operativa" color="var(--rose-700)">

        {/* No-show rate */}
        <div style={{
          padding: '12px 14px', borderRadius: 13,
          background: data.noshowRate > 10 ? 'var(--rose-50)' : 'var(--paper)',
          border: `1px solid ${data.noshowRate > 10 ? 'rgba(194,74,74,.22)' : 'rgba(60,40,20,.09)'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase' }}>
                No-show rate · 30d
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500, color: data.noshowRate > 10 ? 'var(--rose-700)' : 'var(--ink-900)', marginTop: 4, lineHeight: 1 }}>
                {data.noshowRate}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 3 }}>
                {data.noshows30} no-shows en 30 dies
              </div>
            </div>
            <div style={{ fontSize: 28 }}>{data.noshowRate > 15 ? '🚨' : data.noshowRate > 8 ? '⚠️' : '✅'}</div>
          </div>
        </div>

        {/* Zones distribution today */}
        {data.zoneRows.length > 0 && (
          <div style={{ padding: '12px 14px', borderRadius: 13, background: 'var(--paper)', border: '1px solid rgba(60,40,20,.09)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 10 }}>
              Distribució per zona · avui
            </div>
            {data.zoneRows.map(z => (
              <div key={z.label} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink-800)' }}>{z.label}</span>
                  <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{z.count}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--ink-100)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(z.count / maxZone) * 100}%`, background: 'var(--terracotta-500)', transition: 'width 320ms ease' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Birthdays this week */}
        {data.birthdayRes.length > 0 && (
          <AlertCard>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#a37314', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 6 }}>
              🎂 Aniversaris aquesta setmana
            </div>
            {data.birthdayRes.slice(0, 5).map(r => (
              <div key={r.id} style={{ fontSize: 12.5, color: 'var(--ink-800)', padding: '3px 0' }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ color: 'var(--ink-500)' }}> · {shortDayLabel(r.date)} {r.time}</span>
              </div>
            ))}
          </AlertCard>
        )}

        {/* Large groups upcoming */}
        {data.largeGroups.length > 0 && (
          <AlertCard>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--terracotta-700)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 6 }}>
              🍾 Grups grans pròxims (8+ pax)
            </div>
            {data.largeGroups.slice(0, 4).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}>
                <span style={{ color: 'var(--ink-800)' }}>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span style={{ color: 'var(--ink-500)' }}> · {shortDayLabel(r.date)} {r.time}</span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--terracotta-700)' }}>{r.pax} pax</span>
              </div>
            ))}
          </AlertCard>
        )}
      </Section>
    </div>
  );
}

