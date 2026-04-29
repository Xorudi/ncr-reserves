import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import type { FloorTable, FloorZone, TableShape, TableStatus } from '@/types';

const CELL = 58;

const TABLE_CFG: Record<string, { bg: string; fg: string; border: string; dashed?: boolean; stripe?: boolean }> = {
  seated:    { bg:'var(--terracotta-100)', fg:'var(--terracotta-700)', border:'var(--terracotta-500)' },
  confirmed: { bg:'var(--olive-100)',      fg:'var(--olive-700)',      border:'var(--olive-500)' },
  reserved:  { bg:'var(--paper)',          fg:'var(--olive-700)',      border:'var(--olive-500)', dashed:true },
  pending:   { bg:'var(--clay-50)',        fg:'var(--clay-700)',       border:'var(--clay-500)' },
  playing:   { bg:'var(--sky-100)',        fg:'var(--sky-700)',        border:'var(--sky-500)' },
  free:      { bg:'var(--paper)',          fg:'var(--ink-400)',        border:'rgba(60,40,20,0.18)' },
  blocked:   { bg:'var(--ink-100)',        fg:'var(--ink-500)',        border:'var(--ink-300)', stripe:true },
};

interface PopoverState { table: FloorTable; x: number; y: number; }
interface DragState {
  id: string;
  startMouseX: number; startMouseY: number;
  origX: number; origY: number;
  curX: number; curY: number;
}

