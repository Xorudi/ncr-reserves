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
import StatsScreen from './StatsScreen';
import CalendarScreen from './CalendarScreen';

type SubScreen = 'menu' | 'alerts' | 'calendar' | 'backups' | 'stats';

export default function MobileMoreScreen({ onSwitchTab, onOpenNotes, onSwitchUser }: {
  onSwitchTab: (tab: MobileTab) => void;
  onOpenNotes?: () => void;
  onSwitchUser?: () => void;
}) {
  const [sub, setSub] = useState<SubScreen>('menu');

  if (sub === 'alerts')   return <AlertsScreen  onBack={() => setSub('menu')} />;
  if (sub === 'calendar') return <CalendarScreen
    onBack={() => setSub('menu')}
    onSwitchToReserves={() => onSwitchTab('reservations')}
  />;
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
    waitlist, setShowWaitlist,
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
  // Badge reflects only the currently-viewed day's queue, matching the
  // sheet's filtering. Otherwise stale entries from yesterday would inflate
  // the count for today.
  const waitlistCount = waitlist.filter(w => {
    if (w.bizId !== selectedBusiness) return false;
    const d = new Date(w.addedAt);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return iso === todayIso;
  }).length;
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
      label: 'Llista d\'espera',
      desc:  'Cua de grups esperant taula',
      ico:   I.users,
      action: () => setShowWaitlist(true),
      badge: waitlistCount, tone: 'terracotta',
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

