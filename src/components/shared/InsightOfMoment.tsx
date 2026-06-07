/**
 * InsightOfMoment — the "insight del moment" hero card.
 *
 * One single, hand-picked contextual insight rendered with elevated
 * presence: serif headline, eyebrow microlabel, soft tone-tinted ring,
 * subtle breathing glow. Mounts above the dashboard content on
 * desktop/tablet, and above the day list on mobile.
 *
 * Picks `headlineId` from the engine via `pickHeadlineInsight`. If no
 * insight crosses the threshold, the component renders null — quiet by
 * design. This is the inverse of a notification bar.
 *
 * Interaction:
 *   - Whole card is tappable when the insight carries an action.
 *   - Discrete × on the corner to dismiss for the day.
 *   - On a tap, the action runs through the same handler as the strip.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  generateDayInsights, pickHeadlineInsight, dismissInsight,
  type SmartInsight, type InsightAction, type InsightTone, type InsightCategory,
  type ReservationFilter,
} from '@/utils/insights';
import { fetchForecast, DEFAULT_COORDS, type WeatherForecast } from '@/lib/weather';
import ReservationsListSheet from './ReservationsListSheet';

interface Props {
  /** Compact mode tightens padding and font sizes for mobile. */
  compact?: boolean;
  /** Optional external dismiss tick to force re-derive when secondary
   *  strip dismisses a chip (keeps both in sync). */
  dismissTick?: number;
  /** True when the dashboard is rendering floating side panels — adds
   *  horizontal inset so the hero doesn't slide under them. */
  sidePanelInset?: boolean;
}

const CATEGORY_LABEL: Record<InsightCategory, string> = {
  operational: 'Operatiu',
  predictive:  'Previsió',
  business:    'Tendència',
  client:      'Client',
  weather:     'Clima',
  context:     'Context',
};

function tonePalette(tone: InsightTone) {
  switch (tone) {
    case 'positive':
      return {
        ring:    'rgba(116,133,74,.22)',
        accent:  'var(--olive-600)',
        accentSoft: 'rgba(116,133,74,.10)',
        fg:      'var(--olive-700)',
        glow:    'rgba(116,133,74,.12)',
      };
    case 'warning':
      return {
        ring:    'rgba(176,118,54,.24)',
        accent:  'var(--clay-600)',
        accentSoft: 'rgba(176,118,54,.10)',
        fg:      'var(--clay-700)',
        glow:    'rgba(176,118,54,.14)',
      };
    case 'alert':
      return {
        ring:    'rgba(168,74,42,.28)',
        accent:  'var(--terracotta-600)',
        accentSoft: 'rgba(168,74,42,.10)',
        fg:      'var(--terracotta-700)',
        glow:    'rgba(168,74,42,.18)',
      };
    default:
      return {
        ring:    'rgba(60,40,20,.10)',
        accent:  'var(--ink-500)',
        accentSoft: 'rgba(60,40,20,.04)',
        fg:      'var(--ink-700)',
        glow:    'rgba(60,40,20,.05)',
      };
  }
}

