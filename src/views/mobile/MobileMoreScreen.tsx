import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { isoDate, BUSINESSES } from '@/data/mockData';
import type { TouchTab as MobileTab } from '@/views/touch/TouchShell';
import { useBackupStore } from '@/backup/useBackupStore';
import {
  createLocalBackup, restoreFromId, exportCurrentToFile, exportBackupToFile,
  importBackupFromFile, restoreFromBackup, deleteBackupById,
} from '@/backup/backupService';
import { idbGet } from '@/backup/indexedDB';
// Stats + Calendar are the two heaviest sub-screens (~1.5k + ~0.8k lines)
// and are only reached from the "Més" menu. Code-split them so their JS
// downloads on first open instead of bloating the More-tab chunk.
const StatsScreen    = lazy(() => import('./StatsScreen'));
const CalendarScreen = lazy(() => import('./CalendarScreen'));
import { signOut } from '@/lib/auth';
import { isAuthRequired } from '@/lib/supabase';
import { usePinScope } from '@/store/usePinScope';
import { SUPABASE_AUTH_ENABLED } from '@/lib/featureFlags';
import AnimatedSheet from '@/components/shared/AnimatedSheet';
import { Z_INDEX } from '@/lib/zIndex';
import { getThemeMode, setThemeMode, onThemeChange, type ThemeMode } from '@/lib/theme';

type SubScreen = 'menu' | 'alerts' | 'calendar' | 'backups' | 'stats';

export default function MobileMoreScreen({ onSwitchTab, onOpenNotes }: {
  onSwitchTab: (tab: MobileTab) => void;
  onOpenNotes?: () => void;
}) {
  const [sub, setSub] = useState<SubScreen>('menu');

  if (sub === 'alerts')   return <AlertsScreen  onBack={() => setSub('menu')} />;
  if (sub === 'calendar') return (
    <Suspense fallback={<SubScreenFallback />}>
      <CalendarScreen
        onBack={() => setSub('menu')}
        onSwitchToReserves={() => onSwitchTab('reservations')}
      />
    </Suspense>
  );
  if (sub === 'backups')  return <MobileBackupScreen onBack={() => setSub('menu')} />;
  if (sub === 'stats')    return (
    <Suspense fallback={<SubScreenFallback />}>
      <StatsScreen onBack={() => setSub('menu')} />
    </Suspense>
  );

  return <MoreMenu onSub={setSub} onSwitchTab={onSwitchTab} onOpenNotes={onOpenNotes} />;
}

// Brief spinner shown while a lazily-loaded sub-screen chunk downloads.
function SubScreenFallback() {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 240 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid rgba(60,40,20,.12)',
        borderTopColor: 'var(--terracotta-500, #de7a51)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── More menu ───────────────────────────────────────────────────────────────
function MoreMenu({ onSub, onSwitchTab, onOpenNotes }: {
  onSub: (s: SubScreen) => void;
  onSwitchTab: (tab: MobileTab) => void;
  onOpenNotes?: () => void;
}) {
  const {
    selectedBusiness,
    reservations, shiftNotes, appEvents, selectedDate,
    waitlist, setShowWaitlist,
  } = useAppStore();

  // Branded inline confirmation for sign-out — replaces the native
  // window.confirm() dialog so the kiosk feel never breaks.
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const biz     = BUSINESSES.find(b => b.id === selectedBusiness)!;

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
    // "Blocar" is always available — the PIN gate is always active.
    {
      label: 'Blocar',
      desc:  'Bloca l\'app i demana el PIN un altre cop',
      ico:   I.shield,
      action: () => { usePinScope.getState().lock(); },
      tone: 'olive' as const,
    },
    // "Sortir" only when the Supabase Auth gate is in use.
    ...(SUPABASE_AUTH_ENABLED && isAuthRequired() ? [{
      label: 'Sortir',
      desc:  'Tanca la sessió en aquest dispositiu',
      ico:   I.chevR,
      action: () => setConfirmSignOut(true),
      tone: 'clay' as const,
    }] : []),
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
    <>
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

      {/* Operational group */}
      {/* Install hint — only when NOT yet installed as a PWA. iOS Safari
          reports it via navigator.standalone; modern browsers via the
          display-mode media query. */}
      <InstallHint />

      <SectionLabel>Operacional</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {OPERATIONAL.map(renderItem)}
      </div>

      {/* System group */}
      <SectionLabel>Sistema</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SYSTEM.map(renderItem)}
      </div>

      {/* Appearance — day / vespre theme */}
      <div style={{ marginTop: 18 }}>
        <SectionLabel>Aparença</SectionLabel>
        <ThemeSelector />
      </div>

      {/* App version */}
      <div style={{
        marginTop: 28, textAlign: 'center',
        fontSize: 10, color: 'var(--ink-400)',
        fontFamily: 'var(--font-mono)', fontWeight: 600,
        letterSpacing: .12, textTransform: 'uppercase',
      }}>
        NCR Reserves · v0.1
        <div style={{
          marginTop: 4,
          fontSize: 9.5, fontWeight: 500,
          textTransform: 'none', letterSpacing: 0,
          color: 'var(--ink-400)',
        }}>
          by Jordi Audinis
        </div>
      </div>
    </div>

    {/* Sign-out confirmation — branded sheet replacing window.confirm() */}
    <AnimatedSheet open={confirmSignOut} onClose={() => setConfirmSignOut(false)} zIndex={Z_INDEX.action}>
      <div style={{
        background: 'var(--paper)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
        boxShadow: '0 -8px 32px rgba(0,0,0,.16)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '0 auto 14px' }} />
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.005, marginBottom: 8,
        }}>
          Tancar sessió?
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-600)', lineHeight: 1.45, marginBottom: 18 }}>
          Es tancarà la sessió d'aquest dispositiu. Caldrà introduir l'email i contrasenya per tornar a entrar.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setConfirmSignOut(false)} className="tac-btn"
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 12,
              color: 'var(--ink-800)',
              fontSize: 14, fontWeight: 650, minHeight: 48,
            }}>
            Cancel·lar
          </button>
          <button onClick={async () => { setConfirmSignOut(false); await signOut(); }} className="tac-btn tac-btn--accent"
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 12,
              fontSize: 14, fontWeight: 700, minHeight: 48,
            }}>
            Tancar sessió
          </button>
        </div>
      </div>
    </AnimatedSheet>
    </>
  );
}

