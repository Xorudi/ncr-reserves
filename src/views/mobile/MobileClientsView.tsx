import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { Tag } from '@/components/shared/StatusChip';
import { initials, avIdx, isoDate } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { Customer, BusinessId, ReservationStatus } from '@/types';

const ALL_TAGS = ['vip','regular','allergy','birthday','conflictiu','terrassa'] as const;
const TAG_LABEL: Record<string, string> = {
  vip:'VIP', regular:'Habitual', allergy:'Al·lèrgia',
  birthday:'Aniversari', conflictiu:'Conflictiu', terrassa:'Terrassa',
};

// ─── Main view ────────────────────────────────────────────────────────────────
export default function MobileClientsView() {
  const { selectedBusiness, customers } = useAppStore();
  const [query,    setQuery]    = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [showNew,  setShowNew]  = useState(false);

  const filtered = useMemo(() =>
    customers
      .filter(c => {
        if (!c.biz.includes(selectedBusiness as BusinessId)) return false;
        if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.phone.includes(query)) return false;
        return true;
      })
      .sort((a, b) => b.visits - a.visits),
    [customers, selectedBusiness, query],
  );

  const detailClient = customers.find(c => c.id === detailId) ?? null;
  const editClient   = editId ? customers.find(c => c.id === editId) ?? null : null;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding:'10px 14px 8px', borderBottom:'var(--hair)', background:'var(--paper)', flexShrink:0 }}>
        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:'11px 12px 11px 38px', borderRadius:12, background:'rgba(60,40,20,.06)' }}>
            <div style={{ position:'absolute', left:14, pointerEvents:'none', display:'flex', color:'var(--ink-400)' }}><Icon d={I.search} size={16} /></div>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Cercar per nom o telèfon"
              style={{ flex:1, border:'none', outline:'none', background:'transparent', fontFamily:'inherit', fontSize:14, color:'var(--ink-900)' }} />
            {query && (
              <button onClick={() => setQuery('')} style={{ background:'transparent', border:'none', cursor:'pointer', padding:0, color:'var(--ink-400)', display:'grid', placeItems:'center' }}>
                <Icon d={I.x} size={13} />
              </button>
            )}
          </div>
          <button onClick={() => setShowNew(true)}
            style={{ width:40, height:40, borderRadius:12, border:'none', background:'var(--terracotta-600)', color:'white', cursor:'pointer', display:'grid', placeItems:'center', flexShrink:0 }}>
            <Icon d={I.plus} size={18} stroke={2.2} />
          </button>
        </div>
        {/* Filter chips */}
        <div style={{ display:'flex', gap:6, marginTop:8, overflowX:'auto', paddingBottom:2 }}>
          {['Tots','VIP','Habituals','Al·lèrgies','Aniversaris'].map((f, i) => (
            <button key={f} style={{
              padding:'5px 12px', borderRadius:999, whiteSpace:'nowrap', fontFamily:'inherit',
              border: i === 0 ? 'none' : '1px solid rgba(60,40,20,.14)',
              background: i === 0 ? 'var(--ink-900)' : 'var(--paper)',
              color: i === 0 ? 'var(--cream)' : 'var(--ink-500)',
              fontSize:12, fontWeight:600, cursor:'pointer',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <div className="scroll" style={{ flex:1, overflowY:'auto', paddingBottom:'var(--scroll-pad-bottom)' }}>
        {filtered.map(c => (
          <ClientRow key={c.id} client={c} onTap={() => setDetailId(c.id)} />
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 16px', color:'var(--ink-500)' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>👤</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:15 }}>Cap client trobat</div>
          </div>
        )}
      </div>

      {/* ── Detail sheet ───────────────────────────────────────────────── */}
      {detailClient && !editId && !showNew && (
        <ClientDetailSheet
          client={detailClient}
          bizId={selectedBusiness}
          onClose={() => setDetailId(null)}
          onEdit={() => setEditId(detailClient.id)}
          onDeleted={() => setDetailId(null)}
        />
      )}

      {/* ── Edit sheet ─────────────────────────────────────────────────── */}
      {editId && editClient && (
        <ClientFormSheet
          client={editClient}
          bizId={selectedBusiness}
          onClose={() => setEditId(null)}
          onSaved={() => setEditId(null)}
        />
      )}

      {/* ── New client sheet ───────────────────────────────────────────── */}
      {showNew && (
        <ClientFormSheet
          client={null}
          bizId={selectedBusiness}
          onClose={() => setShowNew(false)}
          onSaved={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

// ─── Client row ───────────────────────────────────────────────────────────────
function ClientRow({ client: c, onTap }: { client: Customer; onTap: () => void }) {
  return (
    <button onClick={onTap}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 18px', borderBottom:'var(--hair)', background:'var(--paper)', border:'none', width:'100%', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
      {/* Avatar — Fraunces serif initials circle */}
      <div style={{
        width:42, height:42, borderRadius:999, flexShrink:0,
        background:'var(--cream)', display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--font-serif)', fontSize:15, fontWeight:500, color:'var(--ink-800)',
      }}>
        {initials(c.name)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
          <span style={{ fontSize:14.5, fontWeight:600, color:'var(--ink-900)' }}>{c.name}</span>
          {c.tags.includes('vip') && (
            <span style={{ fontSize:9.5, padding:'2px 5px', borderRadius:4, background:'#2a2119', color:'#f3dca6', fontWeight:700, letterSpacing:.3 }}>VIP</span>
          )}
          {c.tags.includes('allergy') && (
            <span style={{ fontSize:9.5, padding:'2px 5px', borderRadius:4, background:'var(--rose-100)', color:'var(--rose-700)', fontWeight:700, letterSpacing:.3 }}>AL·LÈRGIA</span>
          )}
        </div>
        <div style={{ fontSize:12, color:'var(--ink-400)', marginTop:2, fontFamily:'var(--font-mono)' }}>{c.phone}</div>
        <div style={{ fontSize:11, color:'var(--ink-500)', marginTop:1 }}>{c.visits} visites{c.spend ? ` · ${c.spend}€` : ''}</div>
      </div>
      <Icon d={I.chevR} size={14} />
    </button>
  );
}

// ─── Client detail sheet ──────────────────────────────────────────────────────
function ClientDetailSheet({ client: c, bizId, onClose, onEdit, onDeleted }: {
  client: Customer; bizId: BusinessId;
  onClose: () => void; onEdit: () => void; onDeleted: () => void;
}) {
  const { deleteCustomer, reservations, addReservation } = useAppStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fuzzy match: reservations that share the client's first name in the same biz
  const history = useMemo(() =>
    reservations
      .filter(r => r.bizId === bizId && r.name.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    [reservations, bizId, c.name],
  );

  function handleDelete() {
    deleteCustomer(c.id);
    onDeleted();
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,.35)' }} />
      <div style={{
        position:'fixed', bottom:'calc(var(--mobile-nav-h) + env(safe-area-inset-bottom))',
        left:0, right:0, zIndex:100,
        background:'var(--paper)', borderRadius:'20px 20px 0 0',
        boxShadow:'0 -4px 28px rgba(0,0,0,.2)',
        maxHeight:'82vh', overflowY:'auto',
        paddingBottom:24,
      }}>
        <div style={{ padding:'14px 18px 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 14px' }} />

          {/* Header */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
            <span className={`avatar av-${avIdx(c.name)}`} style={{ width:48, height:48, fontSize:15, flexShrink:0 }}>
              {initials(c.name)}
            </span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:17, fontWeight:700, color:'var(--ink-900)' }}>{c.name}</div>
              <div style={{ fontSize:12, color:'var(--ink-500)', marginTop:2 }}>
                {c.visits} visites{c.lastVisit ? ` · última ${c.lastVisit}` : ''}
              </div>
              {c.tags.length > 0 && (
                <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                  {c.tags.map(t => <Tag key={t} kind={t} />)}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', padding:4, flexShrink:0 }}>
              <Icon d={I.x} size={18} />
            </button>
          </div>

          {/* Contact info */}
          {(c.phone || c.email) && (
            <div style={{ background:'var(--cream)', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
              {c.phone && (
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--ink-800)', marginBottom: c.email ? 6 : 0 }}>
                  <Icon d={I.phone} size={13} /> {c.phone}
                </div>
              )}
              {c.email && (
                <div style={{ fontSize:12.5, color:'var(--ink-600)' }}>{c.email}</div>
              )}
            </div>
          )}

          {/* Notes */}
          {c.notes && (
            <div style={{ background:'rgba(250,230,120,.18)', borderRadius:9, padding:'8px 12px', fontSize:13, color:'#5a4a1a', marginBottom:12, border:'1px solid rgba(200,170,50,.22)' }}>
              {c.notes}
            </div>
          )}

          {/* Reservation history */}
          {history.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, textTransform:'uppercase', marginBottom:7 }}>
                Últimes reserves
              </div>
              {history.map(r => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, background:'var(--cream)', border:'var(--hair)', fontSize:12, marginBottom:4 }}>
                  <span className="mono" style={{ color:'var(--ink-600)', flexShrink:0 }}>{r.date}</span>
                  <span style={{ color:'var(--ink-700)', flex:1 }}>{r.time} · {r.pax}p</span>
                  <span style={{ fontSize:11, color:'var(--ink-500)' }}>{r.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {c.phone && (
              <a href={`tel:${c.phone}`}
                style={{ flex:1, padding:'11px 0', textAlign:'center', background:'var(--ink-100)', borderRadius:11, textDecoration:'none', fontSize:13, fontWeight:600, color:'var(--ink-800)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Icon d={I.phone} size={14} /> Trucar
              </a>
            )}
            <button onClick={onEdit}
              style={{ flex:1, padding:'11px 0', background:'var(--cream)', border:'1.5px solid rgba(60,40,20,.15)', borderRadius:11, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'var(--ink-800)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon d={I.pencil} size={14} /> Editar
            </button>
          </div>

          {/* Quick new reservation */}
          <QuickResRow client={c} bizId={bizId} addReservation={addReservation} />

          {/* Delete */}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              style={{ marginTop:10, width:'100%', padding:'10px 0', borderRadius:10, border:'1px solid rgba(180,50,50,.25)', background:'transparent', color:'var(--rose-600)', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              🗑 Eliminar client
            </button>
          ) : (
            <div style={{ marginTop:10, padding:'12px 14px', borderRadius:11, background:'var(--rose-50)', border:'1px solid rgba(180,50,50,.2)' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--rose-700)', marginBottom:10 }}>
                Segur que vols eliminar {c.name}?
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setConfirmDelete(false)}
                  style={{ flex:1, padding:'9px 0', borderRadius:9, border:'var(--hair)', background:'var(--cream)', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'var(--ink-700)', cursor:'pointer' }}>
                  Cancel·lar
                </button>
                <button onClick={handleDelete}
                  style={{ flex:1, padding:'9px 0', borderRadius:9, border:'none', background:'var(--rose-600)', color:'white', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Quick new-reservation row ────────────────────────────────────────────────
function QuickResRow({ client: c, bizId, addReservation }: {
  client: Customer; bizId: BusinessId;
  addReservation: (r: Omit<import('@/types').Reservation, 'id'>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(isoDate(new Date()));
  const [time, setTime] = useState('13:00');
  const [pax,  setPax]  = useState(2);
  const [done, setDone] = useState(false);

  function save() {
    addReservation({
      bizId, date, time,
      name:   c.name,
      pax,
      status: 'confirmed' as ReservationStatus,
      phone:  c.phone || undefined,
      source: 'directe',
    });
    setDone(true);
    setTimeout(() => { setDone(false); setOpen(false); }, 1400);
  }

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        style={{ width:'100%', padding:'11px 0', borderRadius:11, border:'1.5px solid var(--terracotta-500)', background: open ? 'var(--terracotta-50)' : 'transparent', color:'var(--terracotta-600)', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
        <Icon d={I.plus} size={15} stroke={2.2} />
        Nova reserva per a {c.name.split(' ')[0]}
      </button>
      {open && !done && (
        <div style={{ marginTop:8, padding:'12px', background:'var(--cream)', borderRadius:11, border:'var(--hair)', display:'flex', flexDirection:'column', gap:9 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-400)', letterSpacing:.06, marginBottom:4 }}>DATA</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width:'100%', padding:'8px', borderRadius:8, border:'1.5px solid rgba(60,40,20,.15)', fontFamily:'inherit', fontSize:12, background:'white', outline:'none' }} />
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-400)', letterSpacing:.06, marginBottom:4 }}>HORA</div>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                style={{ width:'100%', padding:'8px', borderRadius:8, border:'1.5px solid rgba(60,40,20,.15)', fontFamily:'inherit', fontSize:12, background:'white', outline:'none' }} />
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-400)', letterSpacing:.06, marginBottom:4 }}>PAX</div>
              <input type="number" min={1} max={30} value={pax}
                onChange={e => setPax(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width:'100%', padding:'8px', borderRadius:8, border:'1.5px solid rgba(60,40,20,.15)', fontFamily:'inherit', fontSize:12, background:'white', outline:'none' }} />
            </div>
          </div>
          <button onClick={save}
            style={{ padding:'10px', borderRadius:10, border:'none', background:'var(--terracotta-600)', color:'white', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            Crear reserva
          </button>
        </div>
      )}
      {done && (
        <div style={{ marginTop:6, padding:'10px', borderRadius:10, background:'rgba(46,112,64,.1)', fontSize:13, fontWeight:600, color:'#2e7040', textAlign:'center' }}>
          ✓ Reserva creada!
        </div>
      )}
    </div>
  );
}

// ─── Client form sheet (new + edit) ──────────────────────────────────────────
function ClientFormSheet({ client, bizId, onClose, onSaved }: {
  client: Customer | null; bizId: BusinessId; onClose: () => void; onSaved: () => void;
}) {
  const { addCustomer, updateCustomer } = useAppStore();
  const isNew = client === null;

  const [form, setForm] = useState<Omit<Customer, 'id'>>({
    name:      client?.name      ?? '',
    phone:     client?.phone     ?? '',
    email:     client?.email     ?? '',
    notes:     client?.notes     ?? '',
    tags:      client?.tags      ?? [],
    visits:    client?.visits    ?? 0,
    lastVisit: client?.lastVisit ?? '',
    spend:     client?.spend     ?? 0,
    biz:       client?.biz       ?? [bizId],
  });
  const [touched, setTouched] = useState(false);

  function upd<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function toggleTag(t: string) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
    }));
  }

  function save() {
    setTouched(true);
    if (!form.name.trim()) return;
    if (isNew) {
      addCustomer(form);
    } else {
      updateCustomer(client!.id, form);
    }
    onSaved();
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'11px 12px', border:'1.5px solid rgba(60,40,20,.15)',
    borderRadius:10, fontFamily:'inherit', fontSize:15, color:'var(--ink-900)',
    background:'var(--cream)', outline:'none',
  };
  const lbl: React.CSSProperties = {
    fontSize:11, fontWeight:700, color:'var(--ink-500)',
    textTransform:'uppercase', letterSpacing:.07, marginBottom:5, display:'block',
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:190, background:'rgba(0,0,0,.4)' }} />
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:200,
        background:'var(--paper)', borderRadius:'20px 20px 0 0',
        boxShadow:'0 -4px 32px rgba(0,0,0,.2)',
        maxHeight:'92vh', overflowY:'auto',
        paddingBottom:'max(env(safe-area-inset-bottom), 20px)',
      }}>
        <div style={{ padding:'14px 18px 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 14px' }} />
          <div style={{ display:'flex', alignItems:'center', marginBottom:18 }}>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:19, fontWeight:500, color:'var(--ink-900)', flex:1 }}>
              {isNew ? 'Nou client' : `Editar ${client!.name.split(' ')[0]}`}
            </div>
            <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', padding:6 }}>
              <Icon d={I.x} size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding:'0 18px 20px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Name */}
          <div>
            <label style={lbl}>Nom complet *</label>
            <input type="text" placeholder="Nom del client" value={form.name}
              onChange={e => upd('name', e.target.value)}
              style={{ ...inp, borderColor: touched && !form.name.trim() ? 'var(--terracotta-500)' : undefined }} />
            {touched && !form.name.trim() && (
              <div style={{ fontSize:11, color:'var(--terracotta-600)', marginTop:3 }}>El nom és obligatori</div>
            )}
          </div>

          {/* Phone + Email */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Telèfon</label>
              <input type="tel" placeholder="+34 600…" value={form.phone}
                onChange={e => upd('phone', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" placeholder="email@…" value={form.email}
                onChange={e => upd('email', e.target.value)} style={inp} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={lbl}>Etiquetes</label>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
              {ALL_TAGS.map(t => {
                const active = form.tags.includes(t);
                return (
                  <button key={t} onClick={() => toggleTag(t)}
                    style={{
                      padding:'6px 12px', borderRadius:8,
                      border: active ? '2px solid var(--terracotta-600)' : '1.5px solid rgba(60,40,20,.15)',
                      background: active ? 'var(--terracotta-50)' : 'var(--cream)',
                      color: active ? 'var(--terracotta-700)' : 'var(--ink-600)',
                      fontWeight: active ? 700 : 500, fontSize:12.5,
                      cursor:'pointer', fontFamily:'inherit',
                    }}>
                    {TAG_LABEL[t] ?? t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Notes (al·lèrgies, preferències…)</label>
            <textarea rows={3}
              placeholder="Exemple: al·lèrgia al gluten, prefereix terrassa, aniversari el 14/03…"
              value={form.notes} onChange={e => upd('notes', e.target.value)}
              style={{ ...inp, resize:'none', lineHeight:1.5 }} />
          </div>

          <button onClick={save}
            style={{ padding:'14px', borderRadius:12, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:15, fontWeight:700, color:'white', background:'var(--terracotta-600)' }}>
            {isNew ? 'Afegir client' : 'Desar canvis'}
          </button>
        </div>
      </div>
    </>
  );
}
