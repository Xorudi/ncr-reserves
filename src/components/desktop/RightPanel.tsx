import React from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip, Tag } from '@/components/shared/StatusChip';
import { initials, avIdx, STATE_LABELS } from '@/data/mockData';
import type { Business, Reservation } from '@/types';

interface Props {
  biz: Business;
  selectedRes?: Reservation | null;
  onClose?: () => void;
}

export function RightPanel({ biz, selectedRes, onClose }: Props) {
  if (selectedRes) return <ResDetailPanel biz={biz} res={selectedRes} onClose={onClose} />;
  return <AlertsPanel />;
}

// ─── Alerts panel ───────────────────────────────────────────────
function AlertsPanel() {
  return (
    <aside style={{ width:312,flex:'none',borderLeft:'var(--hair)',background:'var(--cream)',display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div style={{ padding:'18px 20px 14px',borderBottom:'var(--hair)' }}>
        <div style={{ fontSize:10.5,fontWeight:600,letterSpacing:.08,color:'var(--ink-500)',textTransform:'uppercase' }}>Context del dia</div>
        <h3 style={{ margin:'4px 0 0',fontSize:15,fontFamily:'var(--font-serif)',fontWeight:500,color:'var(--ink-900)' }}>Alertes i notes</h3>
      </div>
      <div className="scroll" style={{ overflowY:'auto',flex:1,padding:'14px 16px' }}>
        <Section title="Alertes" count={3}>
          <AlertCard kind="flame" color="var(--terracotta-700)" bg="var(--terracotta-50)" title="Pic de 14:00 a 15:00" body="8 reserves · 32 comensals. Confirmar torn de cuina." />
          <AlertCard kind="note"  color="var(--clay-700)"       bg="var(--clay-50)"       title="2 reserves pendents de confirmar" body="Anna Vilanova · 13:30 · 2 pax — trucar abans de les 12:30" />
          <AlertCard kind="cake"  color="var(--plum-700)"       bg="var(--plum-100)"      title="Aniversari · Carla Benet · 14:00" body="Porten pastís propi. Avisar cambrer de sala." />
        </Section>
        <Section title="Notes del torn">
          <NoteCard who="Pep · Cuiner" ago="fa 34 min" body="Avui no hi ha rap. Canviar la recomanació per llenguado a la planxa." />
          <NoteCard who="Èlia · Sala"  ago="fa 2 h"   body="Taula 7 té la pota coixa — evitar grups grans fins que vingui el fuster." />
        </Section>
        <Section title="Esdeveniments">
          <EventCard date="Dj. 30 abr" title="Sopar de fi de curs — Institut Vilamar" meta="28 pax · menú tancat · sala privada" />
          <EventCard date="Dv. 1 maig" title="Festiu · horari reduït" meta="Només migdia · cuina fins les 15:30" />
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:'flex',alignItems:'center',gap:6,padding:'0 2px 8px' }}>
        <span style={{ fontSize:11,fontWeight:600,letterSpacing:.06,color:'var(--ink-600)',textTransform:'uppercase' }}>{title}</span>
        {count !== undefined && <span style={{ fontSize:10.5,color:'var(--ink-500)' }}>· {count}</span>}
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:6 }}>{children}</div>
    </div>
  );
}

const iconMap: Record<string, React.ReactNode> = { flame: I.flame, note: I.note, cake: I.cake, bell: I.bell };
function AlertCard({ kind, title, body, color, bg }: { kind: string; title: string; body: string; color: string; bg: string }) {
  return (
    <div style={{ background:'var(--paper)',border:'var(--hair)',borderRadius:10,padding:'10px 12px',display:'flex',gap:10 }}>
      <span style={{ width:26,height:26,borderRadius:7,flex:'none',background:bg,color,display:'grid',placeItems:'center' }}>
        <Icon d={iconMap[kind]} size={14} stroke={1.8} />
      </span>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:12.5,fontWeight:600,color:'var(--ink-900)',lineHeight:1.3 }}>{title}</div>
        <div style={{ fontSize:11.5,color:'var(--ink-600)',marginTop:2,lineHeight:1.4 }}>{body}</div>
      </div>
    </div>
  );
}
function NoteCard({ who, ago, body }: { who: string; ago: string; body: string }) {
  return (
    <div style={{ padding:'8px 10px',background:'var(--ink-50)',borderRadius:8 }}>
      <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--ink-600)' }}>
        <span style={{ fontWeight:600 }}>{who}</span>
        <span style={{ color:'var(--ink-400)' }}>· {ago}</span>
      </div>
      <div style={{ fontSize:12.5,color:'var(--ink-800)',marginTop:3,lineHeight:1.4 }}>{body}</div>
    </div>
  );
}
function EventCard({ date, title, meta }: { date: string; title: string; meta: string }) {
  return (
    <div style={{ padding:'10px 12px',background:'var(--paper)',border:'var(--hair)',borderRadius:10 }}>
      <div style={{ fontSize:10.5,fontWeight:600,color:'var(--terracotta-700)',letterSpacing:.05,textTransform:'uppercase' }}>{date}</div>
      <div style={{ fontSize:12.5,fontWeight:600,color:'var(--ink-900)',marginTop:3,lineHeight:1.3 }}>{title}</div>
      <div style={{ fontSize:11.5,color:'var(--ink-600)',marginTop:2 }}>{meta}</div>
    </div>
  );
}

