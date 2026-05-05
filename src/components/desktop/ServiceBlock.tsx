import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { ReservationRow } from './ReservationRow';
import type { TableInfo } from './ReservationRow';
import { useAppStore } from '@/store/useAppStore';
import { getZoneIcon, getZoneColor } from '@/data/mockData';
import type { Reservation, FloorPlan } from '@/types';

function buildTableInfo(res: Reservation, plan: FloorPlan | undefined): TableInfo | null {
  if (!plan || !res.tableIds || res.tableIds.length === 0) return null;
  const tables = res.tableIds
    .map(id => plan.tables.find(t => t.id === id))
    .filter(Boolean) as NonNullable<ReturnType<typeof plan.tables.find>>[];
  if (tables.length === 0) return null;
  const zoneId    = tables[0].zone;
  const zone      = plan.zones.find(z => z.id === zoneId);
  const zoneLabel = zone?.label ?? zoneId;
  const names     = tables.map(t => t.name ?? t.id);
  const tableStr  = names.length === 1 ? `Taula ${names[0]}` : `Taules ${names.join(' + ')}`;
  return { icon: getZoneIcon(zoneLabel), zoneLabel, tableStr, ...getZoneColor(zoneLabel) };
}

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export interface ActiveStaffMember {
  name: string;
  role: string;
  hours: string;
}

interface Props {
  label: string;
  sub: string;
  ico: string;
  list: Reservation[];
  selectedId?: string | null;
  onSelect?: (r: Reservation) => void;
  nowTime?: string;
  defaultOpen?: boolean;
  activeStaff?: ActiveStaffMember[];
}

