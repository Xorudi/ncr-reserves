import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip } from '@/components/shared/StatusChip';
import { WAITLIST } from '@/data/mockData';
import type { FloorTable, Reservation } from '@/types';

// ─── Base Modal ──────────────────────────────────────────────
interface ModalProps {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  footer?: React.ReactNode; width?: number; children: React.ReactNode;
}
export function Modal({ open, onClose, title, subtitle, footer, width=520, children }: ModalProps) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(36,29,23,.45)',backdropFilter:'blur(3px)',zIndex:1000,display:'grid',placeItems:'center',padding:24 }} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:Math.min(width,window.innerWidth-48),background:'var(--paper)',borderRadius:16,boxShadow:'var(--sh-3)',display:'flex',flexDirection:'column',maxHeight:'90vh',overflow:'hidden' }}>
        <div style={{ padding:'20px 20px 14px',borderBottom:'var(--hair)',display:'flex',alignItems:'flex-start',gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15,fontFamily:'var(--font-serif)',fontWeight:500,color:'var(--ink-900)',lineHeight:1.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize:12.5,color:'var(--ink-600)',marginTop:3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width:28,height:28,display:'grid',placeItems:'center',background:'transparent',border:'none',borderRadius:8,cursor:'pointer',color:'var(--ink-500)',flexShrink:0 }}><Icon d={I.x} size={14} /></button>
        </div>
        <div className="scroll" style={{ overflowY:'auto',flex:1,padding:'18px 20px' }}>{children}</div>
        {footer && <div style={{ padding:'14px 20px',borderTop:'var(--hair)',display:'flex',gap:8,justifyContent:'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ─── Confirm Reservation ─────────────────────────────────────
export function ConfirmReservationModal({ open, res, onClose, onConfirm }: { open:boolean; res:Reservation|null; onClose:()=>void; onConfirm:()=>void }) {
  const [channel, setChannel] = useState('whatsapp');
  const [msg, setMsg] = useState(`Hola, confirmem la teva reserva per a avui ${res?.time||''} (${res?.pax||''} pax) a El Ganxo. Fins ara! 🍽️`);
  return (
    <Modal open={open} onClose={onClose} title="Confirmar reserva" subtitle={res?`${res.name} · ${res.pax} pax · ${res.time}`:''}
      footer={<>
        <button onClick={onClose} style={{ padding:'7px 14px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)' }}>Tornar</button>
        <button onClick={onConfirm} style={{ padding:'7px 16px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,display:'flex',alignItems:'center',gap:6 }}><Icon d={I.check} size={13}/> Confirmar</button>
      </>}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>Canal</div>
        <div style={{ display:'flex',gap:6 }}>
          {[['whatsapp','WhatsApp','#25D366'],['sms','SMS','var(--ink-700)'],['none','No avisar','var(--ink-500)']] .map(([k,label,color])=>(
            <button key={k} onClick={()=>setChannel(k)} style={{ flex:1,padding:'8px 10px',border:channel===k?`1.5px solid ${color}`:'1.5px solid rgba(60,40,20,.12)',background:channel===k?`${color}22`:'var(--paper)',color:channel===k?color:'var(--ink-700)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:600 }}>{label}</button>
          ))}
        </div>
      </div>
      {channel!=='none' && (
        <>
          <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>Missatge</div>
          <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={4}
            style={{ width:'100%',padding:'10px 12px',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,fontFamily:'inherit',fontSize:13,lineHeight:1.5,resize:'vertical',background:'var(--paper)',outline:'none' }} />
        </>
      )}
    </Modal>
  );
}

// ─── Cancel Reservation ──────────────────────────────────────
export function CancelReservationModal({ open, res, onClose, onConfirm }: { open:boolean; res:Reservation|null; onClose:()=>void; onConfirm:()=>void }) {
  const [reason, setReason] = useState('Petició del client');
  const [notify, setNotify] = useState(true);
  return (
    <Modal open={open} onClose={onClose} title="Cancel·lar reserva" subtitle={res?`${res.name} · ${res.pax} pax · ${res.time}`:''}
      footer={<>
        <button onClick={onClose} style={{ padding:'7px 14px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)' }}>Mantenir</button>
        <button onClick={onConfirm} style={{ padding:'7px 16px',background:'var(--rose-700)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550 }}>Cancel·lar reserva</button>
      </>}>
      <div style={{ padding:'10px 14px',background:'var(--rose-50)',color:'var(--rose-700)',borderRadius:8,fontSize:12.5,marginBottom:16,display:'flex',gap:10,alignItems:'flex-start' }}>
        <span>⚠</span><div>Aquesta acció és reversible des de l'historial durant 24h.</div>
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>Motiu</div>
        {['Petició del client','No es presenta (no-show)','Doble reserva',"Canvi d'horari",'Altre'].map(r=>(
          <label key={r} style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,background:reason===r?'var(--ink-100)':'transparent',cursor:'pointer',fontSize:13,marginBottom:2 }}>
            <input type="radio" checked={reason===r} onChange={()=>setReason(r)} /> {r}
          </label>
        ))}
      </div>
      <label style={{ display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--ink-700)',cursor:'pointer' }}>
        <input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)} /> Avisar el client per WhatsApp
      </label>
    </Modal>
  );
}

// ─── Block Table ─────────────────────────────────────────────
export function BlockTableModal({ open, table, onClose, onConfirm }: { open:boolean; table:FloorTable|null; onClose:()=>void; onConfirm:()=>void }) {
  const [reason, setReason] = useState('Avaria');
  const [duration, setDuration] = useState('Tot el dia');
  const [note, setNote] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Bloquejar taula" subtitle={table?`${table.id} · ${table.cap} pax · ${table.zone}`:''}
      footer={<>
        <button onClick={onClose} style={{ padding:'7px 14px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)' }}>Cancel·lar</button>
        <button onClick={onConfirm} style={{ padding:'7px 16px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550 }}>Bloquejar</button>
      </>}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>Motiu</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6 }}>
          {['Avaria','Reservada per esdeveniment','Neteja profunda','Pota coixa','Personal','Altre'].map(r=>(
            <button key={r} onClick={()=>setReason(r)} style={{ padding:'8px 10px',border:reason===r?'none':'1px solid rgba(60,40,20,.14)',background:reason===r?'var(--ink-900)':'var(--paper)',color:reason===r?'var(--cream)':'var(--ink-700)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:550,textAlign:'left' }}>{r}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>Durada</div>
        <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
          {['Servei migdia','Servei nit','Tot el dia','Aquesta setmana','Indefinit'].map(d=>(
            <button key={d} onClick={()=>setDuration(d)} style={{ padding:'6px 11px',borderRadius:999,border:duration===d?'none':'1px solid rgba(60,40,20,.14)',background:duration===d?'var(--terracotta-500)':'transparent',color:duration===d?'#fff':'var(--ink-700)',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600 }}>{d}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:6 }}>Nota (opcional)</div>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Detalls visibles per l'equip"
          style={{ width:'100%',padding:'9px 12px',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,fontFamily:'inherit',fontSize:13,background:'var(--paper)',outline:'none' }} />
      </div>
    </Modal>
  );
}

// ─── Waitlist ────────────────────────────────────────────────
export function WaitlistModal({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const [name, setName] = useState('');
  const [pax, setPax] = useState(2);
  const [phone, setPhone] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Llista d'espera" subtitle={`${WAITLIST.length} grups esperant ara`} width={580}
      footer={<button onClick={onClose} style={{ padding:'7px 14px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)' }}>Tancar</button>}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>Esperant ara</div>
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          {WAITLIST.map(w=>(
            <div key={w.id} style={{ display:'grid',gridTemplateColumns:'1fr auto auto',gap:10,alignItems:'center',padding:'10px 12px',background:'var(--paper)',borderRadius:10,border:'var(--hair)' }}>
              <div>
                <div style={{ fontSize:13.5,fontWeight:600,color:'var(--ink-900)' }}>{w.name} · {w.pax} pax</div>
                <div style={{ fontSize:11.5,color:'var(--ink-600)',marginTop:1 }}>des de {w.since} · <b style={{ color:w.wait>15?'var(--rose-700)':'var(--ink-800)' }}>{w.wait} min</b></div>
              </div>
              <button style={{ padding:'5px 10px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,color:'var(--ink-800)',display:'flex',alignItems:'center',gap:5 }}><Icon d={I.phone} size={12}/> Avisar</button>
              <button style={{ padding:'5px 10px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12.5,fontWeight:550 }}>Asseure</button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop:'var(--hair)',paddingTop:14 }}>
        <div style={{ fontSize:10.5,fontWeight:700,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>Afegir grup</div>
        <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1.5fr auto',gap:8 }}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom" style={{ padding:'8px 12px',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,fontFamily:'inherit',fontSize:13,background:'var(--paper)',outline:'none' }} />
          <input value={pax} type="number" onChange={e=>setPax(+e.target.value)} placeholder="Pax" style={{ padding:'8px 12px',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,fontFamily:'inherit',fontSize:13,background:'var(--paper)',outline:'none' }} />
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Telèfon (opcional)" style={{ padding:'8px 12px',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,fontFamily:'inherit',fontSize:13,background:'var(--paper)',outline:'none' }} />
          <button style={{ padding:'8px 14px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,display:'flex',alignItems:'center',gap:5 }}><Icon d={I.plus} size={13}/> Afegir</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Merge Tables ─────────────────────────────────────────────
export function MergeTablesModal({ open, primary, onClose, onConfirm }: { open:boolean; primary:FloorTable|null; onClose:()=>void; onConfirm:()=>void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const candidates = ['T6','T10'];
  if (!primary) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Unir ${primary.id} amb…`} subtitle="Tria taules veïnes per crear una taula virtual gran"
      footer={<>
        <button onClick={onClose} style={{ padding:'7px 14px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)' }}>Cancel·lar</button>
        <button onClick={onConfirm} disabled={picked.length===0} style={{ padding:'7px 16px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,opacity:picked.length===0?.5:1,display:'flex',alignItems:'center',gap:6 }}><Icon d={I.users} size={13}/> Unir taules</button>
      </>}>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12 }}>
        {candidates.map(t=>{
          const on = picked.includes(t);
          return (
            <button key={t} onClick={()=>setPicked(p=>on?p.filter(x=>x!==t):[...p,t])} style={{ padding:14,border:on?'2px solid var(--terracotta-500)':'1.5px dashed rgba(60,40,20,.16)',background:on?'var(--terracotta-50)':'var(--paper)',borderRadius:10,cursor:'pointer',textAlign:'left',fontFamily:'inherit' }}>
              <div style={{ fontFamily:'var(--font-mono)',fontSize:14,fontWeight:700,color:'var(--ink-900)' }}>{t}</div>
              <div style={{ fontSize:12,color:'var(--ink-600)',marginTop:2 }}>4 pax · veïna directa</div>
            </button>
          );
        })}
      </div>
      {picked.length>0 && (
        <div style={{ padding:'10px 14px',background:'var(--olive-100)',color:'var(--olive-700)',borderRadius:8,fontSize:13,fontWeight:550 }}>
          ✓ La taula virtual <b>{primary.id}+{picked.join('+')}</b> tindrà capacitat per a {primary.cap+picked.length*4} comensals
        </div>
      )}
    </Modal>
  );
}
