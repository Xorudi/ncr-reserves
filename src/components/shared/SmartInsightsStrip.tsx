/**
 * SmartInsightsStrip — horizontal scroll of contextual cards generated from
 * real data (reservation history, customers, waitlist, weather forecast).
 *
 * Each chip is now ACTIONABLE: tapping opens the relevant detail (weather
 * sheet, waitlist, a filtered list of reservations…). The × on the right
 * of each chip dismisses it for the current day. Renders nothing when
 * everything is empty so quiet days stay clean.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  generateDayInsights, dismissInsight,
  type SmartInsight, type InsightTone, type InsightAction, type ReservationFilter,
} from '@/utils/insights';
import { fetchForecast, DEFAULT_COORDS, type WeatherForecast } from '@/lib/weather';
import ReservationsListSheet from './ReservationsListSheet';

export default function SmartInsightsStrip() {
  const {
    selectedBusiness, selectedDate, reservations, customers, waitlist,
    setShowWaitlist,
  } = useAppStore();

  const dayIso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;

  // Weather is async + cached. We re-derive once it lands.
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchForecast({ date: dayIso, lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng })
      .then(f => { if (!cancelled) setForecast(f); });
    return () => { cancelled = true; };
  }, [dayIso]);

  // Force a re-derive when an insight is dismissed (sessionStorage isn't
  // reactive). The counter is incremented from each chip's × handler.
  const [dismissTick, setDismissTick] = useState(0);

  const insights = useMemo(
    () => generateDayInsights({
      selectedDate, bizId: selectedBusiness, reservations, customers, waitlist, forecast,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, selectedBusiness, reservations, customers, waitlist, forecast, dismissTick]
  );

  // State for the filtered-reservations sheet that some chip actions open.
  const [listFilter, setListFilter] = useState<ReservationFilter | null>(null);
  const [listTitle,  setListTitle]  = useState('');

  function handleAction(action?: InsightAction) {
    if (!action) return;
    switch (action.kind) {
      case 'open-weather':
        // Decoupled: the WeatherWidget listens for this event and opens its sheet.
        window.dispatchEvent(new CustomEvent('app:open-weather'));
        break;
      case 'open-waitlist':
        setShowWaitlist(true);
        break;
      case 'open-stats-comparative':
        window.dispatchEvent(new CustomEvent('app:open-stats', { detail: { tab: 'comparativa' } }));
        break;
      case 'show-reservations':
        setListFilter(action.filter);
        setListTitle(action.title);
        break;
      case 'scroll-to-hour':
        window.dispatchEvent(new CustomEvent('app:scroll-to-hour', { detail: { hour: action.hour } }));
        break;
    }
  }

  function handleDismiss(id: string) {
    dismissInsight(id, dayIso);
    setDismissTick(t => t + 1);
  }

  if (insights.length === 0) return null;

  return (
    <>
      <div
        data-swipeable="true"
        style={{
          padding: '10px 14px 4px',
          display: 'flex', gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          maskImage: 'linear-gradient(90deg, #000 0%, #000 calc(100% - 22px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, #000 0%, #000 calc(100% - 22px), transparent 100%)',
        }}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        {insights.map(ins => (
          <InsightChip key={ins.id} ins={ins}
            onAction={() => handleAction(ins.action)}
            onDismiss={() => handleDismiss(ins.id)} />
        ))}
      </div>

      <ReservationsListSheet
        open={listFilter !== null}
        filter={listFilter}
        title={listTitle}
        onClose={() => { setListFilter(null); setListTitle(''); }}
      />
    </>
  );
}

function tonePalette(tone: InsightTone) {
  switch (tone) {
    case 'positive': return { bg: 'var(--olive-50)',      fg: 'var(--olive-700)',      border: 'rgba(116,133,74,.24)' };
    case 'warning':  return { bg: 'var(--clay-50)',       fg: 'var(--clay-700)',       border: 'rgba(176,118,54,.24)' };
    case 'alert':    return { bg: 'var(--terracotta-50)', fg: 'var(--terracotta-700)', border: 'rgba(168,74,42,.26)' };
    default:         return { bg: 'var(--paper)',         fg: 'var(--ink-700)',        border: 'rgba(60,40,20,.10)' };
  }
}

function InsightChip({ ins, onAction, onDismiss }: {
  ins: SmartInsight;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const p = tonePalette(ins.tone);
  const interactive = !!ins.action;
  return (
    <div style={{
      flexShrink: 0,
      maxWidth: 320,
      padding: '8px 4px 8px 12px',
      borderRadius: 12,
      background: `linear-gradient(180deg, ${p.bg} 0%, rgba(255,255,255,.4) 100%)`,
      border: `1px solid ${p.border}`,
      boxShadow: '0 1px 2px rgba(60,40,20,.04), inset 0 1px 0 rgba(255,255,255,.5)',
      display: 'flex', alignItems: 'stretch', gap: 4,
    }}>
      {/* Tappable area — icon + text + sub */}
      <button onClick={interactive ? onAction : undefined} className="press"
        disabled={!interactive}
        style={{
          flex: 1,
          background: 'transparent', border: 'none',
          padding: '1px 0',
          cursor: interactive ? 'pointer' : 'default',
          fontFamily: 'inherit', textAlign: 'left',
          display: 'flex', alignItems: 'flex-start', gap: 9,
          minWidth: 0,
        }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 650, color: p.fg, lineHeight: 1.3,
            letterSpacing: -.005,
          }}>{ins.text}</div>
          {ins.sub && (
            <div style={{
              fontSize: 10.5, color: p.fg, opacity: .7, marginTop: 2,
              fontFamily: 'var(--font-mono)', letterSpacing: .04,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{ins.sub}</div>
          )}
        </div>
      </button>
      {/* Dismiss × — separated so a tap on it never fires the main action */}
      <button onClick={onDismiss} aria-label="Descartar"
        style={{
          flexShrink: 0,
          width: 24, height: 24, alignSelf: 'flex-start',
          margin: '1px 4px 0 0', padding: 0,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: p.fg, opacity: .55,
          display: 'grid', placeItems: 'center',
          fontSize: 14, lineHeight: 1, fontFamily: 'inherit',
        }}>
        ×
      </button>
    </div>
  );
}