/**
 * InstallHint — gentle nudge to add the app to the Home Screen.
 *
 * Hidden when the app is already running as an installed PWA:
 *   • iOS Safari: navigator.standalone === true
 *   • Modern browsers: window.matchMedia('(display-mode: standalone)')
 * Also hidden once dismissed (localStorage flag) — we ask once.
 *
 * On iOS we can't trigger the install programmatically (Apple doesn't
 * expose beforeinstallprompt), so the hint just teaches the gesture
 * "Share → Afegeix a la pantalla d'inici". On Android Chrome, if a
 * beforeinstallprompt event was captured, the button triggers it; else
 * we show the same text-only hint.
 */
function InstallHint() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('ncr.hideInstallHint') === '1') return;

    // Already installed?
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    setShow(true);

    // Capture Android Chrome's install prompt if available
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function dismiss() {
    try { localStorage.setItem('ncr.hideInstallHint', '1'); } catch { /* noop */ }
    setShow(false);
  }
  async function tryInstall() {
    if (deferred && typeof deferred.prompt === 'function') {
      deferred.prompt();
      try {
        const choice = await deferred.userChoice;
        if (choice?.outcome === 'accepted') dismiss();
      } catch { /* noop */ }
    }
  }

  if (!show) return null;

  // Detect iOS for the share-icon copy
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !(window as any).MSStream;

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 14px 14px 16px',
      borderRadius: 14,
      background: 'linear-gradient(180deg, #fff8e6 0%, #fbf2d3 100%)',
      border: '1px solid rgba(180,140,40,.22)',
      boxShadow: '0 1px 2px rgba(180,140,40,.06)',
      marginBottom: 18, overflow: 'hidden',
    }}>
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: '#c89a3a',
      }} />
      <span style={{
        flexShrink: 0, fontSize: 22, lineHeight: 1,
      }}>📱</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#5e4708',
          letterSpacing: -.005, marginBottom: 4,
        }}>
          Afegeix NCR Reserves a la pantalla d'inici
        </div>
        <div style={{
          fontSize: 12, color: '#8a6a10', fontWeight: 500,
          lineHeight: 1.4,
        }}>
          {isIOS
            ? <>Toca <b>Compartir</b> a Safari · <b>Afegir a la pantalla d'inici</b>. Tindràs pantalla completa, sense barres del navegador.</>
            : <>Instal·la l'app per usar-la a pantalla completa sense les barres del navegador.</>
          }
        </div>
        {deferred && (
          <button onClick={tryInstall} className="tac-btn tac-btn--accent"
            style={{
              marginTop: 8, padding: '7px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 700,
            }}>
            Instal·lar
          </button>
        )}
      </div>
      <button onClick={dismiss} aria-label="Tancar"
        className="tac-btn tac-btn--ghost"
        style={{
          width: 26, height: 26, borderRadius: 999,
          color: '#8a6a10', fontSize: 14,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
        ×
      </button>
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

// ─── Theme selector (Aparença) ────────────────────────────────────────────────
// Segmented Auto / Dia / Vespre. 'Auto' follows the service clock (vespre
// from 19:00) — see lib/theme.ts. State re-syncs on the theme-change event
// so an auto crossover while this screen is open updates the description.
function ThemeSelector() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  useEffect(() => onThemeChange(() => setMode(getThemeMode())), []);

  const OPTIONS: { id: ThemeMode; label: string }[] = [
    { id: 'auto',   label: 'Auto' },
    { id: 'llum',   label: 'Dia' },
    { id: 'vespre', label: 'Vespre' },
  ];

  const desc =
    mode === 'auto'   ? 'Mode vespre automàtic a partir de les 19:00.' :
    mode === 'vespre' ? 'Ambient espresso per al servei de nit.' :
                        'Llum de dia sempre, passi l\'hora que passi.';

  return (
    <div style={{
      padding: '14px', borderRadius: 16,
      background: 'var(--paper)', border: 'var(--hair)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        display: 'flex', gap: 4, padding: 3, borderRadius: 11,
        background: 'var(--ink-100)',
      }}>
        {OPTIONS.map(o => {
          const active = mode === o.id;
          return (
            <button key={o.id} onClick={() => setThemeMode(o.id)} className="press"
              aria-pressed={active}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: active ? 700 : 600,
                minHeight: 38,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink-900)' : 'var(--ink-500)',
                boxShadow: active ? 'var(--sh-1), var(--shadow-ring)' : 'none',
                transition: 'background 160ms var(--ease-out), color 160ms var(--ease-out)',
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.4, padding: '0 2px' }}>
        {desc}
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
        <button onClick={onBack} className="tac-btn tac-btn--ghost" aria-label="Tornar"
          style={{ width: 32, height: 32, borderRadius: 8, color: 'var(--ink-600)', display: 'grid', placeItems: 'center' }}>
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
        <button onClick={onBack} className="tac-btn" aria-label="Tornar"
          style={{ width:34, height:34, borderRadius:9, display:'grid', placeItems:'center', color:'var(--ink-700)' }}>
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
              className="tac-btn tac-btn--accent"
              style={{ flex:1, padding:'11px', borderRadius:10, fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon d={I.shield} size={14} /> {isWorking ? 'Treballant…' : 'Backup ara'}
            </button>
            <button onClick={exportCurrentToFile} className="tac-btn"
              style={{ flex:1, padding:'11px', borderRadius:10, color:'var(--ink-700)', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon d={I.download} size={14} /> Exportar
            </button>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="tac-btn"
            style={{ marginTop:8, width:'100%', padding:'10px', borderRadius:10, color:'var(--ink-700)', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <Icon d={I.upload} size={14} /> Importar fitxer JSON
          </button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImport} />
        </div>

        {confirmId?.startsWith('import:') && (
          <div style={{ background:'var(--terracotta-50)', border:'1.5px solid var(--terracotta-400)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--terracotta-800)', marginBottom:8 }}>Aplicar backup importat?</div>
            <div style={{ fontSize:12.5, color:'var(--terracotta-700)', marginBottom:12 }}>Això reemplaçarà totes les dades actuals.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={confirmImport} className="tac-btn tac-btn--accent" style={{ flex:1, padding:'10px', borderRadius:9, fontSize:13, fontWeight:700 }}>Aplicar</button>
              <button onClick={() => { setConfirmId(null); delete (window as any).__pendingImport; }} className="tac-btn" style={{ flex:1, padding:'10px', borderRadius:9, fontSize:13 }}>Cancel·lar</button>
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
                  <button onClick={() => doRestore(meta.id)} className="tac-btn tac-btn--accent" style={{ flex:2, padding:'9px', borderRadius:9, fontSize:13, fontWeight:700 }}>Restaurar</button>
                  <button onClick={() => setConfirmId(null)} className="tac-btn" style={{ flex:1, padding:'9px', borderRadius:9, fontSize:12 }}>Cancel·lar</button>
                </div>
              ) : (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => setConfirmId(meta.id)} className="tac-btn" style={{ flex:1, padding:'8px', borderRadius:8, fontSize:12, fontWeight:600, color:'var(--ink-700)', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Icon d={I.history} size={12} /> Restaurar
                  </button>
                  <button onClick={() => doDownload(meta.id)} className="tac-btn" style={{ flex:1, padding:'8px', borderRadius:8, fontSize:12, fontWeight:600, color:'var(--ink-700)', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Icon d={I.download} size={12} /> Baixar
                  </button>
                  <button onClick={() => deleteBackupById(meta.id).then(loadHistory)} className="tac-btn" style={{ width:34, padding:'8px', borderRadius:8, fontSize:12, color:'var(--rose-500)', display:'grid', placeItems:'center' }}>
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