export default function InsightOfMoment({ compact = false, dismissTick = 0, sidePanelInset = false }: Props) {
  const {
    selectedBusiness, selectedDate, reservations, customers, waitlist,
    setShowWaitlist,
  } = useAppStore();

  const dayIso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;

  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchForecast({ date: dayIso, lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng })
      .then(f => { if (!cancelled) setForecast(f); });
    return () => { cancelled = true; };
  }, [dayIso]);

  const [innerTick, setInnerTick] = useState(0);

  const headline = useMemo<SmartInsight | null>(() => {
    const all = generateDayInsights({
      selectedDate, bizId: selectedBusiness, reservations, customers, waitlist, forecast,
    });
    return pickHeadlineInsight(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedBusiness, reservations, customers, waitlist, forecast, dismissTick, innerTick]);

  const [listFilter, setListFilter] = useState<ReservationFilter | null>(null);
  const [listTitle,  setListTitle]  = useState('');

  function runAction(action?: InsightAction) {
    if (!action) return;
    switch (action.kind) {
      case 'open-weather':
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

  if (!headline) return null;
  const p = tonePalette(headline.tone);
  const interactive = !!headline.action;
  const padV = compact ? 10 : 12;
  const padH = compact ? 12 : 16;
  // Horizontal margin — when the side panels are docked at left:18/right:18
  // with width:192, we need ~220 px clearance on each side. Otherwise we
  // use the default 22 px gutter.
  const marginH = sidePanelInset ? 226 : (compact ? 14 : 22);
  // Centre the hero in a content-width column so it reads as part of the
  // same column as the dashboard's centred content card (which caps at
  // 1100 px in TouchShell). Matching the cap means the hero and the
  // reservation list visually share a single vertical rail.
  const maxWidth = compact ? undefined : 1080;

  return (
    <>
      {/* Outer wrapper provides the side-panel clearance (when capMain) and
          the page gutter on smaller widths. The inner card centres itself
          inside the safe zone via margin:auto + maxWidth. */}
      <div style={{
        paddingLeft: marginH, paddingRight: marginH,
        paddingTop: compact ? 8 : 12, paddingBottom: 4,
        width: '100%',
      }}>
      <div
        className="insight-moment"
        style={{
          position: 'relative',
          margin: '0 auto',
          maxWidth,
          padding: `${padV}px ${padH}px`,
          borderRadius: 14,
          background: `
            radial-gradient(140% 80% at 12% 0%, ${p.accentSoft} 0%, transparent 60%),
            linear-gradient(180deg, var(--surface-elevated) 0%, var(--surface-elevated) 100%)
          `,
          boxShadow: `
            0 0 0 1px ${p.ring} inset,
            0 1px 0 rgba(255,255,255,.65) inset,
            0 8px 24px -16px ${p.glow},
            var(--shadow-sm)
          `,
          display: 'flex', alignItems: 'flex-start', gap: compact ? 10 : 14,
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
        {/* Soft breathing glow — purely decorative, GPU-friendly transform/opacity */}
        <span aria-hidden style={{
          position: 'absolute',
          left: '-10%', top: '-30%',
          width: '60%', height: '160%',
          background: `radial-gradient(closest-side, ${p.glow} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
          animation: 'insight-breathe 8s ease-in-out infinite',
          zIndex: 0,
        }} />

        {/* Icon disc — smaller, no inner shadow so it reads as part of the
            card rather than a separate badge. */}
        <div style={{
          position: 'relative', zIndex: 1,
          flexShrink: 0,
          width: compact ? 34 : 38, height: compact ? 34 : 38,
          borderRadius: 10,
          background: p.accentSoft,
          boxShadow: `0 0 0 1px ${p.ring} inset`,
          display: 'grid', placeItems: 'center',
          fontSize: compact ? 18 : 20, lineHeight: 1,
        }}>
          {headline.icon}
        </div>

        {/* Body — eyebrow + headline + sub. When the insight has a
            specific action, the click runs it. When it doesn't, the
            click opens the full service briefing instead — so the hero
            is always tappable and there's a way to drill into context. */}
        <button
          onClick={interactive
            ? () => runAction(headline.action)
            : () => window.dispatchEvent(new CustomEvent('app:open-briefing'))}
          className="press"
          style={{
            position: 'relative', zIndex: 1,
            flex: 1, minWidth: 0,
            background: 'transparent', border: 'none',
            padding: 0, margin: 0,
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex', flexDirection: 'column', gap: compact ? 3 : 4,
          }}
        >
          {/* Eyebrow */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 9.5, fontWeight: 700, letterSpacing: .14,
            color: p.accent, textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: 999,
              background: p.accent, boxShadow: `0 0 0 3px ${p.accentSoft}`,
            }} />
            Insight del moment
            <span style={{
              opacity: .6, fontWeight: 600, letterSpacing: .08,
            }}>· {CATEGORY_LABEL[headline.category]}</span>
          </div>

          {/* Headline */}
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: compact ? 14.5 : 16.5,
            fontWeight: 500, lineHeight: 1.25,
            color: 'var(--ink-900)', letterSpacing: -.01,
          }}>
            {headline.text}
          </div>

          {/* Sub — single line for compactness; ellipsis if too long. */}
          {headline.sub && (
            <div style={{
              fontSize: compact ? 11 : 11.5,
              color: 'var(--ink-500)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              letterSpacing: .005,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {headline.sub}
            </div>
          )}

          {/* "Veure detall →" — always shown; if the insight carries an
              action the whole body click runs it (interactive=true), and
              if it doesn't, the body becomes a tappable briefing trigger
              via the onClick handler below. */}
          <div style={{
            marginTop: 2,
            fontSize: 10, fontWeight: 700, letterSpacing: .08,
            color: p.fg, textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {interactive ? 'Veure detall' : 'Veure briefing'}
            <span aria-hidden style={{ fontSize: 11 }}>→</span>
          </div>
        </button>

        {/* Dismiss × */}
        <button
          onClick={() => { dismissInsight(headline.id, dayIso); setInnerTick(t => t + 1); }}
          aria-label="Descartar"
          className="tac-btn tac-btn--ghost"
          style={{
            position: 'relative', zIndex: 1,
            flexShrink: 0,
            width: 36, height: 36, padding: 0,
            color: 'var(--ink-500)',
            display: 'grid', placeItems: 'center',
            fontSize: 16, lineHeight: 1,
            borderRadius: 8,
            alignSelf: 'flex-start',
          }}
        >
          ×
        </button>

        <style>{`
          @keyframes insight-breathe {
            0%, 100% { opacity: .55; transform: scale(1); }
            50%      { opacity: .9;  transform: scale(1.06); }
          }
          @media (prefers-reduced-motion: reduce) {
            .insight-moment > span[aria-hidden] { animation: none !important; }
          }
          /* Fast-UI (touch / modest GPU): freeze the breathing glow. The
             scale animates a blur(20px) layer, the last looping blurred
             effect on the dashboard. Static glow keeps the premium look at
             zero per-frame cost. Premium desktops keep it breathing. */
          body[data-fast-ui="1"] .insight-moment > span[aria-hidden] { animation: none !important; }
        `}</style>
      </div>
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
