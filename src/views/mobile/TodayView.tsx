import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip } from '@/components/shared/StatusChip';
import { initials, avIdx, isoDate, BUSINESSES } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { Reservation, BusinessId, ReservationStatus } from '@/types';

const DAYS_CA   = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
const MONTHS_CA = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];

function parseH(t: string) { return parseInt(t.split(':')[0], 10); }

// ─── Main view ────────────────────────────────────────────────────────────────
export default function MobileTodayView() {
  const {
    selectedBusiness, reservations, selectedDate,
    addReservation, businessConfigs,
  } = useAppStore();

  const [sel, setSel]         = useState<Reservation | null>(null);
  const [showNew, setShowNew] = useState(false);

  const dateStr  = isoDate(selectedDate);
  const d        = selectedDate;
  const dayLabel = `${DAYS_CA[d.getDay()]}, ${d.getDate()} ${MONTHS_CA[d.getMonth()]}`;

  const dayRes = useMemo(() =>
    reservations
      .filter(r => r.bizId === selectedBusiness && r.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time)),
    [reservations, selectedBusiness, dateStr]
  );

  const migdia = dayRes.filter(r => parseH(r.time) < 18);
  const nit    = dayRes.filter(r => parseH(r.time) >= 18);

  const totalRes = dayRes.length;
  const totalPax = dayRes.reduce((s, r) => s + r.pax, 0);
  const cap      = businessConfigs[selectedBusiness]?.capacity
                ?? BUSINESSES.find(b => b.id === selectedBusiness)?.capacity ?? 80;
  const occ      = cap > 0 ? Math.min(100, Math.round(totalPax / cap * 100)) : 0;
  const pending  = dayRes.filter(r => r.status === 'pending');

  function handleSelect(r: Reservation) {
    setSel(prev => prev?.id === r.id ? null : r);
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

      {/* ── KPI header ─────────────────────────────────────────────── */}
      <div style={{ flexShrink:0, background:'var(--paper)', borderBottom:'var(--hair)', padding:'14px 16px 12px' }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-500)', letterSpacing:.04, marginBottom:12 }}>
          {dayLabel}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr auto 1fr', alignItems:'center' }}>
          <KpiBlock value={totalRes}  label="reserves" />
          <KpiDiv />
          <KpiBlock value={totalPax}  label="pax" />
          <KpiDiv />
          <KpiBlock value={`${occ}%`} label="ocupació" accent={occ >= 80} />
        </div>

        {pending.length > 0 && (
          <div style={{ marginTop:10, padding:'7px 11px', background:'rgba(185,90,30,.1)', borderRadius:8, fontSize:12, color:'var(--clay-700)', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
            <span>⚠️</span>
            <span>{pending.length} {pending.length === 1 ? 'reserva pendent' : 'reserves pendents'} de confirmar</span>
          </div>
        )}
      </div>

      {/* ── Reservation list ───────────────────────────────────────── */}
      <div className="scroll" style={{ flex:1, overflowY:'auto', paddingBottom:'var(--scroll-pad-bottom)' }}>

        {dayRes.length === 0 && (
          <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--ink-500)' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:17, color:'var(--ink-700)' }}>Cap reserva per avui</div>
            <div style={{ fontSize:13, marginTop:6 }}>Prem "+" per afegir-ne una</div>
          </div>
        )}

        {migdia.length > 0 && (
          <ServiceSection
            label="Servei de migdia" hours="13:00 – 16:00" ico="☀️" isMigdia={true}
            list={migdia} selId={sel?.id ?? null} onSel={handleSelect}
          />
        )}

        {nit.length > 0 && (
          <ServiceSection
            label="Servei de nit" hours="20:30 – 00:00" ico="🌙" isMigdia={false}
            list={nit} selId={sel?.id ?? null} onSel={handleSelect}
          />
        )}
      </div>

      {/* ── FAB ────────────────────────────────────────────────────── */}
      <button
        onClick={() => { setSel(null); setShowNew(true); }}
        style={{
          position:'fixed', bottom:72, right:20, width:54, height:54, borderRadius:'50%',
          background:'var(--terracotta-600)', color:'white', border:'none',
          boxShadow:'0 4px 16px rgba(160,60,20,.4)', cursor:'pointer',
          display:'grid', placeItems:'center', zIndex:50,
        }}>
        <Icon d={I.plus} size={24} stroke={2.2} />
      </button>

      {/* ── Detail sheet ───────────────────────────────────────────── */}
      {sel && !showNew && <ResDetailSheet res={sel} onClose={() => setSel(null)} />}

      {/* ── New reservation sheet ──────────────────────────────────── */}
      {showNew && (
        <NewResSheet
          bizId={selectedBusiness}
          date={dateStr}
          addReservation={addReservation}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

// ─── Service section ──────────────────────────────────────────────────────────
function ServiceSection({ label, hours, ico, isMigdia, list, selId, onSel }: {
  label: string; hours: string; ico: string; isMigdia: boolean;
  list: Reservation[]; selId: string | null; onSel: (r: Reservation) => void;
}) {
  const totalPax  = list.reduce((s, r) => s + r.pax, 0);
  const accentBg  = isMigdia ? 'rgba(180,130,40,.07)' : 'rgba(60,30,100,.05)';
  const accentTxt = isMigdia ? 'var(--clay-700)' : 'var(--plum-700)';

  return (
    <div>
      <div style={{ padding:'11px 16px 9px', background:accentBg, borderBottom:'var(--hair)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:17 }}>{ico}</span>
          <div>
            <div style={{ fontSize:14.5, fontFamily:'var(--font-serif)', fontWeight:500, color:'var(--ink-900)' }}>
              {label}
              <span style={{ fontSize:11.5, fontWeight:400, color:'var(--ink-500)', marginLeft:6 }}>· {hours}</span>
            </div>
            <div style={{ fontSize:11.5, color:'var(--ink-600)', marginTop:1 }}>
              <b style={{ color:accentTxt }}>{list.length}</b> reserves
              <span style={{ margin:'0 5px', color:'var(--ink-300)' }}>·</span>
              <b style={{ color:accentTxt }}>{totalPax}</b> pax
            </div>
          </div>
        </div>
      </div>
      {list.map(r => <ResRow key={r.id} res={r} selected={selId === r.id} onSel={onSel} />)}
    </div>
  );
}

// ─── Reservation row ──────────────────────────────────────────────────────────
function ResRow({ res: r, selected, onSel }: {
  res: Reservation; selected: boolean; onSel: (r: Reservation) => void;
}) {
  return (
    <button
      onClick={() => onSel(r)}
      style={{
        display:'flex', alignItems:'center', gap:12, width:'100%',
        padding:'11px 16px',
        background: selected ? 'var(--ink-100)' : 'transparent',
        border:'none', borderBottom:'var(--hair)',
        cursor:'pointer', fontFamily:'inherit', textAlign:'left',
      }}>
      <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--ink-700)', width:40, flex:'none' }}>
        {r.time}
      </span>
      <span className={`avatar av-${avIdx(r.name)}`} style={{ flex:'none' }}>{initials(r.name)}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)', display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</span>
          {r.tags?.includes('vip') && (
            <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:'#c9a227', color:'white' }}>VIP</span>
          )}
        </div>
        {r.notes && (
          <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.notes}
          </div>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flex:'none' }}>
        <StatusChip state={r.status} size="sm" />
        <span style={{ fontSize:12, color:'var(--ink-600)', fontWeight:500 }}>{r.pax} pax</span>
      </div>
    </button>
  );
}

// ─── KPI primitives ───────────────────────────────────────────────────────────
function KpiBlock({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
      <span style={{
        fontFamily:'var(--font-serif)', fontSize:30, fontWeight:500, lineHeight:1,
        color: accent ? 'var(--terracotta-700)' : 'var(--ink-900)',
      }}>
        {value}
      </span>
      <span style={{ fontSize:11, color:'var(--ink-500)', fontWeight:500 }}>{label}</span>
    </div>
  );
}
function KpiDiv() {
  return <div style={{ width:1, height:30, background:'rgba(60,40,20,.1)', margin:'0 6px' }} />;
}

// ─── Detail bottom sheet ──────────────────────────────────────────────────────
function ResDetailSheet({ res: r, onClose }: { res: Reservation; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,.25)' }} />
      <div style={{
        position:'fixed', bottom:60, left:0, right:0, zIndex:100,
        background:'var(--paper)', borderRadius:'18px 18px 0 0',
        boxShadow:'0 -4px 24px rgba(0,0,0,.15)', padding:'14px 18px 26px',
      }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 14px' }} />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <span className={`avatar lg av-${avIdx(r.name)}`}>{initials(r.name)}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)' }}>{r.name}</div>
            <div style={{ fontSize:12.5, color:'var(--ink-600)', marginTop:2 }}>
              {r.time} · {r.pax} pax{r.source ? ` · ${r.source}` : ''}
            </div>
          </div>
          <StatusChip state={r.status} />
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', padding:4 }}>
            <Icon d={I.x} size={18} />
          </button>
        </div>
        {r.notes && (
          <div style={{ background:'rgba(250,230,120,.2)', borderRadius:8, padding:'8px 11px', fontSize:13, color:'#5a4a1a', marginBottom:12, border:'1px solid rgba(200,170,50,.25)' }}>
            {r.notes}
          </div>
        )}
        {r.phone && (
          <div style={{ fontSize:12.5, color:'var(--ink-600)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
            <Icon d={I.phone} size={13} /> {r.phone}
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          {r.phone && (
            <a href={`tel:${r.phone}`}
              style={{ flex:1, padding:'10px', textAlign:'center', background:'var(--ink-100)', borderRadius:11, textDecoration:'none', fontSize:13, fontWeight:600, color:'var(--ink-800)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon d={I.phone} size={14} /> Trucar
            </a>
          )}
          <button style={{ flex:2, padding:'10px', background:'var(--ink-900)', color:'var(--cream)', border:'none', borderRadius:11, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
            A taula →
          </button>
        </div>
      </div>
    </>
  );
}

// ─── New reservation bottom sheet ─────────────────────────────────────────────
function NewResSheet({ bizId, date, addReservation, onClose }: {
  bizId: BusinessId;
  date: string;
  addReservation: (r: Omit<Reservation, 'id'>) => void;
  onClose: () => void;
}) {
  const biz = BUSINESSES.find(b => b.id === bizId)!;
  const [form, setForm] = useState({
    time:   '13:00',
    name:   '',
    phone:  '',
    pax:    2,
    notes:  '',
    status: 'pending' as ReservationStatus,
    source: 'directe',
  });
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);

  function upd<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleSave() {
    setTouched(true);
    if (!form.name.trim()) return;
    addReservation({
      bizId, date,
      time:   form.time,
      name:   form.name.trim(),
      pax:    form.pax,
      status: form.status,
      phone:  form.phone || undefined,
      notes:  form.notes || undefined,
      source: form.source,
    });
    setSaved(true);
    setTimeout(onClose, 700);
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'11px 12px', border:'1px solid rgba(60,40,20,.15)',
    borderRadius:10, fontFamily:'inherit', fontSize:15, color:'var(--ink-900)',
    background:'var(--cream)', boxSizing:'border-box', outline:'none',
  };
  const lbl: React.CSSProperties = {
    fontSize:11, fontWeight:700, color:'var(--ink-500)',
    textTransform:'uppercase', letterSpacing:.07, marginBottom:5, display:'block',
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,.4)' }} />
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:100,
        background:'var(--paper)', borderRadius:'20px 20px 0 0',
        boxShadow:'0 -4px 32px rgba(0,0,0,.2)',
        maxHeight:'92vh', overflowY:'auto',
        paddingBottom:'max(env(safe-area-inset-bottom), 20px)',
      }}>
        <div style={{ padding:'14px 18px 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 14px' }} />
          <div style={{ display:'flex', alignItems:'center', marginBottom:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:19, fontWeight:500, color:'var(--ink-900)' }}>
                Nova reserva
              </div>
              <div style={{ fontSize:12, color:'var(--ink-500)', marginTop:2 }}>{biz.name} · {date}</div>
            </div>
            <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', padding:6 }}>
              <Icon d={I.x} size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding:'0 18px 20px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Time + Pax */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Hora</label>
              <input type="time" value={form.time} onChange={e => upd('time', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Pax</label>
              <input type="number" min={1} max={99} value={form.pax}
                onChange={e => upd('pax', Math.max(1, parseInt(e.target.value) || 1))}
                style={inp} />
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={lbl}>Nom *</label>
            <input
              type="text" placeholder="Nom del client" value={form.name}
              onChange={e => upd('name', e.target.value)}
              style={{ ...inp, borderColor: touched && !form.name.trim() ? 'var(--terracotta-500)' : undefined }}
            />
            {touched && !form.name.trim() && (
              <div style={{ fontSize:11, color:'var(--terracotta-600)', marginTop:3 }}>El nom és obligatori</div>
            )}
          </div>

          {/* Phone */}
          <div>
            <label style={lbl}>Telèfon</label>
            <input type="tel" placeholder="+34 600 000 000" value={form.phone}
              onChange={e => upd('phone', e.target.value)} style={inp} />
          </div>

          {/* Status + Source */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Estat</label>
              <select value={form.status} onChange={e => upd('status', e.target.value as ReservationStatus)}
                style={{ ...inp, paddingRight:8 }}>
                <option value="pending">Pendent</option>
                <option value="confirmed">Confirmat</option>
                <option value="seated">A taula</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Origen</label>
              <select value={form.source} onChange={e => upd('source', e.target.value)}
                style={{ ...inp, paddingRight:8 }}>
                <option value="directe">Directe</option>
                <option value="telèfon">Telèfon</option>
                <option value="web">Web</option>
                <option value="walk-in">Walk-in</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <textarea rows={2} placeholder="Al·lèrgies, ocasió especial…" value={form.notes}
              onChange={e => upd('notes', e.target.value)}
              style={{ ...inp, resize:'none', lineHeight:1.5 }} />
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={saved}
            style={{
              padding:'14px', borderRadius:12, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:15, fontWeight:700, color:'white',
              background: saved ? '#4a8a4a' : 'var(--terracotta-600)',
              opacity: saved ? 1 : 1,
              transition:'background .3s',
            }}>
            {saved ? '✓  Reserva creada!' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </>
  );
}
