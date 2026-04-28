import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { FLOOR_PLANS } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { FloorTable } from '@/types';

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

export default function FloorPlanView() {
  const {
    selectedBusiness, setShowWalkin,
    setBlockModalTable, setMergeModalTable,
  } = useAppStore();
  const plan = FLOOR_PLANS[selectedBusiness];
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const stats = useMemo(() => {
    const all = plan.tables;
    return {
      occupied: all.filter(t => t.status === 'seated').length,
      reserved: all.filter(t => ['confirmed','reserved','pending'].includes(t.status)).length,
      free:     all.filter(t => t.status === 'free').length,
      blocked:  all.filter(t => t.status === 'blocked').length,
      total:    all.length,
    };
  }, [plan]);

  function handleTableClick(t: FloorTable, e: React.MouseEvent) {
    e.stopPropagation();
    if (popover?.table.id === t.id) { setPopover(null); return; }
    setPopover({ table: t, x: e.clientX, y: e.clientY });
  }

  function handleAction(id: string, table: FloorTable) {
    setPopover(null);
    if (id === 'walkin')  { setShowWalkin(true); return; }
    if (id === 'block')   { setBlockModalTable(table); return; }
    if (id === 'merge')   { setMergeModalTable(table); return; }
    if (id === 'free')    { /* TODO: update table status */ return; }
    if (id === 'view')    { /* TODO: open reservation detail */ return; }
    if (id === 'move')    { /* TODO: move reservation */ return; }
  }

  return (
    <div className="scroll" style={{ flex:1,overflowY:'auto',overflowX:'auto',padding:'18px 28px 40px',background:'var(--cream)' }}
      onClick={() => setPopover(null)}>

      {/* Legend strip */}
      <div style={{ display:'flex',alignItems:'center',gap:16,padding:'10px 16px',background:'var(--paper)',border:'var(--hair)',borderRadius:12,marginBottom:16,boxShadow:'var(--sh-1)',flexWrap:'wrap' }}>
        <LegItem color="var(--terracotta-600)" label="Ocupada"    count={stats.occupied} />
        <LegItem color="var(--olive-600)"      label="Reservada"  count={stats.reserved} hollow={false} />
        <LegItem color="var(--ink-300)"        label="Lliure"     count={stats.free}     hollow={true} />
        <LegItem color="var(--ink-400)"        label="Bloquejada" count={stats.blocked}  stripe={true} />
        <div style={{ flex:1 }} />
        <span style={{ fontSize:11.5,color:'var(--ink-500)' }}>
          {stats.occupied + stats.reserved} / {stats.total} taules compromeses
        </span>
        <button onClick={e => { e.stopPropagation(); setShowWalkin(true); }}
          style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 12px',fontSize:12.5,fontWeight:550,background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit' }}>
          <Icon d={I.users} size={13} /> Walk-in ràpid
        </button>
      </div>

      {/* Canvas */}
      <div style={{ background:'var(--paper)',borderRadius:14,border:'var(--hair)',boxShadow:'var(--sh-1)',padding:22,overflow:'auto' }}>
        <div style={{ position:'relative',width:plan.gridW*CELL,height:plan.gridH*CELL,backgroundImage:'linear-gradient(rgba(60,40,20,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(60,40,20,0.04) 1px, transparent 1px)',backgroundSize:`${CELL}px ${CELL}px` }}>
          {/* Zones */}
          {plan.zones.map(z => (
            <div key={z.id} style={{ position:'absolute',left:z.x*CELL,top:z.y*CELL,width:z.w*CELL,height:z.h*CELL,border:'1.5px dashed rgba(60,40,20,0.14)',borderRadius:10,pointerEvents:'none' }}>
              <span style={{ position:'absolute',top:6,left:10,fontSize:10.5,fontWeight:700,color:'var(--ink-500)',letterSpacing:.08,textTransform:'uppercase',background:'var(--paper)',padding:'0 6px' }}>{z.label}</span>
            </div>
          ))}
          {/* Tables */}
          {plan.tables.map(t => (
            <TableNode key={t.id} t={t}
              selected={popover?.table.id === t.id}
              onClick={(e) => handleTableClick(t, e)} />
          ))}
        </div>
      </div>

      {/* Floating popover */}
      {popover && (
        <TableActionPopover
          table={popover.table}
          x={popover.x}
          y={popover.y}
          zoneName={plan.zones.find(z => z.id === popover.table.zone)?.label ?? popover.table.zone}
          onClose={() => setPopover(null)}
          onAction={(id) => handleAction(id, popover.table)}
        />
      )}
    </div>
  );
}