export function ServiceBlock({ label, sub, ico, list, selectedId, onSelect, nowTime, defaultOpen = true, activeStaff }: Props) {
  const { floorPlans, selectedBusiness } = useAppStore();
  const plan = floorPlans[selectedBusiness];

  const [open, setOpen] = useState(defaultOpen);
  const [staffOpen, setStaffOpen] = useState(false);
  const staffRef = useRef<HTMLDivElement>(null);

  const totalPax = list.reduce((s, r) => s + r.pax, 0);
  const confirmed = list.filter(r => r.status === 'confirmed' || r.status === 'seated').length;
  const pending   = list.filter(r => r.status === 'pending').length;

  // Close staff popover on outside click
  useEffect(() => {
    if (!staffOpen) return;
    function handleClick(e: MouseEvent) {
      if (staffRef.current && !staffRef.current.contains(e.target as Node)) {
        setStaffOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [staffOpen]);

  const buckets = useMemo(() => {
    const minT = Math.floor(Math.min(...list.map(r => parseTime(r.time))) / 30) * 30;
    const maxT = Math.ceil(Math.max(...list.map(r => parseTime(r.time))) / 30) * 30 + 30;
    const bs = [];
    for (let t = minT; t < maxT; t += 30) {
      const inB = list.filter(r => { const m = parseTime(r.time); return m >= t && m < t + 30; });
      bs.push({ label: `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`, pax: inB.reduce((s,r)=>s+r.pax,0) });
    }
    return bs;
  }, [list]);

  const maxPax = Math.max(...buckets.map(b => b.pax), 1);

  const groups = useMemo(() => {
    const by: Record<string, Reservation[]> = {};
    list.forEach(r => { (by[r.time] ||= []).push(r); });
    return Object.entries(by).sort(([a],[b]) => a.localeCompare(b));
  }, [list]);

  const isMigdia = label === 'Migdia';

  return (
    <section style={{ background:'var(--paper)', border:'var(--hair)', borderRadius:14, overflow:'hidden', boxShadow:'var(--sh-1)' }}>
      <button onClick={() => setOpen(!open)} style={{ display:'flex',alignItems:'center',gap:14,padding:'14px 18px',width:'100%',textAlign:'left',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',borderBottom:open?'var(--hair)':'none' }}>
        <span style={{ fontSize:20,width:32,height:32,borderRadius:8,background:isMigdia?'var(--clay-50)':'var(--plum-100)',color:isMigdia?'var(--clay-700)':'var(--plum-700)',display:'grid',placeItems:'center',flex:'none' }}>{ico}</span>
        <div style={{ flex:'none' }}>
          <div style={{ display:'flex',alignItems:'baseline',gap:8 }}>
            <span style={{ fontFamily:'var(--font-serif)',fontSize:19,fontWeight:500,color:'var(--ink-900)',letterSpacing:-.3 }}>Servei de {label.toLowerCase()}</span>
            <span style={{ fontSize:12,color:'var(--ink-500)' }}>· {sub}</span>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginTop:3,fontSize:11.5,color:'var(--ink-600)' }}>
            <span><b style={{ color:'var(--ink-800)' }}>{list.length}</b> reserves</span>
            <span>·</span>
            <span><b style={{ color:'var(--ink-800)' }}>{totalPax}</b> comensals</span>
            {activeStaff && activeStaff.length > 0 && (
              <>
                <span>·</span>
                <div ref={staffRef} style={{ position:'relative' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setStaffOpen(s => !s); }}
                    style={{ display:'flex',alignItems:'center',gap:4,padding:'2px 7px',border:'1px solid rgba(60,120,60,.25)',borderRadius:10,background:staffOpen?'rgba(60,120,60,.1)':'rgba(60,120,60,.06)',cursor:'pointer',fontFamily:'inherit',fontSize:11.5,color:'var(--olive-700)' }}>
                    <b>{activeStaff.length}</b> a sala
                    <Icon d={I.chevD} size={11} />
                  </button>
                  {staffOpen && (
                    <div style={{ position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:200,background:'var(--paper)',border:'var(--hair)',borderRadius:10,boxShadow:'var(--sh-2)',minWidth:200,padding:'6px 0' }}>
                      <div style={{ padding:'4px 12px 6px',fontSize:10.5,fontWeight:700,letterSpacing:.06,textTransform:'uppercase',color:'var(--ink-400)',borderBottom:'var(--hair)' }}>
                        Personal a sala — {label.toLowerCase()}
                      </div>
                      {activeStaff.map((s, i) => (
                        <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'7px 12px',borderBottom: i < activeStaff!.length - 1 ? '1px solid rgba(60,40,20,.05)' : 'none' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13,fontWeight:600,color:'var(--ink-900)' }}>{s.name}</div>
                            <div style={{ fontSize:11,color:'var(--ink-500)',marginTop:1 }}>{s.role}</div>
                          </div>
                          <span className="mono" style={{ fontSize:11.5,fontWeight:600,color:'var(--ink-700)',background:'var(--ink-100)',padding:'2px 6px',borderRadius:4 }}>
                            {s.hours}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {(!activeStaff || activeStaff.length === 0) && (
              <><span>·</span><span><b style={{ color:'var(--olive-700)' }}>{confirmed}</b> a servei</span></>
            )}
            {pending > 0 && <><span>·</span><span><b style={{ color:'var(--clay-700)' }}>{pending}</b> pendents</span></>}
          </div>
        </div>
        <div style={{ flex:1 }} />
        {/* Density strip */}
        <div style={{ display:'flex',alignItems:'flex-end',gap:3,height:42 }}>
          {buckets.map((b, i) => {
            const isNow = nowTime && b.label === nowTime;
            const h = (b.pax / maxPax) * 32 + 2;
            return (
              <div key={i} title={`${b.label} · ${b.pax} pax`} style={{ width:10,height:h,background:isNow?'var(--terracotta-600)':b.pax>0?'var(--ink-400)':'var(--ink-200)',borderRadius:2,alignSelf:'flex-end' }} />
            );
          })}
        </div>
        <span style={{ color:'var(--ink-500)',marginLeft:6,transform:open?'rotate(180deg)':'none',transition:'transform .2s' }}>
          <Icon d={I.chevD} size={16} />
        </span>
      </button>

      {open && (
        <div className="scroll" style={{ padding:'6px 0', maxHeight:460, overflowY:'auto' }}>
          {groups.map(([time, rows]) => {
            const isNow = time === nowTime;
            return (
              <div key={time} style={{ display:'grid',gridTemplateColumns:'72px 1fr',alignItems:'flex-start',padding:'6px 18px',background:isNow?'linear-gradient(90deg,rgba(222,122,81,0.06),transparent 40%)':'transparent' }}>
                <div style={{ paddingTop:10,display:'flex',flexDirection:'column',alignItems:'flex-start' }}>
                  <span className="mono" style={{ fontSize:14,fontWeight:700,letterSpacing:.3,color:isNow?'var(--terracotta-700)':'var(--ink-900)' }}>{time}</span>
                  <span style={{ fontSize:10.5,color:'var(--ink-500)',marginTop:1 }}>{rows.length} res · {rows.reduce((s,r)=>s+r.pax,0)} pax</span>
                </div>
                <div style={{ display:'flex',flexDirection:'column' }}>
                  {rows.map(r => (
                    <ReservationRow key={r.id} res={r}
                      selected={selectedId === r.id}
                      tableInfo={buildTableInfo(r, plan)}
                      onClick={() => onSelect?.(r)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
