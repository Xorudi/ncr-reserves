import React from 'react';
import { StatusChip } from '@/components/shared/StatusChip';
import { initials, avIdx } from '@/data/mockData';
import type { Reservation } from '@/types';

export interface TableInfo {
  icon: string;
  zoneLabel: string;
  tableStr: string;   // "Taula 4" | "Taules 12 + 13"
  bg: string;
  color: string;
}

interface Props {
  res: Reservation;
  selected?: boolean;
  tableInfo?: TableInfo | null;
  onClick?: () => void;
}

export function ReservationRow({ res, selected = false, tableInfo, onClick }: Props) {
  const sel = selected;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        background: sel ? 'var(--ink-900)' : 'transparent',
        color: sel ? 'var(--cream)' : 'var(--ink-800)',
        border: 'none', borderRadius: 8,
        fontFamily: 'inherit', cursor: 'pointer',
        textAlign: 'left', transition: 'background .1s', width: '100%',
      }}
      onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--ink-50)'; }}
      onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>

      {/* Avatar */}
      <span
        className={`avatar av-${avIdx(res.name)}`}
        style={sel ? { background:'rgba(255,255,255,0.12)', color:'var(--cream)' } : {}}>
        {initials(res.name)}
      </span>

      {/* Middle: name + tags + zone/table line */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            className="nowrap"
            style={{ fontSize: 13.5, fontWeight: 600, color: sel ? 'var(--cream)' : 'var(--ink-900)' }}>
            {res.name}
          </span>
          {res.tags?.includes('vip')      && <span className="tag vip"     style={{ fontSize: 10 }}>VIP</span>}
          {res.tags?.includes('birthday') && <span style={{ fontSize: 11 }}>🎂</span>}
          {res.tags?.includes('allergy')  && <span className="tag allergy" style={{ fontSize: 10 }}>Al·lèrgia</span>}
        </div>

        {/* Zone + table line */}
        {tableInfo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 5,
              background: sel ? 'rgba(255,255,255,.15)' : tableInfo.bg,
              color: sel ? 'rgba(251,247,238,.85)' : tableInfo.color,
            }}>
              <span>{tableInfo.icon}</span>
              <span>{tableInfo.zoneLabel}</span>
            </span>
            <span style={{ fontSize: 11.5, color: sel ? 'rgba(251,247,238,.7)' : 'var(--ink-600)', fontWeight: 500 }}>
              {tableInfo.tableStr}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: sel ? 'rgba(251,247,238,.45)' : 'var(--ink-400)', fontStyle: 'italic' }}>
            🪑 Sense assignar
          </div>
        )}

        {/* Notes (if present) */}
        {res.notes && (
          <span
            className="nowrap"
            style={{ fontSize: 11, color: sel ? 'rgba(251,247,238,0.55)' : 'var(--ink-400)', marginTop: 1 }}>
            {res.notes}
          </span>
        )}
      </div>

      {/* Right: pax + status */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <StatusChip state={res.status} size="sm" />
        <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'rgba(251,247,238,.65)' : 'var(--ink-500)' }}>
          {res.pax} pax
        </span>
      </div>
    </button>
  );
}