// ─── Legend item ──────────────────────────────────────────────
function LegItem({ color, label, count, hollow, stripe }: { color:string; label:string; count:number; hollow?:boolean; stripe?:boolean }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:7 }}>
      <span style={{ width:14,height:14,borderRadius:4,background:stripe?`repeating-linear-gradient(45deg,${color},${color} 3px,transparent 3px,transparent 6px)`:hollow?'transparent':color,border:hollow?`1.5px solid ${color}`:'none',flexShrink:0 }} />
      <span style={{ fontSize:12,color:'var(--ink-700)' }}><b style={{ color:'var(--ink-900)' }}>{count}</b> {label.toLowerCase()}</span>
    </div>
  );
}

// ─── Table node (on the canvas) ───────────────────────────────
function TableNode({ t, selected, onClick }: { t: FloorTable; selected: boolean; onClick: (e: React.MouseEvent) => void }) {
  const cfg = TABLE_CFG[t.status] ?? TABLE_CFG.free;
  const w = (t.w ?? 1.4) * CELL;
  const h = (t.h ?? (t.shape === 'court' ? 3 : 1.4)) * CELL;
  const radius = (t.shape === 'round' || t.shape === 'stool') ? '50%' : t.shape === 'court' ? 6 : 8;
  const bg = cfg.stripe
    ? `repeating-linear-gradient(45deg,${cfg.bg},${cfg.bg} 4px,transparent 4px,transparent 8px),var(--paper)`
    : cfg.bg;
  return (
    <button onClick={onClick} style={{ position:'absolute',left:t.x*CELL,top:t.y*CELL,width:w,height:h,background:bg,border:`${selected?2:1.5}px ${cfg.dashed?'dashed':'solid'} ${selected?'var(--terracotta-500)':cfg.border}`,borderRadius:radius,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,fontFamily:'inherit',boxShadow:selected?'0 0 0 4px rgba(220,100,60,0.15)':'none',transition:'box-shadow .1s, border-color .1s',padding:4,overflow:'hidden' }}>
      <span style={{ fontSize:t.shape==='stool'?9:10.5,fontWeight:700,letterSpacing:.2,color:cfg.fg,fontFamily:'var(--font-mono)' }}>{t.id}</span>
      {t.shape !== 'stool' && (
        <>
          <span style={{ fontSize:10,color:cfg.fg,fontWeight:600 }}>{t.cap} pax</span>
          {t.res && t.status !== 'free' && (
            <span style={{ fontSize:t.shape==='court'?11.5:10,fontWeight:600,color:cfg.fg,maxWidth:w-12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block',textAlign:'center' }}>{t.res}</span>
          )}
          {t.time && t.status !== 'free' && (
            <span style={{ fontSize:9.5,color:cfg.fg,opacity:.75,fontWeight:600 }}>{t.time}</span>
          )}
          {t.note && (
            <span style={{ fontSize:9,color:cfg.fg,opacity:.75,fontStyle:'italic' }}>{t.note}</span>
          )}
        </>
      )}
    </button>
  );
}

// ─── Floating action popover ──────────────────────────────────
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
    {
      id:'block', icon: table.status === 'blocked' ? I.x : I.lock,
      label: table.status === 'blocked' ? 'Desbloquejar taula' : 'Bloquejar taula',
      danger: table.status !== 'blocked',
    },
  ];

  // Keep popover within viewport
  const W = 264;
  const left = x + W + 12 > window.innerWidth ? x - W - 8 : x + 8;
  const top  = Math.min(y - 8, window.innerHeight - 320);

  return (
    <div ref={ref} onClick={e => e.stopPropagation()}
      style={{ position:'fixed',left,top,width:W,background:'var(--paper)',borderRadius:12,boxShadow:'var(--sh-3)',border:'var(--hair)',zIndex:500,overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'10px 12px',borderBottom:'var(--hair)',background:'rgba(60,40,20,.025)',display:'flex',alignItems:'center',gap:8 }}>
        <span style={{ fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:'var(--ink-900)' }}>{table.id}</span>
        <span style={{ fontSize:12,color:'var(--ink-600)' }}>{table.cap} pax · {zoneName}</span>
        <div style={{ flex:1 }} />
        <span className={`chip state-${table.status}`}><span className="dot" />{table.status}</span>
      </div>
      {/* Actions */}
      <div style={{ padding:6 }}>
        {actions.map(a => (
          <button key={a.id} onClick={() => onAction(a.id)}
            style={{ display:'flex',alignItems:'center',gap:10,width:'100%',padding:'8px 10px',borderRadius:6,background:a.primary?'var(--ink-100)':'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:a.primary?600:500,color:a.danger?'var(--rose-700)':'var(--ink-800)',textAlign:'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = a.danger ? 'var(--rose-50)' : 'var(--ink-100)')}
            onMouseLeave={e => (e.currentTarget.style.background = a.primary ? 'var(--ink-100)' : 'transparent')}>
            <span style={{ color:a.danger?'var(--rose-500)':'var(--ink-400)',flexShrink:0 }}>
              <Icon d={a.icon} size={13} />
            </span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
