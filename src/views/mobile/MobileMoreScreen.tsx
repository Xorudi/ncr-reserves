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

type SubScreen = 'menu' | 'alerts' | 'calendar' | 'backups';

export default function MobileMoreScreen({ onSwitchTab }: { onSwitchTab: (tab: MobileTab) => void }) {
  const [sub, setSub] = useState<SubScreen>('menu');

  if (sub === 'alerts')   return <AlertsScreen  onBack={() => setSub('menu')} />;
  if (sub === 'calendar') return <CalendarScreen onBack={() => setSub('menu')} />;
  if (sub === 'backups')  return <MobileBackupScreen onBack={() => setSub('menu')} />;

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
    {
      label: 'Còpies de seguretat',
      desc:  'Backup local, exportar i importar dades',
      ico:   I.shield,
      action: () => onSub('backups'),
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
