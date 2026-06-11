import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { isoDate, getZoneIcon } from '@/data/mockData';
import { effectiveTable } from '@/utils/tableStatus';
import type { FloorTable, TableStatus, Reservation } from '@/types';
import { IS_FAST_UI } from '@/lib/uiMode';
import EmptyState from '@/components/shared/EmptyState';

const STATUS_STYLE: Record<TableStatus, { bg: string; color: string; label: string }> = {
  free:      { bg:'var(--olive-50)',       color:'var(--olive-700)',      label:'Lliure'    },
  confirmed: { bg:'var(--clay-50)',        color:'var(--clay-700)',       label:'Confirmada'},
  reserved:  { bg:'var(--clay-50)',        color:'var(--clay-700)',       label:'Reservada' },
  pending:   { bg:'var(--clay-50)',        color:'var(--clay-700)',       label:'Pendent'   },
  seated:    { bg:'var(--terracotta-50)', color:'var(--terracotta-700)', label:'Ocupada'   },
  blocked:   { bg:'var(--ink-100)',        color:'var(--ink-500)',        label:'Bloquejada'},
  playing:   { bg:'var(--terracotta-50)', color:'var(--terracotta-700)', label:'En joc'    },
};

export default function MobileTablesScreen() {
  const {
    selectedBusiness, floorPlans, updateFloorTable, releaseTable, releaseAllTables,
    reservations, selectedDate, addReservation, updateReservation,
  } = useAppStore();
  const plan    = floorPlans[selectedBusiness];
  const dateStr = isoDate(selectedDate);

  const [zoneId, setZoneId] = useState<string>('__all__');
  const [selTable, setSelTable] = useState<FloorTable | null>(null);
  // Coordinates of the tap that opened the sheet, so it can scale-from-tap
  const [tapPt, setTapPt] = useState<{ x: number; y: number } | null>(null);
  // Edit mode — multi-select tables to batch-edit pax / shape / accent
  const [editMode,    setEditMode]    = useState(false);
  const [editIds,     setEditIds]     = useState<Set<string>>(new Set());

  function toggleEdit(id: string) {
    setEditIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function exitEdit() {
    setEditMode(false);
    setEditIds(new Set());
  }
  function bumpCap(delta: number) {
    if (!plan) return;
    editIds.forEach(id => {
      const t = plan.tables.find(x => x.id === id);
      if (!t) return;
      const next = Math.max(1, Math.min(20, t.cap + delta));
      if (next !== t.cap) updateFloorTable(selectedBusiness, id, { cap: next });
    });
  }
  function setShapeFor(shape: 'round' | 'square' | 'rect') {
    editIds.forEach(id => updateFloorTable(selectedBusiness, id, { shape }));
  }
  function setAccentFor(accent: import('@/types').TableAccent | undefined) {
    editIds.forEach(id => updateFloorTable(selectedBusiness, id, { accent }));
  }
  function toggleBlockedSelected() {
    if (!plan) return;
    // If ALL selected are blocked → unblock all; else block all
    const allBlocked = [...editIds].every(id =>
      plan.tables.find(x => x.id === id)?.status === 'blocked',
    );
    editIds.forEach(id => {
      if (allBlocked) {
        updateFloorTable(selectedBusiness, id, { status: 'free', res: undefined, time: undefined });
      } else {
        updateFloorTable(selectedBusiness, id, { status: 'blocked' });
      }
    });
  }

  // ── Swipe L/R inside the table grid → cycle through zones ────────────────
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    cycleZone(dx < 0 ? 1 : -1);
  };
  // Defined later; declared first so it's in closure for handleTouchEnd
  function cycleZone(delta: number) {
    if (!plan) return;
    const ordered = [...plan.zones].sort((a, b) => a.order - b.order);
    const ids = ['__all__', ...ordered.map(z => z.id)];
    const idx = ids.indexOf(zoneId);
    if (idx === -1) return;
    const nextIdx = (idx + delta + ids.length) % ids.length;
    setZoneId(ids[nextIdx]);
  }

  // Reservations for the selected date and business
  const dayRes = useMemo(
    () => reservations.filter(r => r.bizId === selectedBusiness && r.date === dateStr),
    [reservations, selectedBusiness, dateStr],
  );

  // Floor plan tables with statuses derived from today's reservations
  const liveTables = useMemo(
    () => (plan?.tables ?? []).map(t => effectiveTable(t, dayRes)),
    [plan, dayRes],
  );

  // Release-all double confirmation state
  const [showRelease1, setShowRelease1] = useState(false);
  const [showRelease2, setShowRelease2] = useState(false);
  const [confirmText, setConfirmText]   = useState('');

  const zones  = useMemo(() => plan ? [...plan.zones].sort((a, b) => a.order - b.order) : [], [plan]);

  // Sort tables within a single zone — natural numeric order ("Taula 2" < "Taula 10")
  const sortByName = (a: FloorTable, b: FloorTable) =>
    (a.name ?? a.id).localeCompare(b.name ?? b.id, undefined, { numeric: true });

  // For "Totes" view: group by zone in zone-order, NOT a flat numeric sort
  // (otherwise "Bar 1" sits next to "Menjador 1" which makes no spatial sense).
  // For a single zone: just the sorted list of that zone's tables.
  const tableGroups = useMemo<{ id: string; label: string; tables: FloorTable[] }[]>(() => {
    if (zoneId !== '__all__') {
      const z = zones.find(z => z.id === zoneId);
      const list = liveTables.filter(t => t.zone === zoneId).sort(sortByName);
      return [{ id: zoneId, label: z?.label ?? '', tables: list }];
    }
    return zones
      .map(z => ({
        id: z.id,
        label: z.label,
        tables: liveTables.filter(t => t.zone === z.id).sort(sortByName),
      }))
      .filter(g => g.tables.length > 0);
  }, [liveTables, zoneId, zones]);

  const totalTables = useMemo(
    () => tableGroups.reduce((s, g) => s + g.tables.length, 0),
    [tableGroups],
  );

  // Counts (based on live date-aware statuses)
  const counts = useMemo(() => {
    return liveTables.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {} as Record<TableStatus, number>);
  }, [liveTables]);

  if (!plan) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <EmptyState icon="🗺️" title="Sense plànol configurat" sub="Aquest negoci encara no té zones ni taules definides" glow="rgba(204,144,73,.22)" />
    </div>
  );

  const occupiedCount = (counts['seated'] ?? 0) + (counts['confirmed'] ?? 0) + (counts['reserved'] ?? 0) + (counts['pending'] ?? 0);

  // Format selected date for display
  const d = selectedDate;
  const DAY_NAMES = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
  const MONTHS    = ['gen','feb','mar','abr','maig','jun','jul','ago','set','oct','nov','des'];
  const dateLabel = `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const isToday   = isoDate(new Date()) === dateStr;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

      {/* Date header — glass material on top of the canvas */}
      <div style={{
        padding:'10px 14px 8px',
        background: IS_FAST_UI ? 'var(--glass-opaque-soft)' : 'var(--glass-soft)',
        WebkitBackdropFilter: IS_FAST_UI ? 'none' : 'blur(12px)',
        backdropFilter:       IS_FAST_UI ? 'none' : 'blur(12px)',
        boxShadow: 'var(--glass-edge)',
        flexShrink:0, display:'flex', alignItems:'center', gap:8,
        position: 'relative', zIndex: 5,
      }}>
        <span style={{ fontSize:12.5, fontWeight:600, color:'var(--ink-700)' }}>
          {isToday ? 'Avui' : dateLabel}
        </span>
        <span style={{ fontSize:11.5, color:'var(--ink-600)' }}>· taules del dia</span>
        <span style={{ flex:1 }} />
        <button onClick={() => editMode ? exitEdit() : setEditMode(true)} className="press"
          style={{
            padding:'5px 11px', borderRadius:8,
            border: editMode ? 'none' : '1px solid var(--line)',
            background: editMode ? 'var(--ink-900)' : 'transparent',
            color: editMode ? 'var(--cream)' : 'var(--ink-700)',
            fontFamily:'inherit', fontSize:12, fontWeight:650,
            cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:5,
          }}>
          <Icon d={editMode ? I.check : I.pencil} size={12} stroke={editMode ? 2.6 : 2} />
          {editMode ? 'Acabar' : 'Editar'}
        </button>
      </div>

      {/* Stat boxes — 4-col Fraunces grid, paper-elevated with left accents */}
      <div style={{ padding:'10px 14px', flexShrink:0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
          {([
            ['Lliures',  counts['free']     ?? 0, 'var(--olive-700)',      'var(--olive-500)'     ],
            ['Ocupades', counts['seated']   ?? 0, 'var(--terracotta-700)', 'var(--terracotta-500)'],
            ['Reserva',  (counts['confirmed'] ?? 0) + (counts['reserved'] ?? 0) + (counts['pending'] ?? 0), 'var(--clay-700)', 'var(--clay-500)'],
            ['Bloq.',    counts['blocked']  ?? 0, 'var(--ink-700)',        'var(--ink-400)'       ],
          ] as [string, number, string, string][]).map(([l, n, c, accent]) => (
            <div key={l} style={{
              position: 'relative',
              background: 'var(--surface-elevated)',
              boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
              borderRadius: 12, padding: '9px 11px',
              overflow: 'hidden',
            }}>
              <span aria-hidden style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3, background: accent,
              }} />
              <div style={{ fontFamily:'var(--font-serif)', fontSize:20, fontWeight:500, color:c, lineHeight:1, letterSpacing:-.01 }}>{n}</div>
              <div style={{ fontSize:10, color:'var(--ink-500)', fontWeight:700, marginTop:4, letterSpacing:.06, textTransform:'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone tabs — pill style with a real tray treatment */}
      <div data-swipeable="true" style={{
        flexShrink:0, overflowX:'auto', display:'flex',
        padding:'8px 14px 10px', gap:6,
        boxShadow: 'inset 0 -1px 0 rgba(40,28,16,.04)',
        scrollbarWidth: 'none',
      }}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        {[{ id:'__all__', label:`Totes` }, ...zones.map(z => ({ id:z.id, label:z.label }))].map(z => {
          const active = zoneId === z.id;
          return (
            <button key={z.id} onClick={() => setZoneId(z.id)} className="press"
              style={{
                flexShrink:0, padding:'7px 14px', borderRadius:999, whiteSpace:'nowrap',
                border: 'none',
                background: active ? 'var(--ink-900)' : 'var(--surface-elevated)',
                color: active ? 'var(--cream)' : 'var(--ink-600)',
                fontWeight: active ? 650 : 550,
                fontSize:13, cursor:'pointer', fontFamily:'inherit',
                boxShadow: active
                  ? '0 2px 8px rgba(40,28,16,.18), inset 0 1px 0 rgba(255,255,255,.08)'
                  : 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
                transition: 'background 180ms var(--ease-out), color 180ms var(--ease-out), box-shadow 180ms var(--ease-out)',
              }}>
              {z.label}
            </button>
          );
        })}
      </div>

      {/* Table groups — flat single-zone grid, or grouped-by-zone for "Totes".
          Swipe L/R cycles through zones (handled by handleTouch* below). */}
      <div className="scroll"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ flex:1, overflowY:'auto', padding:'10px 14px var(--scroll-pad-bottom)' }}>
        {tableGroups.map((group, gi) => (
          <div key={group.id} style={{ marginTop: gi === 0 ? 0 : 14 }}>
            {/* Zone header — only when viewing "Totes" so a single-zone view
                doesn't get a redundant title above its grid. */}
            {zoneId === '__all__' && (
              <div style={{
                display:'flex', alignItems:'center', gap:9,
                margin:'4px 2px 9px',
              }}>
                <span style={{ fontSize:13, lineHeight:1, color:'var(--ink-500)' }}>
                  {getZoneIcon(group.label)}
                </span>
                <span style={{
                  fontFamily:'var(--font-serif)', fontSize:14.5, fontWeight:500,
                  color:'var(--ink-700)', letterSpacing:-.005,
                }}>
                  {group.label}
                </span>
                <span style={{
                  fontSize:11.5, color:'var(--ink-600)', fontWeight:650,
                  fontFamily:'var(--font-sans)', letterSpacing:.01,
                }}>{group.tables.length}</span>
                <div style={{ flex:1, height:1, background:'rgba(60,40,20,.06)' }} />
              </div>
            )}
            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fill, minmax(96px, 1fr))',
              gap:8,
            }}>
              {group.tables.map(t => {
                const st = STATUS_STYLE[t.status];
                const isSeated = t.status === 'seated';
                const isEditSel = editIds.has(t.id);
                const accent = t.accent;
                const accentColor =
                  accent === 'terracotta' ? 'var(--terracotta-600)' :
                  accent === 'olive'      ? 'var(--olive-600)'      :
                  accent === 'clay'       ? 'var(--clay-600)'       :
                  accent === 'sky'        ? 'var(--sky-600)'        :
                  accent === 'plum'       ? 'var(--plum-600)'       :
                  accent === 'rose'       ? 'var(--rose-600)'       :
                  null;
                const radius = t.shape === 'round' ? 999 : t.shape === 'rect' ? 8 : 12;
                return (
                  <button key={t.id}
                    onClick={(e) => {
                      if (editMode) {
                        toggleEdit(t.id);
                        return;
                      }
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setTapPt({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                      setSelTable(t);
                    }}
                    className="press"
                    style={{
                      position:'relative',
                      aspectRatio:'1/1.05',
                      background:st.bg, borderRadius:radius, padding:'9px 8px 7px',
                      border: isEditSel
                        ? '2px solid var(--ink-900)'
                        : isSeated
                          ? '1px solid var(--terracotta-500)'
                          : '1px solid var(--line-soft)',
                      textAlign:'left', cursor:'pointer',
                      fontFamily:'inherit', display:'flex', flexDirection:'column',
                      justifyContent:'space-between', gap:2,
                      boxShadow: isEditSel
                        ? '0 2px 8px rgba(60,40,20,.18)'
                        : isSeated ? '0 1px 3px rgba(168,74,42,.12)' : 'none',
                      transition:'border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
                    }}>
                    {/* Per-table accent dot in top-right */}
                    {accentColor && !editMode && (
                      <span style={{
                        position:'absolute', top:5, right:5,
                        width:7, height:7, borderRadius:999,
                        background:accentColor,
                        boxShadow:`0 0 0 2px ${st.bg}`,
                      }} />
                    )}
                    {editMode && (
                      <span style={{
                        position:'absolute', top:5, right:5,
                        width:18, height:18, borderRadius:999,
                        background: isEditSel ? 'var(--ink-900)' : 'rgba(60,40,20,.10)',
                        color:'var(--cream)',
                        display:'grid', placeItems:'center',
                        transition:'background 160ms var(--ease-out)',
                      }}>
                        {isEditSel && <Icon d={I.check} size={11} stroke={2.6} />}
                      </span>
                    )}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4 }}>
                      <span style={{
                        fontFamily:'var(--font-serif)', fontSize:18, fontWeight:500,
                        color:st.color, lineHeight:1, letterSpacing:-.005,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        flex:1, minWidth:0,
                      }}>
                        {t.name ?? t.id}
                      </span>
                      <span style={{ fontSize:9, color:st.color, fontWeight:700, opacity:.7,
                                    letterSpacing:.04, flexShrink:0, marginTop:1 }}>{t.cap}p</span>
                    </div>
                    <div style={{ minHeight:0 }}>
                      {t.res && (
                        <div style={{ fontSize:10, color:st.color, fontWeight:650, lineHeight:1.15,
                                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {t.res.split(' ')[0]}
                        </div>
                      )}
                      {t.time && (
                        <div style={{ fontSize:9, color:st.color, opacity:.7,
                                      fontFamily:'var(--font-mono)', marginTop:1 }}>{t.time}</div>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{
                        width:5, height:5, borderRadius:999, background:st.color, opacity:.7, flexShrink:0,
                      }} />
                      <span style={{ fontSize:8.5, color:st.color, fontWeight:700,
                                    textTransform:'uppercase', letterSpacing:.25, opacity:.75,
                                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {st.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {totalTables === 0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--ink-500)', fontSize:14 }}>
            Cap taula en aquesta zona
          </div>
        )}

        {/* ── Danger zone: release all ──────────────────────────── */}
        {occupiedCount > 0 && (
          <div style={{ marginTop:24, padding:'14px 16px', background:'rgba(200,50,50,.05)', border:'1px solid rgba(200,50,50,.15)', borderRadius:12 }}>
            <div style={{ fontSize:11.5, fontWeight:700, color:'#a03030', letterSpacing:.04, textTransform:'uppercase', marginBottom:8 }}>
              Zona de risc
            </div>
            <div style={{ fontSize:12.5, color:'var(--ink-600)', marginBottom:12, lineHeight:1.45 }}>
              Hi ha <b>{occupiedCount}</b> taula{occupiedCount > 1 ? 'es' : ''} en ús. Pots alliberar-les totes alhora.
            </div>
            <button onClick={() => setShowRelease1(true)}
              style={{ width:'100%', padding:'10px', background:'transparent', border:'1px solid rgba(200,50,50,.35)', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700, color:'#c0392b' }}>
              🔓 Alliberar totes les taules
            </button>
          </div>
        )}
      </div>

      {/* Edit-mode floating action bar — appears when editing tables */}
      {editMode && (
        <EditBar
          count={editIds.size}
          plan={plan ?? null}
          editIds={editIds}
          onBumpCap={bumpCap}
          onShape={setShapeFor}
          onAccent={setAccentFor}
          onToggleBlock={toggleBlockedSelected}
          onClearSel={() => setEditIds(new Set())}
        />
      )}

      {/* Table action sheet */}
      {selTable && !editMode && (() => {
        // Use the LIVE status (from effectiveTable) so the sheet matches what
        // the user just tapped and stale persisted statuses don't leak in.
        const liveTable = liveTables.find(t => t.id === selTable.id) ?? selTable;
        const linkedRes = dayRes.find(r =>
          r.tableIds?.includes(selTable.id) &&
          !['cancelled','noshow','completed'].includes(r.status),
        );
        const zoneLabel = plan?.zones.find(z => z.id === selTable.zone)?.label ?? selTable.zone;
        return (
          <TableActionSheet
            table={liveTable}
            zoneLabel={zoneLabel}
            linkedRes={linkedRes}
            tapPt={tapPt}
            onBlock={() => {
              updateFloorTable(selectedBusiness, selTable.id, { status: 'blocked' });
              setSelTable(null);
            }}
            onUnblock={() => {
              updateFloorTable(selectedBusiness, selTable.id, {
                status: 'free', res: undefined, time: undefined,
              });
              setSelTable(null);
            }}
            onRelease={() => {
              releaseTable(selectedBusiness, selTable.id);
              setSelTable(null);
            }}
            onCreateWalkIn={() => {
              const now = new Date();
              const hh = String(now.getHours()).padStart(2,'0');
              const mm = String(now.getMinutes()).padStart(2,'0');
              addReservation({
                bizId:    selectedBusiness,
                date:     dateStr,
                time:     `${hh}:${mm}`,
                name:     `Walk-in ${selTable.name ?? selTable.id}`,
                pax:      selTable.cap,
                status:   'seated',
                source:   'walk-in',
                tableIds: [selTable.id],
              });
              setSelTable(null);
            }}
            onSeatReservation={() => {
              if (!linkedRes) return;
              updateReservation(linkedRes.id, { status: 'seated' });
              setSelTable(null);
            }}
            onConfirmReservation={() => {
              if (!linkedRes) return;
              updateReservation(linkedRes.id, { status: 'confirmed' });
              setSelTable(null);
            }}
            onClose={() => setSelTable(null)}
          />
        );
      })()}

      {/* ── Release all — step 1 ──────────────────────────────────── */}
      {showRelease1 && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', background:'var(--paper)', padding:'20px 18px calc(env(safe-area-inset-bottom) + 24px)', borderRadius:'20px 20px 0 0' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--ink-900)', marginBottom:8 }}>🔓 Alliberar totes les taules</div>
            <div style={{ fontSize:13.5, color:'var(--ink-600)', marginBottom:20, lineHeight:1.55 }}>
              Aquesta acció alliberarà totes les taules ocupades o reservades.<br />
              <span style={{ color:'var(--ink-400)', fontSize:12.5 }}>Les taules bloquejades es mantindran.</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowRelease1(false)}
                style={{ flex:1, padding:'13px', background:'var(--ink-100)', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:'var(--ink-800)' }}>
                Cancel·lar
              </button>
              <button onClick={() => { setShowRelease1(false); setShowRelease2(true); setConfirmText(''); }}
                style={{ flex:1, padding:'13px', background:'#c0392b', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, color:'white' }}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Release all — step 2: type ALLIBERAR ─────────────────── */}
      {showRelease2 && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', background:'var(--paper)', padding:'20px 18px calc(env(safe-area-inset-bottom) + 24px)', borderRadius:'20px 20px 0 0' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#c0392b', marginBottom:8 }}>Confirmació final</div>
            <div style={{ fontSize:13.5, color:'var(--ink-600)', marginBottom:16, lineHeight:1.55 }}>
              Escriu <b style={{ color:'#c0392b', fontFamily:'monospace' }}>ALLIBERAR</b> per confirmar.
            </div>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="ALLIBERAR"
              autoFocus
              style={{
                width:'100%', padding:'12px 14px', fontSize:15, fontFamily:'monospace',
                border:'2px solid rgba(200,50,50,.35)', borderRadius:10,
                background:'var(--cream)', color:'var(--ink-900)', outline:'none',
                boxSizing:'border-box', marginBottom:16,
                letterSpacing:2,
              }}
            />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setShowRelease2(false); setConfirmText(''); }}
                style={{ flex:1, padding:'13px', background:'var(--ink-100)', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:'var(--ink-800)' }}>
                Cancel·lar
              </button>
              <button
                disabled={confirmText !== 'ALLIBERAR'}
                onClick={() => { releaseAllTables(selectedBusiness); setShowRelease2(false); setConfirmText(''); }}
                style={{
                  flex:1, padding:'13px', border:'none', borderRadius:12, cursor: confirmText === 'ALLIBERAR' ? 'pointer' : 'not-allowed',
                  fontFamily:'inherit', fontSize:14, fontWeight:700, color:'white',
                  background: confirmText === 'ALLIBERAR' ? '#c0392b' : 'rgba(200,50,50,.3)',
                  transition:'background .15s',
                }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Table action sheet ───────────────────────────────────────────────────────
function TableActionSheet({
  table: t, zoneLabel, linkedRes, tapPt,
  onBlock, onUnblock, onRelease, onCreateWalkIn, onSeatReservation, onConfirmReservation,
  onClose,
}: {
  table: FloorTable;
  zoneLabel: string;
  linkedRes?: Reservation;
  /** Viewport-relative center of the cell that opened this sheet — used to
   *  scale-from-tap so the sheet feels born from the tapped table. */
  tapPt: { x: number; y: number } | null;
  onBlock: () => void;
  onUnblock: () => void;
  onRelease: () => void;
  onCreateWalkIn: () => void;
  onSeatReservation: () => void;
  onConfirmReservation: () => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<string>('center bottom');
  // Compute transform-origin in the sheet's coordinate space the moment it
  // mounts so the sheet appears to grow out of the tapped cell.
  useEffect(() => {
    if (!tapPt || !sheetRef.current) return;
    const r = sheetRef.current.getBoundingClientRect();
    setOrigin(`${tapPt.x - r.left}px ${tapPt.y - r.top}px`);
  }, [tapPt]);
  const st = STATUS_STYLE[t.status];
  const isFree    = t.status === 'free';
  const isBlocked = t.status === 'blocked';
  const isSeated  = t.status === 'seated';
  // Has a linked reservation but it's not yet seated
  const isPendingReservation = !!linkedRes && linkedRes.status !== 'seated';

  // Build the action list based on the live state — only actions that
  // actually do something on the current table status.
  type Action = {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    primary?: boolean;
    danger?: boolean;
  };
  const actions: Action[] = [];

  if (isFree) {
    // Free table → can create a walk-in or block
    actions.push({
      key:'walkin', label:'Sentar walk-in', icon:I.users,
      onClick:onCreateWalkIn, primary:true,
    });
    actions.push({
      key:'block', label:'Bloquejar taula', icon:I.x,
      onClick:onBlock,
    });
  } else if (isBlocked) {
    // Blocked → only unblock makes sense
    actions.push({
      key:'unblock', label:'Desbloquejar taula', icon:I.check,
      onClick:onUnblock, primary:true,
    });
  } else if (isSeated) {
    // Currently seated → release it (ends the seating)
    actions.push({
      key:'release', label:'Alliberar taula', icon:I.check,
      onClick:onRelease, primary:true,
    });
  } else if (isPendingReservation) {
    // Has confirmed/pending reservation → seat them, or just release the slot
    actions.push({
      key:'seat', label:'Sentar la reserva', icon:I.users,
      onClick:onSeatReservation, primary:true,
    });
    if (linkedRes && linkedRes.status === 'pending') {
      actions.push({
        key:'confirm', label:'Confirmar reserva', icon:I.check,
        onClick:onConfirmReservation,
      });
    }
    actions.push({
      key:'release', label:'Treure de la taula', icon:I.x,
      onClick:onRelease, danger:true,
    });
  }

  return (
    <>
      <div onClick={onClose}
        style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,.42)' }} />
      <div ref={sheetRef} className="sheet-from-tap" style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:100,
        background:'var(--paper)', borderRadius:'22px 22px 0 0',
        boxShadow:'0 -8px 32px rgba(0,0,0,.18)',
        paddingBottom:'max(env(safe-area-inset-bottom, 0px), 14px)',
        maxHeight:'82dvh', overflowY:'auto',
        transformOrigin: origin,
      }}>
        <div style={{ width:38, height:4, borderRadius:2, background:'var(--ink-200)',
                      margin:'10px auto 6px' }} />

        {/* ── Header — big tile + label + close ──────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 18px 14px' }}>
          <span style={{
            width:60, height:60, borderRadius:14,
            background:st.bg, border:`1.5px solid ${st.color}`,
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            flexShrink:0,
          }}>
            <span style={{
              fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500,
              color:st.color, lineHeight:1,
            }}>{t.name ?? t.id}</span>
            <span style={{ fontSize:9.5, color:st.color, fontWeight:700, marginTop:2,
                           letterSpacing:.04 }}>{t.cap} PAX</span>
          </span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:'var(--font-serif)', fontSize:21, fontWeight:500,
              color:'var(--ink-900)', lineHeight:1.1, letterSpacing:-.005,
            }}>
              Taula {t.name ?? t.id}
            </div>
            <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:4,
                          textTransform:'uppercase', letterSpacing:.08, fontWeight:600,
                          display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                <Icon d={I.tableIco} size={11} stroke={2} />
                {zoneLabel}
              </span>
              <span style={{ width:3, height:3, borderRadius:999, background:'var(--ink-300)' }} />
              <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:6, height:6, borderRadius:999, background:st.color }} />
                <span style={{ color:st.color }}>{st.label}</span>
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Tancar" className="tac-btn"
            style={{
              width:34, height:34, borderRadius:999,
              color:'var(--ink-600)',
              display:'grid', placeItems:'center', flexShrink:0,
            }}>
            <Icon d={I.x} size={15} />
          </button>
        </div>

        {/* ── Linked reservation card ──────────────────────────────────── */}
        {linkedRes && (
          <div style={{ padding:'0 18px 14px' }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'var(--ink-500)',
                          letterSpacing:.08, textTransform:'uppercase', marginBottom:7 }}>
              Reserva vinculada
            </div>
            <div style={{
              background:'var(--cream)', borderRadius:12,
              border:'1px solid var(--line-soft)',
              padding:'12px 14px',
              display:'flex', alignItems:'center', gap:12,
            }}>
              <div style={{
                width:42, height:42, borderRadius:10, background:'var(--paper)',
                border:'1px solid var(--line-soft)',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                flexShrink:0,
              }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700,
                               color:'var(--ink-900)', lineHeight:1 }}>{linkedRes.time}</span>
                <span style={{ fontFamily:'var(--font-serif)', fontSize:11, color:'var(--ink-500)',
                               marginTop:2, lineHeight:1 }}>{linkedRes.pax}p</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14.5, fontWeight:650, color:'var(--ink-900)',
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {linkedRes.name}
                </div>
                {linkedRes.phone && (
                  <div style={{ fontSize:11.5, color:'var(--ink-500)',
                                fontFamily:'var(--font-mono)', marginTop:2 }}>
                    {linkedRes.phone}
                  </div>
                )}
              </div>
              <span className={`chip state-${linkedRes.status}`} style={{ flexShrink:0 }}>
                <span className="dot" />
                {linkedRes.status === 'pending'   ? 'Pendent'
                : linkedRes.status === 'confirmed' ? 'Confirmada'
                : linkedRes.status === 'seated'    ? 'A taula'
                : linkedRes.status === 'completed' ? 'Acabada'
                : linkedRes.status === 'cancelled' ? 'Cancel·lada'
                : linkedRes.status === 'noshow'    ? 'No-show'
                : linkedRes.status}
              </span>
            </div>
          </div>
        )}

        {/* ── Action list — only meaningful actions for current state ── */}
        <div style={{ padding:'2px 18px 18px', display:'flex', flexDirection:'column', gap:8 }}>
          {actions.map(a => {
            if (a.primary) {
              const bg = a.danger
                ? 'linear-gradient(180deg, #c0392b 0%, #a93020 100%)'
                : a.key === 'unblock'
                  ? 'linear-gradient(180deg, var(--olive-600) 0%, var(--olive-700) 100%)'
                  : 'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)';
              const shadow = a.danger
                ? '0 4px 14px rgba(192,57,43,.30)'
                : a.key === 'unblock'
                  ? '0 4px 14px rgba(116,133,74,.32)'
                  : '0 4px 14px rgba(168,74,42,.32), 0 1px 2px rgba(168,74,42,.18)';
              return (
                <button key={a.key} onClick={a.onClick} className="press"
                  style={{
                    width:'100%', padding:'15px', borderRadius:14,
                    border:'none', cursor:'pointer',
                    fontFamily:'inherit', fontSize:15, fontWeight:650, color:'#fff',
                    background: bg, boxShadow: shadow,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  }}>
                  <Icon d={a.icon} size={17} stroke={2.2} />
                  {a.label}
                </button>
              );
            }
            return (
              <button key={a.key} onClick={a.onClick} className="press"
                style={{
                  width:'100%', padding:'13px 16px', borderRadius:12,
                  background:'var(--cream)',
                  border: a.danger
                    ? '1px solid rgba(192,57,43,.25)'
                    : '1px solid var(--line-soft)',
                  cursor:'pointer', fontFamily:'inherit',
                  fontSize:14, fontWeight:600, textAlign:'left',
                  color: a.danger ? '#c0392b' : 'var(--ink-800)',
                  display:'flex', alignItems:'center', gap:11,
                }}>
                <Icon d={a.icon} size={16} stroke={1.9} />
                <span style={{ flex:1 }}>{a.label}</span>
                <Icon d={I.chevR} size={14} stroke={1.8} />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Edit-mode floating bar — batch ops on multi-selected tables ─────────────
function EditBar({
  count, plan, editIds,
  onBumpCap, onShape, onAccent, onToggleBlock, onClearSel,
}: {
  count: number;
  plan: import('@/types').FloorPlan | null;
  editIds: Set<string>;
  onBumpCap: (delta: number) => void;
  onShape: (s: 'round' | 'square' | 'rect') => void;
  onAccent: (a: import('@/types').TableAccent | undefined) => void;
  onToggleBlock: () => void;
  onClearSel: () => void;
}) {
  // Quick read-back: are all selected currently blocked? (label + colour)
  const allBlocked = plan && count > 0
    ? [...editIds].every(id => plan.tables.find(x => x.id === id)?.status === 'blocked')
    : false;
  // Common cap among selected (or null when mixed)
  const caps = plan && count > 0
    ? [...editIds].map(id => plan.tables.find(x => x.id === id)?.cap ?? 0)
    : [];
  const sameCap = caps.length > 0 && caps.every(c => c === caps[0]) ? caps[0] : null;

  const ACCENTS: { id: import('@/types').TableAccent | undefined; color: string; label: string }[] = [
    { id: undefined,     color: 'transparent',           label: 'Cap'        },
    { id: 'terracotta',  color: 'var(--terracotta-600)', label: 'Terracotta' },
    { id: 'olive',       color: 'var(--olive-600)',      label: 'Olive'      },
    { id: 'clay',        color: 'var(--clay-600)',       label: 'Clay'       },
    { id: 'sky',         color: 'var(--sky-600)',        label: 'Sky'        },
    { id: 'plum',        color: 'var(--plum-600)',       label: 'Plum'       },
    { id: 'rose',        color: 'var(--rose-600)',       label: 'Rose'       },
  ];

  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:80,
      paddingBottom:'max(env(safe-area-inset-bottom, 0px), 12px)',
      pointerEvents:'none',
    }}>
      <div style={{
        margin:'0 14px', pointerEvents:'auto',
        background:'var(--paper)',
        borderRadius:18,
        boxShadow:'0 -2px 24px rgba(60,40,20,.12), 0 4px 12px rgba(60,40,20,.06)',
        border:'1px solid var(--line-soft)',
        padding:'12px 14px 10px',
        display:'flex', flexDirection:'column', gap:10,
      }}>
        {/* Header: count + clear */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            fontFamily:'var(--font-serif)', fontSize:15, fontWeight:500,
            color:'var(--ink-900)', letterSpacing:-.005,
          }}>
            <span key={count} className="number-tween" style={{ fontFamily:'var(--font-serif)' }}>{count}</span>{' '}
            seleccionad{count === 1 ? 'a' : 'es'}
          </div>
          {count > 0 && (
            <button onClick={onClearSel} className="press"
              style={{
                marginLeft:'auto',
                padding:'3px 8px', borderRadius:6, border:'none',
                background:'transparent', color:'var(--ink-500)',
                fontSize:11.5, fontWeight:650, cursor:'pointer',
              }}>Treure</button>
          )}
        </div>

        {/* Pax stepper + Forma + Block in one row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{
            fontSize:10.5, fontWeight:700, color:'var(--ink-500)',
            letterSpacing:.06, textTransform:'uppercase',
          }}>Pax</span>
          <button onClick={() => onBumpCap(-1)} disabled={count === 0} className="press"
            style={stepBtn}>−</button>
          <span style={{
            minWidth:30, textAlign:'center',
            fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
            color:'var(--ink-900)',
          }}>
            {sameCap !== null ? sameCap : '~'}
          </span>
          <button onClick={() => onBumpCap(1)} disabled={count === 0} className="press"
            style={stepBtn}>+</button>

          <span style={{ width:1, height:22, background:'rgba(60,40,20,.08)', margin:'0 4px' }} />

          {/* Shape buttons */}
          <button onClick={() => onShape('square')} disabled={count === 0} className="press"
            title="Quadrada"
            style={shapeBtn}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2.5" y="2.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
          <button onClick={() => onShape('round')} disabled={count === 0} className="press"
            title="Rodona"
            style={shapeBtn}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
          <button onClick={() => onShape('rect')} disabled={count === 0} className="press"
            title="Rectangular"
            style={shapeBtn}>
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
              <rect x="1.5" y="3.5" width="13" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>

          <span style={{ flex:1 }} />

          <button onClick={onToggleBlock} disabled={count === 0} className="press"
            style={{
              padding:'7px 12px', borderRadius:9, border:'1px solid var(--line)',
              background: allBlocked ? 'var(--olive-50)' : 'var(--ink-100)',
              color: allBlocked ? 'var(--olive-700)' : 'var(--ink-800)',
              fontFamily:'inherit', fontSize:12, fontWeight:650, cursor: count === 0 ? 'not-allowed' : 'pointer',
              opacity: count === 0 ? .4 : 1,
            }}>
            {allBlocked ? 'Desbloquejar' : 'Bloquejar'}
          </button>
        </div>

        {/* Accent palette */}
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{
            fontSize:10.5, fontWeight:700, color:'var(--ink-500)',
            letterSpacing:.06, textTransform:'uppercase',
          }}>Color</span>
          {ACCENTS.map(a => (
            <button key={a.id ?? 'none'}
              onClick={() => onAccent(a.id)} disabled={count === 0}
              className="press"
              title={a.label}
              style={{
                width:24, height:24, borderRadius:999,
                border: a.id === undefined
                  ? '1.5px dashed var(--line-strong)'
                  : `1.5px solid ${a.color}`,
                background: a.id === undefined ? 'transparent' : a.color,
                cursor: count === 0 ? 'not-allowed' : 'pointer',
                opacity: count === 0 ? .4 : 1,
                padding:0,
              }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width:30, height:30, borderRadius:999, border:'1px solid var(--line)',
  background:'var(--paper)', cursor:'pointer', fontSize:15, color:'var(--ink-700)',
  display:'grid', placeItems:'center', fontFamily:'inherit', fontWeight:500,
};
const shapeBtn: React.CSSProperties = {
  width:30, height:30, borderRadius:8, border:'1px solid var(--line)',
  background:'var(--paper)', cursor:'pointer', color:'var(--ink-700)',
  display:'grid', placeItems:'center', padding:0,
};
