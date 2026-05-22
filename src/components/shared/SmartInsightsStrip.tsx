/**
 * SmartInsightsStrip — horizontal scroll of contextual cards generated from
 * real data (reservation history, customers, waitlist, weather forecast).
 *
 * Each chip is now ACTIONABLE: tapping opens the relevant detail (weather
 * sheet, waitlist, a filtered list of reservations…). The × on the right
 * of each chip dismisses it for the current day. Renders nothing when
 * everything is empty so quiet days stay clean.
 */
import React, { useEffect, useMemo, useState, memo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  generateDayInsights, dismissInsight, pickHeadlineInsight, pickSecondaryInsights,
  type SmartInsight, type InsightTone, type InsightAction, type ReservationFilter,
} from '@/utils/insights';
import { fetchForecast, DEFAULT_COORDS, type WeatherForecast } from '@/lib/weather';
import ReservationsListSheet from './ReservationsListSheet';
import { useDevice } from '@/hooks/useDevice';

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

  // On a large touchscreen the right side panel already shows the
  // trend tile (Tendència ±%) — drop the equivalent insight chip
  // (cmp-up / cmp-down) to avoid duplicating the same number.
  const { isLargeScreen, isTouch } = useDevice();
  const dedupForLargeTouch = isLargeScreen && isTouch;

  const insights = useMemo(
    () => {
      const all = generateDayInsights({
        selectedDate, bizId: selectedBusiness, reservations, customers, waitlist, forecast,
      });
      // The "insight del moment" hero card already shows the top insight
      // above the strip — filter it out so the same line doesn't appear
      // twice. Also: when the day is quiet (≤3 reservations), tighten the
      // cap so the AI doesn't artificially fill the screen with ambient
      // observations the operator doesn't need.
      const headline = pickHeadlineInsight(all);
      const dayIsQuiet =
        reservations.filter(r => r.bizId === selectedBusiness && r.date === dayIso
          && r.status !== 'cancelled' && r.status !== 'noshow').length <= 3;
      const secondaries = pickSecondaryInsights(all, headline?.id, 3, dayIsQuiet);
      return dedupForLargeTouch
        ? secondaries.filter(i => i.id !== 'cmp-up' && i.id !== 'cmp-down')
        : secondaries;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, selectedBusiness, reservations, customers, waitlist, forecast, dismissTick, dedupForLargeTouch, dayIso]
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
          // On a large touchscreen the floating OpsLeftPanel (left:18, w:192)
          // and LiveSidePanel (right:18, w:192) overlap the bottom of the
          // strip. Inset the row to ~226 px on each side so the chips read
          // cleanly inside the content column. Phones/iPads keep the 14 px
          // gutter.
          padding: dedupForLargeTouch ? '10px 226px 4px' : '10px 14px 4px',
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
  // Phase 4 (calmer): secondaries sit on paper with no tint wash. The only
  // tone signal is a thin left accent line + a slightly tinted icon
  // background. Foreground text stays in ink-900/ink-600 — the chip reads
  // as part of the page, not as a coloured banner. Terracotta only fires
  // when severity is "alert" (genuine action required).
  switch (tone) {
    case 'positive': return { tint: 'rgba(116,133,74,.06)', fg: 'var(--ink-900)', accent: 'var(--olive-500)'      };
    case 'warning':  return { tint: 'rgba(176,118,54,.06)', fg: 'var(--ink-900)', accent: 'var(--clay-500)'       };
    case 'alert':    return { tint: 'rgba(168,74,42,.08)',  fg: 'var(--ink-900)', accent: 'var(--terracotta-500)' };
    default:         return { tint: 'rgba(60,40,20,.03)',   fg: 'var(--ink-900)', accent: 'var(--ink-300)'        };
  }
}

const InsightChip = memo(function InsightChip({ ins, onAction, onDismiss }: {
  ins: SmartInsight;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const p = tonePalette(ins.tone);
  const interactive = !!ins.action;
  return (
    <div style={{
      position: 'relative',
      flexShrink: 0,
      maxWidth: 320,
      padding: '8px 6px 8px 14px',
      borderRadius: 10,
      // Almost-flat paper card — single hairline ring instead of a stack
      // of shadows so the strip doesn't compete with the hero card above.
      background: 'var(--surface-elevated)',
      boxShadow: '0 0 0 1px rgba(60,40,20,.06) inset, 0 1px 0 rgba(255,255,255,.5) inset',
      display: 'flex', alignItems: 'stretch', gap: 4,
      overflow: 'hidden',
    }}>
      {/* Tone accent — a thin 2 px line, only visible for warning/alert.
          Neutral/positive chips have no left bar so they feel lighter. */}
      {(ins.tone === 'warning' || ins.tone === 'alert') && (
        <span aria-hidden style={{
          position: 'absolute', left: 0, top: 6, bottom: 6,
          width: 2, background: p.accent, opacity: .55,
          borderRadius: 999,
        }} />
      )}
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
        <span aria-hidden style={{
          fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1,
          width: 22, height: 22, borderRadius: 6,
          background: p.tint,
          display: 'grid', placeItems: 'center',
        }}>{ins.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: p.fg, lineHeight: 1.3,
            letterSpacing: -.005,
          }}>{ins.text}</div>
          {ins.sub && (
            <div style={{
              fontSize: 11, color: 'var(--ink-500)', marginTop: 2,
              fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: .01,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{ins.sub}</div>
          )}
        </div>
      </button>
      {/* Dismiss × — separated so a tap on it never fires the main action.
          Sized at 32 px so it's a comfortable target on the counter
          touchscreen without becoming visually dominant. */}
      <button onClick={onDismiss} aria-label="Descartar"
        className="tac-btn tac-btn--ghost"
        style={{
          flexShrink: 0,
          width: 32, height: 32, alignSelf: 'flex-start',
          margin: '-2px 0 0 2px', padding: 0,
          color: p.fg,
          display: 'grid', placeItems: 'center',
          fontSize: 18, lineHeight: 1,
          borderRadius: 8,
        }}>
        ×
      </button>
    </div>
  );
});
