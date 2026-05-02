import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import type { FloorTable, TableStatus } from '@/types';

const STATUS_STYLE: Record<TableStatus, { bg: string; color: string; label: string }> = {
  free:      { bg:'rgba(70,130,60,.12)',   color:'#2e7040', label:'Lliure'    },
  confirmed: { bg:'rgba(30,80,160,.12)',   color:'#1a4ea0', label:'Confirmada'},
  reserved:  { bg:'rgba(100,40,140,.12)',  color:'#6a1b9a', label:'Reservada' },
  pending:   { bg:'rgba(190,100,20,.12)',  color:'#b05a00', label:'Pendent'   },
  seated:    { bg:'rgba(190,50,40,.12)',   color:'#b52b22', label:'Ocupada'   },
  blocked:   { bg:'rgba(60,50,40,.08)',    color:'#666',    label:'Bloquejada'},
  playing:   { bg:'rgba(0,120,160,.12)',   color:'#007799', label:'En joc'    },
};

export default function MobileTablesScreen() {
  const { selectedBusiness, floorPlans, updateFloorTable, releaseTable, releaseAllTables } = useAppStore();
  const plan       = floorPlans[selectedBusiness];
  const [zoneId, setZoneId] = useState<string>('__all__');
  const [selTable, setSelTable] = useState<FloorTable | null>(null);

  // Release-all double confirmation state
  const [showRelease1, setShowRelease1] = useState(false);
  const [showRelease2, setShowRelease2] = useState(false);
  const [confirmText, setConfirmText]   = useState('');

  const zones  = useMemo(() => plan ? [...plan.zones].sort((a, b) => a.order - b.order) : [], [plan]);
  const tables = useMemo(() => {
    if (!plan) return [];
    const base = zoneId === '__all__' ? plan.tables : plan.tables.filter(t => t.zone === zoneId);
    return [...base].sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [plan, zoneId]);

  // Counts
  const counts = useMemo(() => {
    if (!plan) return {} as Record<TableStatus, number>;
    return plan.tables.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {} as Record<TableStatus, number>);
  }, [plan]);

  if (!plan) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-500)', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:28 }}>🗺️</div>
      <div style={{ fontFamily:'var(--font-serif)', fontSize:16 }}>Sense plànol configurat</div>
    </div>
  );

  const occupiedCount = (counts['seated'] ?? 0) + (counts['confirmed'] ?? 0) + (counts['reserved'] ?? 0) + (counts['pending'] ?? 0);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Status summary strip */}
      <div style={{ padding:'10px 14px 8px', background:'var(--paper)', borderBottom:'var(--hair)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:2 }}>
          {(['free','seated','confirmed','reserved','pending','blocked'] as TableStatus[]).map(s => {
            const n = counts[s] ?? 0;
            if (!n) return null;
            const st = STATUS_STYLE[s];
            return (
              <span key={s} style={{ flexShrink:0, fontSize:11.5, fontWeight:600, padding:'3px 9px', borderRadius:8, background:st.bg, color:st.color, whiteSpace:'nowrap' }}>
                {n} {st.label.toLowerCase()}{n > 1 && s !== 'playing' ? 'es' : ''}
              </span>
            );
          })}
        </div>
      </div>

      {/* Zone tabs */}
      <div style={{ background:'var(--paper)', borderBottom:'var(--hair)', flexShrink:0, overflowX:'auto', display:'flex', padding:'6px 10px' }}>
        {[{ id:'__all__', label:`Totes (${plan.tables.length})` }, ...zones.map(z => ({ id:z.id, label:z.label }))].map(z => (
          <button key={z.id} onClick={() => setZoneId(z.id)}
            style={{
              flexShrink:0, padding:'5px 12px', borderRadius:8, border:'none',
              background: zoneId === z.id ? 'var(--ink-900)' : 'transparent',
              color: zoneId === z.id ? 'var(--cream)' : 'var(--ink-600)',
              fontWeight: zoneId === z.id ? 600 : 500,
              fontSize:13, cursor:'pointer', fontFamily:'inherit',
              marginRight:4,
            }}>
            {z.label}
          </button>
        ))}
      </div>

      {/* Table grid */}
      <div className="scroll" style={{ flex:1, overflowY:'auto', padding:'12px 14px var(--scroll-pad-bottom)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:10 }}>
          {tables.map(t => {
            const st = STATUS_STYLE[t.status];
            return (
              <button key={t.id} onClick={() => setSelTable(t)}
                style={{
                  padding:'12px 10px', borderRadius:12, border:`1.5px solid ${st.bg}`,
                  background:st.bg, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                  display:'flex', flexDirection:'column', gap:4,
                }}>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)', lineHeight:1 }}>
                  {t.name ?? t.id}
                </div>
                <div style={{ fontSize:10.5, color:'var(--ink-500)' }}>{t.cap} pax</div>
                <span style={{ fontSize:10, fontWeight:700, color:st.color, marginTop:2 }}>
                  {st.label}
                </span>
                {t.time && (
                  <span className="mono" style={{ fontSize:10.5, color:'var(--ink-700)' }}>{t.time}</span>
                )}
                {t.res && (
                  <span style={{ fontSize:10, color:'var(--ink-600)', lineHeight:1.2, marginTop:1 }}
                    title={t.res}>
                    {t.res.length > 12 ? t.res.slice(0, 11) + '…' : t.res}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {tables.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--ink-500)', fontSize:14 }}>
            Cap taula en aquesta zona
          </div>
        )}

        {/* ── Danger zone: release all ──────────────────────────── */}
        {occupiedCount > 0 && (
          <div style={{ marginTop:24, padding:'14px 16px', background:'rgba(200,50,50,.05)', border:'1px solid rgba(200,50,50,.15)', borderRadius:12 }}>
            <div style={{ fontSize:11.5, fontWeight:700, color:'#a03030', letterSpacing:.04, textTransform:'uppercase', marginBottom:8 }}>
              Zona de risc
            </div>
            <div style={{ fontSize:12.5, color:'var(--ink-600)', marginBottom:12, lineHeight:1.45 }}>
              Hi ha <b>{occupiedCount}</b> taula{occupiedCount > 1 ? 'es' : ''} en ús. Pots alliberar-les totes alhora.
            </div>
            <button onClick={() => setShowRelease1(true)}
              style={{ width:'100%', padding:'10px', background:'transparent', border:'1px solid rgba(200,50,50,.35)', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700, color:'#c0392b' }}>
              🔓 Alliberar totes les taules
            </button>
          </div>
        )}
      </div>

      {/* Table action sheet */}
      {selTable && (
        <TableActionSheet
          table={selTable}
          bizId={selectedBusiness}
          onAction={(status) => {
            updateFloorTable(selectedBusiness, selTable.id, { status });
            setSelTable(null);
          }}
          onRelease={() => {
            releaseTable(selectedBusiness, selTable.id);
            setSelTable(null);
          }}
          onClose={() => setSelTable(null)}
        />
      )}

      {/* ── Release all — step 1 ──────────────────────────────────── */}
      {showRelease1 && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', background:'var(--paper)', padding:'20px 18px calc(env(safe-area-inset-bottom) + 24px)', borderRadius:'20px 20px 0 0' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--ink-900)', marginBottom:8 }}>🔓 Alliberar totes les taules</div>
            <div style={{ fontSize:13.5, color:'var(--ink-600)', marginBottom:20, lineHeight:1.55 }}>
              Aquesta acció alliberarà totes les taules ocupades o reservades.<br />
              <span style={{ color:'var(--ink-400)', fontSize:12.5 }}>Les taules bloquejades es mantindran.</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowRelease1(false)}
                style={{ flex:1, padding:'13px', background:'var(--ink-100)', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:'var(--ink-800)' }}>
                Cancel·lar
              </button>
              <button onClick={() => { setShowRelease1(false); setShowRelease2(true); setConfirmText(''); }}
                style={{ flex:1, padding:'13px', background:'#c0392b', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, color:'white' }}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Release all — step 2: type ALLIBERAR ─────────────────── */}
      {showRelease2 && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', background:'var(--paper)', padding:'20px 18px calc(env(safe-area-inset-bottom) + 24px)', borderRadius:'20px 20px 0 0' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#c0392b', marginBottom:8 }}>Confirmació final</div>
            <div style={{ fontSize:13.5, color:'var(--ink-600)', marginBottom:16, lineHeight:1.55 }}>
              Escriu <b style={{ color:'#c0392b', fontFamily:'monospace' }}>ALLIBERAR</b> per confirmar.
            </div>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="ALLIBERAR"
              autoFocus
              style={{
                width:'100%', padding:'12px 14px', fontSize:15, fontFamily:'monospace',
                border:'2px solid rgba(200,50,50,.35)', borderRadius:10,
                background:'var(--cream)', color:'var(--ink-900)', outline:'none',
                boxSizing:'border-box', marginBottom:16,
                letterSpacing:2,
              }}
            />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setShowRelease2(false); setConfirmText(''); }}
                style={{ flex:1, padding:'13px', background:'var(--ink-100)', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:'var(--ink-800)' }}>
                Cancel·lar
              </button>
              <button
                disabled={confirmText !== 'ALLIBERAR'}
                onClick={() => { releaseAllTables(selectedBusiness); setShowRelease2(false); setConfirmText(''); }}
                style={{
                  flex:1, padding:'13px', border:'none', borderRadius:12, cursor: confirmText === 'ALLIBERAR' ? 'pointer' : 'not-allowed',
                  fontFamily:'inherit', fontSize:14, fontWeight:700, color:'white',
                  background: confirmText === 'ALLIBERAR' ? '#c0392b' : 'rgba(200,50,50,.3)',
                  transition:'background .15s',
                }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Table action sheet ───────────────────────────────────────────────────────
function TableActionSheet({ table: t, onAction, onRelease, onClose }: {
  table: FloorTable; bizId: string;
  onAction: (status: TableStatus) => void;
  onRelease: () => void;
  onClose: () => void;
}) {
  const st = STATUS_STYLE[t.status];
  const isOccupied = ['seated','confirmed','reserved','pending'].includes(t.status);

  const allActions: Array<{ label: string; status: TableStatus; color?: string }> = [
    { label: '✅ Marcar lliure',     status: 'free'      as TableStatus },
    { label: '🍽️ Marcar ocupada',   status: 'seated'    as TableStatus, color: 'var(--terracotta-600)' },
    { label: '📋 Confirmar reserva', status: 'confirmed' as TableStatus, color: '#1a4ea0' },
    { label: '🔒 Bloquejar',         status: 'blocked'   as TableStatus, color: '#888' },
  ];
  const actions = allActions.filter(a => a.status !== t.status);

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,.3)' }} />
      <div style={{
        position:'fixed', bottom:60, left:0, right:0, zIndex:100,
        background:'var(--paper)', borderRadius:'18px 18px 0 0',
        boxShadow:'0 -4px 24px rgba(0,0,0,.15)', padding:'14px 18px 24px',
      }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--ink-200)', margin:'0 auto 14px' }} />

        {/* Table info */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <span style={{ width:44, height:44, borderRadius:10, background:st.bg, display:'grid', placeItems:'center', fontSize:18, fontWeight:700, color:'var(--ink-900)' }}>
            {t.name ?? t.id}
          </span>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--ink-900)' }}>Taula {t.name ?? t.id}</div>
            <div style={{ fontSize:12, color:'var(--ink-500)' }}>
              {t.cap} pax · <span style={{ color:st.color, fontWeight:600 }}>{st.label}</span>
              {t.time ? ` · ${t.time}` : ''}
            </div>
            {t.res && (
              <div style={{ fontSize:12, color:'var(--ink-700)', fontWeight:600, marginTop:2 }}>
                {t.res}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-400)' }}>
            <Icon d={I.x} size={18} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {isOccupied && (
            <button onClick={onRelease}
              style={{
                padding:'12px 16px', borderRadius:11, border:'1px solid rgba(200,50,50,.25)',
                background:'rgba(200,50,50,.05)', cursor:'pointer', fontFamily:'inherit',
                fontSize:14, fontWeight:600, textAlign:'left',
                color: '#c0392b',
              }}>
              🔓 Alliberar taula
            </button>
          )}
          {actions.map(a => (
            <button key={a.status} onClick={() => onAction(a.status)}
              style={{
                padding:'12px 16px', borderRadius:11, border:'1px solid rgba(60,40,20,.1)',
                background:'var(--cream)', cursor:'pointer', fontFamily:'inherit',
                fontSize:14, fontWeight:600, textAlign:'left',
                color: a.color ?? 'var(--ink-900)',
              }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
