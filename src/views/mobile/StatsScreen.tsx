import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { isoDate, BUSINESSES } from '@/data/mockData';
import { useVisibleBusinesses } from '@/store/usePinScope';
import { rankCustomers, LEVELS, levelTint, computeCustomerStats, type LevelId } from '@/utils/loyalty';
import { getDailyServiceCapacity, getEffectiveCapacity } from '@/utils/businessConfig';
import type { Reservation } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type StatsTab = 'general' | 'clients' | 'ocupacio' | 'fidelitzacio' | 'comparativa';

interface DayBucket {
  iso:     string;
  count:   number;
  pax:     number;
  noshows: number;
  isWeekend: boolean;
}

function shortDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dows = ['Dg','Dl','Dt','Dc','Dj','Dv','Ds'];
  return `${dows[d.getDay()]} ${d.getDate()}`;
}

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

function rangeDays(endIso: string, days: number): string[] {
  const end = new Date(endIso + 'T00:00:00').getTime();
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(end - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen with tabs
// ─────────────────────────────────────────────────────────────────────────────

export default function StatsScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<StatsTab>('general');
  const [printing, setPrinting] = useState(false);

  // Inject the @media print stylesheet once.
  useEffect(() => {
    if (document.getElementById('stats-print-style')) return;
    const style = document.createElement('style');
    style.id = 'stats-print-style';
    style.textContent = `
      .stats-print-portal { display: none; }
      @media print {
        /* Hide everything in the document tree, then show only the portal. */
        body > * { display: none !important; }
        body > .stats-print-portal { display: block !important; background: white; padding: 0; }
        @page { margin: 14mm; size: A4; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Trigger the system print dialog right after the print-only DOM mounts.
  useEffect(() => {
    if (!printing) return;
    const cleanup = () => setPrinting(false);
    window.addEventListener('afterprint', cleanup);
    const id = window.setTimeout(() => window.print(), 80);
    // Fallback in case afterprint never fires (some browsers).
    const fallback = window.setTimeout(cleanup, 60000);
    return () => {
      window.removeEventListener('afterprint', cleanup);
      window.clearTimeout(id);
      window.clearTimeout(fallback);
    };
  }, [printing]);

  const now = new Date();
  const generatedAt = `${now.toLocaleDateString('ca-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} a les ${now.toLocaleTimeString('ca-ES', { hour:'2-digit', minute:'2-digit' })}`;

  return (
    <div id="stats-print-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="stats-screen" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 11px', background: 'var(--paper)', borderBottom: 'var(--hair)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-600)', display: 'grid', placeItems: 'center' }}>
          <Icon d={I.chevL} size={20} stroke={2} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', flex: 1 }}>Estadístiques</span>
        <button onClick={() => setPrinting(true)}
          className="press"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 11px', borderRadius: 9,
            background: 'var(--ink-900)', color: 'var(--cream)',
            border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
          }}>
          <Icon d={I.shield ?? I.calendar} size={12} stroke={2.2} />
          Exportar
        </button>
      </div>

      {/* Tabs */}
      <div data-print-hide style={{ display: 'flex', gap: 4, padding: '10px 14px', background: 'var(--paper)', borderBottom: 'var(--hair)', overflowX: 'auto' }}>
        {([
          ['general',      'General'],
          ['clients',      'Clients'],
          ['ocupacio',     'Ocupació'],
          ['fidelitzacio', 'Fidelització'],
          ['comparativa',  'Comparativa'],
        ] as const).map(([id, label]) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} className="press"
              style={{
                padding: '7px 14px', borderRadius: 999,
                border: 'none', cursor: 'pointer',
                background: active ? 'var(--ink-900)' : 'transparent',
                color: active ? 'var(--cream)' : 'var(--ink-700)',
                fontSize: 12.5, fontWeight: 650, fontFamily: 'inherit',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'background 180ms var(--ease-in-out)',
              }}>{label}</button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px var(--scroll-pad-bottom)' }}>
        {tab === 'general'      && <GeneralTab />}
        {tab === 'clients'      && <ClientsTab />}
        {tab === 'ocupacio'     && <OcupacioTab />}
        {tab === 'fidelitzacio' && <FidelitzacioTab />}
        {tab === 'comparativa'  && <ComparativaTab />}
      </div>
      </div>

      {/* Print-only region — mounted to document.body via portal so the
          system print engine sees it as a top-level flow element and lays
          out across as many pages as needed. */}
      {printing && createPortal(
        <div className="stats-print-portal" style={{ padding: '18px 24px' }}>
          <div style={{ fontFamily: 'Georgia, serif', borderBottom: '1px solid #ddd', paddingBottom: 12, marginBottom: 18 }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#3c2814' }}>Informe Estadístiques</div>
            <div style={{ fontSize: 12, color: '#766251', marginTop: 4 }}>Generat el {generatedAt}</div>
          </div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#3c2814', marginTop: 8, marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4 }}>1 · General</h2>
          <GeneralTab />
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#3c2814', marginTop: 24, marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4, pageBreakBefore: 'always' }}>2 · Clients</h2>
          <ClientsTab />
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#3c2814', marginTop: 24, marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4, pageBreakBefore: 'always' }}>3 · Ocupació</h2>
          <OcupacioTab />
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#3c2814', marginTop: 24, marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4, pageBreakBefore: 'always' }}>4 · Fidelització</h2>
          <FidelitzacioTab />
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#3c2814', marginTop: 24, marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4, pageBreakBefore: 'always' }}>5 · Comparativa</h2>
          <ComparativaTab />
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB · General  (Insights, KPIs avui + delta, comparativa, tendència)
// ─────────────────────────────────────────────────────────────────────────────

function GeneralTab() {
  return (
    <>
      <AutoInsightsBlock />
      <KPIsTodayBlock />
      <ComparativeBlock />
      <TrendBlock />
    </>
  );
}

function AutoInsightsBlock() {
  const { selectedBusiness, reservations, selectedDate, businessConfigs } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const insights = useMemo(() => {
    const out: { icon: string; text: string; tone: 'olive' | 'rose' | 'terracotta' | 'sky' }[] = [];
    const t = new Date(todayIso + 'T00:00:00').getTime();

    // 1. Same-weekday comparison: last 4 same-weekdays vs the 4 before
    const dow = new Date(todayIso + 'T00:00:00').getDay();
    const recent: number[] = [];
    const older:  number[] = [];
    for (let w = 1; w <= 4; w++) {
      const iso = new Date(t - w * 7 * 86400000).toISOString().slice(0, 10);
      recent.push(reservations.filter(r => r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled').length);
    }
    for (let w = 5; w <= 8; w++) {
      const iso = new Date(t - w * 7 * 86400000).toISOString().slice(0, 10);
      older.push(reservations.filter(r => r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled').length);
    }
    const recAvg = recent.reduce((s, n) => s + n, 0) / 4;
    const oldAvg = older.reduce((s, n) => s + n, 0)  / 4;
    const dowNames = ['diumenges','dilluns','dimarts','dimecres','dijous','divendres','dissabtes'];
    if (recAvg > 0 && oldAvg > 0) {
      const delta = pctDelta(recAvg, oldAvg);
      if (delta !== null && Math.abs(delta) >= 10) {
        out.push({
          icon: delta > 0 ? '📈' : '📉',
          text: `Les reserves dels ${dowNames[dow]} han ${delta > 0 ? 'augmentat' : 'baixat'} un ${Math.abs(delta)}%`,
          tone: delta > 0 ? 'olive' : 'rose',
        });
      }
    }

    // 2. No-show trend this week vs last
    const thisWeek = rangeDays(todayIso, 7);
    const lastWeek = rangeDays(new Date(t - 7 * 86400000).toISOString().slice(0, 10), 7);
    const nsThis = reservations.filter(r => r.bizId === selectedBusiness && thisWeek.includes(r.date) && r.status === 'noshow').length;
    const nsLast = reservations.filter(r => r.bizId === selectedBusiness && lastWeek.includes(r.date) && r.status === 'noshow').length;
    if (nsLast >= 2 || nsThis >= 2) {
      const delta = pctDelta(nsThis, nsLast);
      if (delta !== null && Math.abs(delta) >= 15) {
        out.push({
          icon: delta < 0 ? '✅' : '⚠️',
          text: `Els no-shows han ${delta < 0 ? 'baixat' : 'pujat'} un ${Math.abs(delta)}% aquesta setmana`,
          tone: delta < 0 ? 'olive' : 'rose',
        });
      }
    }

    // 3. Monthly record check
    const startOfMonth = (iso: string) => iso.slice(0, 7);
    const thisMonthKey = startOfMonth(todayIso);
    const monthlyTotals: Record<string, number> = {};
    reservations.forEach(r => {
      if (r.bizId !== selectedBusiness || r.status === 'cancelled') return;
      const k = startOfMonth(r.date);
      monthlyTotals[k] = (monthlyTotals[k] || 0) + 1;
    });
    const currMonth = monthlyTotals[thisMonthKey] ?? 0;
    const otherMax = Math.max(0, ...Object.entries(monthlyTotals).filter(([k]) => k !== thisMonthKey).map(([_, v]) => v));
    if (currMonth > 0 && currMonth >= otherMax && otherMax > 0) {
      out.push({ icon: '🏆', text: `Nou rècord mensual de reserves (${currMonth})!`, tone: 'terracotta' });
    }

    // 4. Occupancy spike today vs 7-day avg
    const todayPax = reservations.filter(r => r.bizId === selectedBusiness && r.date === todayIso && r.status !== 'cancelled' && r.status !== 'noshow')
      .reduce((s, r) => s + r.pax, 0);
    const avgPax7d = rangeDays(new Date(t - 86400000).toISOString().slice(0, 10), 7).reduce((acc, iso) => {
      return acc + reservations.filter(r => r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled').reduce((s, r) => s + r.pax, 0);
    }, 0) / 7;
    if (todayPax > 0 && avgPax7d > 0) {
      const delta = pctDelta(todayPax, avgPax7d);
      const cap = getDailyServiceCapacity(selectedBusiness, businessConfigs);
      const occPct = cap > 0 ? Math.round((todayPax / cap) * 100) : 0;
      if (occPct >= 90) out.push({ icon: '🔥', text: `Avui ple: ocupació al ${occPct}%`, tone: 'terracotta' });
      else if (delta !== null && delta >= 25) out.push({ icon: '🚀', text: `Avui ${delta}% més pax que la mitjana setmanal`, tone: 'olive' });
    }

    return out;
  }, [reservations, selectedBusiness, todayIso, businessConfigs]);

  if (insights.length === 0) return null;

  const palette = (tone: 'olive' | 'rose' | 'terracotta' | 'sky') => ({
    olive:      { bg: 'var(--olive-50)',      fg: 'var(--olive-700)'      },
    rose:       { bg: 'var(--rose-50)',       fg: 'var(--rose-700)'       },
    terracotta: { bg: 'var(--terracotta-50)', fg: 'var(--terracotta-700)' },
    sky:        { bg: 'var(--sky-50)',        fg: 'var(--sky-700)'        },
  }[tone]);

  return (
    <div style={{ marginBottom: 18 }}>
      <SectionLabel color="var(--ink-700)">✨ Insights</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {insights.map((it, i) => {
          const c = palette(it.tone);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '11px 13px', borderRadius: 12,
              background: c.bg, border: `1px solid ${c.fg}22`,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{it.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.fg, lineHeight: 1.35 }}>{it.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPIsTodayBlock() {
  const { selectedBusiness, reservations, selectedDate, businessConfigs } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const data = useMemo(() => {
    const todayRes = reservations.filter(r => r.bizId === selectedBusiness && r.date === todayIso);
    const activeToday = todayRes.filter(r => r.status !== 'cancelled' && r.status !== 'noshow');
    const pax = activeToday.reduce((s, r) => s + r.pax, 0);
    const noshow = todayRes.filter(r => r.status === 'noshow').length;
    const cap = getDailyServiceCapacity(selectedBusiness, businessConfigs);
    const occupancy = Math.min(100, Math.round((pax / cap) * 100));

    const t = new Date(todayIso + 'T00:00:00').getTime();
    const sevenDayRes: number[] = [];
    const sevenDayPax: number[] = [];
    for (let i = 1; i <= 7; i++) {
      const iso = new Date(t - i * 86400000).toISOString().slice(0, 10);
      const dayRes = reservations.filter(r => r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled');
      sevenDayRes.push(dayRes.length);
      sevenDayPax.push(dayRes.reduce((s, r) => s + r.pax, 0));
    }
    const avgRes = sevenDayRes.reduce((s, n) => s + n, 0) / 7;
    const avgPax = sevenDayPax.reduce((s, n) => s + n, 0) / 7;

    return {
      res: activeToday.length, pax, noshow, occupancy,
      diffRes: activeToday.length - avgRes,
      diffPax: pax - avgPax,
    };
  }, [reservations, selectedBusiness, todayIso, businessConfigs]);

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--terracotta-700)">🎯 Avui</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KPICard value={data.res} label="Reserves" delta={data.diffRes} tone="terracotta" />
        <KPICard value={data.pax} label="Pax" delta={data.diffPax} tone="olive" />
        <KPICard value={`${data.occupancy}%`} label="Ocupació" tone={data.occupancy >= 85 ? 'rose' : 'sky'} />
        <KPICard value={data.noshow} label="No-shows" tone={data.noshow > 0 ? 'rose' : 'ink'} />
      </div>
    </div>
  );
}

function ComparativeBlock() {
  const { selectedBusiness, reservations, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const data = useMemo(() => {
    const t = new Date(todayIso + 'T00:00:00').getTime();
    const thisWeek = rangeDays(todayIso, 7);
    const lastWeek = rangeDays(new Date(t - 7 * 86400000).toISOString().slice(0, 10), 7);
    const thisMonth = rangeDays(todayIso, 30);
    const lastMonth = rangeDays(new Date(t - 30 * 86400000).toISOString().slice(0, 10), 30);

    const period = (isos: string[]) => {
      const res = reservations.filter(r => r.bizId === selectedBusiness && isos.includes(r.date));
      const active = res.filter(r => r.status !== 'cancelled' && r.status !== 'noshow');
      const final  = res.filter(r => r.status === 'completed' || r.status === 'noshow');
      return {
        count:   active.length,
        pax:     active.reduce((s, r) => s + r.pax, 0),
        noshows: res.filter(r => r.status === 'noshow').length,
        noshowRate: final.length ? Math.round((res.filter(r => r.status === 'noshow').length / final.length) * 100) : 0,
      };
    };

    const wThis = period(thisWeek);  const wLast = period(lastWeek);
    const mThis = period(thisMonth); const mLast = period(lastMonth);

    return {
      week: {
        res:     { curr: wThis.count, prev: wLast.count, delta: pctDelta(wThis.count, wLast.count) },
        pax:     { curr: wThis.pax,   prev: wLast.pax,   delta: pctDelta(wThis.pax, wLast.pax) },
        noshows: { curr: wThis.noshows, prev: wLast.noshows, delta: pctDelta(wThis.noshows, wLast.noshows) },
      },
      month: {
        res:     { curr: mThis.count, prev: mLast.count, delta: pctDelta(mThis.count, mLast.count) },
        pax:     { curr: mThis.pax,   prev: mLast.pax,   delta: pctDelta(mThis.pax, mLast.pax) },
        noshows: { curr: mThis.noshows, prev: mLast.noshows, delta: pctDelta(mThis.noshows, mLast.noshows) },
      },
    };
  }, [reservations, selectedBusiness, todayIso]);

  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const p = data[period];

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionLabel color="var(--sky-700)">📈 Comparativa</SectionLabel>
        <div style={{ display: 'flex', gap: 3, background: 'var(--cream)', borderRadius: 999, padding: 3 }}>
          {(['week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: '4px 11px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: period === p ? 'var(--ink-900)' : 'transparent',
                color: period === p ? 'var(--cream)' : 'var(--ink-600)',
                fontSize: 11, fontWeight: 650, fontFamily: 'inherit',
              }}>{p === 'week' ? 'Setmana' : 'Mes'}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 14px', borderRadius: 13, background: 'var(--paper)', border: '1px solid var(--line-soft)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <ComparativeCell label="Reserves" curr={p.res.curr} prev={p.res.prev} delta={p.res.delta} inverseColor={false} />
        <ComparativeCell label="Pax"      curr={p.pax.curr} prev={p.pax.prev} delta={p.pax.delta} inverseColor={false} />
        <ComparativeCell label="No-shows" curr={p.noshows.curr} prev={p.noshows.prev} delta={p.noshows.delta} inverseColor />
      </div>
    </div>
  );
}

function ComparativeCell({ label, curr, prev, delta, inverseColor }: {
  label: string; curr: number; prev: number; delta: number | null; inverseColor: boolean;
}) {
  // inverseColor=true means "going up is bad" (e.g. noshows): red on rise, green on fall
  const arrow = delta === null ? '—' : delta > 0 ? '▲' : delta < 0 ? '▼' : '=';
  const sign  = delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`;
  const isGood = delta === null ? null : inverseColor ? delta < 0 : delta > 0;
  const isNeutral = delta === 0 || delta === null;
  const col = isNeutral ? 'var(--ink-500)' : isGood ? 'var(--olive-700)' : 'var(--rose-700)';
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500, color: 'var(--ink-900)', marginTop: 4, lineHeight: 1 }}>{curr}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: col, marginTop: 4 }}>
        {arrow} {sign}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-400)', marginTop: 2 }}>vs {prev}</div>
    </div>
  );
}

function TrendBlock() {
  const { selectedBusiness, reservations, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const { days, maxCount, bestDow, peakHour, peakLunch, peakDinner } = useMemo(() => {
    const isos = rangeDays(todayIso, 30);
    const days: DayBucket[] = isos.map(iso => {
      const dr = reservations.filter(r => r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled');
      const d = new Date(iso + 'T00:00:00');
      return {
        iso,
        count: dr.length,
        pax: dr.reduce((s, r) => s + r.pax, 0),
        noshows: reservations.filter(r => r.bizId === selectedBusiness && r.date === iso && r.status === 'noshow').length,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      };
    });
    const maxCount = Math.max(1, ...days.map(d => d.count));

    const dowTotals = [0, 0, 0, 0, 0, 0, 0];
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    days.forEach(d => {
      const dow = new Date(d.iso + 'T00:00:00').getDay();
      dowTotals[dow] += d.count;
      dowCounts[dow] += 1;
    });
    const dowAvgs = dowTotals.map((tot, i) => dowCounts[i] ? tot / dowCounts[i] : 0);
    const bestDowIdx = dowAvgs.indexOf(Math.max(...dowAvgs));
    const dowNames = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
    const bestDow = { name: dowNames[bestDowIdx], avg: dowAvgs[bestDowIdx] };

    // Bucket reservations by hour over the last 30 days, then split into
    // lunch (12-16h) and dinner (19-24h) services so a restaurant with two
    // distinct shifts sees both peaks instead of just whichever is busier.
    const hourBuckets: Record<number, number> = {};
    const tStart = new Date(todayIso + 'T00:00:00').getTime() - 30 * 86400000;
    reservations.forEach(r => {
      if (r.bizId !== selectedBusiness || r.status === 'cancelled') return;
      if (new Date(r.date + 'T00:00:00').getTime() < tStart) return;
      const h = parseInt(r.time.split(':')[0], 10);
      hourBuckets[h] = (hourBuckets[h] || 0) + 1;
    });
    const peakIn = (from: number, to: number) => {
      let best: { hour: number; count: number } | null = null;
      for (const [hStr, c] of Object.entries(hourBuckets)) {
        const h = parseInt(hStr, 10);
        if (h < from || h >= to) continue;
        if (!best || c > best.count) best = { hour: h, count: c };
      }
      return best;
    };
    const peakLunch  = peakIn(12, 17);  // migdia
    const peakDinner = peakIn(19, 24);  // nit
    // Fallback: if a restaurant has no clear two-service rhythm, fall back to
    // the single all-day peak so the card still reads sensibly.
    const peakEntry = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
    const peakHour = peakEntry ? { hour: parseInt(peakEntry[0], 10), count: peakEntry[1] } : null;

    return { days, maxCount, bestDow, peakLunch, peakDinner, peakHour };
  }, [reservations, selectedBusiness, todayIso]);

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--olive-700)">📊 Últims 30 dies</SectionLabel>
      <div style={{ padding: '14px 14px 10px', borderRadius: 13, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
        {/* Y-axis hint — shows the scale max so the bar heights are readable. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--ink-500)', marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>màx {maxCount}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>reserves/dia</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90, paddingBottom: 4 }}>
          {days.map((d, i) => {
            const h = (d.count / maxCount) * 100;
            const isToday = i === days.length - 1;
            return (
              <div key={d.iso}
                title={`${shortDayLabel(d.iso)} · ${d.count} reserves · ${d.pax} pax`}
                style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  width: '100%',
                  height: `${h}%`,
                  minHeight: d.count > 0 ? 3 : 0,
                  background: isToday ? 'var(--terracotta-600)' : d.isWeekend ? 'var(--olive-500)' : 'var(--ink-300)',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 320ms ease',
                }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          <span>{shortDayLabel(days[0].iso)}</span>
          <span>{shortDayLabel(days[days.length - 1].iso)}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <InsightCard icon="📅" label="Millor dia" value={bestDow.name} sub={`${bestDow.avg.toFixed(1)} reserves/dia`} />
        {/* Show lunch + dinner peaks separately when both exist; fall back to
            the single all-day peak when the restaurant only does one service. */}
        {peakLunch && peakDinner ? (
          <InsightCard icon="⏰" label="Hores punta"
            value={`${peakLunch.hour}:00 · ${peakDinner.hour}:00`}
            sub={`${peakLunch.count} migdia · ${peakDinner.count} nit`} />
        ) : (
          <InsightCard icon="⏰" label="Hora punta"
            value={peakHour ? `${peakHour.hour}:00` : '—'}
            sub={peakHour ? `${peakHour.count} reserves` : 'Sense dades'} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB · Clients  (Origen, nous vs recurrents, top, aniversaris)
// ─────────────────────────────────────────────────────────────────────────────

function ClientsTab() {
  return (
    <>
      <NewVsRecurringBlock />
      <SourcesBlock />
      <TopClientsBlock />
      <BirthdaysBlock />
    </>
  );
}

function NewVsRecurringBlock() {
  const { selectedBusiness, reservations, customers, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const data = useMemo(() => {
    const isos30 = new Set(rangeDays(todayIso, 30));
    const monthRes = reservations.filter(r =>
      r.bizId === selectedBusiness && isos30.has(r.date) && r.status !== 'cancelled'
    );

    // A reservation is "recurring" if the matched customer has visits > 1, else "new"
    let recurring = 0, fresh = 0;
    for (const r of monthRes) {
      const c = customers.find(c =>
        (c.phone && r.phone === c.phone) ||
        c.name.trim().toLowerCase() === r.name.trim().toLowerCase()
      );
      if (c && c.visits > 1) recurring++;
      else fresh++;
    }
    const total = recurring + fresh;
    const recurringPct = total ? Math.round((recurring / total) * 100) : 0;
    const freshPct = total ? 100 - recurringPct : 0;
    return { recurring, fresh, total, recurringPct, freshPct };
  }, [reservations, customers, selectedBusiness, todayIso]);

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--olive-700)">🔁 Nous vs recurrents · 30d</SectionLabel>
      <div style={{ padding: '14px', borderRadius: 13, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
        {data.total === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', textAlign: 'center' }}>Sense dades suficients.</div>
        ) : (
          <>
            <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${data.recurringPct}%`, background: 'var(--olive-600)' }} />
              <div style={{ width: `${data.freshPct}%`, background: 'var(--terracotta-500)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--olive-700)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--olive-600)' }} />
                  RECURRENTS
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500, color: 'var(--ink-900)', marginTop: 2 }}>
                  {data.recurringPct}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{data.recurring} reserves</div>
              </div>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--terracotta-700)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--terracotta-500)' }} />
                  NOUS
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500, color: 'var(--ink-900)', marginTop: 2 }}>
                  {data.freshPct}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{data.fresh} reserves</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SourcesBlock() {
  const { selectedBusiness, reservations, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const data = useMemo(() => {
    const isos30 = new Set(rangeDays(todayIso, 30));
    const month = reservations.filter(r =>
      r.bizId === selectedBusiness && isos30.has(r.date) && r.status !== 'cancelled'
    );
    const buckets: Record<string, number> = {};
    for (const r of month) {
      const key = (r.source ?? 'Desconegut').trim() || 'Desconegut';
      buckets[key] = (buckets[key] || 0) + 1;
    }
    const total = Object.values(buckets).reduce((s, n) => s + n, 0);
    return Object.entries(buckets)
      .map(([label, count]) => ({ label, count, pct: total ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [reservations, selectedBusiness, todayIso]);

  // Color per known source name
  const sourceColor = (src: string): string => {
    const s = src.toLowerCase();
    if (s.includes('web'))      return 'var(--sky-600)';
    if (s.includes('telèfon') || s.includes('telefon') || s.includes('phone')) return 'var(--olive-600)';
    if (s.includes('walk'))     return 'var(--terracotta-600)';
    if (s.includes('directe'))  return 'var(--terracotta-600)';
    if (s.includes('xarxa') || s.includes('social') || s.includes('insta')) return 'var(--clay-600)';
    if (s.includes('cover') || s.includes('thefork') || s.includes('plataforma')) return 'var(--ink-600)';
    return 'var(--ink-500)';
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--sky-700)">📡 Origen de les reserves · 30d</SectionLabel>
      <div style={{ padding: '14px', borderRadius: 13, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
        {data.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', textAlign: 'center' }}>Encara sense reserves al període.</div>
        ) : (
          data.map(row => (
            <div key={row.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink-800)' }}>{row.label}</span>
                <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>
                  {row.count} · {row.pct}%
                </span>
              </div>
              <div style={{ height: 7, borderRadius: 3.5, background: 'var(--ink-100)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${row.pct}%`, background: sourceColor(row.label), transition: 'width 320ms ease' }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TopClientsBlock() {
  const { selectedBusiness, customers, reservations } = useAppStore();
  const top = useMemo(
    () => rankCustomers(customers, reservations, selectedBusiness).slice(0, 5),
    [customers, reservations, selectedBusiness],
  );

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="#a37314">🏆 Top 5 clients</SectionLabel>
      {top.length === 0 ? (
        <div style={{ padding: '11px 14px', borderRadius: 11, background: 'var(--paper)', border: '1px solid var(--line-soft)', fontSize: 12.5, color: 'var(--ink-500)', textAlign: 'center' }}>
          Encara no hi ha prou dades.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {top.map((row) => {
            const podium = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `${row.rank}.`;
            return (
              <div key={row.customer.id} style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 13px', borderRadius: 11,
                background: 'var(--paper)', border: '1px solid var(--line-soft)',
              }}>
                <span style={{
                  width: 30, textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: row.rank <= 3 ? 18 : 13, fontWeight: 700,
                  color: row.rank <= 3 ? 'var(--ink-900)' : 'var(--ink-400)',
                }}>{podium}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-900)' }}>{row.customer.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
                    {row.stats.completed} visites · {row.stats.points} pt
                  </div>
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 700,
                  padding: '3px 8px', borderRadius: 999,
                  background: levelTint(row.stats.level).bg, color: levelTint(row.stats.level).color,
                  border: `1px solid ${levelTint(row.stats.level).color}33`,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  <span>{row.stats.level.icon}</span>{row.stats.level.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BirthdaysBlock() {
  const { selectedBusiness, reservations, customers, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const upcoming = useMemo(() => {
    const t = new Date(todayIso + 'T00:00:00').getTime();
    const end = new Date(t + 7 * 86400000).toISOString().slice(0, 10);
    return reservations
      .filter(r => r.bizId === selectedBusiness && r.date >= todayIso && r.date <= end)
      .filter(r => {
        const c = customers.find(c =>
          (c.phone && c.phone === r.phone) ||
          c.name.trim().toLowerCase() === r.name.trim().toLowerCase()
        );
        return c?.tags.includes('birthday') || r.tags?.includes('birthday') || r.notes?.toLowerCase().includes('aniversari');
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [reservations, customers, selectedBusiness, todayIso]);

  if (upcoming.length === 0) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="#a37314">🎂 Aniversaris aquesta setmana</SectionLabel>
      <div style={{ padding: '11px 14px', borderRadius: 11, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
        {upcoming.slice(0, 6).map(r => (
          <div key={r.id} style={{ fontSize: 12.5, color: 'var(--ink-800)', padding: '4px 0' }}>
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: 'var(--ink-500)' }}> · {shortDayLabel(r.date)} {r.time} · {r.pax} pax</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB · Ocupació (live state, heatmap, zones, predictions)
// ─────────────────────────────────────────────────────────────────────────────

function OcupacioTab() {
  return (
    <>
      <LiveStateBlock />
      <HeatmapBlock />
      <ZonesBlock />
      <PredictionBlock />
    </>
  );
}

function LiveStateBlock() {
  const { selectedBusiness, reservations, floorPlans, selectedDate, businessConfigs } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const data = useMemo(() => {
    const todayRes = reservations.filter(r => r.bizId === selectedBusiness && r.date === todayIso);
    const seated = todayRes.filter(r => r.status === 'seated');
    const seatedPax = seated.reduce((s, r) => s + r.pax, 0);
    // Live snapshot: just-seated pax against the room's base capacity (no turnover factor).
    const cap = getEffectiveCapacity(selectedBusiness, businessConfigs);
    const occupancyNow = Math.min(100, Math.round((seatedPax / cap) * 100));

    // Reserves pendents d'arribar (confirmed/pending in next 90 min)
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const pendingArrivals = todayRes
      .filter(r => (r.status === 'pending' || r.status === 'confirmed'))
      .filter(r => {
        const [h, m] = r.time.split(':').map(Number);
        const resMin = h * 60 + m;
        return resMin >= nowMin && resMin <= nowMin + 90;
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    // Retards (pending/confirmed past their time by >15 min)
    const delays = todayRes
      .filter(r => (r.status === 'pending' || r.status === 'confirmed'))
      .filter(r => {
        const [h, m] = r.time.split(':').map(Number);
        const resMin = h * 60 + m;
        return resMin < nowMin - 15;
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    // Taules actives
    const plan = floorPlans[selectedBusiness];
    const activeTables = plan ? plan.tables.filter(t => t.status === 'seated').length : seated.length;
    const totalTables = plan ? plan.tables.length : 0;

    return { seatedCount: seated.length, seatedPax, occupancyNow, pendingArrivals, delays, activeTables, totalTables };
  }, [reservations, floorPlans, selectedBusiness, todayIso, businessConfigs]);

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--terracotta-700)">🟢 Estat ara mateix</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KPICard value={`${data.occupancyNow}%`} label="Ocupació" tone={data.occupancyNow >= 85 ? 'rose' : data.occupancyNow >= 50 ? 'terracotta' : 'sky'} />
        <KPICard value={`${data.activeTables}${data.totalTables ? ` / ${data.totalTables}` : ''}`} label="Taules actives" tone="olive" />
        <KPICard value={data.pendingArrivals.length} label="Pendents arribar" tone="sky" />
        <KPICard value={data.delays.length} label="Amb retard" tone={data.delays.length > 0 ? 'rose' : 'ink'} />
      </div>

      {data.delays.length > 0 && (
        <div style={{ marginTop: 10, padding: '11px 14px', borderRadius: 11, background: 'var(--rose-50)', border: '1px solid rgba(194,74,74,.22)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--rose-700)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 6 }}>
            ⏱ Reserves amb retard
          </div>
          {data.delays.slice(0, 4).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}>
              <span style={{ color: 'var(--ink-800)' }}><b>{r.name}</b> · {r.pax} pax</span>
              <span style={{ color: 'var(--rose-700)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.time}</span>
            </div>
          ))}
        </div>
      )}

      {data.pendingArrivals.length > 0 && (
        <div style={{ marginTop: 10, padding: '11px 14px', borderRadius: 11, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-700)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 6 }}>
            🚶 Pendents arribar (90 min)
          </div>
          {data.pendingArrivals.slice(0, 5).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}>
              <span style={{ color: 'var(--ink-800)' }}><b>{r.name}</b> · {r.pax} pax</span>
              <span style={{ color: 'var(--ink-600)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeatmapBlock() {
  const { selectedBusiness, reservations, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const { matrix, maxVal, dows, hours } = useMemo(() => {
    // Hours from 12:00 to 23:00 — covers lunch + dinner
    const hours = Array.from({ length: 12 }, (_, i) => i + 12); // 12..23
    const dows = ['Dl','Dt','Dc','Dj','Dv','Ds','Dg']; // Monday-first
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(hours.length).fill(0));

    const isos30 = new Set(rangeDays(todayIso, 30));
    reservations.forEach(r => {
      if (r.bizId !== selectedBusiness) return;
      if (r.status === 'cancelled') return;
      if (!isos30.has(r.date)) return;
      const d = new Date(r.date + 'T00:00:00');
      const dow = (d.getDay() + 6) % 7; // shift Sunday(0) → 6, Monday(1) → 0
      const h = parseInt(r.time.split(':')[0], 10);
      const hIdx = hours.indexOf(h);
      if (hIdx === -1) return;
      matrix[dow][hIdx] += r.pax;
    });
    const maxVal = Math.max(1, ...matrix.flat());
    return { matrix, maxVal, dows, hours };
  }, [reservations, selectedBusiness, todayIso]);

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--clay-700)">🔥 Heatmap d'ocupació · 30d</SectionLabel>
      <div style={{ padding: '14px 12px', borderRadius: 13, background: 'var(--paper)', border: '1px solid var(--line-soft)', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `28px repeat(${hours.length}, 1fr)`, gap: 2, minWidth: 320 }}>
          {/* Header row */}
          <div />
          {hours.map(h => (
            <div key={h} style={{ fontSize: 9, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{h}</div>
          ))}
          {/* Data rows */}
          {dows.map((dow, di) => (
            <React.Fragment key={dow}>
              <div style={{ fontSize: 10, color: 'var(--ink-600)', fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
                {dow}
              </div>
              {hours.map((_, hi) => {
                const v = matrix[di][hi];
                const intensity = v / maxVal;
                const bg = v === 0
                  ? 'var(--ink-50)'
                  : `rgba(200, 97, 58, ${0.12 + intensity * 0.78})`;
                return (
                  <div key={hi} title={`${dow} ${hours[hi]}:00 · ${v} pax`} style={{
                    aspectRatio: '1.1 / 1',
                    background: bg,
                    borderRadius: 3,
                  }} />
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 10, color: 'var(--ink-500)' }}>
          <span>menys</span>
          {[0, 0.25, 0.5, 0.75, 1].map(i => (
            <span key={i} style={{ width: 11, height: 11, borderRadius: 2, background: i === 0 ? 'var(--ink-50)' : `rgba(200, 97, 58, ${0.12 + i * 0.78})` }} />
          ))}
          <span>més</span>
        </div>
      </div>
    </div>
  );
}

function ZonesBlock() {
  const { selectedBusiness, reservations, floorPlans, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const rows = useMemo(() => {
    const plan = floorPlans[selectedBusiness];
    if (!plan) return [];
    const todayRes = reservations.filter(r => r.bizId === selectedBusiness && r.date === todayIso && r.status !== 'cancelled');
    const zoneCounts: Record<string, number> = {};
    todayRes.forEach(r => {
      (r.tableIds ?? []).forEach(tid => {
        const tbl = plan.tables.find(x => x.id === tid);
        if (tbl) zoneCounts[tbl.zone] = (zoneCounts[tbl.zone] || 0) + 1;
      });
    });
    return plan.zones
      .map(z => ({ label: z.label, count: zoneCounts[z.id] || 0 }))
      .filter(z => z.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [reservations, floorPlans, selectedBusiness, todayIso]);

  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map(r => r.count));

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--ink-700)">🏠 Distribució per zona · avui</SectionLabel>
      <div style={{ padding: '14px', borderRadius: 13, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
        {rows.map(z => (
          <div key={z.label} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--ink-800)' }}>{z.label}</span>
              <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{z.count}</span>
            </div>
            <div style={{ height: 7, borderRadius: 3.5, background: 'var(--ink-100)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(z.count / max) * 100}%`, background: 'var(--terracotta-500)', transition: 'width 320ms ease' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PredictionBlock() {
  const { selectedBusiness, reservations, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  // Simple prediction: average reservations at each hour for the same DOW over last 4 weeks
  const slots = useMemo(() => {
    const t = new Date(todayIso + 'T00:00:00').getTime();
    const dow = new Date(todayIso + 'T00:00:00').getDay();
    const sameDowDates: string[] = [];
    for (let w = 1; w <= 4; w++) {
      sameDowDates.push(new Date(t - w * 7 * 86400000).toISOString().slice(0, 10));
    }
    const slots: { hour: number; expected: number; actualSoFar: number }[] = [];
    for (let h = 12; h <= 23; h++) {
      const pastPax = sameDowDates.reduce((acc, iso) => {
        return acc + reservations.filter(r =>
          r.bizId === selectedBusiness && r.date === iso && r.status !== 'cancelled' &&
          parseInt(r.time.split(':')[0], 10) === h
        ).reduce((s, r) => s + r.pax, 0);
      }, 0);
      const expected = Math.round(pastPax / 4);
      const actualSoFar = reservations.filter(r =>
        r.bizId === selectedBusiness && r.date === todayIso && r.status !== 'cancelled' &&
        parseInt(r.time.split(':')[0], 10) === h
      ).reduce((s, r) => s + r.pax, 0);
      slots.push({ hour: h, expected, actualSoFar });
    }
    return slots.filter(s => s.expected > 0 || s.actualSoFar > 0);
  }, [reservations, selectedBusiness, todayIso]);

  if (slots.length === 0) return null;
  const max = Math.max(1, ...slots.map(s => Math.max(s.expected, s.actualSoFar)));

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--sky-700)">🔮 Predicció pròximes hores</SectionLabel>
      <div style={{ padding: '14px', borderRadius: 13, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
        <div style={{ fontSize: 10.5, color: 'var(--ink-500)', marginBottom: 8 }}>
          Mitjana de pax per hora (basat en els últims 4 mateixos dies de la setmana)
        </div>
        {slots.map(s => (
          <div key={s.hour} style={{ marginBottom: 6, display: 'grid', gridTemplateColumns: '38px 1fr 60px', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-600)' }}>{s.hour}:00</span>
            <div style={{ position: 'relative', height: 16, background: 'var(--ink-100)', borderRadius: 4 }}>
              {/* Expected (light) */}
              <div style={{ position: 'absolute', inset: 0, width: `${(s.expected / max) * 100}%`, background: 'var(--sky-100)', borderRadius: 4 }} />
              {/* Actual so far (filled) */}
              <div style={{ position: 'absolute', inset: 0, width: `${(s.actualSoFar / max) * 100}%`, background: 'var(--sky-600)', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-500)', textAlign: 'right' }}>
              {s.actualSoFar}/{s.expected}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10.5, color: 'var(--ink-600)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--sky-600)' }} /> Actual
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--sky-100)' }} /> Previst
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB · Fidelització (level distribution, no-show health, badges)
// ─────────────────────────────────────────────────────────────────────────────

function FidelitzacioTab() {
  return (
    <>
      <LoyaltyHealthBlock />
      <LevelDistributionBlock />
      <BadgesPopularityBlock />
    </>
  );
}

function LoyaltyHealthBlock() {
  const { selectedBusiness, reservations, customers, selectedDate } = useAppStore();
  const todayIso = isoDate(selectedDate);

  const data = useMemo(() => {
    const isos30 = new Set(rangeDays(todayIso, 30));
    const recent = reservations.filter(r =>
      r.bizId === selectedBusiness && isos30.has(r.date)
    );
    const recentFinal = recent.filter(r => r.status === 'completed' || r.status === 'noshow');
    const noshows = recent.filter(r => r.status === 'noshow').length;
    const noshowRate = recentFinal.length > 0 ? Math.round((noshows / recentFinal.length) * 100) : 0;

    // Total points distributed (all-time for this biz)
    const ranked = rankCustomers(customers, reservations, selectedBusiness);
    const totalPoints = ranked.reduce((s, r) => s + Math.max(0, r.stats.points), 0);
    const totalCustomers = ranked.filter(r => r.stats.total > 0).length;

    return { noshowRate, noshows, totalPoints, totalCustomers };
  }, [reservations, customers, selectedBusiness, todayIso]);

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--rose-700)">💚 Salut del programa</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KPICard value={`${data.noshowRate}%`} label="No-show rate 30d" tone={data.noshowRate > 10 ? 'rose' : 'olive'} />
        <KPICard value={data.totalCustomers} label="Clients actius" tone="sky" />
        <div style={{ gridColumn: '1 / -1' }}>
          <KPICard value={data.totalPoints.toLocaleString('ca-ES')} label="Punts totals distribuïts" tone="terracotta" />
        </div>
      </div>
    </div>
  );
}

function LevelDistributionBlock() {
  const { selectedBusiness, customers, reservations } = useAppStore();

  const buckets = useMemo(() => {
    const ranked = rankCustomers(customers, reservations, selectedBusiness).filter(r => r.stats.total > 0);
    const counts: Record<LevelId, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0, diamond: 0, master: 0 };
    ranked.forEach(r => { counts[r.stats.level.id]++; });
    const total = ranked.length;
    return LEVELS.map(l => ({
      level: l,
      count: counts[l.id],
      pct: total ? Math.round((counts[l.id] / total) * 100) : 0,
    }));
  }, [customers, reservations, selectedBusiness]);

  const total = buckets.reduce((s, b) => s + b.count, 0);
  const max = Math.max(1, ...buckets.map(b => b.count));

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="#a37314">📊 Distribució per nivell</SectionLabel>
      <div style={{ padding: '14px', borderRadius: 13, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
        {total === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', textAlign: 'center' }}>Encara no hi ha clients actius.</div>
        ) : (
          buckets.map(b => (
            <div key={b.level.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: levelTint(b.level).color }}>
                  {b.level.icon} {b.level.name}
                </span>
                <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{b.count} · {b.pct}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 3.5, background: 'var(--ink-100)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(b.count / max) * 100}%`, background: levelTint(b.level).color, transition: 'width 320ms ease' }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BadgesPopularityBlock() {
  const { selectedBusiness, customers, reservations } = useAppStore();

  const data = useMemo(() => {
    const scoped = customers.filter(c => c.biz.includes(selectedBusiness));
    const badgeCounts: Record<string, { icon: string; label: string; count: number }> = {};
    scoped.forEach(c => {
      const stats = computeCustomerStats(c, reservations);
      stats.badges.forEach(b => {
        if (!b.earned) return;
        if (!badgeCounts[b.id]) badgeCounts[b.id] = { icon: b.icon, label: b.label, count: 0 };
        badgeCounts[b.id].count++;
      });
    });
    return Object.values(badgeCounts).sort((a, b) => b.count - a.count);
  }, [customers, reservations, selectedBusiness]);

  if (data.length === 0) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel color="var(--olive-700)">🎖 Insígnies més comunes</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {data.map(b => (
          <div key={b.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 11px', borderRadius: 999,
            background: 'var(--paper)', border: '1px solid var(--line)',
            fontSize: 12, fontWeight: 600, color: 'var(--ink-800)',
          }}>
            <span style={{ fontSize: 14 }}>{b.icon}</span>
            <span>{b.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-500)', fontWeight: 700 }}>· {b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB · Comparativa  (3 negocis costat a costat)
// ─────────────────────────────────────────────────────────────────────────────

interface BizMetrics {
  bizId:        string;
  name:         string;
  hue:          string;
  hueSoft:      string;
  monogram:     string;
  resToday:     number;
  paxToday:     number;
  occupancyPct: number;
  noshowsMonth: number;
  noshowRate:   number;     // % over completed+noshow in last 30d
  topClient:    { name: string; points: number; level: string; levelIcon: string } | null;
  trend7d:      number[];   // reservation count last 7 days (oldest first)
  maxTrend:     number;
}

function ComparativaTab() {
  const { reservations, customers, selectedDate, businessConfigs } = useAppStore();
  const visibleBusinesses = useVisibleBusinesses();
  const todayIso = isoDate(selectedDate);

  const metrics = useMemo<BizMetrics[]>(() => {
    const t = new Date(todayIso + 'T00:00:00').getTime();
    const startMonth = new Date(t - 30 * 86400000).toISOString().slice(0, 10);

    return visibleBusinesses.map(biz => {
      // Today
      const todayRes = reservations.filter(r => r.bizId === biz.id && r.date === todayIso);
      const activeToday = todayRes.filter(r => r.status !== 'cancelled' && r.status !== 'noshow');
      const paxToday = activeToday.reduce((s, r) => s + r.pax, 0);
      const cap = getDailyServiceCapacity(biz.id, businessConfigs);
      const occupancyPct = cap > 0 ? Math.min(100, Math.round((paxToday / cap) * 100)) : 0;

      // Last 30d no-show rate
      const monthRes = reservations.filter(r =>
        r.bizId === biz.id && r.date >= startMonth && r.date <= todayIso
      );
      const monthFinal = monthRes.filter(r => r.status === 'completed' || r.status === 'noshow');
      const noshowsMonth = monthRes.filter(r => r.status === 'noshow').length;
      const noshowRate = monthFinal.length > 0
        ? Math.round((noshowsMonth / monthFinal.length) * 100)
        : 0;

      // Top customer for this biz
      const ranked = rankCustomers(customers, reservations, biz.id as any);
      const top = ranked[0];
      const topClient = top && top.stats.total > 0 ? {
        name:      top.customer.name,
        points:    top.stats.points,
        level:     top.stats.level.name,
        levelIcon: top.stats.level.icon,
      } : null;

      // 7-day trend (oldest → newest)
      const trend7d: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const iso = new Date(t - i * 86400000).toISOString().slice(0, 10);
        const dayRes = reservations.filter(r =>
          r.bizId === biz.id && r.date === iso && r.status !== 'cancelled'
        );
        trend7d.push(dayRes.length);
      }
      const maxTrend = Math.max(1, ...trend7d);

      return {
        bizId: biz.id,
        name:  biz.name,
        hue:   biz.hue,
        hueSoft: biz.hueSoft,
        monogram: biz.monogram,
        resToday:     activeToday.length,
        paxToday,
        occupancyPct,
        noshowsMonth,
        noshowRate,
        topClient,
        trend7d,
        maxTrend,
      };
    });
  }, [reservations, customers, todayIso, businessConfigs, visibleBusinesses]);

  // Leaders per metric — used to add a subtle 🏆 to the leader card.
  const leaderRes  = metrics.reduce((max, m) => m.resToday    > max.resToday    ? m : max, metrics[0]);
  const leaderPax  = metrics.reduce((max, m) => m.paxToday    > max.paxToday    ? m : max, metrics[0]);
  const leaderOcc  = metrics.reduce((max, m) => m.occupancyPct > max.occupancyPct ? m : max, metrics[0]);
  // For no-show, the LOWEST rate wins (with at least 3 final reservations to be meaningful).
  const noshowCandidates = metrics.filter(m => m.noshowsMonth >= 0);
  const leaderNoshow = noshowCandidates.length
    ? noshowCandidates.reduce((min, m) => m.noshowRate < min.noshowRate ? m : min, noshowCandidates[0])
    : null;

  return (
    <>
      <div style={{ marginBottom: 14, padding: '0 2px' }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
        }}>Avui · els 3 negocis</div>
        <div style={{
          fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3,
          fontFamily: 'var(--font-mono)', letterSpacing: .04,
        }}>🏆 marca el líder de cada mètrica</div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 10,
      }}>
        {metrics.map(m => (
          <BizColumn key={m.bizId}
            m={m}
            leaderRes={leaderRes.bizId === m.bizId && m.resToday > 0}
            leaderPax={leaderPax.bizId === m.bizId && m.paxToday > 0}
            leaderOcc={leaderOcc.bizId === m.bizId && m.occupancyPct > 0}
            leaderNoshow={!!leaderNoshow && leaderNoshow.bizId === m.bizId && m.noshowsMonth === 0}
          />
        ))}
      </div>
    </>
  );
}

function BizColumn({ m, leaderRes, leaderPax, leaderOcc, leaderNoshow }: {
  m: BizMetrics;
  leaderRes: boolean; leaderPax: boolean; leaderOcc: boolean; leaderNoshow: boolean;
}) {
  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid var(--line-soft)',
      background: 'var(--paper)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(60,40,20,.04)',
    }}>
      {/* Header — biz monogram tile + name in biz hue */}
      <div style={{
        padding: '12px 12px 10px',
        background: `linear-gradient(180deg, ${m.hueSoft} 0%, var(--paper) 100%)`,
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'var(--paper)', color: m.hue,
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 600,
          border: `1px solid ${m.hue}33`,
        }}>{m.monogram}</span>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 14.5, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.005,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{m.name}</div>
      </div>

      {/* Metric stack */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CompareMetric label="Reserves avui"  value={m.resToday}  leader={leaderRes} />
        <CompareMetric label="Pax avui"        value={m.paxToday}  leader={leaderPax} />
        <CompareMetric label="Ocupació"
          value={`${m.occupancyPct}%`}
          leader={leaderOcc}
          tone={m.occupancyPct >= 85 ? 'rose' : m.occupancyPct >= 50 ? 'terracotta' : 'sky'} />
        <CompareMetric label="No-shows 30d"
          value={`${m.noshowsMonth} · ${m.noshowRate}%`}
          leader={leaderNoshow}
          tone={m.noshowRate > 10 ? 'rose' : 'ink'} />

        {/* 7-day mini bar chart */}
        <div style={{ marginTop: 2 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: 'var(--ink-500)',
            letterSpacing: .08, textTransform: 'uppercase', marginBottom: 4,
          }}>Últims 7 dies</div>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 2, height: 36,
            padding: '2px 0',
          }}>
            {m.trend7d.map((c, i) => {
              const h = (c / m.maxTrend) * 100;
              const isToday = i === m.trend7d.length - 1;
              return (
                <div key={i} style={{
                  flex: 1, height: '100%',
                  display: 'flex', alignItems: 'flex-end',
                }}>
                  <div style={{
                    width: '100%',
                    height: `${h}%`, minHeight: c > 0 ? 2 : 0,
                    background: isToday ? m.hue : `${m.hue}55`,
                    borderRadius: '2px 2px 0 0',
                  }} title={`${c} reserves`} />
                </div>
              );
            })}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 9, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)',
            marginTop: 3, letterSpacing: .04,
          }}>
            <span>−6d</span>
            <span>avui</span>
          </div>
        </div>

        {/* Top client (mes) */}
        <div style={{
          marginTop: 2, padding: '8px 10px', borderRadius: 10,
          background: 'var(--ink-50)', border: '1px solid var(--line-soft)',
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: 'var(--ink-500)',
            letterSpacing: .08, textTransform: 'uppercase', marginBottom: 3,
          }}>Top client</div>
          {m.topClient ? (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 650, color: 'var(--ink-900)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                <span>{m.topClient.levelIcon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.topClient.name}
                </span>
              </div>
              <div style={{
                fontSize: 10, color: 'var(--ink-500)', marginTop: 1,
                fontFamily: 'var(--font-mono)', letterSpacing: .04,
              }}>{m.topClient.points} pt · {m.topClient.level}</div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--ink-400)', fontStyle: 'italic' }}>—</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareMetric({ label, value, leader, tone = 'ink' }: {
  label: string; value: string | number; leader?: boolean;
  tone?: 'ink' | 'terracotta' | 'rose' | 'sky';
}) {
  const fg =
    tone === 'rose'       ? 'var(--rose-700)' :
    tone === 'terracotta' ? 'var(--terracotta-700)' :
    tone === 'sky'        ? 'var(--sky-700)' :
    'var(--ink-900)';
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 9.5, fontWeight: 700, color: 'var(--ink-500)',
        letterSpacing: .08, textTransform: 'uppercase',
      }}>
        {leader && <span style={{ fontSize: 10 }}>🏆</span>}
        <span>{label}</span>
      </div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 500,
        color: fg, marginTop: 2, lineHeight: 1.05, letterSpacing: -.01,
      }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared visual primitives
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: .06, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function KPICard({ value, label, delta, tone }: {
  value: number | string; label: string; delta?: number;
  tone: 'terracotta' | 'olive' | 'sky' | 'rose' | 'ink';
}) {
  // Tone now drives just the value color + accent bar — card itself is
  // paper-elevated, matching the rest of the app. The previous tint-flooded
  // background made the stats screen feel like a different app.
  const palette = {
    terracotta: { fg: 'var(--terracotta-700)', accent: 'var(--terracotta-500)' },
    olive:      { fg: 'var(--olive-700)',      accent: 'var(--olive-500)'      },
    sky:        { fg: 'var(--sky-700)',        accent: 'var(--sky-500)'        },
    rose:       { fg: 'var(--rose-700)',       accent: 'var(--rose-600)'       },
    ink:        { fg: 'var(--ink-900)',        accent: 'var(--ink-300)'        },
  }[tone];
  const deltaStr = delta !== undefined
    ? (delta > 0.5 ? `▲ +${delta.toFixed(0)}` : delta < -0.5 ? `▼ ${delta.toFixed(0)}` : '= mitjana')
    : null;
  const deltaCol = delta === undefined ? 'var(--ink-500)' : delta > 0.5 ? 'var(--olive-700)' : delta < -0.5 ? 'var(--rose-700)' : 'var(--ink-500)';
  return (
    <div style={{
      position: 'relative',
      padding: '14px 16px', borderRadius: 14,
      background: 'var(--surface-elevated)',
      boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
      overflow: 'hidden',
    }}>
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: palette.accent,
      }} />
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 500, color: palette.fg, lineHeight: 1, letterSpacing: -.015 }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginTop: 7 }}>
        {label}
      </div>
      {deltaStr && (
        <div style={{ fontSize: 10.5, color: deltaCol, marginTop: 4, fontWeight: 600 }}>
          {deltaStr}
        </div>
      )}
    </div>
  );
}

function InsightCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div style={{
      padding: '13px 15px', borderRadius: 14,
      background: 'var(--surface-elevated)',
      boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase' }}>
        <span style={{ fontSize: 14 }}>{icon}</span> {label}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 500, color: 'var(--ink-900)', marginTop: 4, lineHeight: 1.1, letterSpacing: -.005 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}
