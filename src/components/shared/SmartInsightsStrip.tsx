/**
 * SmartInsightsStrip — horizontal scroll of contextual cards generated from
 * real data (reservation history, customers, waitlist, weather forecast).
 *
 * Mounted at the top of TodayView. Renders nothing when there's no insight
 * worth showing, so the screen stays clean on truly quiet days.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { generateDayInsights, type SmartInsight, type InsightTone } from '@/utils/insights';
import { fetchForecast, DEFAULT_COORDS, type WeatherForecast } from '@/lib/weather';

export default function SmartInsightsStrip() {
  const {
    selectedBusiness, selectedDate, reservations, customers, waitlist,
  } = useAppStore();

  // Weather is async + cached. We fetch in the background and re-derive
  // insights once it's resolved. The strip renders immediately with
  // weather-less insights and quietly upgrades when the forecast lands.
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  useEffect(() => {
    let cancelled = false;
    const dateIso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;
    fetchForecast({ date: dateIso, lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng })
      .then(f => { if (!cancelled) setForecast(f); });
    return () => { cancelled = true; };
  }, [selectedDate]);

  const insights = useMemo(
    () => generateDayInsights({
      selectedDate, bizId: selectedBusiness, reservations, customers, waitlist, forecast,
    }),
    [selectedDate, selectedBusiness, reservations, customers, waitlist, forecast]
  );

  if (insights.length === 0) return null;

  return (
    <div
      data-swipeable="true"  // prevents day-swipe from triggering on horizontal scroll
      style={{
        padding: '10px 14px 4px',
        display: 'flex', gap: 8,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        // Soft fade at the right edge as a "there's more" hint
        maskImage: 'linear-gradient(90deg, #000 0%, #000 calc(100% - 22px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, #000 0%, #000 calc(100% - 22px), transparent 100%)',
      }}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      {insights.map(ins => <InsightChip key={ins.id} ins={ins} />)}
    </div>
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

function InsightChip({ ins }: { ins: SmartInsight }) {
  const p = tonePalette(ins.tone);
  return (
    <div style={{
      flexShrink: 0,
      maxWidth: 280,
      padding: '9px 12px',
      borderRadius: 12,
      background: `linear-gradient(180deg, ${p.bg} 0%, rgba(255,255,255,.4) 100%)`,
      border: `1px solid ${p.border}`,
      boxShadow: '0 1px 2px rgba(60,40,20,.04), inset 0 1px 0 rgba(255,255,255,.5)',
      display: 'flex', alignItems: 'flex-start', gap: 9,
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
    </div>
  );
}
