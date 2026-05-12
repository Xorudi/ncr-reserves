import React, { useState, useMemo, useEffect } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip, Tag } from '@/components/shared/StatusChip';
import { BUSINESSES, initials, avIdx } from '@/data/mockData';
import { Modal } from '@/components/desktop/Modals';
import { useAppStore } from '@/store/useAppStore';
import type { Customer, BusinessId } from '@/types';
import { rankCustomers, computeCustomerStats, type CustomerStats, type Level } from '@/utils/loyalty';

function fmtDate(iso: string) {
  const [y,m,d] = iso.split('-');
  const mon = ['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'][Number(m)-1];
  return `${Number(d)} ${mon} ${y.slice(2)}`;
}

export default function ClientsView() {
  const { selectedBusiness, customers, addCustomer, reservations } = useAppStore();
  const [query, setQuery]   = useState('');
  // Persist filter across sessions — same UX rationale as the mobile view.
  const [filter, setFilter] = useState<string>(() => {
    try { return sessionStorage.getItem('ncr.clientsFilter.desktop') ?? 'all'; }
    catch { return 'all'; }
  });
  useEffect(() => {
    try { sessionStorage.setItem('ncr.clientsFilter.desktop', filter); } catch { /* ignore */ }
  }, [filter]);
  const [showNewClient, setShowNewClient] = useState(false);
  const { selectedCustomer, setSelectedCustomer } = useAppStore();

  // Compute the full ranking for the current business once; rank field is stable
  // across filters so the user always sees a client's global position.
  const ranked = useMemo(
    () => rankCustomers(customers, reservations, selectedBusiness as BusinessId),
    [customers, reservations, selectedBusiness],
  );
  const rankMap = useMemo(() => {
    const m = new Map<string, { stats: CustomerStats; rank: number }>();
    for (const r of ranked) m.set(r.customer.id, { stats: r.stats, rank: r.rank });
    return m;
  }, [ranked]);

  const filtered = useMemo(() => {
    const base = customers.filter(c => {
      if (!c.biz.includes(selectedBusiness as any)) return false;
      if (filter === 'vip'     && !c.tags.includes('vip'))     return false;
      if (filter === 'regular' && !c.tags.includes('regular')) return false;
      if (filter === 'new'     && c.visits > 1)                 return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.phone.includes(query)) return false;
      return true;
    });
    if (filter === 'ranking') {
      return base.sort((a, b) => (rankMap.get(a.id)?.rank ?? 9999) - (rankMap.get(b.id)?.rank ?? 9999));
    }
    return base.sort((a, b) => b.visits - a.visits);
  }, [selectedBusiness, query, filter, customers, rankMap]);

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
            {([['all','Tots'],['ranking','🏆 Ranking'],['regular','Habituals'],['vip','VIP'],['new','Nous']] as const).map(([k,label]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding:'6px 12px',borderRadius:999,border:filter===k?'none':'1px solid rgba(60,40,20,.14)',background:filter===k?'var(--ink-900)':'transparent',color:filter===k?'var(--cream)':'var(--ink-700)',fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer' }}>{label}</button>
            ))}
          </div>
          <div style={{ flex:1 }} />
          <span style={{ fontSize:12,color:'var(--ink-500)' }}>{filtered.length} clients</span>
          <button onClick={() => setShowNewClient(true)}
            style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 12px',fontSize:12.5,fontWeight:550,background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit' }}>
            <Icon d={I.plus} size={13} /> Nou client
          </button>
        </div>

        {/* Table */}
        <div className="scroll" style={{ overflowY:'auto',flex:1 }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--ink-50)',borderBottom:'var(--hair)' }}>
                {[['#','center',46],['Client','',260],['Nivell','',140],['Telèfon','',150],['Visites','center',80],['Última','',120],['Ticket','right',110],['Etiquetes','',150],['Negocis','',120]] .map(([h,a,w],i) => (
                  <th key={i} style={{ textAlign:(a||'left') as any,padding:'9px 14px',fontSize:10.5,fontWeight:700,letterSpacing:.08,textTransform:'uppercase',color:'var(--ink-500)',width:Number(w) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const avg = c.visits > 0 ? Math.round(c.spend / c.visits) : 0;
                const isSel = selectedCustomer?.id === c.id;
                const entry = rankMap.get(c.id);
                const isPodium = entry && entry.rank <= 3;
                const podiumIcon = entry?.rank === 1 ? '🥇' : entry?.rank === 2 ? '🥈' : entry?.rank === 3 ? '🥉' : null;
                return (
                  <tr key={c.id} onClick={() => setSelectedCustomer(isSel ? null : c)}
                    style={{ borderBottom:'var(--hair)',cursor:'pointer',background:isSel?'var(--ink-100)':'transparent' }}
                    onMouseEnter={e => { if(!isSel)(e.currentTarget as HTMLElement).style.background='var(--ink-50)'; }}
                    onMouseLeave={e => { if(!isSel)(e.currentTarget as HTMLElement).style.background='transparent'; }}>
                    <td style={{ padding:'11px 14px',textAlign:'center',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,color: isPodium ? 'var(--ink-900)' : 'var(--ink-500)' }}>
                      {podiumIcon ?? entry?.rank ?? '—'}
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <span className={`avatar av-${avIdx(c.name)}`}>{initials(c.name)}</span>
                        <div>
                          <div style={{ fontSize:13,fontWeight:600,color:'var(--ink-900)' }}>{c.name}</div>
                          {c.email && <div style={{ fontSize:11,color:'var(--ink-500)' }}>{c.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      {entry && <LevelPill level={entry.stats.level} points={entry.stats.points} />}
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

      {/* New client modal */}
      <NewClientModal
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        onSave={(data) => {
          addCustomer({
            ...data,
            visits: 0,
            spend: 0,
            lastVisit: new Date().toISOString().slice(0, 10),
          });
          setShowNewClient(false);
        }}
      />
    </div>
  );
}

function LevelPill({ level, points }: { level: Level; points: number }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 9px', borderRadius:999,
      background: level.bg, color: level.color,
      fontSize:11, fontWeight:700,
      border:`1px solid ${level.color}33`,
    }}>
      <span>{level.icon}</span>
      <span>{level.name}</span>
      <span style={{ opacity:.7, fontWeight:600 }}>· {points} pt</span>
    </span>
  );
}

function ClientDetailPanel({ cust, onClose }: { cust: Customer; onClose: () => void }) {
  const avg = cust.visits > 0 ? Math.round(cust.spend / cust.visits) : 0;
  const { reservations } = useAppStore();
  const stats = useMemo(() => computeCustomerStats(cust, reservations), [cust, reservations]);
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
        {/* ── Fidelitat ──────────────────────────────────────── */}
        <div style={{ marginBottom:18, padding:'14px', borderRadius:12, background:stats.level.bg + '55', border:`1px solid ${stats.level.color}22` }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:22 }}>{stats.level.icon}</span>
              <div>
                <div style={{ fontFamily:'var(--font-serif)',fontSize:16,fontWeight:600,color:stats.level.color,lineHeight:1.1 }}>{stats.level.name}</div>
                <div style={{ fontSize:11,color:'var(--ink-500)',marginTop:2 }}>{stats.points} punts · {stats.completed} visites</div>
              </div>
            </div>
            {stats.nextLevel && (
              <div style={{ textAlign:'right',fontSize:11,color:'var(--ink-600)' }}>
                <div style={{ fontWeight:600 }}>{stats.nextLevel.min - Math.max(0,stats.points)} pt</div>
                <div style={{ opacity:.7 }}>fins {stats.nextLevel.name}</div>
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ height:6,borderRadius:3,background:'rgba(255,255,255,.6)',overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${stats.progressPct}%`,background:stats.level.color,transition:'width 320ms ease' }} />
          </div>
          {/* Badges */}
          <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginTop:12 }}>
            {stats.badges.map(b => (
              <span key={b.id} title={b.description}
                style={{
                  display:'inline-flex',alignItems:'center',gap:4,
                  padding:'4px 9px',borderRadius:999,
                  background: b.earned ? 'var(--paper)' : 'transparent',
                  color: b.earned ? 'var(--ink-800)' : 'var(--ink-400)',
                  border:'1px solid rgba(60,40,20,.12)',
                  fontSize:11, fontWeight:600,
                  opacity: b.earned ? 1 : .55,
                  filter: b.earned ? 'none' : 'grayscale(1)',
                }}>
                <span>{b.icon}</span><span>{b.label}</span>
              </span>
            ))}
          </div>
        </div>

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

// ─── New Client Modal ─────────────────────────────────────────
interface NewClientData {
  name: string; phone: string; email: string;
  biz: BusinessId[]; tags: string[]; notes: string;
}
function NewClientModal({ open, onClose, onSave }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: NewClientData) => void;
}) {
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [biz,   setBiz]   = useState<BusinessId[]>([]);
  const [tags,  setTags]  = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string,string>>({});

  function toggleBiz(id: BusinessId) {
    setBiz(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  function toggleTag(t: string) {
    setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }
  function handleSave() {
    const errs: Record<string,string> = {};
    if (!name.trim())  errs.name  = 'El nom és obligatori';
    if (!phone.trim()) {
      errs.phone = 'El telèfon és obligatori';
    } else {
      const digits = phone.replace(/[^\d]/g, '');
      if (digits.length < 9)       errs.phone = 'Telèfon massa curt';
      else if (digits.length > 15) errs.phone = 'Telèfon massa llarg';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Email no vàlid';
    }
    if (biz.length === 0) errs.biz = 'Selecciona almenys un negoci';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSave({ name: name.trim(), phone: phone.trim(), email: email.trim(), biz, tags, notes: notes.trim() });
    // Reset
    setName(''); setPhone(''); setEmail(''); setBiz([]); setTags([]); setNotes(''); setErrors({});
  }
  function handleClose() {
    setName(''); setPhone(''); setEmail(''); setBiz([]); setTags([]); setNotes(''); setErrors({});
    onClose();
  }

  const inputStyle = (err?: string): React.CSSProperties => ({
    width: '100%', padding: '9px 12px',
    border: `1px solid ${err ? 'var(--rose-500)' : 'rgba(60,40,20,.14)'}`,
    borderRadius: 8, fontFamily: 'inherit', fontSize: 13,
    background: 'var(--paper)', outline: 'none', color: 'var(--ink-900)',
    boxSizing: 'border-box',
  });

  return (
    <Modal open={open} onClose={handleClose} title="Nou client" width={500}
      footer={<>
        <button onClick={handleClose}
          style={{ padding:'7px 14px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)' }}>
          Cancel·lar
        </button>
        <button onClick={handleSave}
          style={{ padding:'7px 16px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,display:'flex',alignItems:'center',gap:6 }}>
          <Icon d={I.check} size={13} /> Crear client
        </button>
      </>}>

      {/* Nom */}
      <div style={{ marginBottom:14 }}>
        <FieldLabel required>Nom complet</FieldLabel>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Ex: Maria Puig Solà"
          style={inputStyle(errors.name)} />
        {errors.name && <ErrMsg>{errors.name}</ErrMsg>}
      </div>

      {/* Telèfon + Email */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14 }}>
        <div>
          <FieldLabel required>Telèfon</FieldLabel>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="612 345 678" type="tel"
            style={{ ...inputStyle(errors.phone), fontFamily:'var(--font-mono)' }} />
          {errors.phone && <ErrMsg>{errors.phone}</ErrMsg>}
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="correu@exemple.com" type="email"
            style={inputStyle(errors.email)} />
          {errors.email && <ErrMsg>{errors.email}</ErrMsg>}
        </div>
      </div>

      {/* Negocis */}
      <div style={{ marginBottom:14 }}>
        <FieldLabel required>Negoci(s)</FieldLabel>
        <div style={{ display:'flex',gap:8 }}>
          {BUSINESSES.map(b => {
            const on = biz.includes(b.id as BusinessId);
            return (
              <button key={b.id} onClick={() => toggleBiz(b.id as BusinessId)}
                style={{ flex:1,display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:10,border:on?`2px solid ${b.hue}`:'1.5px solid rgba(60,40,20,.14)',background:on?b.hueSoft:'var(--paper)',cursor:'pointer',fontFamily:'inherit',textAlign:'left' }}>
                <span style={{ width:24,height:24,borderRadius:6,background:b.hueSoft,color:b.hue,display:'grid',placeItems:'center',fontSize:10,fontWeight:700,fontFamily:'var(--font-serif)',flexShrink:0 }}>{b.monogram}</span>
                <span style={{ fontSize:12.5,fontWeight:on?600:500,color:on?'var(--ink-900)':'var(--ink-700)' }}>{b.name}</span>
              </button>
            );
          })}
        </div>
        {errors.biz && <ErrMsg>{errors.biz}</ErrMsg>}
      </div>

      {/* Etiquetes */}
      <div style={{ marginBottom:14 }}>
        <FieldLabel>Etiquetes</FieldLabel>
        <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
          {[
            { id:'vip',      label:'⭐ VIP' },
            { id:'regular',  label:'🔁 Habitual' },
            { id:'birthday', label:'🎂 Aniversari' },
            { id:'allergy',  label:'⚠️ Al·lèrgia' },
          ].map(t => {
            const on = tags.includes(t.id);
            return (
              <button key={t.id} onClick={() => toggleTag(t.id)}
                style={{ padding:'6px 12px',borderRadius:999,border:on?'none':'1px solid rgba(60,40,20,.14)',background:on?'var(--ink-900)':'transparent',color:on?'var(--cream)':'var(--ink-700)',cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:600 }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <FieldLabel>Notes internes</FieldLabel>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Al·lèrgies, preferències de taula, altres observacions…"
          rows={3}
          style={{ ...inputStyle(), resize:'vertical', lineHeight:1.5 }} />
      </div>
    </Modal>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:6 }}>
      {children}{required && <span style={{ color:'var(--terracotta-600)',marginLeft:3 }}>*</span>}
    </div>
  );
}
function ErrMsg({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:11,color:'var(--rose-600)',marginTop:4 }}>{children}</div>;
}
