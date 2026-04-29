import React, { useState, useEffect, useCallback } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { DAY_NAMES } from '@/data/mockData';
import type { BusinessId, BizShift, Employee, EmployeeRole, NotifConfig, DayHours } from '@/types';

const TABS = [
  { k:'general',       label:'General' },
  { k:'hours',         label:'Horaris' },
  { k:'shifts',        label:'Torns' },
  { k:'integrations',  label:'Integracions' },
  { k:'notifications', label:'Notificacions' },
  { k:'team',          label:'Equip' },
] as const;

export default function SettingsView() {
  const [tab, setTab] = useState<string>('general');
  const { selectedBusiness } = useAppStore();

  // Reset to general when business changes
  useEffect(() => { setTab('general'); }, [selectedBusiness]);

  return (
    <div style={{ flex:1, display:'flex', height:'100%', overflow:'hidden', background:'var(--cream)' }}>
      {/* Sidebar */}
      <aside style={{ width:196, padding:'20px 10px', borderRight:'var(--hair)', flexShrink:0, background:'var(--paper)' }}>
        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:.08, textTransform:'uppercase', color:'var(--ink-500)', padding:'0 10px 12px' }}>
          Configuració
        </div>
        {TABS.map(({ k, label }) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ display:'block', width:'100%', padding:'8px 10px', background: tab===k ? 'var(--terracotta-50)' : 'transparent', border:'none', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight: tab===k ? 600 : 500, color: tab===k ? 'var(--terracotta-700)' : 'var(--ink-700)', textAlign:'left', marginBottom:1, borderLeft: tab===k ? '2.5px solid var(--terracotta-500)' : '2.5px solid transparent' }}>
            {label}
          </button>
        ))}
      </aside>

      {/* Content */}
      <div className="scroll" style={{ flex:1, overflowY:'auto', padding:'28px 36px 60px' }}>
        {tab === 'general'       && <GeneralTab    bizId={selectedBusiness} />}
        {tab === 'hours'         && <HoursTab      bizId={selectedBusiness} />}
        {tab === 'shifts'        && <ShiftsTab     bizId={selectedBusiness} />}
        {tab === 'integrations'  && <IntegrationsTab />}
        {tab === 'notifications' && <NotificationsTab bizId={selectedBusiness} />}
        {tab === 'team'          && <TeamTab        bizId={selectedBusiness} />}
      </div>
    </div>
  );
}

// ─── Save bar ─────────────────────────────────────────────────────────────────
function SaveBar({ dirty, saved, onSave, onCancel }: {
  dirty: boolean; saved: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 0 0', borderTop:'var(--hair)', marginTop:28, position:'sticky', bottom:0, background:'var(--cream)', zIndex:10 }}>
      {saved && (
        <span style={{ fontSize:12.5, color:'var(--olive-700)', fontWeight:600 }}>✓ Canvis desats</span>
      )}
      {dirty && !saved && (
        <span style={{ fontSize:12.5, color:'var(--clay-700)', fontWeight:600 }}>● Canvis pendents</span>
      )}
      <div style={{ flex:1 }} />
      {dirty && (
        <button onClick={onCancel}
          style={{ padding:'8px 16px', background:'transparent', color:'var(--ink-600)', border:'var(--hair)', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:550 }}>
          Cancel·lar
        </button>
      )}
      <button onClick={dirty ? onSave : undefined}
        style={{ padding:'8px 20px', background: dirty ? 'var(--terracotta-600)' : 'var(--ink-200)', color: dirty ? 'white' : 'var(--ink-500)', border:'none', borderRadius:8, cursor: dirty ? 'pointer' : 'default', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
        Desar canvis
      </button>
    </div>
  );
}

function useSaved() {
  const [saved, setSaved] = useState(false);
  const flash = useCallback(() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }, []);
  return { saved, flash };
}

// ─── Label helper ─────────────────────────────────────────────────────────────
const Label = ({ text }: { text: string }) => (
  <div style={{ fontSize:11, fontWeight:700, letterSpacing:.06, textTransform:'uppercase', color:'var(--ink-500)', marginBottom:5 }}>{text}</div>
);

const Input = ({ value, onChange, type = 'text', mono = false }: {
  value: string | number; onChange: (v: string) => void; type?: string; mono?: boolean;
}) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(60,40,20,.14)', borderRadius:8, fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize:13, background:'var(--paper)', color:'var(--ink-900)', outline:'none', boxSizing:'border-box' }}
  />
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontFamily:'var(--font-serif)', fontWeight:500, fontSize:22, color:'var(--ink-900)', margin:'0 0 22px' }}>{children}</h3>
);

