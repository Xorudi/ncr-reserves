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
  type WeatherForecast, type WxCondition, type HourlySlot,
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

        {/* Hourly forecast — strip of mini-cards + smooth temperature curve.
            Only renders when the API returned hourly data (always true for
            dates within Open-Meteo's hourly window). */}
        {forecast.hourly && forecast.hourly.length > 0 && (
          <>
            <HourlyStrip slots={forecast.hourly} dateIso={forecast.date} />
            <HourlyCurve  slots={forecast.hourly} tMin={forecast.tMin} tMax={forecast.tMax} dateIso={forecast.date} />
          </>
        )}

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

// ─── Hourly strip — horizontal scroll of mini-cards (hour · icon · temp) ─────

function HourlyStrip({ slots, dateIso }: { slots: HourlySlot[]; dateIso: string }) {
  const nowIso = new Date().toISOString().slice(0, 10);
  const isToday = dateIso === nowIso;
  const currentHour = isToday ? new Date().getHours() : -1;

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)',
        letterSpacing: .06, textTransform: 'uppercase', marginBottom: 6,
      }}>Per hores</div>
      <div className="scroll" style={{
        display: 'flex', gap: 6,
        overflowX: 'auto', paddingBottom: 6,
        // Hide horizontal scrollbar — the cards spill far enough to imply more
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {slots.map(s => {
          const isCurrent = s.hour === currentHour;
          return (
            <div key={s.hour} style={{
              flexShrink: 0, width: 50,
              padding: '8px 4px', borderRadius: 10,
              background: isCurrent ? 'var(--terracotta-50)' : 'var(--ink-50)',
              border: isCurrent ? '1.5px solid var(--terracotta-500)' : '1px solid rgba(60,40,20,.06)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: isCurrent ? 'var(--terracotta-700)' : 'var(--ink-500)',
                letterSpacing: .04,
              }}>{String(s.hour).padStart(2, '0')}</div>
              <div style={{ fontSize: 16, lineHeight: 1 }}>{hourEmoji(s.condition)}</div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 500,
                color: 'var(--ink-900)', lineHeight: 1,
              }}>{s.temp}°</div>
              {s.precipProb >= 30 && (
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--sky-700)',
                  fontFamily: 'var(--font-mono)', letterSpacing: .04,
                }}>{s.precipProb}%</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hourly temp curve — smooth SVG area chart with min/max dots labeled ─────

function HourlyCurve({ slots, tMin, tMax, dateIso }: {
  slots: HourlySlot[]; tMin: number; tMax: number; dateIso: string;
}) {
  // Layout
  const W = 320, H = 90, P = { l: 8, r: 8, t: 16, b: 14 };
  const innerW = W - P.l - P.r;
  const innerH = H - P.t - P.b;
  // Pad the range a bit so the curve breathes
  const min = tMin - 1;
  const max = tMax + 1;
  const range = Math.max(1, max - min);
  const x = (i: number) => P.l + (i / Math.max(1, slots.length - 1)) * innerW;
  const y = (t: number) => P.t + (1 - (t - min) / range) * innerH;

  // Build a smooth Catmull-Rom-ish path via cubic bezier (simple variant).
  const points = slots.map((s, i) => ({ x: x(i), y: y(s.temp) }));
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) { d += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`; continue; }
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    d += ` C ${cx.toFixed(1)} ${prev.y.toFixed(1)}, ${cx.toFixed(1)} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  const fillPath = `${d} L ${points[points.length - 1].x.toFixed(1)} ${(P.t + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(P.t + innerH).toFixed(1)} Z`;

  // Indices of min/max for the dot labels
  let iMin = 0, iMax = 0;
  slots.forEach((s, i) => {
    if (s.temp < slots[iMin].temp) iMin = i;
    if (s.temp > slots[iMax].temp) iMax = i;
  });

  const nowIso = new Date().toISOString().slice(0, 10);
  const isToday = dateIso === nowIso;
  const currentHour = isToday ? new Date().getHours() : -1;
  const currentIdx = currentHour >= 0 ? slots.findIndex(s => s.hour === currentHour) : -1;

  return (
    <div style={{ padding: '8px 18px 0' }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)',
        letterSpacing: .06, textTransform: 'uppercase', marginBottom: 6,
      }}>Temperatura · 24h</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
        style={{ display: 'block' }}>
        <defs>
          <linearGradient id="wxCurveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--terracotta-500)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--sky-500)"        stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="wxCurveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="var(--sky-600)" />
            <stop offset="50%"  stopColor="var(--olive-600)" />
            <stop offset="100%" stopColor="var(--terracotta-600)" />
          </linearGradient>
        </defs>

        {/* Gridlines at quartiles */}
        {[0, 0.5, 1].map(f => (
          <line key={f}
            x1={P.l} x2={P.l + innerW}
            y1={P.t + f * innerH} y2={P.t + f * innerH}
            stroke="rgba(60,40,20,.08)" strokeWidth="1" strokeDasharray="2 4" />
        ))}

        {/* Filled area under curve */}
        <path d={fillPath} fill="url(#wxCurveFill)" />
        {/* The curve itself */}
        <path d={d} fill="none" stroke="url(#wxCurveStroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Now indicator */}
        {currentIdx >= 0 && (
          <>
            <line x1={x(currentIdx)} x2={x(currentIdx)} y1={P.t} y2={P.t + innerH}
              stroke="var(--terracotta-600)" strokeWidth="1" strokeOpacity="0.5" />
            <circle cx={x(currentIdx)} cy={y(slots[currentIdx].temp)} r="3"
              fill="var(--terracotta-600)" stroke="white" strokeWidth="1.5" />
          </>
        )}

        {/* Min/Max dots + labels */}
        <circle cx={x(iMax)} cy={y(slots[iMax].temp)} r="2.5" fill="var(--terracotta-700)" />
        <text x={x(iMax)} y={y(slots[iMax].temp) - 6}
          textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)"
          fontWeight="700" fill="var(--terracotta-700)">
          {slots[iMax].temp}°
        </text>
        <circle cx={x(iMin)} cy={y(slots[iMin].temp)} r="2.5" fill="var(--sky-700)" />
        <text x={x(iMin)} y={y(slots[iMin].temp) + 12}
          textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)"
          fontWeight="700" fill="var(--sky-700)">
          {slots[iMin].temp}°
        </text>

        {/* X-axis labels at 0/6/12/18 */}
        {[0, 6, 12, 18].map(h => {
          const idx = slots.findIndex(s => s.hour === h);
          if (idx < 0) return null;
          return (
            <text key={h} x={x(idx)} y={H - 2}
              textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)"
              fill="var(--ink-400)">{h}</text>
          );
        })}
      </svg>
    </div>
  );
}

// Hour-level icon — smaller variants of the same condition emojis used in the
// pill, picked to look right at 16px without color.
function hourEmoji(c: WxCondition): string {
  switch (c) {
    case 'clear':    return '☀';
    case 'cloudy':   return '⛅';
    case 'overcast': return '☁';
    case 'fog':      return '🌫';
    case 'drizzle':  return '🌦';
    case 'rain':
    case 'showers':  return '🌧';
    case 'thunder':  return '⛈';
    case 'snow':     return '❄';
    default:         return '·';
  }
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
