import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import DatePickerPopover from '@/components/shared/DatePickerPopover';
import TimePickerPopover from '@/components/shared/TimePickerPopover';
import { Tag } from '@/components/shared/StatusChip';
import { initials, avIdx, isoDate } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import type { Customer, BusinessId, ReservationStatus } from '@/types';
import {
  rankCustomers, computeCustomerStats,
  countVisitsInPeriod, periodLabel,
  type CustomerStats, type Period,
} from '@/utils/loyalty';

const ALL_TAGS = ['vip','regular','allergy','birthday','conflictiu','terrassa'] as const;
const TAG_LABEL: Record<string, string> = {
  vip:'VIP', regular:'Habitual', allergy:'Al·lèrgia',
  birthday:'Aniversari', conflictiu:'Conflictiu', terrassa:'Terrassa',
};

// Filter ids — match Customer.tags entries (plus 'all' for no filter, 'ranking' for points sort)
type ClientFilter = 'all' | 'ranking' | 'vip' | 'regular' | 'allergy' | 'birthday';
const FILTER_LIST: { id: ClientFilter; label: string; tone?: string }[] = [
  { id: 'all',      label: 'Tots'        },
  { id: 'ranking',  label: '🏆 Ranking'  },
  { id: 'vip',      label: 'VIP'         },
  { id: 'regular',  label: 'Habituals'   },
  { id: 'allergy',  label: 'Al·lèrgies'  },
  { id: 'birthday', label: 'Aniversaris' },
];

