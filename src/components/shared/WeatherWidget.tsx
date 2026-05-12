/**
 * WeatherWidget — discreet header pill that shows the forecast for the
 * currently-selected date and, on tap, opens a detail sheet with the full
 * breakdown and an operational alert when the day's weather will affect
 * service (rain, wind, heat, etc.).
 *
 * Animation is a low-amplitude background layer keyed off the condition
 * (sun halo, cloud drift, falling drops, wind sweep, snow flakes). Honors
 * prefers-reduced-motion.
 */
import React, { useEffect, useState, useMemo } from 'react';
import AnimatedSheet from './AnimatedSheet';
import { useAppStore } from '@/store/useAppStore';
import { isoDate } from '@/data/mockData';
import {
  fetchForecast, conditionLabel, operationalAlert, DEFAULT_COORDS,
  type WeatherForecast, type WxCondition,
} from '@/lib/weather';

// ─── Emoji per condition — used as the icon glyph in the pill and the sheet ──
function emojiFor(c: WxCondition): string {
  switch (c) {
    case 'clear':    return '☀️';
    case 'cloudy':   return '🌤';
    case 'overcast': return '☁️';
    case 'fog':      return '🌫';
    case 'drizzle':
    case 'rain':
    case 'showers':  return '🌧';
    case 'thunder':  return '⛈';
    case 'snow':     return '❄️';
    default:         return '·';
  }
}

/** Compact horizontal pill — fits in the header next to the search/more buttons. */
export default function WeatherWidget({ compact = false }: { compact?: boolean }) {
  const { selectedDate } = useAppStore();
  const dateIso = isoDate(selectedDate);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchForecast({ date: dateIso, lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng })
      .then(f => { if (!cancelled) { setForecast(f); setLoading(false); } });
    return () => { cancelled = true; };
  }, [dateIso]);

  // Hide entirely (rather than show a stub) when no data — date too far out,
  // offline, etc. Keeps the header chrome clean.
  if (!forecast && !loading) return null;

  const showRainBadge = !!forecast && forecast.precipProb >= 30;

  return (
    <>
      <button onClick={() => forecast && setShowDetail(true)}
        title={forecast ? `${conditionLabel(forecast.condition)} · ${forecast.tMin}°–${forecast.tMax}°` : 'Carregant…'}
        className={`wx-pill press`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: compact ? '4px 9px 4px 6px' : '5px 11px 5px 7px',
          borderRadius: 999,
          border: '1px solid rgba(60,40,20,.10)',
          background: 'var(--paper)',
          cursor: forecast ? 'pointer' : 'default',
          fontFamily: 'inherit',
          height: compact ? 28 : 32,
          minWidth: compact ? 56 : 64,
          opacity: loading && !forecast ? .55 : 1,
        }}>
        {/* Animated background layer — sits behind the text */}
        {forecast && <WxBackgroundAnimation condition={forecast.condition} />}

        {/* Foreground content — kept on z=1 so animations don't overlap text */}
        <span style={{ position:'relative', zIndex:1, fontSize: compact ? 13 : 15, lineHeight:1 }}>
          {forecast ? emojiFor(forecast.condition) : '·'}
        </span>
        <span style={{
          position:'relative', zIndex:1,
          fontFamily: 'var(--font-serif)',
          fontSize: compact ? 13 : 14.5, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.005,
        }}>
          {forecast ? `${forecast.tMax}°` : '—'}
        </span>
        {showRainBadge && (
          <span style={{
            position:'relative', zIndex:1,
            fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: 'var(--sky-700)', letterSpacing: .04,
          }}>{forecast!.precipProb}%</span>
        )}
      </button>

      {forecast && (
        <WeatherDetailSheet
          open={showDetail}
          onClose={() => setShowDetail(false)}
          forecast={forecast}
          date={selectedDate}
        />
      )}
    </>
  );
}

// ─── Background animation per condition ──────────────────────────────────────