// ═══════════════════════════════════════════════════════════════════
// 1. GENERAL
// ═══════════════════════════════════════════════════════════════════
function GeneralTab({ bizId }: { bizId: BusinessId }) {
  const { businessConfigs, updateBusinessConfig } = useAppStore();
  const stored = businessConfigs[bizId];
  const [draft, setDraft] = useState(() => ({ ...stored }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const { saved, flash } = useSaved();

  useEffect(() => { setDraft({ ...businessConfigs[bizId] }); }, [bizId]);

  function set(key: string, val: string | number | boolean) {
    setDraft(d => ({ ...d, [key]: val }));
  }

  function handleSave() { updateBusinessConfig(bizId, draft); flash(); }
  function handleCancel() { setDraft({ ...stored }); }

  return (
    <div style={{ maxWidth:580 }}>
      <SectionTitle>General</SectionTitle>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <div style={{ gridColumn:'1/-1' }}>
          <Label text="Nom del negoci" />
          <Input value={draft.name} onChange={v => set('name', v)} />
        </div>
        <div>
          <Label text="Tipus" />
          <Input value={draft.kind} onChange={v => set('kind', v)} />
        </div>
        <div>
          <Label text="Capacitat total" />
          <Input type="number" value={draft.capacity} onChange={v => set('capacity', Number(v))} />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <Label text="Adreça" />
          <Input value={draft.address} onChange={v => set('address', v)} />
        </div>
        <div>
          <Label text="Telèfon" />
          <Input value={draft.phone} onChange={v => set('phone', v)} />
        </div>
        <div>
          <Label text="Email" />
          <Input value={draft.email} onChange={v => set('email', v)} />
        </div>
      </div>

      {/* Active toggle */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--paper)', border:'var(--hair)', borderRadius:10, marginTop:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-900)' }}>Negoci actiu</div>
          <div style={{ fontSize:12, color:'var(--ink-500)', marginTop:2 }}>Si està inactiu no apareixerà a la llista de selecció</div>
        </div>
        <Toggle value={draft.active} onChange={v => set('active', v)} />
      </div>

      <SaveBar dirty={dirty} saved={saved} onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 2. HORARIS
// ═══════════════════════════════════════════════════════════════════
function HoursTab({ bizId }: { bizId: BusinessId }) {
  const { businessHours, updateBusinessHours } = useAppStore();
  const stored = businessHours[bizId];
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(stored)));
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const { saved, flash } = useSaved();

  useEffect(() => { setDraft(JSON.parse(JSON.stringify(businessHours[bizId]))); }, [bizId]);

  function toggleDay(i: number, open: boolean) {
    setDraft((d: typeof draft) => {
      const days = [...d.days];
      days[i] = { ...days[i], open, slots: open && days[i].slots.length === 0 ? [{ start:'13:00', end:'16:00' }] : days[i].slots };
      return { ...d, days };
    });
  }
  function updateSlot(dayIdx: number, slotIdx: number, field: 'start'|'end', val: string) {
    setDraft((d: typeof draft) => {
      const days = d.days.map((day: DayHours, i: number) => {
        if (i !== dayIdx) return day;
        return { ...day, slots: day.slots.map((s: {start:string;end:string}, j: number) => j === slotIdx ? { ...s, [field]: val } : s) };
      });
      return { ...d, days };
    });
  }
  function addSlot(dayIdx: number) {
    setDraft((d: typeof draft) => {
      const days = d.days.map((day: DayHours, i: number) =>
        i === dayIdx ? { ...day, slots: [...day.slots, { start:'20:00', end:'00:00' }] } : day);
      return { ...d, days };
    });
  }
  function removeSlot(dayIdx: number, slotIdx: number) {
    setDraft((d: typeof draft) => {
      const days = d.days.map((day: DayHours, i: number) =>
        i === dayIdx ? { ...day, slots: day.slots.filter((_: any, j: number) => j !== slotIdx) } : day);
      return { ...d, days };
    });
  }

  return (
    <div style={{ maxWidth:700 }}>
      <SectionTitle>Horaris d'obertura</SectionTitle>

      <div style={{ background:'var(--paper)', borderRadius:12, border:'var(--hair)', overflow:'hidden', marginBottom:14 }}>
        {DAY_NAMES.map((dayName, i) => {
          const day = draft.days[i];
          return (
            <div key={dayName} style={{ padding:'12px 16px', borderBottom: i < 6 ? 'var(--hair)' : 'none', background: !day.open ? 'rgba(60,40,20,0.02)' : 'transparent' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: day.open && day.slots.length > 0 ? 10 : 0 }}>
                <div style={{ width:110, fontSize:13, fontWeight:600, color: day.open ? 'var(--ink-900)' : 'var(--ink-400)' }}>{dayName}</div>
                <Toggle value={day.open} onChange={v => toggleDay(i, v)} size="sm" />
                {!day.open && <span style={{ fontSize:12, color:'var(--ink-400)' }}>Tancat</span>}
                {day.open && (
                  <button onClick={() => addSlot(i)}
                    style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'transparent', border:'1px dashed var(--ink-300)', borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontSize:11.5, color:'var(--ink-500)' }}>
                    <Icon d={I.plus} size={11} /> Franja
                  </button>
                )}
              </div>
              {day.open && day.slots.map((slot: {start:string;end:string}, j: number) => (
                <div key={j} style={{ display:'flex', alignItems:'center', gap:8, marginLeft:122, marginBottom: j < day.slots.length-1 ? 6 : 0 }}>
                  <input type="time" value={slot.start} onChange={e => updateSlot(i, j, 'start', e.target.value)}
                    style={{ padding:'6px 8px', border:'var(--hair)', borderRadius:6, fontFamily:'var(--font-mono)', fontSize:12.5, background:'var(--cream)', outline:'none' }} />
                  <span style={{ fontSize:12, color:'var(--ink-400)' }}>–</span>
                  <input type="time" value={slot.end} onChange={e => updateSlot(i, j, 'end', e.target.value)}
                    style={{ padding:'6px 8px', border:'var(--hair)', borderRadius:6, fontFamily:'var(--font-mono)', fontSize:12.5, background:'var(--cream)', outline:'none' }} />
                  {day.slots.length > 1 && (
                    <button onClick={() => removeSlot(i, j)}
                      style={{ width:22, height:22, display:'grid', placeItems:'center', background:'transparent', border:'none', cursor:'pointer', color:'var(--rose-400)', borderRadius:4 }}>
                      <Icon d={I.x} size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--paper)', border:'var(--hair)', borderRadius:10 }}>
        <span style={{ fontSize:13, color:'var(--ink-700)' }}>Durada mitjana per taula:</span>
        <input type="number" value={draft.avgTableMinutes} min={15} step={15}
          onChange={e => setDraft((d: typeof draft) => ({ ...d, avgTableMinutes: Number(e.target.value) }))}
          style={{ width:64, padding:'6px 8px', border:'var(--hair)', borderRadius:6, fontFamily:'var(--font-mono)', fontSize:13, background:'var(--cream)', outline:'none' }} />
        <span style={{ fontSize:13, color:'var(--ink-500)' }}>minuts</span>
      </div>

      <SaveBar dirty={dirty} saved={saved}
        onSave={() => { updateBusinessHours(bizId, draft); flash(); }}
        onCancel={() => setDraft(JSON.parse(JSON.stringify(stored)))} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 3. TORNS
// ═══════════════════════════════════════════════════════════════════
function ShiftsTab({ bizId }: { bizId: BusinessId }) {
  const { bizShifts, addBizShift, updateBizShift, deleteBizShift } = useAppStore();
  const shifts = bizShifts[bizId] ?? [];
  const [editing, setEditing] = useState<BizShift | null>(null);
  const [adding, setAdding] = useState(false);
  const { saved, flash } = useSaved();

  const COLORS = ['#f3e3d6','#d4e5ee','#e7ecd3','#ecdaf0','#f3d7d1','#e6d3c8','#fde8c8','#dbe6f4'];

  function handleSave(data: Omit<BizShift,'id'> & { id?: string }) {
    if (data.id) { updateBizShift(bizId, data.id, data); }
    else { addBizShift(bizId, data); }
    setEditing(null);
    setAdding(false);
    flash();
  }

  return (
    <div style={{ maxWidth:620 }}>
      <div style={{ display:'flex', alignItems:'center', marginBottom:22 }}>
        <SectionTitle>Torns</SectionTitle>
        <div style={{ flex:1 }} />
        <button onClick={() => setAdding(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'var(--terracotta-600)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
          <Icon d={I.plus} size={13} /> Nou torn
        </button>
      </div>

      {(adding || editing) && (
        <ShiftForm
          initial={editing ?? { id:'', code:'', label:'', start:'12:00', end:'16:00', color:COLORS[0], active:true }}
          isNew={adding}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setAdding(false); }}
          colors={COLORS}
        />
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {shifts.map(sh => (
          <div key={sh.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:'var(--paper)', border:'var(--hair)', borderRadius:12, boxShadow:'var(--sh-1)' }}>
            <div style={{ width:36, height:36, borderRadius:8, background:sh.color, display:'grid', placeItems:'center', flexShrink:0 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:800, color:'rgba(60,40,20,.6)' }}>{sh.code}</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)' }}>{sh.label}</div>
              <div style={{ fontSize:12, color:'var(--ink-500)', fontFamily:'var(--font-mono)', marginTop:2 }}>{sh.start} – {sh.end}</div>
            </div>
            <span style={{ fontSize:11.5, padding:'3px 9px', borderRadius:20, background: sh.active ? 'var(--olive-100)' : 'var(--ink-100)', color: sh.active ? 'var(--olive-700)' : 'var(--ink-500)', fontWeight:600 }}>
              {sh.active ? 'Actiu' : 'Inactiu'}
            </span>
            <button onClick={() => { setEditing(sh); setAdding(false); }}
              style={{ width:28, height:28, border:'var(--hair)', borderRadius:6, background:'transparent', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-500)' }}>
              <Icon d={I.pencil} size={13} />
            </button>
            <button onClick={() => { if (confirm(`Eliminar torn "${sh.label}"?`)) { deleteBizShift(bizId, sh.id); flash(); } }}
              style={{ width:28, height:28, border:'1px solid var(--rose-200)', borderRadius:6, background:'var(--rose-50)', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--rose-500)' }}>
              <Icon d={I.trash} size={13} />
            </button>
          </div>
        ))}
        {shifts.length === 0 && (
          <div style={{ padding:'40px 0', textAlign:'center', color:'var(--ink-400)', fontSize:13 }}>Cap torn definit</div>
        )}
      </div>
      {saved && <div style={{ marginTop:14, fontSize:12.5, color:'var(--olive-700)', fontWeight:600 }}>✓ Canvis desats</div>}
    </div>
  );
}

function ShiftForm({ initial, isNew, onSave, onCancel, colors }: {
  initial: BizShift; isNew: boolean;
  onSave: (d: any) => void; onCancel: () => void; colors: string[];
}) {
  const [d, setD] = useState({ ...initial });
  return (
    <div style={{ padding:'16px', background:'var(--cream)', border:'2px solid var(--terracotta-200)', borderRadius:12, marginBottom:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 1fr', gap:10, marginBottom:12 }}>
        <div>
          <Label text="Codi" />
          <Input value={d.code} onChange={v => setD(x => ({ ...x, code: v.slice(0,3).toUpperCase() }))} />
        </div>
        <div>
          <Label text="Nom" />
          <Input value={d.label} onChange={v => setD(x => ({ ...x, label: v }))} />
        </div>
        <div>
          <Label text="Inici" />
          <input type="time" value={d.start} onChange={e => setD(x => ({ ...x, start: e.target.value }))}
            style={{ width:'100%', padding:'9px 10px', border:'var(--hair)', borderRadius:8, fontFamily:'var(--font-mono)', fontSize:13, background:'var(--paper)', outline:'none', boxSizing:'border-box' }} />
        </div>
        <div>
          <Label text="Final" />
          <input type="time" value={d.end} onChange={e => setD(x => ({ ...x, end: e.target.value }))}
            style={{ width:'100%', padding:'9px 10px', border:'var(--hair)', borderRadius:8, fontFamily:'var(--font-mono)', fontSize:13, background:'var(--paper)', outline:'none', boxSizing:'border-box' }} />
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--ink-500)', textTransform:'uppercase', letterSpacing:.06 }}>Color</span>
        {colors.map(c => (
          <button key={c} onClick={() => setD(x => ({ ...x, color: c }))}
            style={{ width:24, height:24, borderRadius:6, background:c, border: d.color===c ? '2px solid var(--terracotta-600)' : '2px solid transparent', cursor:'pointer' }} />
        ))}
        <div style={{ flex:1 }} />
        <Toggle value={d.active} onChange={v => setD(x => ({ ...x, active: v }))} size="sm" />
        <span style={{ fontSize:12, color:'var(--ink-600)' }}>Actiu</span>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => onSave(d)}
          style={{ padding:'7px 16px', background:'var(--terracotta-600)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
          {isNew ? 'Afegir' : 'Desar'}
        </button>
        <button onClick={onCancel}
          style={{ padding:'7px 14px', background:'transparent', color:'var(--ink-600)', border:'var(--hair)', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
          Cancel·lar
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 4. INTEGRACIONS
// ═══════════════════════════════════════════════════════════════════
function IntegrationsTab() {
  const [states, setStates] = useState<Record<string,boolean>>({ whatsapp:false, email:true, gcal:false, thefork:false, web:false });

  const CARDS = [
    { id:'whatsapp', icon:'💬', name:'WhatsApp Business', desc:'Envia confirmacions i recordatoris automàtics per WhatsApp als clients.', color:'#25D366' },
    { id:'email',    icon:'✉️', name:'Email',             desc:'Notificacions per correu electrònic. SMTP configurat via Resend.', color:'#5B6FEF' },
    { id:'gcal',     icon:'📅', name:'Google Calendar',  desc:'Sincronitza les reserves amb el calendari de Google automàticament.', color:'#4285F4' },
    { id:'thefork',  icon:'🍴', name:'TheFork / Resto',  desc:'Importa reserves des de plataformes externes en temps real.', color:'#00848F' },
    { id:'web',      icon:'🌐', name:'Formulari web',     desc:"Formulari de reserves per a la web pública amb confirmació automàtica.", color:'#8B5CF6' },
  ];

  return (
    <div style={{ maxWidth:640 }}>
      <SectionTitle>Integracions</SectionTitle>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {CARDS.map(c => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 18px', background:'var(--paper)', border:'var(--hair)', borderRadius:14, boxShadow:'var(--sh-1)' }}>
            <div style={{ width:44, height:44, borderRadius:10, background:`${c.color}18`, display:'grid', placeItems:'center', fontSize:22, flexShrink:0 }}>{c.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)' }}>{c.name}</span>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: states[c.id] ? 'var(--olive-100)' : 'var(--ink-100)', color: states[c.id] ? 'var(--olive-700)' : 'var(--ink-500)', fontWeight:600 }}>
                  {states[c.id] ? '● Connectat' : '○ No connectat'}
                </span>
              </div>
              <div style={{ fontSize:12, color:'var(--ink-500)', marginTop:4 }}>{c.desc}</div>
            </div>
            <button
              onClick={() => setStates(s => ({ ...s, [c.id]: !s[c.id] }))}
              style={{ padding:'7px 14px', background: states[c.id] ? 'var(--rose-50)' : 'var(--terracotta-600)', color: states[c.id] ? 'var(--rose-700)' : 'white', border: states[c.id] ? '1px solid var(--rose-200)' : 'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:600, flexShrink:0 }}>
              {states[c.id] ? 'Desconnectar' : 'Connectar'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop:20, padding:'14px 16px', background:'var(--ink-50)', borderRadius:10, fontSize:12.5, color:'var(--ink-500)' }}>
        Les integracions de producció requeriran credencials API. Contacta amb el teu proveïdor per obtenir les claus d'accés.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 5. NOTIFICACIONS
// ═══════════════════════════════════════════════════════════════════
function NotificationsTab({ bizId }: { bizId: BusinessId }) {
  const { notifConfigs, updateNotifConfig } = useAppStore();
  const stored = notifConfigs[bizId];
  const [draft, setDraft] = useState<NotifConfig>({ ...stored });
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const { saved, flash } = useSaved();

  useEffect(() => { setDraft({ ...notifConfigs[bizId] }); }, [bizId]);

  function toggle(key: keyof NotifConfig, val: boolean) {
    setDraft(d => ({ ...d, [key]: val }));
  }

  const ITEMS: { key: keyof NotifConfig; label: string; desc: string }[] = [
    { key:'pendingConfirm', label:'Reserves pendents de confirmar', desc:'Avisa quan hi ha reserves sense confirmar a menys de X minuts' },
    { key:'peakAlert',      label:'Pic de reserves',                desc:'Avisa quan el servei supera el 80% de capacitat' },
    { key:'birthdays',      label:'Aniversaris i etiquetes especials', desc:'Avisa quan un client amb etiqueta #aniversari té reserva avui' },
    { key:'resChanges',     label:'Canvis de reserva',               desc:'Avisa quan una reserva es modifica, cancel·la o mou' },
    { key:'clientNotes',    label:'Notes importants del client',      desc:'Avisa quan hi ha notes al perfil del client (al·lèrgies, VIP…)' },
  ];

  return (
    <div style={{ maxWidth:580 }}>
      <SectionTitle>Notificacions</SectionTitle>

      <div style={{ background:'var(--paper)', border:'var(--hair)', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
        {ITEMS.map((item, i) => (
          <div key={item.key} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderBottom: i < ITEMS.length-1 ? 'var(--hair)' : 'none' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-900)' }}>{item.label}</div>
              <div style={{ fontSize:12, color:'var(--ink-500)', marginTop:2 }}>{item.desc}</div>
            </div>
            <Toggle value={draft[item.key] as boolean} onChange={v => toggle(item.key, v)} />
          </div>
        ))}
      </div>

      <div style={{ background:'var(--paper)', border:'var(--hair)', borderRadius:12, padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <Label text="Canal d'enviament" />
          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            {([['intern','Intern 🔔'],['email','Email ✉️'],['whatsapp','WhatsApp 💬']] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setDraft(d => ({ ...d, channel: v }))}
                style={{ padding:'7px 14px', borderRadius:8, border: draft.channel===v ? 'none' : 'var(--hair)', background: draft.channel===v ? 'var(--terracotta-600)' : 'var(--paper)', color: draft.channel===v ? 'white' : 'var(--ink-700)', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Label text="Antelació" />
          <input type="number" min={5} step={5} value={draft.advanceMinutes}
            onChange={e => setDraft(d => ({ ...d, advanceMinutes: Number(e.target.value) }))}
            style={{ width:70, padding:'7px 10px', border:'var(--hair)', borderRadius:8, fontFamily:'var(--font-mono)', fontSize:13, background:'var(--cream)', outline:'none' }} />
          <span style={{ fontSize:13, color:'var(--ink-500)' }}>minuts abans</span>
        </div>
      </div>

      <SaveBar dirty={dirty} saved={saved}
        onSave={() => { updateNotifConfig(bizId, draft); flash(); }}
        onCancel={() => setDraft({ ...stored })} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 6. EQUIP (empleats + rols)
// ═══════════════════════════════════════════════════════════════════
function TeamTab({ bizId }: { bizId: BusinessId }) {
  const [sub, setSub] = useState<'employees'|'roles'>('employees');
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', marginBottom:22 }}>
        <SectionTitle>Equip</SectionTitle>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', gap:2, padding:3, background:'var(--ink-100)', borderRadius:8 }}>
          {([['employees','Empleats'],['roles','Rols']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setSub(k)}
              style={{ padding:'6px 14px', border:'none', borderRadius:6, background: sub===k ? 'var(--paper)' : 'transparent', color:'var(--ink-800)', fontSize:12.5, fontWeight:600, fontFamily:'inherit', cursor:'pointer', boxShadow: sub===k ? 'var(--sh-1)' : 'none' }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {sub === 'employees' && <EmployeesPanel bizId={bizId} />}
      {sub === 'roles'     && <RolesPanel     bizId={bizId} />}
    </div>
  );
}

// ─── Employees panel ──────────────────────────────────────────────
function EmployeesPanel({ bizId }: { bizId: BusinessId }) {
  const { employees, employeeRoles, addEmployee, updateEmployee, deleteEmployee } = useAppStore();
  const bizEmps = employees.filter(e => e.bizId === bizId);
  const bizRoles = employeeRoles.filter(r => r.bizId === bizId && r.active).sort((a,b) => a.order - b.order);
  const [modal, setModal] = useState<Employee | 'new' | null>(null);
  const { saved, flash } = useSaved();

  function handleSave(data: Omit<Employee,'id'> & { id?: string }) {
    if (data.id) { updateEmployee(data.id, data); }
    else { addEmployee({ ...data, bizId }); }
    setModal(null); flash();
  }

  return (
    <div style={{ maxWidth:720 }}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
        <button onClick={() => setModal('new')}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'var(--terracotta-600)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
          <Icon d={I.plus} size={13} /> Nou empleat
        </button>
      </div>

      {modal && (
        <EmployeeModal
          initial={modal === 'new' ? null : modal}
          bizId={bizId}
          roles={bizRoles}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {bizEmps.map(emp => {
          const role = bizRoles.find(r => r.id === emp.roleId);
          return (
            <div key={emp.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'var(--paper)', border:'var(--hair)', borderRadius:12, boxShadow:'var(--sh-1)', opacity: emp.active ? 1 : 0.55 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background: role?.color ?? 'var(--ink-100)', display:'grid', placeItems:'center', flexShrink:0 }}>
                <span style={{ fontSize:12, fontWeight:700, color: role?.textColor ?? 'var(--ink-600)' }}>{emp.initials}</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, fontWeight:600, color:'var(--ink-900)' }}>{emp.fullName}</div>
                <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:2 }}>
                  {role?.name ?? '—'}
                  {emp.phone && <span style={{ marginLeft:10 }}>· {emp.phone}</span>}
                </div>
              </div>
              <span style={{ fontSize:11, padding:'3px 9px', borderRadius:20, background: emp.active ? 'var(--olive-100)' : 'var(--ink-100)', color: emp.active ? 'var(--olive-700)' : 'var(--ink-500)', fontWeight:600 }}>
                {emp.active ? 'Actiu' : 'Inactiu'}
              </span>
              <button onClick={() => setModal(emp)}
                style={{ width:28, height:28, border:'var(--hair)', borderRadius:6, background:'transparent', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--ink-500)' }}>
                <Icon d={I.pencil} size={13} />
              </button>
              <button onClick={() => { if (confirm(`Eliminar ${emp.fullName}?`)) { deleteEmployee(emp.id); flash(); } }}
                style={{ width:28, height:28, border:'1px solid var(--rose-200)', borderRadius:6, background:'var(--rose-50)', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--rose-500)' }}>
                <Icon d={I.trash} size={13} />
              </button>
            </div>
          );
        })}
        {bizEmps.length === 0 && (
          <div style={{ padding:'40px 0', textAlign:'center', color:'var(--ink-400)', fontSize:13 }}>Cap empleat en aquest negoci</div>
        )}
      </div>
      {saved && <div style={{ marginTop:14, fontSize:12.5, color:'var(--olive-700)', fontWeight:600 }}>✓ Canvis desats</div>}
    </div>
  );
}

function EmployeeModal({ initial, bizId, roles, onSave, onClose }: {
  initial: Employee | null; bizId: BusinessId;
  roles: EmployeeRole[]; onSave: (d: any) => void; onClose: () => void;
}) {
  const base: Omit<Employee,'id'> = initial ?? {
    bizId, fullName:'', initials:'', roleId: roles[0]?.id ?? '',
    active:true, clockedIn:false, startedAt:null,
  };
  const [d, setD] = useState<any>({ ...base });

  function computeInitials(name: string) {
    return name.split(/\s+/).slice(0,2).map(s => s[0]?.toUpperCase() ?? '').join('');
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'var(--paper)', borderRadius:16, padding:'24px 28px', width:460, boxShadow:'var(--sh-3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:17, fontWeight:600, color:'var(--ink-900)', marginBottom:20 }}>
          {initial ? 'Editar empleat' : 'Nou empleat'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <Label text="Nom complet" />
            <Input value={d.fullName} onChange={v => setD((x: any) => ({ ...x, fullName: v, initials: computeInitials(v) }))} />
          </div>
          <div>
            <Label text="Inicials" />
            <Input value={d.initials} onChange={v => setD((x: any) => ({ ...x, initials: v.toUpperCase().slice(0,3) }))} />
          </div>
          <div>
            <Label text="Rol" />
            <select value={d.roleId} onChange={e => setD((x: any) => ({ ...x, roleId: e.target.value }))}
              style={{ width:'100%', padding:'9px 12px', border:'var(--hair)', borderRadius:8, fontFamily:'inherit', fontSize:13, background:'var(--paper)', outline:'none' }}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <Label text="Telèfon" />
            <Input value={d.phone ?? ''} onChange={v => setD((x: any) => ({ ...x, phone: v }))} />
          </div>
          <div>
            <Label text="Email" />
            <Input value={d.email ?? ''} onChange={v => setD((x: any) => ({ ...x, email: v }))} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <Label text="Notes internes" />
            <textarea value={d.notes ?? ''} onChange={e => setD((x: any) => ({ ...x, notes: e.target.value }))}
              rows={2}
              style={{ width:'100%', padding:'9px 12px', border:'var(--hair)', borderRadius:8, fontFamily:'inherit', fontSize:13, background:'var(--cream)', outline:'none', resize:'vertical', boxSizing:'border-box' }} />
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <Toggle value={d.active} onChange={v => setD((x: any) => ({ ...x, active: v }))} size="sm" />
          <span style={{ fontSize:13, color:'var(--ink-700)' }}>Empleat actiu</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => onSave({ ...d, id: initial?.id })}
            style={{ flex:1, padding:'9px 0', background:'var(--terracotta-600)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
            {initial ? 'Desar canvis' : 'Afegir empleat'}
          </button>
          <button onClick={onClose}
            style={{ padding:'9px 18px', background:'transparent', color:'var(--ink-600)', border:'var(--hair)', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
            Cancel·lar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Roles panel ──────────────────────────────────────────────────
function RolesPanel({ bizId }: { bizId: BusinessId }) {
  const { employeeRoles, addEmployeeRole, updateEmployeeRole, deleteEmployeeRole } = useAppStore();
  const roles = employeeRoles.filter(r => r.bizId === bizId).sort((a,b) => a.order - b.order);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#e7ecd3');
  const [newText, setNewText] = useState('#5d6e3a');
  const { saved, flash } = useSaved();

  const PRESET_COLORS = [
    { bg:'#f3e3d6', text:'#8a4a2a' }, { bg:'#e7ecd3', text:'#5d6e3a' },
    { bg:'#d4e5ee', text:'#3a6b8a' }, { bg:'#ecdaf0', text:'#7a4288' },
    { bg:'#f3d7d1', text:'#aa3d2e' }, { bg:'#e6d3c8', text:'#552d20' },
    { bg:'#fde8c8', text:'#a06020' }, { bg:'#dbe6f4', text:'#2a5a8a' },
  ];

  return (
    <div style={{ maxWidth:600 }}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
        <button onClick={() => setAdding(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'var(--terracotta-600)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:600 }}>
          <Icon d={I.plus} size={13} /> Nou rol
        </button>
      </div>

      {adding && (
        <div style={{ padding:'14px 16px', background:'var(--cream)', border:'2px solid var(--terracotta-200)', borderRadius:12, marginBottom:14 }}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:160 }}>
              <Label text="Nom del rol" />
              <Input value={newName} onChange={setNewName} />
            </div>
            <div>
              <Label text="Color" />
              <div style={{ display:'flex', gap:5, marginTop:6 }}>
                {PRESET_COLORS.map(p => (
                  <button key={p.bg} onClick={() => { setNewColor(p.bg); setNewText(p.text); }}
                    style={{ width:22, height:22, borderRadius:5, background:p.bg, border: newColor===p.bg ? '2px solid var(--terracotta-600)' : '2px solid transparent', cursor:'pointer' }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button onClick={() => {
              if (!newName.trim()) return;
              addEmployeeRole({ bizId, name: newName.trim(), color: newColor, textColor: newText, order: roles.length, active: true });
              setNewName(''); setAdding(false); flash();
            }}
              style={{ padding:'7px 16px', background:'var(--terracotta-600)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
              Afegir
            </button>
            <button onClick={() => setAdding(false)}
              style={{ padding:'7px 14px', background:'transparent', color:'var(--ink-600)', border:'var(--hair)', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
              Cancel·lar
            </button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {roles.map(role => (
          <div key={role.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--paper)', border:'var(--hair)', borderRadius:12, boxShadow:'var(--sh-1)' }}>
            <span style={{ padding:'4px 12px', borderRadius:20, background:role.color, color:role.textColor, fontSize:12, fontWeight:700 }}>{role.name}</span>
            <div style={{ flex:1 }} />
            <Toggle value={role.active} onChange={v => { updateEmployeeRole(role.id, { active: v }); flash(); }} size="sm" />
            <button onClick={() => { if (confirm(`Eliminar rol "${role.name}"?`)) { deleteEmployeeRole(role.id); flash(); } }}
              style={{ width:28, height:28, border:'1px solid var(--rose-200)', borderRadius:6, background:'var(--rose-50)', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--rose-500)' }}>
              <Icon d={I.trash} size={13} />
            </button>
          </div>
        ))}
        {roles.length === 0 && (
          <div style={{ padding:'40px 0', textAlign:'center', color:'var(--ink-400)', fontSize:13 }}>Cap rol definit</div>
        )}
      </div>
      {saved && <div style={{ marginTop:14, fontSize:12.5, color:'var(--olive-700)', fontWeight:600 }}>✓ Canvis desats</div>}
    </div>
  );
}

// ─── Toggle component ─────────────────────────────────────────────
function Toggle({ value, onChange, size = 'md' }: {
  value: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 32 : 40;
  const h = size === 'sm' ? 18 : 22;
  const ball = size === 'sm' ? 12 : 16;
  const off = size === 'sm' ? 3 : 3;
  return (
    <button onClick={() => onChange(!value)}
      style={{ width:w, height:h, borderRadius:h/2, background: value ? 'var(--terracotta-600)' : 'var(--ink-200)', border:'none', cursor:'pointer', position:'relative', flexShrink:0, transition:'background .2s' }}>
      <span style={{ position:'absolute', top:off, left: value ? w-ball-off : off, width:ball, height:ball, borderRadius:'50%', background:'white', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  );
}
