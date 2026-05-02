import React from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip } from '@/components/shared/StatusChip';
import { initials, avIdx } from '@/data/mockData';
import type { Reservation } from '@/types';

interface Props {
  res: Reservation;
  selected?: boolean;
  tableLabel?: string;   // e.g. "T12" or "T12 + T13"
  onClick?: () => void;
}

export function ReservationRow({ res, selected = false, tableLabel, onClick }: Props) {
  return (
    <button onClick={onClick} style={{ display:'grid',gridTemplateColumns:'28px 1fr auto auto',alignItems:'center',gap:12,padding:'9px 10px',background:selected?'var(--ink-900)':'transparent',color:selected?'var(--cream)':'var(--ink-800)',border:'none',borderRadius:8,fontFamily:'inherit',cursor:'pointer',textAlign:'left',transition:'background .1s',width:'100%' }}
      onMouseEnter={e=>{if(!selected)(e.currentTarget as HTMLElement).style.background='var(--ink-50)';}}
      onMouseLeave={e=>{if(!selected)(e.currentTarget as HTMLElement).style.background='transparent';}}>

      <span className={`avatar av-${avIdx(res.name)}`} style={selected?{background:'rgba(255,255,255,0.12)',color:'var(--cream)'}:{}}>
        {initials(res.name)}
      </span>

      <div style={{ minWidth:0,display:'flex',flexDirection:'column' }}>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <span className="nowrap" style={{ fontSize:13.5,fontWeight:600,color:selected?'var(--cream)':'var(--ink-900)' }}>{res.name}</span>
          {res.tags?.includes('vip') && <span className="tag vip" style={{ fontSize:10 }}>VIP</span>}
          {res.tags?.includes('birthday') && <span style={{ fontSize:11 }}>🎂</span>}
          {res.tags?.includes('allergy') && <span className="tag allergy" style={{ fontSize:10 }}>Al·lèrgia</span>}
        </div>
        {res.notes && (
          <span className="nowrap" style={{ fontSize:11.5,color:selected?'rgba(251,247,238,0.6)':'var(--ink-500)',marginTop:1 }}>{res.notes}</span>
        )}
      </div>

      <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:selected?'rgba(251,247,238,0.75)':'var(--ink-600)' }}>
        <Icon d={I.users} size={12} stroke={2} />
        <span style={{ fontWeight:600 }}>{res.pax}</span>
        {tableLabel && (
          <span style={{
            fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5,
            background: selected ? 'rgba(255,255,255,.18)' : 'rgba(60,40,20,.09)',
            color: selected ? 'rgba(251,247,238,.85)' : 'var(--ink-700)',
            marginLeft:2,
          }}>
            {tableLabel}
          </span>
        )}
      </div>

      <StatusChip state={res.status} size="sm" />
    </button>
  );
}
