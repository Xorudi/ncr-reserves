import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES } from '@/data/mockData';

const SOURCES = ['Telèfon','WhatsApp','Web','Booking','TheFork','Instagram','App'];

export default function ReservationForm({ onClose }: { onClose?: () => void }) {
  const { selectedBusiness, addReservation } = useAppStore();
  const biz = BUSINESSES.find(b => b.id === selectedBusiness)!;

  const [name,   setName]   = useState('');
  const [phone,  setPhone]  = useState('');
  const [pax,    setPax]    = useState(2);
  const [time,   setTime]   = useState('13:00');
  const [source, setSource] = useState('Telèfon');
  const [notes,  setNotes]  = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !time) return;
    addReservation({ name, phone, pax, time, source, notes, bizId: selectedBusiness, status:'confirmed', tags:[] });
    onClose?.();
  }

  return (
    <div style={{ flex:1,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'var(--cream)' }}>
      <div style={{ padding:'18px 28px 14px',borderBottom:'var(--hair)',flexShrink:0 }}>
        <div style={{ fontSize:11,fontWeight:600,color:'var(--ink-500)',textTransform:'uppercase',letterSpacing:.08,marginBottom:4 }}>{biz.name}</div>
        <h2 style={{ margin:0,fontFamily:'var(--font-serif)',fontSize:26,fontWeight:500,color:'var(--ink-900)' }}>Nova reserva</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ flex:1,overflowY:'auto',padding:'24px 28px' }}>
        <div style={{ maxWidth:600,display:'flex',flexDirection:'column',gap:18 }}>
          {/* Name */}
          <Field label="Nom del client *">
            <input required value={name} onChange={e=>setName(e.target.value)}
              placeholder="Nom i cognoms"
              style={inputStyle} />
          </Field>

          {/* Phone */}
          <Field label="Telèfon">
            <input value={phone} onChange={e=>setPhone(e.target.value)}
              placeholder="+34 6XX XXX XXX" type="tel"
              style={inputStyle} />
          </Field>

          {/* Pax */}
          <Field label="Comensals">
            <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} type="button" onClick={() => setPax(n)}
                  style={{ width:40,height:40,borderRadius:8,border:'none',cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:'var(--font-serif)',background:pax===n?'var(--ink-900)':'var(--paper)',color:pax===n?'var(--cream)':'var(--ink-800)',boxShadow:pax===n?'var(--sh-2)':'var(--sh-1)',transition:'all .1s' }}>
                  {n}
                </button>
              ))}
              <input value={pax} onChange={e=>setPax(Number(e.target.value))} type="number" min={1} max={50}
                style={{ ...inputStyle, width:70 }} />
            </div>
          </Field>

          {/* Time */}
          <Field label="Hora *">
            <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:6 }}>
              {['13:00','13:30','14:00','14:30','15:00','20:30','21:00','21:30','22:00'].map(t => (
                <button key={t} type="button" onClick={() => setTime(t)}
                  style={{ padding:'6px 12px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12.5,fontFamily:'var(--font-mono)',fontWeight:600,background:time===t?'var(--ink-900)':'var(--paper)',color:time===t?'var(--cream)':'var(--ink-800)',boxShadow:time===t?'var(--sh-2)':'var(--sh-1)',transition:'all .1s' }}>
                  {t}
                </button>
              ))}
            </div>
            <input value={time} onChange={e=>setTime(e.target.value)} type="time"
              style={{ ...inputStyle, width:120, fontFamily:'var(--font-mono)' }} />
          </Field>

          {/* Source */}
          <Field label="Canal">
            <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
              {SOURCES.map(s => (
                <button key={s} type="button" onClick={() => setSource(s)}
                  style={{ padding:'5px 12px',borderRadius:999,border:'none',cursor:'pointer',fontSize:12,fontWeight:550,fontFamily:'inherit',background:source===s?'var(--ink-900)':'var(--paper)',color:source===s?'var(--cream)':'var(--ink-700)',boxShadow:source===s?'var(--sh-2)':'var(--sh-1)',transition:'all .1s' }}>
                  {s}
                </button>
              ))}
            </div>
          </Field>

          {/* Notes */}
          <Field label="Notes internes">
            <textarea value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder="Al·lèrgies, preferències, peticions especials…"
              rows={3}
              style={{ ...inputStyle, resize:'vertical',lineHeight:1.5 }} />
          </Field>

          {/* Actions */}
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end',paddingTop:4 }}>
            {onClose && (
              <button type="button" onClick={onClose}
                style={{ padding:'9px 18px',background:'transparent',border:'1px solid rgba(60,40,20,.14)',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)' }}>
                Cancel·lar
              </button>
            )}
            <button type="submit"
              style={{ display:'flex',alignItems:'center',gap:6,padding:'9px 20px',background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550 }}>
              <Icon d={I.check} size={14} /> Crear reserva
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:'var(--hair-strong)', background:'var(--paper)',
  fontFamily:'inherit', fontSize:13, color:'var(--ink-900)', outline:'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block',fontSize:11,fontWeight:600,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}