// ─── Main view ────────────────────────────────────────────────────────────────
export default function MobileClientsView() {
  const { selectedBusiness, customers, reservations } = useAppStore();
  const [query,    setQuery]    = useState('');
  // Persist the filter across navigations within the same session — operators
  // get frustrated re-selecting "Ranking" every time they pop back from a
  // client detail.
  const [filter,   setFilter]   = useState<ClientFilter>(() => {
    try {
      const saved = sessionStorage.getItem('ncr.clientsFilter');
      if (saved === 'all' || saved === 'ranking' || saved === 'vip' || saved === 'regular' || saved === 'allergy' || saved === 'birthday') return saved;
    } catch { /* private mode */ }
    return 'all';
  });
  useEffect(() => {
    try { sessionStorage.setItem('ncr.clientsFilter', filter); } catch { /* ignore */ }
  }, [filter]);

  // Period sub-filter for the ranking view (Setmana / Mes / Any / Total).
  // Defaults to 'all' for backwards-compatibility with the previous UI.
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const saved = sessionStorage.getItem('ncr.clientsPeriod');
      if (saved === 'week' || saved === 'month' || saved === 'year' || saved === 'all') return saved;
    } catch { /* ignore */ }
    return 'all';
  });
  useEffect(() => {
    try { sessionStorage.setItem('ncr.clientsPeriod', period); } catch { /* ignore */ }
  }, [period]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [showNew,  setShowNew]  = useState(false);

  // Customers belonging to the active business (search + filter applied)
  const bizClients = useMemo(
    () => customers.filter(c => c.biz.includes(selectedBusiness as BusinessId)),
    [customers, selectedBusiness],
  );

  // Per-business ranking — computed once, queried via rankMap by customer id.
  const ranked = useMemo(
    () => rankCustomers(customers, reservations, selectedBusiness as BusinessId),
    [customers, reservations, selectedBusiness],
  );
  const rankMap = useMemo(() => {
    const m = new Map<string, { stats: CustomerStats; rank: number }>();
    for (const r of ranked) m.set(r.customer.id, { stats: r.stats, rank: r.rank });
    return m;
  }, [ranked]);

  // Per-customer visit count for the currently-selected period.
  // Built once per (customers, reservations, period, biz) — cheap O(N×M)
  // pass; for typical restaurant scales (≈hundreds × hundreds) negligible.
  const todayForCount = useMemo(() => isoDate(new Date()), []);
  const periodResScoped = useMemo(
    () => reservations.filter(r => r.bizId === selectedBusiness),
    [reservations, selectedBusiness],
  );
  const visitsByPeriod = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of bizClients) {
      m.set(c.id, countVisitsInPeriod(c, periodResScoped, period, todayForCount));
    }
    return m;
  }, [bizClients, periodResScoped, period, todayForCount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = bizClients.filter(c => {
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(query)) return false;
      if (filter === 'ranking' || filter === 'all') return true;
      if (!c.tags.includes(filter)) return false;
      return true;
    });
    if (filter === 'ranking') {
      if (period === 'all') {
        // Lifetime ranking = preserved original behaviour (by points).
        return base.sort((a, b) =>
          (rankMap.get(a.id)?.rank ?? 9999) - (rankMap.get(b.id)?.rank ?? 9999));
      }
      // Period ranking — sort by completed visits in the window, descending.
      // Tie-break with lifetime points so two clients with the same count
      // keep a stable, meaningful order.
      return base.sort((a, b) => {
        const va = visitsByPeriod.get(a.id) ?? 0;
        const vb = visitsByPeriod.get(b.id) ?? 0;
        if (vb !== va) return vb - va;
        const pa = rankMap.get(a.id)?.stats.points ?? 0;
        const pb = rankMap.get(b.id)?.stats.points ?? 0;
        return pb - pa;
      });
    }
    return base.sort((a, b) => b.visits - a.visits);
  }, [bizClients, query, filter, period, rankMap, visitsByPeriod]);

  // Header stats — totals + today's expected visitors (fuzzy first-name match)
  const todayIso = isoDate(new Date());
  const stats = useMemo(() => {
    const totals: Record<ClientFilter, number> = {
      all: bizClients.length, ranking: bizClients.length, vip: 0, regular: 0, allergy: 0, birthday: 0,
    };
    bizClients.forEach(c => {
      if (c.tags.includes('vip'))      totals.vip++;
      if (c.tags.includes('regular'))  totals.regular++;
      if (c.tags.includes('allergy'))  totals.allergy++;
      if (c.tags.includes('birthday')) totals.birthday++;
    });
    const todayResNames = new Set(
      reservations
        .filter(r => r.bizId === selectedBusiness && r.date === todayIso)
        .map(r => r.name.split(' ')[0].toLowerCase()),
    );
    const expected = bizClients.filter(c =>
      todayResNames.has(c.name.split(' ')[0].toLowerCase()),
    ).length;
    return { ...totals, expected };
  }, [bizClients, reservations, selectedBusiness, todayIso]);

  const detailClient = customers.find(c => c.id === detailId) ?? null;
  const editClient   = editId ? customers.find(c => c.id === editId) ?? null : null;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding:'14px 16px 10px',
        borderBottom:'var(--hair)', background:'var(--paper)',
        flexShrink:0,
      }}>
        {/* Title + stats + new-button */}
        <div style={{
          display:'flex', alignItems:'center', gap:10, marginBottom:12,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:'var(--font-serif)', fontSize:22, fontWeight:500,
              color:'var(--ink-900)', letterSpacing:-.005, lineHeight:1.05,
            }}>
              Clientela
            </div>
            <div style={{
              fontSize:11.5, color:'var(--ink-500)', fontWeight:600,
              letterSpacing:.05, marginTop:4,
              fontFamily:'var(--font-mono)',
              display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
            }}>
              <span key={`t-${stats.all}`} className="number-tween"
                style={{ fontFamily:'var(--font-serif)', fontSize:13, fontWeight:500, color:'var(--ink-900)' }}>
                {stats.all}
              </span>
              <span style={{ textTransform:'uppercase', letterSpacing:.08 }}>actius</span>
              {stats.vip > 0 && (
                <>
                  <span style={{ width:3, height:3, borderRadius:999, background:'var(--ink-300)' }} />
                  <span key={`v-${stats.vip}`} className="number-tween"
                    style={{ fontFamily:'var(--font-serif)', fontSize:13, fontWeight:500, color:'#8a6a00' }}>
                    {stats.vip}
                  </span>
                  <span style={{ color:'#8a6a00', textTransform:'uppercase', letterSpacing:.08 }}>vips</span>
                </>
              )}
              {stats.expected > 0 && (
                <>
                  <span style={{ width:3, height:3, borderRadius:999, background:'var(--ink-300)' }} />
                  <span key={`e-${stats.expected}`} className="number-tween"
                    style={{ fontFamily:'var(--font-serif)', fontSize:13, fontWeight:500, color:'var(--terracotta-700)' }}>
                    {stats.expected}
                  </span>
                  <span style={{ color:'var(--terracotta-700)', textTransform:'uppercase', letterSpacing:.08 }}>avui</span>
                </>
              )}
            </div>
          </div>
          <button onClick={() => setShowNew(true)} className="press"
            aria-label="Nou client"
            style={{
              height:40, padding:'0 14px', borderRadius:12, border:'none',
              background:'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)',
              color:'white', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              fontFamily:'inherit', fontSize:13, fontWeight:650, flexShrink:0,
              boxShadow:'0 2px 6px rgba(168,74,42,.28)',
            }}>
            <Icon d={I.plus} size={15} stroke={2.4} />
            Nou
          </button>
        </div>

        {/* Search input */}
        <div style={{ position:'relative', marginBottom:10 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'10px 12px 10px 38px', borderRadius:12,
            background:'var(--cream)',
            border:'1px solid rgba(60,40,20,.08)',
          }}>
            <div style={{
              position:'absolute', left:14, pointerEvents:'none',
              display:'flex', color:'var(--ink-400)',
            }}><Icon d={I.search} size={16} /></div>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Cerca per nom o telèfon"
              style={{
                flex:1, border:'none', outline:'none', background:'transparent',
                fontFamily:'inherit', fontSize:14, color:'var(--ink-900)',
              }} />
            {query && (
              <button onClick={() => setQuery('')}
                aria-label="Esborrar cerca"
                style={{
                  background:'rgba(60,40,20,.08)', border:'none',
                  cursor:'pointer', borderRadius:999,
                  width:22, height:22, color:'var(--ink-500)',
                  display:'grid', placeItems:'center', flexShrink:0,
                }}>
                <Icon d={I.x} size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips — actually wired to filter state */}
        <div style={{
          display:'flex', gap:6, overflowX:'auto', paddingBottom:2,
          scrollbarWidth:'none', msOverflowStyle:'none',
        }}>
          {FILTER_LIST.map(f => {
            const active = filter === f.id;
            const count  = stats[f.id];
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} className="press"
                style={{
                  flexShrink:0, padding:'7px 13px', borderRadius:999,
                  whiteSpace:'nowrap', fontFamily:'inherit',
                  border: active ? 'none' : '1px solid rgba(60,40,20,.10)',
                  background: active ? 'var(--ink-900)' : 'var(--paper)',
                  color: active ? 'var(--cream)' : 'var(--ink-600)',
                  fontSize:12.5, fontWeight: active ? 700 : 600, cursor:'pointer',
                  display:'inline-flex', alignItems:'center', gap:6,
                  transition:'background 200ms var(--ease-in-out), color 200ms var(--ease-in-out), border-color 200ms var(--ease-in-out)',
                }}>
                {f.label}
                {count > 0 && (
                  <span style={{
                    fontSize:10.5, fontWeight:700,
                    fontFamily:'var(--font-mono)',
                    color: active ? 'var(--cream)' : 'var(--ink-500)',
                    opacity: active ? .65 : .85,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Period sub-filter — only when Ranking tab is active. */}
        {filter === 'ranking' && (
          <div style={{
            display:'flex', gap:6, marginTop:8, overflowX:'auto',
            scrollbarWidth:'none', msOverflowStyle:'none',
          }}>
            {([
              ['week',  'Setmana'],
              ['month', 'Mes'],
              ['year',  'Any'],
              ['all',   'Total'],
            ] as const).map(([id, label]) => {
              const active = period === id;
              return (
                <button key={id} onClick={() => setPeriod(id)} className="press"
                  style={{
                    flexShrink:0, padding:'5px 11px', borderRadius:999,
                    whiteSpace:'nowrap', fontFamily:'inherit',
                    border: active ? 'none' : '1px solid rgba(60,40,20,.10)',
                    background: active ? 'var(--terracotta-600)' : 'var(--paper)',
                    color: active ? 'var(--cream)' : 'var(--ink-600)',
                    fontSize:11.5, fontWeight: active ? 700 : 600, cursor:'pointer',
                    transition:'background 200ms var(--ease-in-out), color 200ms var(--ease-in-out), border-color 200ms var(--ease-in-out)',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <div className="scroll" style={{ flex:1, overflowY:'auto', paddingBottom:'var(--scroll-pad-bottom)' }}>
        {filtered.map((c, i) => (
          <div key={c.id}
            className="row-stagger"
            style={{ ['--row-i' as string]: Math.min(i, 7) }}>
            <ClientRow
              client={c}
              rankInfo={rankMap.get(c.id)}
              showRank={filter === 'ranking'}
              periodCount={filter === 'ranking' ? visitsByPeriod.get(c.id) : undefined}
              periodSuffix={filter === 'ranking' ? periodLabel(period) : undefined}
              onTap={() => setDetailId(c.id)}
            />
          </div>
        ))}
        {filtered.length === 0 && (
          <ClientsEmpty query={query} filter={filter} />
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Short relative time. Recent → "ahir / fa 3 d / fa 2 s". Older → actual date. */
function relLastVisit(lastVisit: string | undefined): string | null {
  if (!lastVisit) return null;
  try {
    const t = new Date(lastVisit).getTime();
    if (Number.isNaN(t)) return null;
    const diffDays = Math.max(0, Math.floor((Date.now() - t) / 86400000));
    if (diffDays === 0)  return 'avui';
    if (diffDays === 1)  return 'ahir';
    if (diffDays < 7)    return `fa ${diffDays} d`;
    if (diffDays < 30)   return `fa ${Math.floor(diffDays / 7)} s`;
    // Older than a month: show the actual date — "fa 47 d" is unreadable.
    const d = new Date(lastVisit);
    const months = ['gen','feb','mar','abr','maig','jun','jul','ago','set','oct','nov','des'];
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return sameYear
      ? `${d.getDate()} ${months[d.getMonth()]}`
      : `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  } catch { return null; }
}

// ─── Empty state — no clients matched the query/filter ───────────────────────
function ClientsEmpty({ query, filter }: { query: string; filter: ClientFilter }) {
  return (
    <div style={{
      textAlign:'center', padding:'56px 22px 28px',
      color:'var(--ink-500)',
      display:'flex', flexDirection:'column', alignItems:'center', gap:14,
    }}>
      {/* Minimal "address book" line-art */}
      <svg width="68" height="80" viewBox="0 0 68 80" fill="none" aria-hidden="true">
        <path d="M14 8 H54 Q58 8 58 12 V72 Q58 76 54 76 H14 Q10 76 10 72 V12 Q10 8 14 8 Z"
          stroke="var(--ink-400)" strokeWidth="1.6" fill="var(--cream)" />
        {/* spine ribs */}
        <path d="M10 22 H6 M10 36 H6 M10 50 H6 M10 64 H6"
          stroke="var(--ink-300)" strokeWidth="1.2" strokeLinecap="round" />
        {/* head + shoulders silhouette */}
        <circle cx="34" cy="34" r="7" stroke="var(--ink-400)" strokeWidth="1.5" fill="var(--ink-50)" />
        <path d="M22 56 Q22 46 34 46 Q46 46 46 56"
          stroke="var(--ink-400)" strokeWidth="1.5" fill="var(--ink-50)" strokeLinecap="round" />
        {/* contact lines */}
        <path d="M22 64 H46 M26 70 H42"
          stroke="var(--ink-300)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <div>
        <div style={{
          fontFamily:'var(--font-serif)', fontSize:17, color:'var(--ink-700)',
          letterSpacing:-.005,
        }}>
          {query
            ? 'Cap client coincideix'
            : filter !== 'all'
              ? 'Cap client en aquest filtre'
              : 'La cartera encara és buida'}
        </div>
        <div style={{ fontSize:13, color:'var(--ink-500)', marginTop:6 }}>
          {query
            ? `Prova canviant la cerca o esborrant-la`
            : filter !== 'all'
              ? 'Treu el filtre per veure tots els clients'
              : 'Prem "Nou" per afegir el primer'}
        </div>
      </div>
    </div>
  );
}

// ─── Client row — richer layout with last-visit, allergens, serif spend ──────
function ClientRow({ client: c, onTap, rankInfo, showRank, periodCount, periodSuffix }: {
  client: Customer; onTap: () => void;
  rankInfo?: { stats: CustomerStats; rank: number };
  showRank?: boolean;
  /** When defined, overrides the lifetime `c.visits` counter on the row.
   *  Used by the ranking view to show "3 visites aquesta setmana" etc. */
  periodCount?: number;
  periodSuffix?: string;
}) {
  const lastSeen = relLastVisit(c.lastVisit);
  const isVip      = c.tags.includes('vip');
  const hasAllergy = c.tags.includes('allergy');
  const isBirthday = c.tags.includes('birthday');
  const palette    = avIdx(c.name);
  const podiumIcon = showRank && rankInfo?.rank === 1 ? '🥇'
                   : showRank && rankInfo?.rank === 2 ? '🥈'
                   : showRank && rankInfo?.rank === 3 ? '🥉' : null;
  return (
    <button onClick={onTap} className="press"
      style={{
        display:'flex', alignItems:'center', gap:13, padding:'14px 18px',
        borderBottom:'var(--hair)',
        background: isVip
          ? 'linear-gradient(180deg, rgba(243,220,166,.18) 0%, var(--paper) 60%)'
          : 'var(--paper)',
        border:'none', width:'100%', cursor:'pointer',
        fontFamily:'inherit', textAlign:'left',
        transition:'background 200ms var(--ease-out)',
      }}>
      {/* Rank position (only on ranking filter) */}
      {showRank && (
        <span style={{
          flexShrink:0, width:28, textAlign:'center',
          fontFamily:'var(--font-mono)', fontSize: podiumIcon ? 18 : 13,
          fontWeight:700,
          color: rankInfo && rankInfo.rank <= 3 ? 'var(--ink-900)' : 'var(--ink-400)',
        }}>{podiumIcon ?? rankInfo?.rank ?? '—'}</span>
      )}
      {/* Avatar — palette-coloured serif initials, with subtle gold ring on VIPs */}
      <span className={`avatar av-${palette}`}
        style={{
          width:46, height:46, borderRadius:999,
          fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500,
          letterSpacing:-.005, flexShrink:0,
          boxShadow: isVip ? '0 0 0 2px #d8b463' : 'none',
        }}>
        {initials(c.name)}
      </span>

      <div style={{ flex:1, minWidth:0 }}>
        {/* Name + inline tags */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{
            fontSize:15, fontWeight:650, color:'var(--ink-900)', letterSpacing:-.005,
          }}>{c.name}</span>
          {isVip && (
            <span style={{
              fontSize:9.5, padding:'2px 6px', borderRadius:4,
              background:'#2a2119', color:'#f3dca6',
              fontWeight:700, letterSpacing:.3,
            }}>VIP</span>
          )}
          {hasAllergy && (
            <span style={{
              fontSize:9.5, padding:'2px 6px', borderRadius:4,
              background:'var(--rose-50)', color:'var(--rose-700)',
              fontWeight:700, letterSpacing:.3,
              border:'1px solid rgba(194,74,74,.22)',
              display:'inline-flex', alignItems:'center', gap:3,
            }}>⚠ AL·LÈRGIA</span>
          )}
          {isBirthday && (
            <span style={{ fontSize:13, lineHeight:1 }} aria-label="Aniversari">🎂</span>
          )}
          {rankInfo && (
            <span title={`${rankInfo.stats.points} punts`} style={{
              fontSize:10, fontWeight:700,
              padding:'2px 7px', borderRadius:999,
              background: rankInfo.stats.level.bg,
              color: rankInfo.stats.level.color,
              border: `1px solid ${rankInfo.stats.level.color}33`,
              display:'inline-flex', alignItems:'center', gap:3,
              letterSpacing:.2,
            }}>
              <span style={{ fontSize:11 }}>{rankInfo.stats.level.icon}</span>
              <span>{rankInfo.stats.level.name}</span>
            </span>
          )}
        </div>

        {/* Phone in mono */}
        <div style={{
          fontSize:12, color:'var(--ink-500)', marginTop:3,
          fontFamily:'var(--font-mono)', fontWeight:550, letterSpacing:.005,
        }}>{c.phone || '—'}</div>

        {/* Stats line: visits · spend · last-seen */}
        <div style={{
          fontSize:11.5, color:'var(--ink-500)', marginTop:5,
          display:'flex', alignItems:'center', gap:7, flexWrap:'wrap',
        }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
            <span style={{
              fontFamily:'var(--font-serif)', fontSize:13.5, fontWeight:500,
              color:'var(--ink-900)', letterSpacing:-.005,
            }}>{periodCount !== undefined ? periodCount : c.visits}</span>
            {periodCount !== undefined ? (
              <span style={{ fontWeight:600 }}>
                {periodCount === 1 ? 'visita' : 'visites'}
                {periodSuffix ? <span style={{ fontWeight:500, color:'var(--ink-400)' }}> {periodSuffix}</span> : null}
              </span>
            ) : (
              <span style={{ fontWeight:600 }}>{c.visits === 1 ? 'visita' : 'visites'}</span>
            )}
          </span>
          {c.spend > 0 && (
            <>
              <span style={{ width:3, height:3, borderRadius:999, background:'var(--ink-300)' }} />
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                <span style={{
                  fontFamily:'var(--font-serif)', fontSize:13.5, fontWeight:500,
                  color: c.spend > 500 ? 'var(--olive-700)' : 'var(--ink-900)', letterSpacing:-.005,
                }}>{c.spend}</span>
                <span style={{ fontWeight:600, color: c.spend > 500 ? 'var(--olive-700)' : 'var(--ink-500)' }}>€</span>
              </span>
            </>
          )}
          {lastSeen && (
            <>
              <span style={{ width:3, height:3, borderRadius:999, background:'var(--ink-300)' }} />
              <span style={{
                fontWeight:600,
                fontFamily:'var(--font-mono)', fontSize:11.5,
                color: lastSeen === 'avui' ? 'var(--terracotta-700)' : 'var(--ink-500)',
              }}>{lastSeen}</span>
            </>
          )}
        </div>
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
  const fidelity = useMemo(() => computeCustomerStats(c, reservations), [c, reservations]);

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

          {/* Fidelitat */}
          <div style={{
            marginBottom:12,
            padding:'12px 14px',
            borderRadius:12,
            background: fidelity.level.bg + '66',
            border: `1px solid ${fidelity.level.color}22`,
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:24 }}>{fidelity.level.icon}</span>
                <div>
                  <div style={{ fontFamily:'var(--font-serif)', fontSize:16, fontWeight:600, color:fidelity.level.color, lineHeight:1.1 }}>
                    {fidelity.level.name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--ink-500)', marginTop:2 }}>
                    {fidelity.points} punts · {fidelity.completed} visites{fidelity.noshows > 0 ? ` · ${fidelity.noshows} no-show` : ''}
                  </div>
                </div>
              </div>
              {fidelity.nextLevel && (
                <div style={{ textAlign:'right', fontSize:11, color:'var(--ink-600)' }}>
                  <div style={{ fontWeight:700 }}>{fidelity.nextLevel.min - Math.max(0, fidelity.points)} pt</div>
                  <div style={{ opacity:.7 }}>fins {fidelity.nextLevel.name}</div>
                </div>
              )}
            </div>
            <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,.6)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${fidelity.progressPct}%`, background: fidelity.level.color, transition:'width 320ms ease' }} />
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:10 }}>
              {fidelity.badges.map(b => (
                <span key={b.id} title={b.description}
                  style={{
                    display:'inline-flex', alignItems:'center', gap:4,
                    padding:'3px 8px', borderRadius:999,
                    background: b.earned ? 'var(--paper)' : 'transparent',
                    color: b.earned ? 'var(--ink-800)' : 'var(--ink-400)',
                    border:'1px solid rgba(60,40,20,.12)',
                    fontSize:10.5, fontWeight:600,
                    opacity: b.earned ? 1 : .5,
                    filter: b.earned ? 'none' : 'grayscale(1)',
                  }}>
                  <span>{b.icon}</span><span>{b.label}</span>
                </span>
              ))}
            </div>
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
  // Anchors for the custom date/time popovers.
  const dateTileRef = useRef<HTMLLabelElement | null>(null);
  const timeTileRef = useRef<HTMLLabelElement | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

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
          <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', gap:8 }}>
            {/* DATA tile — opens DatePickerPopover */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, marginBottom:4 }}>DATA</div>
              <label
                ref={dateTileRef}
                onClick={() => setDateOpen(o => !o)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', height:38, padding:'0 10px', borderRadius:8, border:'1px solid rgba(60,40,20,.12)', background:'var(--paper)', cursor:'pointer', boxShadow:'var(--sh-1)' }}>
                <span style={{ fontFamily:'var(--font-serif)', fontSize:14, fontWeight:500, color:'var(--ink-900)', whiteSpace:'nowrap' }}>
                  {(() => { const [y,m,dd] = date.split('-').map(Number); const dt = new Date(y, (m||1)-1, dd||1); const M=['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des']; return `${dt.getDate()} ${M[dt.getMonth()]}`; })()}
                </span>
              </label>
              <DatePickerPopover
                open={dateOpen}
                selected={(() => { const [y,m,dd] = date.split('-').map(Number); return new Date(y, (m||1)-1, dd||1); })()}
                onSelect={d => setDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)}
                onClose={() => setDateOpen(false)}
                anchorRef={dateTileRef}
              />
            </div>
            {/* HORA tile — opens TimePickerPopover */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, marginBottom:4 }}>HORA</div>
              <label
                ref={timeTileRef}
                onClick={() => setTimeOpen(o => !o)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', height:38, padding:'0 10px', borderRadius:8, border:'1px solid rgba(60,40,20,.12)', background:'var(--paper)', cursor:'pointer', boxShadow:'var(--sh-1)' }}>
                <span style={{ fontFamily:'var(--font-serif)', fontSize:14, fontWeight:500, color:'var(--ink-900)' }}>
                  {time}
                </span>
              </label>
              <TimePickerPopover
                open={timeOpen}
                value={time}
                onChange={setTime}
                onClose={() => setTimeOpen(false)}
                anchorRef={timeTileRef}
              />
            </div>
            {/* PAX — −/+ stepper instead of native number spinner */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-500)', letterSpacing:.06, marginBottom:4 }}>PAX</div>
              <div style={{ display:'flex', alignItems:'center', height:38, borderRadius:8, border:'1px solid rgba(60,40,20,.12)', background:'var(--paper)', boxShadow:'var(--sh-1)', overflow:'hidden' }}>
                <button className="press" aria-label="Restar comensal"
                  onClick={() => setPax(p => Math.max(1, p - 1))}
                  style={{ width:34, height:'100%', border:'none', background:'transparent', cursor:'pointer', fontSize:18, color:'var(--ink-700)', display:'grid', placeItems:'center' }}>−</button>
                <span style={{ flex:1, textAlign:'center', fontFamily:'var(--font-serif)', fontSize:15, fontWeight:500, color:'var(--ink-900)', fontVariantNumeric:'tabular-nums' }}>
                  {pax}
                </span>
                <button className="press" aria-label="Sumar comensal"
                  onClick={() => setPax(p => Math.min(30, p + 1))}
                  style={{ width:34, height:'100%', border:'none', background:'transparent', cursor:'pointer', fontSize:18, color:'var(--ink-700)', display:'grid', placeItems:'center' }}>+</button>
              </div>
            </div>
          </div>
          <button onClick={save} className="press"
            style={{ padding:'12px', borderRadius:10, border:'none', background:'var(--terracotta-600)', color:'white', fontFamily:'inherit', fontSize:13.5, fontWeight:700, cursor:'pointer', minHeight:44, boxShadow:'0 1px 2px rgba(168,74,42,.32), inset 0 1px 0 rgba(255,255,255,.18)' }}>
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

  // Validation helpers. Phone is normalized to digits-only for the check so
  // formatting (+34, spaces, dots) doesn't trip the rule.
  function phoneError(): string | null {
    const v = form.phone.trim();
    if (!v) return null;  // optional
    const digits = v.replace(/[^\d]/g, '');
    if (digits.length < 9) return 'Telèfon massa curt';
    if (digits.length > 15) return 'Telèfon massa llarg';
    return null;
  }
  function emailError(): string | null {
    const v = form.email.trim();
    if (!v) return null;  // optional
    // Minimal but practical email check.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email no vàlid';
    return null;
  }

  function save() {
    setTouched(true);
    if (!form.name.trim()) return;
    if (phoneError()) return;
    if (emailError()) return;
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
              maxLength={80} autoComplete="name"
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
                onChange={e => upd('phone', e.target.value)}
                maxLength={30} inputMode="tel" autoComplete="tel"
                pattern="^[+0-9 ()\-\.]{6,30}$"
                style={{ ...inp, borderColor: touched && phoneError() ? 'var(--terracotta-500)' : undefined }} />
              {touched && phoneError() && (
                <div style={{ fontSize:11, color:'var(--terracotta-600)', marginTop:3 }}>{phoneError()}</div>
              )}
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" placeholder="email@…" value={form.email}
                onChange={e => upd('email', e.target.value)}
                maxLength={254} inputMode="email" autoComplete="email"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
                style={{ ...inp, borderColor: touched && emailError() ? 'var(--terracotta-500)' : undefined }} />
              {touched && emailError() && (
                <div style={{ fontSize:11, color:'var(--terracotta-600)', marginTop:3 }}>{emailError()}</div>
              )}
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
              maxLength={2000}
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