function WxBackgroundAnimation({ condition }: { condition: WxCondition }) {
  if (condition === 'clear') {
    return <div className="wx-anim" aria-hidden><span className="wx-sun-halo" /></div>;
  }
  if (condition === 'cloudy' || condition === 'overcast' || condition === 'fog') {
    return (
      <div className="wx-anim" aria-hidden>
        <span className="wx-cloud" /><span className="wx-cloud" />
      </div>
    );
  }
  if (condition === 'drizzle' || condition === 'rain' || condition === 'showers' || condition === 'thunder') {
    return (
      <div className="wx-anim" aria-hidden>
        <span className="wx-drop" /><span className="wx-drop" /><span className="wx-drop" />
      </div>
    );
  }
  if (condition === 'snow') {
    return (
      <div className="wx-anim" aria-hidden>
        <span className="wx-flake" /><span className="wx-flake" /><span className="wx-flake" />
      </div>
    );
  }
  return null;
}

// ─── Detail sheet — opens on tap ──────────────────────────────────────────────

function WeatherDetailSheet({ open, onClose, forecast, date }: {
  open: boolean; onClose: () => void; forecast: WeatherForecast; date: Date;
}) {
  const alert = useMemo(() => operationalAlert(forecast), [forecast]);
  const dateLabel = date.toLocaleDateString('ca-ES', { weekday:'long', day:'numeric', month:'long' });

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={210}>
      <div style={{
        background: 'var(--paper)', borderRadius: '18px 18px 0 0',
        boxShadow: '0 -4px 28px rgba(0,0,0,.18)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '10px auto 8px' }} />

        {/* Header */}
        <div style={{ padding: '4px 18px 14px', display:'flex', alignItems:'center', gap:14 }}>
          <span className="wx-pill" style={{
            position:'relative', display:'grid', placeItems:'center',
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--cream)', border:'1px solid rgba(60,40,20,.10)',
            fontSize: 32,
          }}>
            <WxBackgroundAnimation condition={forecast.condition} />
            <span style={{ position:'relative', zIndex:1 }}>{emojiFor(forecast.condition)}</span>
          </span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
              textTransform: 'capitalize',
            }}>{dateLabel}</div>
            <div style={{
              fontSize: 13, color: 'var(--ink-600)', marginTop: 3,
            }}>{conditionLabel(forecast.condition)}</div>
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:'none', cursor:'pointer',
            color:'var(--ink-600)', fontFamily:'inherit', fontSize:14,
            fontWeight:600, padding:'4px 6px',
          }}>Tancar</button>
        </div>

        {/* Stats grid */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 8,
          padding: '0 18px',
        }}>
          <DetailCard label="Temperatura" value={`${forecast.tMin}° – ${forecast.tMax}°`} />
          <DetailCard label="Probab. pluja" value={`${forecast.precipProb}%`} tone={forecast.precipProb >= 50 ? 'sky' : 'ink'} />
          <DetailCard label="Vent màxim" value={`${forecast.windKmh} km/h`} tone={forecast.windKmh >= 40 ? 'rose' : 'ink'} />
        </div>

        {/* Operational alert */}
        {alert && (
          <div style={{
            margin: '14px 18px 4px', padding: '11px 14px', borderRadius: 12,
            background: 'var(--terracotta-50)', border: '1px solid rgba(168,74,42,.22)',
            display:'flex', alignItems:'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color:'var(--terracotta-700)', lineHeight: 1.4 }}>
              {alert}
            </span>
          </div>
        )}

        {/* Source attribution */}
        <div style={{
          padding: '12px 18px 4px',
          fontSize: 10.5, color:'var(--ink-400)', textAlign:'center',
          fontFamily: 'var(--font-mono)', letterSpacing: .04,
        }}>
          dades · open-meteo.com
        </div>
      </div>
    </AnimatedSheet>
  );
}

function DetailCard({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'sky' | 'rose' }) {
  const palette = {
    ink:  { bg: 'var(--ink-100)',  fg: 'var(--ink-700)' },
    sky:  { bg: 'var(--sky-50)',   fg: 'var(--sky-700)' },
    rose: { bg: 'var(--rose-50)',  fg: 'var(--rose-700)' },
  }[tone];
  return (
    <div style={{
      padding: '11px 12px', borderRadius: 12,
      background: palette.bg, border: `1px solid ${palette.fg}22`,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--ink-500)',
        letterSpacing: .06, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
        color: palette.fg, marginTop: 3, lineHeight: 1.1,
      }}>{value}</div>
    </div>
  );
}