export default function FloorPlanView() {
  const {
    selectedBusiness, setShowWalkin,
    setBlockModalTable, setMergeModalTable,
    floorPlans, updateFloorTable, addFloorTable, deleteFloorTable,
    updateFloorZone, addFloorZone, deleteFloorZone, setFloorPlan,
  } = useAppStore();

  const plan = floorPlans[selectedBusiness];

  const sortedZones = useMemo(
    () => [...(plan?.zones ?? [])].sort((a, b) => a.order - b.order),
    [plan?.zones],
  );

  const [activeZoneId, setActiveZoneId] = useState<string>(() => sortedZones[0]?.id ?? '');
  const [editMode, setEditMode]           = useState(false);
  const [snapshot, setSnapshot]           = useState<typeof plan | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [popover, setPopover]             = useState<PopoverState | null>(null);
  const [drag, setDrag]                   = useState<DragState | null>(null);
  const [renamingZone, setRenamingZone]   = useState<string | null>(null);
  const [renameVal, setRenameVal]         = useState('');

  // Reset when business changes
  useEffect(() => {
    const first = [...(floorPlans[selectedBusiness]?.zones ?? [])].sort((a,b)=>a.order-b.order)[0]?.id ?? '';
    setActiveZoneId(first);
    setSelectedTableId(null);
    setPopover(null);
    setEditMode(false);
    setSnapshot(null);
    setDrag(null);
  }, [selectedBusiness]);

  // If active zone was deleted, fall back to first
  useEffect(() => {
    if (!sortedZones.find(z => z.id === activeZoneId) && sortedZones.length > 0) {
      setActiveZoneId(sortedZones[0].id);
    }
  }, [sortedZones]);

  const activeZone = sortedZones.find(z => z.id === activeZoneId);

  const zoneTables = useMemo(
    () => (plan?.tables ?? []).filter(t => t.zone === activeZoneId),
    [plan?.tables, activeZoneId],
  );

  // canvas auto-size from table extents
  const { canvasW, canvasH } = useMemo(() => {
    const PAD = 1.5;
    if (!zoneTables.length) return { canvasW: 8 * CELL, canvasH: 5 * CELL };
    const maxX = Math.max(...zoneTables.map(t => t.x + (t.w ?? 1.4))) + PAD;
    const maxY = Math.max(...zoneTables.map(t => t.y + (t.h ?? (t.shape === 'court' ? 3 : 1.4)))) + PAD;
    return { canvasW: maxX * CELL, canvasH: maxY * CELL };
  }, [zoneTables]);

  const zoneStats = useMemo(() => ({
    total:    zoneTables.length,
    cap:      zoneTables.reduce((s, t) => s + t.cap, 0),
    occupied: zoneTables.filter(t => t.status === 'seated').length,
    reserved: zoneTables.filter(t => ['confirmed','reserved','pending'].includes(t.status)).length,
    free:     zoneTables.filter(t => t.status === 'free').length,
    blocked:  zoneTables.filter(t => t.status === 'blocked').length,
  }), [zoneTables]);

  // ── Edit mode helpers ──────────────────────────────────────────
  function enterEdit() {
    setSnapshot(JSON.parse(JSON.stringify(plan)));
    setEditMode(true);
    setPopover(null);
  }
  function cancelEdit() {
    if (snapshot) setFloorPlan(selectedBusiness, snapshot);
    setEditMode(false);
    setSnapshot(null);
    setSelectedTableId(null);
    setDrag(null);
  }
  function saveEdit() {
    setEditMode(false);
    setSnapshot(null);
    setSelectedTableId(null);
    setDrag(null);
  }

  // ── Drag ──────────────────────────────────────────────────────
  function handleTableMouseDown(t: FloorTable, e: React.MouseEvent) {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    setDrag({ id: t.id, startMouseX: e.clientX, startMouseY: e.clientY, origX: t.x, origY: t.y, curX: t.x, curY: t.y });
    setSelectedTableId(t.id);
  }
  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const dx = (e.clientX - drag.startMouseX) / CELL;
    const dy = (e.clientY - drag.startMouseY) / CELL;
    setDrag(d => d ? { ...d, curX: Math.max(0, d.origX + dx), curY: Math.max(0, d.origY + dy) } : null);
  }
  function handleCanvasMouseUp() {
    if (!drag) return;
    const snapX = Math.round(drag.curX * 4) / 4;
    const snapY = Math.round(drag.curY * 4) / 4;
    updateFloorTable(selectedBusiness, drag.id, { x: snapX, y: snapY });
    setDrag(null);
  }

  // ── Table click ───────────────────────────────────────────────
  function handleTableClick(t: FloorTable, e: React.MouseEvent) {
    e.stopPropagation();
    if (drag) return; // was a drag, not a click
    if (editMode) {
      setSelectedTableId(prev => prev === t.id ? null : t.id);
      return;
    }
    if (popover?.table.id === t.id) { setPopover(null); return; }
    setPopover({ table: t, x: e.clientX, y: e.clientY });
  }

  function handleAction(id: string, table: FloorTable) {
    setPopover(null);
    if (id === 'walkin') { setShowWalkin(true); return; }
    if (id === 'block')  { setBlockModalTable(table); return; }
    if (id === 'merge')  { setMergeModalTable(table); return; }
  }

  // ── Add table / zone ──────────────────────────────────────────
  function addTableToZone() {
    const maxX = zoneTables.length > 0
      ? Math.max(...zoneTables.map(t => t.x + (t.w ?? 1.4))) + 0.3
      : 0.3;
    const newId = `${activeZoneId}-t${Date.now()}`;
    const tbl: FloorTable = {
      id: newId, name: '—',
      x: maxX > canvasW / CELL - 1.8 ? 0.3 : maxX, y: 0.3,
      shape: 'square', cap: 4, zone: activeZoneId, status: 'free',
    };
    addFloorTable(selectedBusiness, tbl);
    setSelectedTableId(newId);
  }

  function addZone() {
    const newId = `zona-${Date.now()}`;
    addFloorZone(selectedBusiness, { id: newId, label: 'Nova zona', order: sortedZones.length });
    setActiveZoneId(newId);
    setTimeout(() => { setRenamingZone(newId); setRenameVal('Nova zona'); }, 50);
  }

  const selectedTable = plan?.tables.find(t => t.id === selectedTableId) ?? null;

  if (!plan) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-400)', fontSize:14 }}>
      No hi ha planta per a aquest negoci.
    </div>
  );

  return (
    <div className="scroll"
      style={{ flex:1, overflowY:'auto', overflowX:'auto', padding:'18px 28px 40px', background:'var(--cream)' }}
      onClick={() => { setPopover(null); }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500, color:'var(--ink-900)', letterSpacing:-.4 }}>Planta</span>
        <div style={{ flex:1 }} />
        {editMode ? (
          <>
            <button onClick={e => { e.stopPropagation(); addTableToZone(); }}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12.5,fontWeight:550,background:'var(--olive-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit' }}>
              <Icon d={I.plus} size={13} /> Taula
            </button>
            <button onClick={cancelEdit}
              style={{ padding:'6px 14px',fontSize:12.5,fontWeight:550,background:'transparent',color:'var(--ink-600)',border:'var(--hair)',borderRadius:8,cursor:'pointer',fontFamily:'inherit' }}>
              Cancel·lar
            </button>
            <button onClick={saveEdit}
              style={{ padding:'6px 14px',fontSize:12.5,fontWeight:600,background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit' }}>
              Guardar canvis
            </button>
          </>
        ) : (
          <>
            <button onClick={e => { e.stopPropagation(); setShowWalkin(true); }}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12.5,fontWeight:550,background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit' }}>
              <Icon d={I.users} size={13} /> Walk-in
            </button>
            <button onClick={enterEdit}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12.5,fontWeight:550,background:'var(--paper)',color:'var(--ink-700)',border:'var(--hair)',borderRadius:8,cursor:'pointer',fontFamily:'inherit' }}>
              <Icon d={I.pencil} size={13} /> Editar planta
            </button>
          </>
        )}
      </div>

      {/* ── Zone tabs ─────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {sortedZones.map(z => (
          <div key={z.id} style={{ display:'flex', alignItems:'center', gap:2 }}>
            {renamingZone === z.id ? (
              <input autoFocus value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={() => {
                  if (renameVal.trim()) updateFloorZone(selectedBusiness, z.id, { label: renameVal.trim() });
                  setRenamingZone(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (renameVal.trim()) updateFloorZone(selectedBusiness, z.id, { label: renameVal.trim() });
                    setRenamingZone(null);
                  } else if (e.key === 'Escape') setRenamingZone(null);
                }}
                style={{ padding:'6px 10px', fontSize:13, fontWeight:600, border:'2px solid var(--terracotta-400)', borderRadius:8, fontFamily:'inherit', outline:'none', width:130 }}
              />
            ) : (
              <button onClick={() => setActiveZoneId(z.id)}
                style={{
                  padding:'7px 14px', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
                  border: activeZoneId === z.id ? 'none' : 'var(--hair)',
                  borderRadius:8,
                  background: activeZoneId === z.id ? 'var(--ink-900)' : 'var(--paper)',
                  color:       activeZoneId === z.id ? 'white'          : 'var(--ink-600)',
                  boxShadow:   activeZoneId === z.id ? 'var(--sh-1)'    : 'none',
                  transition:'background .15s, color .15s',
                }}>
                {z.label}
                <span style={{ marginLeft:6, fontSize:11, opacity:.7 }}>
                  {(plan.tables).filter(t => t.zone === z.id).length}
                </span>
              </button>
            )}
            {editMode && renamingZone !== z.id && (
              <>
                <button title="Reanomenar" onClick={e => { e.stopPropagation(); setActiveZoneId(z.id); setRenamingZone(z.id); setRenameVal(z.label); }}
                  style={{ width:22,height:22,border:'none',borderRadius:4,background:'transparent',cursor:'pointer',color:'var(--ink-400)',padding:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <Icon d={I.pencil} size={11} />
                </button>
                <button title="Eliminar zona" onClick={e => { e.stopPropagation(); if (confirm(`Eliminar zona "${z.label}"?`)) deleteFloorZone(selectedBusiness, z.id); }}
                  style={{ width:22,height:22,border:'none',borderRadius:4,background:'transparent',cursor:'pointer',color:'var(--rose-400)',padding:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <Icon d={I.trash} size={11} />
                </button>
              </>
            )}
          </div>
        ))}
        {editMode && (
          <button onClick={e => { e.stopPropagation(); addZone(); }}
            style={{ padding:'7px 12px', fontSize:12.5, fontWeight:550, fontFamily:'inherit', cursor:'pointer', border:'1.5px dashed var(--ink-300)', borderRadius:8, background:'transparent', color:'var(--ink-500)', display:'flex', alignItems:'center', gap:5 }}>
            <Icon d={I.plus} size={12} /> Zona
          </button>
        )}
      </div>

      {/* ── Stats strip ───────────────────────────────────────── */}
      {activeZone && (
        <div style={{ display:'flex', alignItems:'center', gap:16, padding:'8px 16px', background:'var(--paper)', border:'var(--hair)', borderRadius:10, marginBottom:16, boxShadow:'var(--sh-1)', flexWrap:'wrap' }}>
          <LegItem color="var(--terracotta-600)" label="Ocupada"    count={zoneStats.occupied} />
          <LegItem color="var(--olive-600)"      label="Reservada"  count={zoneStats.reserved} />
          <LegItem color="var(--ink-300)"        label="Lliure"     count={zoneStats.free}    hollow />
          <LegItem color="var(--ink-400)"        label="Bloquejada" count={zoneStats.blocked} stripe />
          <div style={{ flex:1 }} />
          <span style={{ fontSize:11.5, color:'var(--ink-500)' }}>
            {zoneStats.total} taules · {zoneStats.cap} pax
          </span>
          {editMode && (
            <span style={{ fontSize:11.5, color:'var(--terracotta-600)', fontWeight:600 }}>
              ✏️ Mode edició — arrossega les taules per moure-les
            </span>
          )}
        </div>
      )}

      {/* ── Canvas + sidebar ──────────────────────────────────── */}
      <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
        {/* Canvas */}
        <div style={{ flex:1, background:'var(--paper)', borderRadius:14, border: editMode ? '2px solid var(--terracotta-300)' : 'var(--hair)', boxShadow:'var(--sh-1)', padding:22, overflow:'auto' }}>
          <div
            style={{
              position:'relative', width:canvasW, height:canvasH, minWidth:400, minHeight:260,
              backgroundImage:'linear-gradient(rgba(60,40,20,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(60,40,20,0.04) 1px, transparent 1px)',
              backgroundSize:`${CELL}px ${CELL}px`,
              cursor: drag ? 'grabbing' : 'default',
              userSelect:'none',
            }}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}>
            {zoneTables.map(t => {
              const isDragging = drag?.id === t.id;
              const dispX = isDragging ? drag!.curX : t.x;
              const dispY = isDragging ? drag!.curY : t.y;
              return (
                <TableNode key={t.id} t={{ ...t, x: dispX, y: dispY }}
                  selected={selectedTableId === t.id || popover?.table.id === t.id}
                  editMode={editMode}
                  isDragging={isDragging}
                  onMouseDown={(e) => handleTableMouseDown(t, e)}
                  onClick={(e) => handleTableClick(t, e)}
                />
              );
            })}
            {zoneTables.length === 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, color:'var(--ink-400)', pointerEvents:'none' }}>
                <span style={{ fontSize:36 }}>📐</span>
                <span style={{ fontSize:13 }}>
                  {editMode ? 'Zona buida. Afegeix taules amb el botó "Taula".' : 'Aquesta zona no té taules.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Edit panel */}
        {editMode && selectedTable && (
          <TableEditPanel
            key={selectedTable.id}
            table={selectedTable}
            onUpdate={(updates) => updateFloorTable(selectedBusiness, selectedTable.id, updates)}
            onDelete={() => { deleteFloorTable(selectedBusiness, selectedTable.id); setSelectedTableId(null); }}
            onClose={() => setSelectedTableId(null)}
          />
        )}
      </div>

      {/* Floating popover (view mode only) */}
      {!editMode && popover && (
        <TableActionPopover
          table={popover.table}
          x={popover.x}
          y={popover.y}
          zoneName={activeZone?.label ?? activeZoneId}
          onClose={() => setPopover(null)}
          onAction={(id) => handleAction(id, popover.table)}
        />
      )}
    </div>
  );
}

