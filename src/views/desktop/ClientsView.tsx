import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip, Tag } from '@/components/shared/StatusChip';
import { CUSTOMERS, BUSINESSES, initials, avIdx } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { Customer } from '@/types';

function fmtDate(iso: string) {
  const [y,m,d] = iso.split('-');
  const mon = ['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'][Number(m)-1];
  return `${Number(d)} ${mon} ${y.slice(2)}`;
}

export default function ClientsView() {
  const { selectedBusiness } = useAppStore();
  const [query, setQuery]   = useState('');
  const [filter, setFilter] = useState('all');
  const { selectedCustomer, setSelectedCustomer } = useAppStore();

  const filtered = useMemo(() => {
    return CUSTOMERS.filter(c => {
      if (!c.biz.includes(selectedBusiness as any)) return false;
      if (filter === 'vip'     && !c.tags.includes('vip'))     return false;
      if (filter === 'regular' && !c.tags.includes('regular')) return false;
      if (filter === 'new'     && c.visits > 1)                 return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.phone.includes(query)) return false;
      return true;
    }).sort((a,b) => b.visits - a.visits);
  }, [selectedBusiness, query, filter]);

  return (
    <div style={{ flex:1,display:'flex',height:'100%',overflow:'hidden' }}>
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'var(--cream)' }}>
        {/* Toolbar */}
        <div style={{ padding:'14px 24px',borderBottom:'var(--hair)',display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 12px',borderRadius:8,background:'var(--paper)',border:'var(--hair)',flex:'0 0 280px' }}>
            <Icon d={I.search} size={14} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Cerca per nom o telèfon…"
              style={{ flex:1,border:'none',outline:'none',background:'transparent',fontFamily:'inherit',fontSize:13,color:'var(--ink-900)' }} />
          </div>
          <div style={{ display:'flex',gap:3 }}>
            {([['all','Tots'],['regular','Habituals'],['vip','VIP'],['new','Nous']] as const).map(([k,label]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding:'6px 12px',borderRadius:999,border:filter===k?'none':'1px solid rgba(60,40,20,.14)',background:filter===k?'var(--ink-900)':'transparent',color:filter===k?'var(--cream)':'var(--ink-700)',fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer' }}>{label}</button>
            ))}
          </div>
          <div style={{ flex:1 }} />
          <span style={{ fontSize:12,color:'var(--ink-500)' }}>{filtered.length} clients</span>
          <button style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 12px',fontSize:12.5,fontWeight:550,background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit' }}>
            <Icon d={I.plus} size={13} /> Nou client
          </button>
        </div>

        {/* Table */}
        <div className="scroll" style={{ overflowY:'auto',flex:1 }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--ink-50)',borderBottom:'var(--hair)' }}>
                {[['Client','',260],['Telèfon','',150],['Visites','center',80],['Última','',120],['Ticket','right',110],['Etiquetes','',150],['Negocis','',120]] .map(([h,a,w],i) => (
                  <th key={i} style={{ textAlign:(a||'left') as any,padding:'9px 14px',fontSize:10.5,fontWeight:700,letterSpacing:.08,textTransform:'uppercase',color:'var(--ink-500)',width:Number(w) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const avg = c.visits > 0 ? Math.round(c.spend / c.visits) : 0;
                const isSel = selectedCustomer?.id === c.id;
                return (
                  <tr key={c.id} onClick={() => setSelectedCustomer(isSel ? null : c)}
                    style={{ borderBottom:'var(--hair)',cursor:'pointer',background:isSel?'var(--ink-100)':'transparent' }}
                    onMouseEnter={e => { if(!isSel)(e.currentTarget as HTMLElement).style.background='var(--ink-50)'; }}
                    onMouseLeave={e => { if(!isSel)(e.currentTarget as HTMLElement).style.background='transparent'; }}>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <span className={`avatar av-${avIdx(c.name)}`}>{initials(c.name)}</span>
                        <div>
                          <div style={{ fontSize:13,fontWeight:600,color:'var(--ink-900)' }}>{c.name}</div>
                          {c.email && <div style={{ fontSize:11,color:'var(--ink-500)' }}>{c.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--ink-700)' }}>{c.phone}</td>
                    <td style={{ padding:'11px 14px',textAlign:'center',fontWeight:600,color:'var(--ink-900)' }}>{c.visits}</td>
                    <td style={{ padding:'11px 14px',color:'var(--ink-600)',fontSize:12 }}>{fmtDate(c.lastVisit)}</td>
                    <td style={{ padding:'11px 14px',textAlign:'right',fontFamily:'var(--font-mono)',color:'var(--ink-700)' }}>{c.visits>0?`${avg}€`:'—'}</td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
                        {c.tags.length===0 ? <span style={{ fontSize:11,color:'var(--ink-400)' }}>—</span> : c.tags.map(t=><Tag key={t} kind={t}/>)}
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex',gap:4 }}>
                        {c.biz.map(bid => {
                          const b = BUSINESSES.find(x=>x.id===bid);
                          if (!b) return null;
                          return <span key={bid} title={b.name} style={{ width:22,height:22,borderRadius:6,background:b.hueSoft,color:b.hue,display:'grid',placeItems:'center',fontSize:9.5,fontWeight:700,fontFamily:'var(--font-serif)' }}>{b.monogram}</span>;
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedCustomer && <ClientDetailPanel cust={selectedCustomer} onClose={() => setSelectedCustomer(null)} />}
    </div>
  );
}

function ClientDetailPanel({ cust, onClose }: { cust: Customer; onClose: () => void }) {
  const avg = cust.visits > 0 ? Math.round(cust.spend / cust.visits) : 0;
  return (
    <aside style={{ width:360,flex:'none',borderLeft:'var(--hair)',background:'var(--cream)',display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'18px 18px 14px',borderBottom:'var(--hair)' }}>
        <div style={{ display:'flex',alignItems:'flex-start',gap:12,marginBottom:10 }}>
          <span className={`avatar lg av-${avIdx(cust.name)}`} style={{ width:52,height:52,fontSize:18 }}>{initials(cust.name)}</span>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontFamily:'var(--font-serif)',fontSize:19,fontWeight:500,color:'var(--ink-900)',lineHeight:1.2 }}>{cust.name}</div>
            <div style={{ fontFamily:'var(--font-mono)',fontSize:12,color:'var(--ink-600)',marginTop:3 }}>{cust.phone}</div>
            {cust.email && <div style={{ fontSize:12,color:'var(--ink-600)',marginTop:1 }}>{cust.email}</div>}
          </div>
          <button onClick={onClose} style={{ width:28,height:28,display:'grid',placeItems:'center',background:'transparent',border:'none',borderRadius:8,cursor:'pointer',color:'var(--ink-500)' }}>
            <Icon d={I.x} size={14} />
          </button>
        </div>
        {cust.tags.length > 0 && (
          <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
            {cust.tags.map(t => <Tag key={t} kind={t} />)}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderBottom:'var(--hair)' }}>
        <StatCell value={cust.visits}    label="Visites" />
        <StatCell value={`${avg}€`}      label="Ticket mitjà" divL />
        <StatCell value={fmtDate(cust.lastVisit).split(' ').slice(0,2).join(' ')} label="Última visita" divL small />
      </div>

      <div className="scroll" style={{ overflowY:'auto',flex:1,padding:'14px 18px' }}>
        {cust.notes && (
          <div style={{ marginBottom:16 }}>
            <Label>Notes del client</Label>
            <div style={{ background:'#fef6d6',borderRadius:8,padding:'10px 12px',fontSize:12.5,lineHeight:1.5,color:'#5a4a2a' }}>{cust.notes}</div>
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <Label>Historial de visites · {cust.visits}</Label>
          {[
            { date:'Avui · 24 abr', biz:'ganxo' as const, time:'14:00', pax:5, status:'pending', note:'Aniversari' },
            { date:'18 abr',        biz:'ganxo' as const, time:'21:00', pax:4, status:'completed' },
            { date:'3 abr',         biz:'esquitx' as const, time:'20:30', pax:2, status:'completed' },
            { date:'27 mar',        biz:'ganxo' as const, time:'14:00', pax:6, status:'completed' },
            { date:'10 mar',        biz:'ganxo' as const, time:'21:00', pax:2, status:'completed' },
          ].map((v,i) => {
            const b = BUSINESSES.find(x=>x.id===v.biz);
            return (
              <div key={i} style={{ display:'grid',gridTemplateColumns:'68px 1fr auto',alignItems:'center',gap:8,padding:'8px 0',borderTop:i>0?'var(--hair)':'none' }}>
                <span className="mono" style={{ fontSize:11,color:'var(--ink-600)' }}>{v.date}</span>
                <div style={{ display:'flex',alignItems:'center',gap:7,minWidth:0 }}>
                  {b && <span style={{ width:17,height:17,borderRadius:4,flex:'none',background:b.hueSoft,color:b.hue,display:'grid',placeItems:'center',fontSize:8,fontWeight:700,fontFamily:'var(--font-serif)' }}>{b.monogram}</span>}
                  <span style={{ fontSize:12.5,fontWeight:550,color:'var(--ink-800)' }}>{v.time} · {v.pax} pax</span>
                  {v.note && <span style={{ fontSize:11,color:'var(--ink-500)',fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>· {v.note}</span>}
                </div>
                <StatusChip state={v.status} size="sm" />
              </div>
            );
          })}
        </div>

        <div>
          <Label>Preferències</Label>
          <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
            <PrefRow icon="📍" text="Taula a la finestra" />
            <PrefRow icon="🍷" text="Vi negre · Priorat" />
            {cust.tags.includes('allergy') && <PrefRow icon="⚠️" text="Al·lèrgia al marisc cuit" warn />}
          </div>
        </div>
      </div>

      <div style={{ padding:14,borderTop:'var(--hair)',display:'flex',gap:6 }}>
        <button style={{ flex:1,padding:'7px 12px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)',display:'flex',alignItems:'center',gap:6,justifyContent:'center' }}>
          <Icon d={I.phone} size={13} /> Trucar
        </button>
        <button style={{ flex:1,padding:'7px 12px',background:'var(--ink-900)',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--cream)',display:'flex',alignItems:'center',gap:6,justifyContent:'center' }}>
          <Icon d={I.plus} size={13} /> Nova reserva
        </button>
      </div>
    </aside>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10.5,fontWeight:600,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>{children}</div>;
}
function StatCell({ value, label, divL, small }: { value: string|number; label: string; divL?: boolean; small?: boolean }) {
  return (
    <div style={{ padding:'14px 14px',borderLeft:divL?'var(--hair)':'none',textAlign:'center' }}>
      <div style={{ fontFamily:'var(--font-serif)',fontSize:small?15:22,fontWeight:500,color:'var(--ink-900)',lineHeight:1.1 }}>{value}</div>
      <div style={{ fontSize:10.5,fontWeight:600,color:'var(--ink-500)',letterSpacing:.04,textTransform:'uppercase',marginTop:2 }}>{label}</div>
    </div>
  );
}
function PrefRow({ icon, text, warn }: { icon:string; text:string; warn?:boolean }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,background:warn?'var(--rose-50)':'var(--ink-50)',color:warn?'var(--rose-700)':'var(--ink-700)',fontSize:12.5 }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  );
}