// ─── Reservation detail panel ────────────────────────────────────
function ResDetailPanel({ biz: _biz, res, onClose }: { biz: Business; res: Reservation; onClose?: () => void }) {
  const states = ['pending','confirmed','seated','completed'] as const;
  const curIdx = states.indexOf(res.status as typeof states[number]);
  return (
    <aside style={{ width:312,flex:'none',borderLeft:'var(--hair)',background:'var(--cream)',display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div style={{ padding:'16px 18px 12px',borderBottom:'var(--hair)',display:'flex',alignItems:'flex-start',gap:10 }}>
        <span className={`avatar lg av-${avIdx(res.name)}`}>{initials(res.name)}</span>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:15,fontFamily:'var(--font-serif)',fontWeight:500,color:'var(--ink-900)',lineHeight:1.2 }}>{res.name}</div>
          <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-600)',marginTop:3 }}>
            <span className="mono" style={{ fontWeight:600,color:'var(--ink-800)' }}>{res.time}</span>
            <span>·</span><span>{res.pax} pax</span>
            {res.source && <><span>·</span><span>{res.source}</span></>}
          </div>
        </div>
        <button onClick={onClose} style={{ width:30,height:30,padding:0,display:'grid',placeItems:'center',background:'transparent',border:'none',borderRadius:8,cursor:'pointer',color:'var(--ink-600)' }}>
          <Icon d={I.x} size={14} />
        </button>
      </div>

      <div className="scroll" style={{ overflowY:'auto',flex:1,padding:'14px 18px' }}>
        {res.tags && res.tags.length > 0 && (
          <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginBottom:14 }}>
            {res.tags.map(t => <Tag key={t} kind={t} />)}
          </div>
        )}

        {/* Status pipeline */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10.5,fontWeight:600,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:8 }}>Estat</div>
          <div style={{ display:'flex',gap:4 }}>
            {states.map((s, idx) => {
              const isCur = s === res.status;
              const passed = idx < curIdx;
              return (
                <button key={s} style={{ flex:1,padding:'6px 4px',borderRadius:6,border:isCur?'none':'1px solid rgba(60,40,20,0.08)',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'inherit',background:isCur?`var(--state-${s}-bg)`:passed?'var(--ink-100)':'transparent',color:isCur?`var(--state-${s}-fg)`:passed?'var(--ink-700)':'var(--ink-500)',transition:'all .12s' }}>
                  {STATE_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Contacte">
          <Icon d={I.phone} size={13} />
          <span className="mono" style={{ fontSize:12.5 }}>{res.phone}</span>
        </Field>
        <Field label="Taula">
          <span style={{ fontSize:13,color:'var(--ink-800)' }}>Sense assignar</span>
          <button style={{ padding:'3px 8px',fontSize:11.5,background:'transparent',border:'none',cursor:'pointer',color:'var(--ink-600)' }}>Assignar →</button>
        </Field>
        {res.notes && (
          <Field label="Notes">
            <div style={{ background:'#fef6d6',borderRadius:8,padding:'8px 10px',fontSize:12.5,lineHeight:1.45,color:'#5a4a2a' }}>{res.notes}</div>
          </Field>
        )}
        {res.source && (
          <Field label="Font">
            <span style={{ fontSize:12.5,color:'var(--ink-700)' }}>{res.source}</span>
          </Field>
        )}
        <Field label="Historial">
          <div style={{ fontSize:11.5,color:'var(--ink-600)',lineHeight:1.5 }}>
            <div>Reserva creada · 22 abr 18:34 · {res.source}</div>
            <div>Confirmada · 23 abr 09:12 · Joan R.</div>
          </div>
        </Field>
      </div>

      <div style={{ padding:14,borderTop:'var(--hair)',display:'flex',gap:6 }}>
        <button style={{ flex:1,padding:'7px 12px',background:'transparent',border:'1px solid rgba(60,40,20,0.14)',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--ink-800)' }}>Editar</button>
        <button style={{ flex:1,padding:'7px 12px',background:'var(--ink-900)',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:550,color:'var(--cream)' }}>A taula</button>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10.5,fontWeight:600,letterSpacing:.06,color:'var(--ink-500)',textTransform:'uppercase',marginBottom:4 }}>{label}</div>
      <div style={{ display:'flex',alignItems:'center',gap:8 }}>{children}</div>
    </div>
  );
}
