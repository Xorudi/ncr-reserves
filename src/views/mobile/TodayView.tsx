import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip, Tag } from '@/components/shared/StatusChip';
import { initials, avIdx, getStats } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { Reservation } from '@/types';

const DAYS_CA    = ['dg.','dl.','dm.','dc.','dj.','dv.','ds.'];
const MONTHS_CA  = ['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'];

export default function MobileTodayView() {
  const { selectedBusiness, reservations, selectedDate } = useAppStore();
  const stats  = getStats(selectedBusiness);
  const bizRes = useMemo(() => reservations.filter(r => r.bizId === selectedBusiness), [reservations, selectedBusiness]);
  const [sel, setSel] = useState<Reservation | null>(null);

  const d = selectedDate;
  const dateStr = `${DAYS_CA[d.getDay()]} ${d.getDate()} ${MONTHS_CA[d.getMonth()]}`;

  const pending = bizRes.filter(r => r.status === 'pending');

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Summary strip */}
      <div style={{ padding:'12px 16px', background:'var(--paper)', borderBottom:'var(--hair)', flexShrink:0 }}>
        <div style={{ fontSize:12, color:'var(--ink-600)', marginBottom:6 }}>{dateStr}</div>
        <div style={{ display:'flex', gap:14 }}>
          <StatM value={stats.totalRes}  label="reserves" />
          <StatM value={stats.totalPax}  label="pax" />
          <StatM value={`${stats.occupancyPct}%`} label="ocupació" accent={stats.level==='high'} />
        </div>
        {pending.length > 0 && (
          <div style={{ marginTop:8, padding:'6px 10px', background:'var(--clay-50)', borderRadius:8, fontSize:12, color:'var(--clay-700)', fontWeight:550 }}>
            ⚠️ {pending.length} {pending.length===1?'reserva pendent':'reserves pendents'} de confirmar
          </div>
        )}
      </div>

      {/* List */}
      <div className="scroll" style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
        {bizRes.map(r => (
          <button key={r.id} onClick={() => setSel(sel?.id===r.id ? null : r)}
            style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px 16px', background:sel?.id===r.id?'var(--ink-100)':'transparent', border:'none', borderBottom:'var(--hair)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
            <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--ink-700)', width:40, flex:'none' }}>{r.time}</span>
            <span className={`avatar av-${avIdx(r.name)}`}>{initials(r.name)}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)', display:'flex', alignItems:'center', gap:6 }}>
                <span className="nowrap" style={{ flex:1 }}>{r.name}</span>
                {r.tags?.includes('vip') && <span className="tag vip" style={{ fontSize:10 }}>VIP</span>}
              </div>
              {r.notes && <div className="nowrap" style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:1 }}>{r.notes}</div>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
              <StatusChip state={r.status} size="sm" />
              <span style={{ fontSize:12, color:'var(--ink-600)' }}>{r.pax} pax</span>
            </div>
          </button>
        ))}
        {bizRes.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 16px', color:'var(--ink-500)' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📭</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:16 }}>Cap reserva per avui</div>
          </div>
        )}
        <div style={{ height:80 }} />
      </div>

      {/* FAB */}
      <button style={{ position:'fixed', bottom:72, right:20, width:52, height:52, borderRadius:'50%', background:'var(--terracotta-600)', color:'white', border:'none', boxShadow:'var(--sh-3)', cursor:'pointer', display:'grid', placeItems:'center' }}>
        <Icon d={I.plus} size={22} stroke={2} />
      </button>

      {/* Bottom sheet detail */}
      {sel && (
        <div style={{ position:'fixed', bottom:60, left:0, right:0, background:'var(--paper)', borderTop:'var(--hair)', borderRadius:'16px 16px 0 0', boxShadow:'var(--sh-3)', padding:'16px 18px 24px', zIndex:100 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 14px' }} />
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <span className={`avatar lg av-${avIdx(sel.name)}`}>{initials(sel.name)}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--ink-900)' }}>{sel.name}</div>
              <div style={{ fontSize:12, color:'var(--ink-600)' }}>{sel.time} · {sel.pax} pax{sel.source ? ` · ${sel.source}` : ''}</div>
            </div>
            <button onClick={() => setSel(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-500)' }}>
              <Icon d={I.x} size={16} />
            </button>
          </div>
          {sel.notes && <div style={{ background:'#fef6d6', borderRadius:8, padding:'8px 10px', fontSize:13, color:'#5a4a2a', marginBottom:10 }}>{sel.notes}</div>}
          <div style={{ display:'flex', gap:8 }}>
            {sel.phone && (
              <a href={`tel:${sel.phone}`} style={{ flex:1, padding:'9px', textAlign:'center', background:'var(--ink-100)', borderRadius:10, textDecoration:'none', fontSize:13, fontWeight:550, color:'var(--ink-800)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Icon d={I.phone} size={14} /> Trucar
              </a>
            )}
            <button style={{ flex:2, padding:'9px', background:'var(--ink-900)', color:'var(--cream)', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:550 }}>
              A taula
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatM({ value, label, accent }: { value: string|number; label: string; accent?: boolean }) {
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <span style={{ fontFamily:'var(--font-serif)', fontSize:20, fontWeight:500, color:accent?'var(--terracotta-700)':'var(--ink-900)', lineHeight:1 }}>{value}</span>
      <span style={{ fontSize:10.5, color:'var(--ink-500)' }}>{label}</span>
    </div>
  );
}
