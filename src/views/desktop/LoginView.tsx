import React, { useState } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { STAFF, ROLES, initials, avIdx } from '@/data/mockData';
import type { StaffMember } from '@/data/mockData';

interface Props { onLogin: (user: StaffMember) => void; }

export default function LoginView({ onLogin }: Props) {
  const [pin, setPin] = useState('');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const ganxoStaff = STAFF.filter(s => s.biz.includes('ganxo'));

  return (
    <div style={{ width:'100%',height:'100%',overflow:'auto',background:'radial-gradient(ellipse at top,#f5e9d6 0%,#ebe5d8 60%,#ddd4c2 100%)',display:'grid',placeItems:'center',padding:32 }}>
      <div style={{ width:720,maxWidth:'100%',background:'var(--paper)',borderRadius:18,boxShadow:'0 24px 60px rgba(60,40,20,.18),0 4px 12px rgba(60,40,20,.08)',overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'28px 32px 22px',background:'linear-gradient(180deg,#2a201a 0%,#1d1612 100%)',color:'var(--cream)',display:'flex',alignItems:'center',gap:14 }}>
          <div style={{ width:44,height:44,borderRadius:10,background:'var(--terracotta-500)',color:'#fff',display:'grid',placeItems:'center',fontFamily:'var(--font-serif)',fontWeight:500,fontSize:22 }}>N</div>
          <div>
            <div style={{ fontFamily:'var(--font-serif)',fontSize:22,fontWeight:500,lineHeight:1.1 }}>NCR Reserves</div>
            <div style={{ fontSize:12,color:'rgba(251,247,238,.7)',marginTop:2 }}>Tria el teu nom per començar el torn</div>
          </div>
          <div style={{ flex:1 }} />
          <div style={{ fontSize:11.5,color:'rgba(251,247,238,.6)' }}>Divendres 24 abril · 11:48</div>
        </div>

        {!selected ? (
          <div style={{ padding:24 }}>
            <div style={{ fontSize:11,fontWeight:700,letterSpacing:.06,textTransform:'uppercase',color:'var(--ink-500)',marginBottom:12 }}>Empleats · El Ganxo</div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8 }}>
              {ganxoStaff.map(s=>{
                const role = ROLES[s.role];
                return (
                  <button key={s.id} onClick={()=>setSelected(s)}
                    style={{ padding:'12px 12px 10px',background:'var(--cream)',border:'1.5px solid rgba(60,40,20,.1)',borderRadius:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',flexDirection:'column',gap:6,transition:'all .1s' }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--terracotta-500)';(e.currentTarget as HTMLElement).style.transform='translateY(-1px)';}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(60,40,20,.1)';(e.currentTarget as HTMLElement).style.transform='none';}}>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span className={`avatar av-${avIdx(s.name)}`} style={{ width:32,height:32,fontSize:11 }}>{initials(s.name)}</span>
                      {s.clockedIn && <span style={{ marginLeft:'auto',width:8,height:8,borderRadius:'50%',background:'var(--olive-500)',boxShadow:'0 0 0 3px var(--olive-100)' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize:13.5,fontWeight:600,color:'var(--ink-900)' }}>{s.name}</div>
                      <div style={{ display:'inline-flex',alignItems:'center',gap:5,marginTop:3,padding:'1px 7px',borderRadius:4,background:role.bg,color:role.hue,fontSize:10.5,fontWeight:600 }}>{role.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop:16,padding:'10px 12px',background:'var(--ink-50)',borderRadius:8,fontSize:12,color:'var(--ink-600)' }}>
              No hi ets? <span style={{ color:'var(--terracotta-700)',fontWeight:600,cursor:'pointer' }}>Contacta amb l'encarregat</span> per afegir-te.
            </div>
          </div>
        ) : (
          <div style={{ padding:'32px 24px' }}>
            <button onClick={()=>{ setSelected(null); setPin(''); }} style={{ display:'flex',alignItems:'center',gap:6,marginBottom:16,padding:'4px 8px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,color:'var(--ink-700)' }}>
              <Icon d={I.chevL} size={13} /> Canviar d'usuari
            </button>
            <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:24 }}>
              <span className={`avatar av-${avIdx(selected.name)}`} style={{ width:56,height:56,fontSize:18 }}>{initials(selected.name)}</span>
              <div>
                <div style={{ fontFamily:'var(--font-serif)',fontSize:22,fontWeight:500,color:'var(--ink-900)' }}>Hola, {selected.name.split(' ')[0]}</div>
                <div style={{ fontSize:13,color:'var(--ink-600)' }}>Introdueix el teu PIN per fitxar entrada.</div>
              </div>
            </div>
            {/* PIN display */}
            <div style={{ display:'flex',gap:8,justifyContent:'center',marginBottom:18 }}>
              {[0,1,2,3].map(i=>(
                <span key={i} style={{ width:48,height:56,borderRadius:10,background:'var(--cream)',border:pin.length===i?'2px solid var(--terracotta-500)':'1.5px solid rgba(60,40,20,.12)',display:'grid',placeItems:'center',fontFamily:'var(--font-serif)',fontSize:28,fontWeight:600,color:'var(--ink-900)' }}>{pin[i]?'●':''}</span>
              ))}
            </div>
            {/* Numpad */}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,maxWidth:280,margin:'0 auto' }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n,i)=>(
                <button key={i} onClick={()=>{ if(n==='⌫') setPin(p=>p.slice(0,-1)); else if(typeof n==='number') setPin(p=>(p+n).slice(0,4)); }}
                  disabled={n===''} style={{ padding:'14px 0',background:n===''?'transparent':'var(--cream)',border:n===''?'none':'1.5px solid rgba(60,40,20,.1)',borderRadius:10,fontFamily:'var(--font-serif)',fontSize:22,fontWeight:500,color:'var(--ink-900)',cursor:n===''?'default':'pointer' }}>{n}</button>
              ))}
            </div>
            <button onClick={()=>onLogin(selected)} disabled={pin.length<4}
              style={{ width:'100%',marginTop:18,padding:12,background:'var(--terracotta-600)',color:'white',border:'none',borderRadius:12,cursor:pin.length<4?'default':'pointer',fontFamily:'inherit',fontSize:14,fontWeight:600,opacity:pin.length<4?.5:1 }}>
              Fitxar entrada i començar torn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