// ─── Legend item ───────────────────────────────────────────────────────────────
function LegItem({ color, label, count, hollow, stripe }: {
  color: string; label: string; count: number; hollow?: boolean; stripe?: boolean;
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
      <span style={{
        width:14, height:14, borderRadius:4, flexShrink:0,
        background: stripe
          ? `repeating-linear-gradient(45deg,${color},${color} 3px,transparent 3px,transparent 6px)`
          : hollow ? 'transparent' : color,
        border: hollow ? `1.5px solid ${color}` : 'none',
      }} />
      <span style={{ fontSize:12, color:'var(--ink-700)' }}>
        <b style={{ color:'var(--ink-900)' }}>{count}</b> {label.toLowerCase()}
      </span>
    </div>
  );
}

// ─── Table node ────────────────────────────────────────────────────────────────
function TableNode({ t, selected, editMode, isDragging, onMouseDown, onClick }: {
  t: FloorTable; selected: boolean; editMode: boolean; isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cfg = TABLE_CFG[t.status] ?? TABLE_CFG.free;
  const w = (t.w ?? 1.4) * CELL;
  const h = (t.h ?? (t.shape === 'court' ? 3 : 1.4)) * CELL;
  const radius = (t.shape === 'round' || t.shape === 'stool') ? '50%' : t.shape === 'court' ? 6 : 8;
  const bg = cfg.stripe
    ? `repeating-linear-gradient(45deg,${cfg.bg},${cfg.bg} 4px,transparent 4px,transparent 8px),var(--paper)`
    : cfg.bg;
  return (
    <button
      onMouseDown={editMode ? onMouseDown : undefined}
      onClick={onClick}
      style={{
        position:'absolute', left:t.x*CELL, top:t.y*CELL, width:w, height:h,
        background:bg,
        border:`${selected ? 2 : 1.5}px ${cfg.dashed ? 'dashed' : 'solid'} ${selected ? 'var(--terracotta-500)' : cfg.border}`,
        borderRadius:radius,
        cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:2, fontFamily:'inherit', padding:4, overflow:'hidden',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : selected ? '0 0 0 4px rgba(220,100,60,0.15)' : 'none',
        transition: isDragging ? 'none' : 'box-shadow .1s, border-color .1s',
        opacity: isDragging ? 0.85 : 1,
        zIndex: isDragging ? 10 : 1,
      }}>
      <span style={{ fontSize:t.shape==='stool'?9:10.5, fontWeight:700, letterSpacing:.2, color:cfg.fg, fontFamily:'var(--font-mono)' }}>
        {t.name ?? t.id}
      </span>
      {t.shape !== 'stool' && (
        <>
          <span style={{ fontSize:10, color:cfg.fg, fontWeight:600 }}>{t.cap} pax</span>
          {t.res && t.status !== 'free' && (
            <span style={{ fontSize:t.shape==='court'?11.5:10, fontWeight:600, color:cfg.fg, maxWidth:w-12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', textAlign:'center' }}>{t.res}</span>
          )}
          {t.time && t.status !== 'free' && (
            <span style={{ fontSize:9.5, color:cfg.fg, opacity:.75, fontWeight:600 }}>{t.time}</span>
          )}
          {t.note && (
            <span style={{ fontSize:9, color:cfg.fg, opacity:.75, fontStyle:'italic' }}>{t.note}</span>
          )}
        </>
      )}
    </button>
  );
}

// ─── Table edit panel (sidebar) ────────────────────────────────────────────────
function TableEditPanel({ table, onUpdate, onDelete, onClose }: {
  table: FloorTable;
  onUpdate: (updates: Partial<FloorTable>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name,   setName]   = useState(table.name ?? table.id);
  const [cap,    setCap]    = useState(table.cap);
  const [shape,  setShape]  = useState<TableShape>(table.shape);
  const [status, setStatus] = useState<TableStatus>(table.status);
  const [tw,     setTw]     = useState<string>(table.w != null ? String(table.w) : '');
  const [th,     setTh]     = useState<string>(table.h != null ? String(table.h) : '');

  function handleSave() {
    onUpdate({
      name:   name.trim() || table.id,
      cap:    Math.max(1, cap),
      shape,
      status,
      w: tw !== '' ? Number(tw) : undefined,
      h: th !== '' ? Number(th) : undefined,
    });
  }

  const lbl = (text: string) => (
    <span style={{ fontSize:11, fontWeight:600, color:'var(--ink-500)', textTransform:'uppercase', letterSpacing:.4 }}>{text}</span>
  );

  return (
    <div style={{ width:240, background:'var(--paper)', border:'var(--hair)', borderRadius:14, boxShadow:'var(--sh-2)', padding:'16px 14px', flexShrink:0 }}
      onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--ink-900)' }}>
          {table.name ?? table.id}
        </span>
        <div style={{ flex:1 }} />
        <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-400)', padding:4 }}>
          <Icon d={I.x} size={14} />
        </button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {/* Name */}
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {lbl('Nom')}
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ padding:'6px 8px', borderRadius:6, border:'var(--hair)', fontSize:13, fontFamily:'inherit', outline:'none' }} />
        </label>

        {/* Cap */}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {lbl('Capacitat')}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => setCap(c => Math.max(1, c-1))}
              style={{ width:28,height:28,borderRadius:6,border:'var(--hair)',background:'var(--ink-50)',cursor:'pointer',fontFamily:'inherit',fontSize:16 }}>−</button>
            <span style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)', width:28, textAlign:'center' }}>{cap}</span>
            <button onClick={() => setCap(c => c+1)}
              style={{ width:28,height:28,borderRadius:6,border:'var(--hair)',background:'var(--ink-50)',cursor:'pointer',fontFamily:'inherit',fontSize:16 }}>+</button>
          </div>
        </div>

        {/* Shape */}
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {lbl('Forma')}
          <select value={shape} onChange={e => setShape(e.target.value as TableShape)}
            style={{ padding:'6px 8px', borderRadius:6, border:'var(--hair)', fontSize:13, fontFamily:'inherit', outline:'none', background:'white' }}>
            <option value="round">Rodona</option>
            <option value="square">Quadrada</option>
            <option value="rect">Rectangular</option>
            <option value="stool">Tamboret</option>
            <option value="court">Pista</option>
          </select>
        </label>

        {/* Status */}
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {lbl('Estat')}
          <select value={status} onChange={e => setStatus(e.target.value as TableStatus)}
            style={{ padding:'6px 8px', borderRadius:6, border:'var(--hair)', fontSize:13, fontFamily:'inherit', outline:'none', background:'white' }}>
            <option value="free">Lliure</option>
            <option value="confirmed">Confirmada</option>
            <option value="seated">Ocupada</option>
            <option value="reserved">Reservada (nit)</option>
            <option value="pending">Pendent</option>
            <option value="blocked">Bloquejada</option>
          </select>
        </label>

        {/* Size (rect/court) */}
        {(shape === 'rect' || shape === 'court') && (
          <div style={{ display:'flex', gap:8 }}>
            <label style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
              {lbl('Amplada')}
              <input type="number" step="0.25" min="0.5" value={tw} onChange={e => setTw(e.target.value)}
                style={{ padding:'6px 8px', borderRadius:6, border:'var(--hair)', fontSize:13, fontFamily:'inherit', outline:'none' }} />
            </label>
            <label style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
              {lbl('Alçada')}
              <input type="number" step="0.25" min="0.5" value={th} onChange={e => setTh(e.target.value)}
                style={{ padding:'6px 8px', borderRadius:6, border:'var(--hair)', fontSize:13, fontFamily:'inherit', outline:'none' }} />
            </label>
          </div>
        )}

        {/* Apply */}
        <button onClick={handleSave}
          style={{ width:'100%', padding:'8px 0', borderRadius:8, border:'none', background:'var(--olive-600)', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginTop:4 }}>
          Aplicar canvis
        </button>

        {/* Delete */}
        <button onClick={() => { if (confirm('Eliminar aquesta taula?')) onDelete(); }}
          style={{ width:'100%', padding:'7px 0', borderRadius:8, border:'1px solid var(--rose-200)', background:'var(--rose-50)', color:'var(--rose-700)', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          Eliminar taula
        </button>
      </div>
    </div>
  );
}

