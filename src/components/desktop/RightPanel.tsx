import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { StatusChip, Tag } from '@/components/shared/StatusChip';
import { initials, avIdx, STATE_LABELS, isoDate, timeAgo, BUSINESSES } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import TableSelectorModal from '@/components/shared/TableSelectorModal';
import { toast } from '@/components/shared/Toaster';
import type { Business, Reservation, ReservationStatus, ShiftNote, AppEvent } from '@/types';

interface Props {
  biz: Business;
  selectedRes?: Reservation | null;
  onClose?: () => void;
}

export function RightPanel({ biz, selectedRes, onClose }: Props) {
  if (selectedRes) return <ResDetailPanel biz={biz} res={selectedRes} onClose={onClose} />;
  return <AlertsPanel biz={biz} />;
}

// ─── Alerts + notes + events panel ──────────────────────────────
function AlertsPanel({ biz }: { biz: Business }) {
  const {
    selectedDate, selectedBusiness, reservations,
    shiftNotes, addShiftNote, editShiftNote, deleteShiftNote,
    appEvents, addAppEvent, deleteAppEvent,
  } = useAppStore();

  const dateStr = isoDate(selectedDate);

  const dayRes = useMemo(() =>
    reservations.filter(r => r.bizId === selectedBusiness && r.date === dateStr),
    [reservations, selectedBusiness, dateStr]
  );

  // ── Alertes dinàmiques ────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { kind: string; color: string; bg: string; title: string; body: string }[] = [];
    const pending = dayRes.filter(r => r.status === 'pending');
    if (pending.length > 0) {
      const names = pending.slice(0, 2).map(r => `${r.name} · ${r.time}`).join(' — ');
      list.push({ kind:'note', color:'var(--clay-700)', bg:'var(--clay-50)',
        title:`${pending.length} reserva${pending.length > 1 ? 's' : ''} pendent${pending.length > 1 ? 's' : ''} de confirmar`,
        body: names + (pending.length > 2 ? ` i ${pending.length - 2} més` : ''),
      });
    }
    const bdays = dayRes.filter(r => r.tags?.includes('birthday'));
    bdays.forEach(r => {
      list.push({ kind:'cake', color:'var(--plum-700)', bg:'var(--plum-100)',
        title:`Aniversari · ${r.name} · ${r.time}`,
        body: r.notes || 'Comprovar detalls de la celebració',
      });
    });
    // Pic de comensals per franges
    const slots: Record<string, number> = {};
    dayRes.forEach(r => {
      const [h, m] = r.time.split(':').map(Number);
      const slot = `${h}:${m < 30 ? '00' : '30'}`;
      slots[slot] = (slots[slot] || 0) + r.pax;
    });
    const maxPax = Math.max(...Object.values(slots), 0);
    if (maxPax >= 20) {
      const peakSlot = Object.entries(slots).find(([, v]) => v === maxPax)?.[0];
      list.push({ kind:'flame', color:'var(--terracotta-700)', bg:'var(--terracotta-50)',
        title:`Pic al voltant de les ${peakSlot}`,
        body: `${maxPax} comensals simultanis. Confirmar torn de cuina.`,
      });
    }
    return list;
  }, [dayRes]);

  // ── Notes del torn filtrades per negoci + dia ─────────────────
  const dayNotes = shiftNotes.filter(n => n.bizId === selectedBusiness && n.date === dateStr);

  // ── Esdeveniments propers (fins a 7 dies) ─────────────────────
  const upcomingEvents = useMemo(() => {
    const from = selectedDate;
    const to   = new Date(selectedDate); to.setDate(to.getDate() + 7);
    return appEvents.filter(e => {
      if (e.bizId !== selectedBusiness) return false;
      const d = new Date(e.date);
      return d >= from && d <= to;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [appEvents, selectedBusiness, selectedDate]);

  // ── Formulari nova nota ───────────────────────────────────────
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteAuthor,   setNoteAuthor]   = useState('');
  const [noteBody,     setNoteBody]     = useState('');
  const [editingNote,  setEditingNote]  = useState<ShiftNote | null>(null);

  function saveNote() {
    if (!noteBody.trim()) return;
    if (editingNote) {
      editShiftNote(editingNote.id, noteBody.trim());
      setEditingNote(null);
    } else {
      addShiftNote({ bizId: selectedBusiness, date: dateStr, author: noteAuthor.trim() || 'Tu', body: noteBody.trim(), createdAt: Date.now() });
    }
    setNoteBody(''); setNoteAuthor(''); setShowNoteForm(false);
  }

  function startEditNote(n: ShiftNote) {
    setEditingNote(n); setNoteBody(n.body); setNoteAuthor(n.author);
    setShowNoteForm(true);
  }

  // ── Formulari nou event ───────────────────────────────────────
  const [showEvForm,  setShowEvForm]  = useState(false);
  const [evTitle,     setEvTitle]     = useState('');
  const [evDate,      setEvDate]      = useState(dateStr);
  const [evTime,      setEvTime]      = useState('');
  const [evDesc,      setEvDesc]      = useState('');

  function saveEvent() {
    if (!evTitle.trim()) return;
    addAppEvent({ bizId: selectedBusiness, date: evDate, title: evTitle.trim(), time: evTime || undefined, description: evDesc.trim() || undefined });
    setEvTitle(''); setEvDate(dateStr); setEvTime(''); setEvDesc(''); setShowEvForm(false);
  }

  // ── Helpers de format ─────────────────────────────────────────
  function fmtEventDate(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    const DAYS = ['Dg.','Dl.','Dm.','Dc.','Dj.','Dv.','Ds.'];
    const MONS = ['gen','feb','mar','abr','maig','jun','jul','ago','set','oct','nov','des'];
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]}`;
  }

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'8px 10px', border:'1px solid rgba(60,40,20,.14)',
    borderRadius:8, fontFamily:'inherit', fontSize:12.5, background:'var(--paper)',
    outline:'none', color:'var(--ink-900)', boxSizing:'border-box',
  };

  return (
    <aside style={{ width:312, flex:'none', borderLeft:'var(--hair)', background:'var(--cream)', display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'18px 20px 14px', borderBottom:'var(--hair)' }}>
        <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:.08, color:'var(--ink-500)', textTransform:'uppercase' }}>Context del dia</div>
        <h3 style={{ margin:'4px 0 0', fontSize:15, fontFamily:'var(--font-serif)', fontWeight:500, color:'var(--ink-900)' }}>Alertes i notes</h3>
      </div>
      <div className="scroll" style={{ overflowY:'auto', flex:1, padding:'14px 16px' }}>

        {/* ── Alertes ── */}
        {alerts.length > 0 && (
          <Section title="Alertes" count={alerts.length}>
            {alerts.map((a, i) => (
              <AlertCard key={i} kind={a.kind} color={a.color} bg={a.bg} title={a.title} body={a.body} />
            ))}
          </Section>
        )}

        {/* ── Notes del torn ── */}
        <Section title="Notes del torn"
          action={<button onClick={() => { setEditingNote(null); setNoteBody(''); setNoteAuthor(''); setShowNoteForm(v => !v); }}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 7px', fontSize:11, fontWeight:600, color:'var(--terracotta-700)', background:'var(--terracotta-50)', border:'none', borderRadius:6, cursor:'pointer', fontFamily:'inherit' }}>
            <Icon d={I.plus} size={11} /> Nova nota
          </button>}>

          {showNoteForm && (
            <div style={{ background:'var(--paper)', border:'var(--hair)', borderRadius:10, padding:'10px 12px', marginBottom:6 }}>
              <input value={noteAuthor} onChange={e => setNoteAuthor(e.target.value)}
                placeholder="Autor / Rol (opcional)"
                maxLength={80}
                style={{ ...inputStyle, marginBottom:6 }} />
              <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)}
                placeholder="Escriu la nota…" rows={3}
                maxLength={2000}
                style={{ ...inputStyle, resize:'vertical', lineHeight:1.45 }} />
              <div style={{ display:'flex', gap:5, marginTop:7 }}>
                <button onClick={() => { setShowNoteForm(false); setEditingNote(null); setNoteBody(''); setNoteAuthor(''); }}
                  style={{ flex:1, padding:'5px 0', fontSize:12, fontWeight:550, background:'transparent', border:'1px solid rgba(60,40,20,.14)', borderRadius:7, cursor:'pointer', fontFamily:'inherit', color:'var(--ink-700)' }}>
                  Cancel·lar
                </button>
                <button onClick={saveNote}
                  style={{ flex:1, padding:'5px 0', fontSize:12, fontWeight:600, background:'var(--ink-900)', color:'var(--cream)', border:'none', borderRadius:7, cursor:'pointer', fontFamily:'inherit' }}>
                  {editingNote ? 'Actualitzar' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {dayNotes.length === 0 && !showNoteForm && (
            <div style={{ fontSize:12, color:'var(--ink-400)', fontStyle:'italic', padding:'4px 2px' }}>Cap nota per a aquest torn.</div>
          )}
          {dayNotes.map(n => (
            <NoteCard key={n.id} note={n}
              onEdit={() => startEditNote(n)}
              onDelete={() => {
                const snap = { bizId: n.bizId, date: n.date, author: n.author, body: n.body, createdAt: n.createdAt };
                deleteShiftNote(n.id);
                toast('Nota eliminada', {
                  icon: 'check', tone: 'ink', ms: 5000,
                  action: { label: 'Desfer', onClick: () => addShiftNote(snap) },
                });
              }} />
          ))}
        </Section>

        {/* ── Esdeveniments ── */}
        <Section title="Esdeveniments"
          action={<button onClick={() => { setEvDate(dateStr); setShowEvForm(v => !v); }}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 7px', fontSize:11, fontWeight:600, color:'var(--terracotta-700)', background:'var(--terracotta-50)', border:'none', borderRadius:6, cursor:'pointer', fontFamily:'inherit' }}>
            <Icon d={I.plus} size={11} /> Nou event
          </button>}>

          {showEvForm && (
            <div style={{ background:'var(--paper)', border:'var(--hair)', borderRadius:10, padding:'10px 12px', marginBottom:6 }}>
              <input value={evTitle} onChange={e => setEvTitle(e.target.value)}
                placeholder="Títol de l'esdeveniment *"
                maxLength={120}
                style={{ ...inputStyle, marginBottom:6 }} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
                <input value={evDate} onChange={e => setEvDate(e.target.value)}
                  type="date" style={inputStyle} />
                <input value={evTime} onChange={e => setEvTime(e.target.value)}
                  type="time" placeholder="Hora (opcional)" style={inputStyle} />
              </div>
              <textarea value={evDesc} onChange={e => setEvDesc(e.target.value)}
                placeholder="Descripció (opcional)" rows={2}
                maxLength={1000}
                style={{ ...inputStyle, resize:'vertical', lineHeight:1.45, marginBottom:6 }} />
              <div style={{ display:'flex', gap:5 }}>
                <button onClick={() => setShowEvForm(false)}
                  style={{ flex:1, padding:'5px 0', fontSize:12, fontWeight:550, background:'transparent', border:'1px solid rgba(60,40,20,.14)', borderRadius:7, cursor:'pointer', fontFamily:'inherit', color:'var(--ink-700)' }}>
                  Cancel·lar
                </button>
                <button onClick={saveEvent}
                  style={{ flex:1, padding:'5px 0', fontSize:12, fontWeight:600, background:'var(--ink-900)', color:'var(--cream)', border:'none', borderRadius:7, cursor:'pointer', fontFamily:'inherit' }}>
                  Guardar
                </button>
              </div>
            </div>
          )}

          {upcomingEvents.length === 0 && !showEvForm && (
            <div style={{ fontSize:12, color:'var(--ink-400)', fontStyle:'italic', padding:'4px 2px' }}>Cap esdeveniment proper.</div>
          )}
          {upcomingEvents.map(e => (
            <EventCard key={e.id} event={e} fmtDate={fmtEventDate}
              onDelete={() => {
                const snap = { bizId: e.bizId, date: e.date, title: e.title, time: e.time, description: e.description, kind: e.kind };
                deleteAppEvent(e.id);
                toast('Esdeveniment eliminat', {
                  icon: 'check', tone: 'ink', ms: 5000,
                  action: { label: 'Desfer', onClick: () => addAppEvent(snap) },
                });
              }} />
          ))}
        </Section>
      </div>
    </aside>
  );
}

// ─── Shared section wrapper ──────────────────────────────────────
function Section({ title, count, action, children }: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 2px 8px' }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:.06, color:'var(--ink-600)', textTransform:'uppercase', flex:1 }}>{title}</span>
        {count !== undefined && <span style={{ fontSize:10.5, color:'var(--ink-500)' }}>· {count}</span>}
        {action}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>{children}</div>
    </div>
  );
}

const iconMap: Record<string, React.ReactNode> = { flame: I.flame, note: I.note, cake: I.cake, bell: I.bell };
function AlertCard({ kind, title, body, color, bg }: { kind: string; title: string; body: string; color: string; bg: string }) {
  return (
    <div style={{ background:'var(--paper)', border:'var(--hair)', borderRadius:10, padding:'10px 12px', display:'flex', gap:10 }}>
      <span style={{ width:26, height:26, borderRadius:7, flex:'none', background:bg, color, display:'grid', placeItems:'center' }}>
        <Icon d={iconMap[kind] ?? I.bell} size={14} stroke={1.8} />
      </span>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:'var(--ink-900)', lineHeight:1.3 }}>{title}</div>
        <div style={{ fontSize:11.5, color:'var(--ink-600)', marginTop:2, lineHeight:1.4 }}>{body}</div>
      </div>
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete }: { note: ShiftNote; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ padding:'8px 10px', background:'var(--ink-50)', borderRadius:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--ink-600)', marginBottom:3 }}>
        <span style={{ fontWeight:600, flex:1 }}>{note.author}</span>
        <span style={{ color:'var(--ink-400)' }}>· {timeAgo(note.createdAt)}</span>
        <button onClick={onEdit} title="Editar nota"
          style={{ width:20, height:20, display:'grid', placeItems:'center', background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-500)', borderRadius:4, padding:0 }}>
          <Icon d={I.pencil} size={11} />
        </button>
        <button onClick={onDelete} title="Eliminar nota"
          style={{ width:20, height:20, display:'grid', placeItems:'center', background:'transparent', border:'none', cursor:'pointer', color:'var(--rose-500)', borderRadius:4, padding:0 }}>
          <Icon d={I.trash} size={11} />
        </button>
      </div>
      <div style={{ fontSize:12.5, color:'var(--ink-800)', lineHeight:1.4 }}>{note.body}</div>
    </div>
  );
}

function EventCard({ event, fmtDate, onDelete }: { event: AppEvent; fmtDate: (s: string) => string; onDelete: () => void }) {
  return (
    <div style={{ padding:'10px 12px', background:'var(--paper)', border:'var(--hair)', borderRadius:10 }}>
      <div style={{ display:'flex', alignItems:'flex-start' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10.5, fontWeight:600, color:'var(--terracotta-700)', letterSpacing:.05, textTransform:'uppercase' }}>
            {fmtDate(event.date)}{event.time ? ` · ${event.time}` : ''}
          </div>
          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--ink-900)', marginTop:3, lineHeight:1.3 }}>{event.title}</div>
          {event.description && (
            <div style={{ fontSize:11.5, color:'var(--ink-600)', marginTop:2 }}>{event.description}</div>
          )}
        </div>
        <button onClick={onDelete} title="Eliminar event"
          style={{ width:22, height:22, display:'grid', placeItems:'center', background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)', borderRadius:4, flexShrink:0, marginLeft:4, padding:0 }}>
          <Icon d={I.trash} size={12} />
        </button>
      </div>
    </div>
  );
}


// ─── Reservation detail panel ─────────────────────────────────────
function ResDetailPanel({ biz: _biz, res, onClose }: { biz: Business; res: Reservation; onClose?: () => void }) {
  const { updateReservationStatus, updateReservation, deleteReservation, setSelectedReservation, assignTablesToReservation, floorPlans } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTableSel, setShowTableSel] = useState(false);

  const plan = floorPlans[res.bizId];
  const assignedTableNames = (res.tableIds ?? [])
    .map(id => plan?.tables.find(t => t.id === id)?.name ?? id)
    .join(' + ');

  const states: ReservationStatus[] = ['pending', 'confirmed', 'seated', 'completed'];
  const curIdx = states.indexOf(res.status as typeof states[number]);

  if (editing) {
    return <EditResForm res={res} onSave={(updates) => { updateReservation(res.id, updates); setEditing(false); }} onCancel={() => setEditing(false)} onClose={onClose} onDelete={() => { setEditing(false); setConfirmDelete(true); }} />;
  }

  function handleDelete() {
    deleteReservation(res.id);
    setConfirmDelete(false);
    setSelectedReservation(null);
    if (onClose) onClose();
  }

  return (
  <>
    <aside style={{ width:312, flex:'none', borderLeft:'var(--hair)', background:'var(--cream)', display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', position:'relative' }}>
      {/* Header */}
      <div style={{ padding:'16px 18px 12px', borderBottom:'var(--hair)', display:'flex', alignItems:'flex-start', gap:10 }}>
        <span className={`avatar lg av-${avIdx(res.name)}`}>{initials(res.name)}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontFamily:'var(--font-serif)', fontWeight:500, color:'var(--ink-900)', lineHeight:1.2 }}>{res.name}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--ink-600)', marginTop:3 }}>
            <span className="mono" style={{ fontWeight:600, color:'var(--ink-800)' }}>{res.time}</span>
            <span>·</span><span>{res.pax} pax</span>
            {res.source && <><span>·</span><span>{res.source}</span></>}
          </div>
        </div>
        <button onClick={onClose} style={{ width:30, height:30, padding:0, display:'grid', placeItems:'center', background:'transparent', border:'none', borderRadius:8, cursor:'pointer', color:'var(--ink-600)' }}>
          <Icon d={I.x} size={14} />
        </button>
      </div>

      <div className="scroll" style={{ overflowY:'auto', flex:1, padding:'14px 18px' }}>
        {res.tags && res.tags.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14 }}>
            {res.tags.map(t => <Tag key={t} kind={t} />)}
          </div>
        )}

        {/* ── Status pipeline (clicable) ── */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:.06, color:'var(--ink-500)', textTransform:'uppercase', marginBottom:8 }}>Estat</div>
          <div style={{ display:'flex', gap:4 }}>
            {states.map((s, idx) => {
              const isCur  = s === res.status;
              const passed = idx < curIdx;
              return (
                <button key={s}
                  onClick={() => updateReservationStatus(res.id, s)}
                  title={`Canviar a: ${STATE_LABELS[s]}`}
                  style={{ flex:1, padding:'6px 4px', borderRadius:6,
                    border: isCur ? 'none' : '1px solid rgba(60,40,20,0.08)',
                    cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit',
                    background: isCur ? `var(--state-${s}-bg)` : passed ? 'var(--ink-100)' : 'transparent',
                    color:      isCur ? `var(--state-${s}-fg)` : passed ? 'var(--ink-700)' : 'var(--ink-500)',
                    transition:'all .12s',
                  }}>
                  {STATE_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Contacte">
          <Icon d={I.phone} size={13} />
          <span className="mono" style={{ fontSize:12.5 }}>{res.phone || '—'}</span>
        </Field>
        <Field label="Taula">
          {res.tableIds && res.tableIds.length > 0 ? (
            <span style={{ fontSize:13, fontWeight:600, color:'var(--ink-900)' }}>
              {assignedTableNames}
            </span>
          ) : (
            <span style={{ fontSize:13, color:'var(--ink-500)', fontStyle:'italic' }}>Sense taula assignada</span>
          )}
          <button onClick={() => setShowTableSel(true)}
            style={{ padding:'3px 8px', fontSize:11.5, background:'transparent', border:'1px solid rgba(60,40,20,.15)', borderRadius:6, cursor:'pointer', color:'var(--ink-700)', fontFamily:'inherit', fontWeight:600 }}>
            {res.tableIds && res.tableIds.length > 0 ? 'Canviar taula' : 'Assignar taula'}
          </button>
        </Field>
        {res.notes && (
          <Field label="Notes">
            <div style={{ background:'#fef6d6', borderRadius:8, padding:'8px 10px', fontSize:12.5, lineHeight:1.45, color:'#5a4a2a' }}>{res.notes}</div>
          </Field>
        )}
        {res.source && (
          <Field label="Font">
            <span style={{ fontSize:12.5, color:'var(--ink-700)' }}>{res.source}</span>
          </Field>
        )}
        <Field label="Historial">
          <div style={{ fontSize:11.5, color:'var(--ink-600)', lineHeight:1.5 }}>
            <div>Reserva creada · {res.source || 'Desconegut'}</div>
            <div>Estat actual: <b style={{ color:'var(--ink-800)' }}>{STATE_LABELS[res.status] || res.status}</b></div>
          </div>
        </Field>
      </div>

      <div style={{ padding:14, borderTop:'var(--hair)', display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setEditing(true)}
            style={{ flex:1, padding:'7px 12px', background:'transparent', border:'1px solid rgba(60,40,20,0.14)', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:550, color:'var(--ink-800)', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <Icon d={I.pencil} size={13} /> Editar
          </button>
          <button onClick={() => updateReservationStatus(res.id, 'seated')}
            style={{ flex:1, padding:'7px 12px', background:'var(--ink-900)', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:550, color:'var(--cream)' }}>
            A taula
          </button>
        </div>
        <button onClick={() => setConfirmDelete(true)}
          style={{ width:'100%', padding:'7px 12px', background:'transparent', border:'1px solid rgba(200,50,50,0.25)', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:550, color:'#c0392b', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
          <Icon d={I.trash} size={13} /> Eliminar reserva
        </button>
      </div>

      {/* ── Confirm delete overlay ───────────────────────────────── */}
      {confirmDelete && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'flex-end', zIndex:20 }}>
          <div style={{ width:'100%', background:'var(--paper)', padding:'20px 18px 24px', borderRadius:'18px 18px 0 0' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--ink-900)', marginBottom:6 }}>Eliminar reserva</div>
            <div style={{ fontSize:13, color:'var(--ink-600)', marginBottom:18, lineHeight:1.5 }}>
              Segur que vols eliminar la reserva de <b>{res.name}</b>?<br />
              <span style={{ color:'var(--ink-500)' }}>Aquesta acció no es pot desfer.</span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex:1, padding:'9px', background:'transparent', border:'1px solid rgba(60,40,20,.14)', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'var(--ink-800)' }}>
                Cancel·lar
              </button>
              <button onClick={handleDelete}
                style={{ flex:1, padding:'9px', background:'#c0392b', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:'white' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>

    {/* ── Table selector modal ─────────────────────────────────── */}
    {showTableSel && (
      <TableSelectorModal
        bizId={res.bizId}
        pax={res.pax}
        currentIds={res.tableIds ?? []}
        date={res.date}
        onSave={ids => assignTablesToReservation(res.id, ids)}
        onClose={() => setShowTableSel(false)}
      />
    )}
  </>
  );
}

// ─── Edit reservation form ────────────────────────────────────────
const SOURCES = ['Web','Telèfon','WhatsApp','Instagram','Booking','TheFork','App','Presencial'];
const ALL_TAGS = [
  { id:'birthday', label:'🎂 Aniversari' },
  { id:'allergy',  label:'⚠️ Al·lèrgia' },
  { id:'vip',      label:'⭐ VIP' },
  { id:'regular',  label:'🔁 Habitual' },
  { id:'terrassa', label:'🌿 Terrassa' },
];

function EditResForm({ res, onSave, onCancel, onClose, onDelete }: {
  res: Reservation;
  onSave: (u: Partial<Reservation>) => void;
  onCancel: () => void;
  onClose?: () => void;
  onDelete?: () => void;
}) {
  const [name,   setName]   = useState(res.name);
  const [phone,  setPhone]  = useState(res.phone  || '');
  const [time,   setTime]   = useState(res.time);
  const [pax,    setPax]    = useState(res.pax);
  const [notes,  setNotes]  = useState(res.notes  || '');
  const [source, setSource] = useState(res.source || '');
  const [tags,   setTags]   = useState<string[]>(res.tags || []);
  const [status, setStatus] = useState<ReservationStatus>(res.status);

  function toggleTag(t: string) {
    setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'8px 10px', border:'1px solid rgba(60,40,20,.14)',
    borderRadius:8, fontFamily:'inherit', fontSize:13, background:'var(--paper)',
    outline:'none', color:'var(--ink-900)', boxSizing:'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize:10.5, fontWeight:700, letterSpacing:.06, color:'var(--ink-500)',
    textTransform:'uppercase', marginBottom:5, display:'block',
  };

  return (
    <aside style={{ width:312, flex:'none', borderLeft:'var(--hair)', background:'var(--cream)', display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 18px 12px', borderBottom:'var(--hair)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ fontSize:14, fontFamily:'var(--font-serif)', fontWeight:500, color:'var(--ink-900)', flex:1 }}>Editar reserva</div>
        <button onClick={onClose || onCancel} style={{ width:28, height:28, display:'grid', placeItems:'center', background:'transparent', border:'none', borderRadius:8, cursor:'pointer', color:'var(--ink-600)' }}>
          <Icon d={I.x} size={14} />
        </button>
      </div>

      <div className="scroll" style={{ overflowY:'auto', flex:1, padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* Nom */}
        <div>
          <label style={lbl}>Nom complet</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" style={inp} />
        </div>

        {/* Telèfon + Hora */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <label style={lbl}>Telèfon</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" maxLength={30} inputMode="tel" autoComplete="tel" pattern="^[+0-9 ()\-\.]{6,30}$" style={{ ...inp, fontFamily:'var(--font-mono)' }} />
          </div>
          <div>
            <label style={lbl}>Hora</label>
            <input value={time} onChange={e => setTime(e.target.value)} type="time" style={inp} />
          </div>
        </div>

        {/* Pax */}
        <div>
          <label style={lbl}>Comensals (pax)</label>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => setPax(p => Math.max(1, p - 1))}
              style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(60,40,20,.14)', background:'var(--paper)', cursor:'pointer', fontSize:18, color:'var(--ink-700)', display:'grid', placeItems:'center', fontFamily:'inherit' }}>
              −
            </button>
            <span style={{ fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500, color:'var(--ink-900)', minWidth:32, textAlign:'center' }}>{pax}</span>
            <button onClick={() => setPax(p => Math.min(50, p + 1))}
              style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(60,40,20,.14)', background:'var(--paper)', cursor:'pointer', fontSize:18, color:'var(--ink-700)', display:'grid', placeItems:'center', fontFamily:'inherit' }}>
              +
            </button>
          </div>
        </div>

        {/* Estat */}
        <div>
          <label style={lbl}>Estat</label>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {(['pending','confirmed','seated','completed','cancelled','noshow'] as ReservationStatus[]).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                style={{ padding:'5px 10px', borderRadius:6, border: status === s ? 'none' : '1px solid rgba(60,40,20,.1)',
                  background: status === s ? `var(--state-${s}-bg, var(--ink-900))` : 'transparent',
                  color:      status === s ? `var(--state-${s}-fg, var(--cream))` : 'var(--ink-600)',
                  cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit' }}>
                {STATE_LABELS[s] || s}
              </button>
            ))}
          </div>
        </div>

        {/* Font */}
        <div>
          <label style={lbl}>Font</label>
          <select value={source} onChange={e => setSource(e.target.value)}
            style={{ ...inp, cursor:'pointer' }}>
            <option value="">— Sense especificar —</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Etiquetes */}
        <div>
          <label style={lbl}>Etiquetes</label>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {ALL_TAGS.map(t => {
              const on = tags.includes(t.id);
              return (
                <button key={t.id} onClick={() => toggleTag(t.id)}
                  style={{ padding:'5px 10px', borderRadius:999, border: on ? 'none' : '1px solid rgba(60,40,20,.14)',
                    background: on ? 'var(--ink-900)' : 'transparent', color: on ? 'var(--cream)' : 'var(--ink-700)',
                    cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={lbl}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} placeholder="Al·lèrgies, preferències, observacions…"
            maxLength={1000}
            style={{ ...inp, resize:'vertical', lineHeight:1.5 }} />
        </div>

      </div>

      <div style={{ padding:14, borderTop:'var(--hair)', display:'flex', gap:6 }}>
        <button onClick={onCancel}
          style={{ flex:1, padding:'7px 12px', background:'transparent', border:'1px solid rgba(60,40,20,0.14)', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:550, color:'var(--ink-800)' }}>
          Cancel·lar
        </button>
        <button onClick={() => onSave({ name, phone: phone || undefined, time, pax, notes: notes || undefined, source: source || undefined, tags, status })}
          style={{ flex:1, padding:'7px 12px', background:'var(--terracotta-600)', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:550, color:'white', display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
          <Icon d={I.check} size={13} /> Guardar
        </button>
      </div>
      {onDelete && (
        <div style={{ padding:'0 14px 14px' }}>
          <button onClick={onDelete}
            style={{ width:'100%', padding:'7px', background:'transparent', border:'1px solid rgba(200,50,50,0.25)', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:550, color:'#c0392b', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <Icon d={I.trash} size={13} /> Eliminar reserva
          </button>
        </div>
      )}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:.06, color:'var(--ink-500)', textTransform:'uppercase', marginBottom:4 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>{children}</div>
    </div>
  );
}