// ─── Floating action popover ────────────────────────────────────────────────────
function TableActionPopover({ table, x, y, zoneName, onClose, onAction }: {
  table: FloorTable; x: number; y: number; zoneName: string;
  onClose: () => void; onAction: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const actions: { id: string; icon: React.ReactNode; label: string; primary?: boolean; danger?: boolean }[] = [
    ...(table.status === 'free'
      ? [{ id:'walkin', icon:I.users, label:'Asseure walk-in', primary:true }]
      : [{ id:'view',   icon:I.eye,   label:`Veure reserva${table.res ? ' · '+table.res : ''}`, primary:true }]),
    ...(table.status !== 'free' && table.status !== 'blocked'
      ? [{ id:'move', icon:I.move, label:'Moure reserva a una altra taula' }]
      : []),
    { id:'merge', icon:I.merge, label:'Unir amb taula veïna' },
    ...(table.status !== 'free'
      ? [{ id:'free', icon:I.check, label:'Marcar com lliure' }]
      : []),
    { id:'block', icon: table.status === 'blocked' ? I.x : I.lock,
      label: table.status === 'blocked' ? 'Desbloquejar taula' : 'Bloquejar taula',
      danger: table.status !== 'blocked' },
  ];

  const W = 268;
  const left = x + W + 12 > window.innerWidth ? x - W - 8 : x + 8;
  const top  = Math.min(y - 8, window.innerHeight - 320);

  return (
    <div ref={ref} onClick={e => e.stopPropagation()}
      style={{ position:'fixed', left, top, width:W, background:'var(--paper)', borderRadius:12, boxShadow:'var(--sh-3)', border:'var(--hair)', zIndex:500, overflow:'hidden' }}>
      <div style={{ padding:'10px 12px', borderBottom:'var(--hair)', background:'rgba(60,40,20,.025)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--ink-900)' }}>
          {table.name ?? table.id}
        </span>
        <span style={{ fontSize:12, color:'var(--ink-600)' }}>{table.cap} pax · {zoneName}</span>
        <div style={{ flex:1 }} />
        <span className={`chip state-${table.status}`}><span className="dot" />{table.status}</span>
      </div>
      <div style={{ padding:6 }}>
        {actions.map(a => (
          <button key={a.id} onClick={() => onAction(a.id)}
            style={{ display:'flex',alignItems:'center',gap:10,width:'100%',padding:'8px 10px',borderRadius:6,background:a.primary?'var(--ink-100)':'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:a.primary?600:500,color:a.danger?'var(--rose-700)':'var(--ink-800)',textAlign:'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = a.danger ? 'var(--rose-50)' : 'var(--ink-100)')}
            onMouseLeave={e => (e.currentTarget.style.background = a.primary ? 'var(--ink-100)' : 'transparent')}>
            <span style={{ color:a.danger?'var(--rose-500)':'var(--ink-400)', flexShrink:0 }}>
              <Icon d={a.icon} size={13} />
            </span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
