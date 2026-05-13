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
  fetchForecast, conditionLabel, operationalInsights, DEFAULT_COORDS,
  type WeatherForecast, type WxCondition, type HourlySlot, type OperationalInsight,
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

  // Listen for app-wide requests to open the weather detail (e.g. a smart
  // insight chip dispatching `app:open-weather`). Only the *first mounted*
  // widget handles it — both compact and full variants would otherwise
  // both pop a sheet.
  useEffect(() => {
    const handler = () => { if (forecast) setShowDetail(true); };
    window.addEventListener('app:open-weather', handler);
    return () => window.removeEventListener('app:open-weather', handler);
  }, [forecast]);

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
  const insights = useMemo(() => operationalInsights(forecast), [forecast]);
  const dateLabel = date.toLocaleDateString('ca-ES', { weekday:'long', day:'numeric', month:'long' });

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={210}>
      <div
        // data-swipeable tells the shell-level day-swipe handler that this
        // surface owns its horizontal gesture (so the hourly strip can scroll
        // without flipping to the previous/next day in the background).
        data-swipeable="true"
        style={{
          background: 'linear-gradient(180deg, var(--paper) 0%, var(--cream) 100%)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -6px 32px rgba(0,0,0,.18)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)',
          maxHeight: '94vh',
          overflowY: 'auto',
        }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '11px auto 14px' }} />

        {/* Hero header — bigger icon with glow, big serif date, bold condition */}
        <div style={{ padding: '4px 22px 22px', display:'flex', alignItems:'center', gap:18 }}>
          <span className="wx-pill" style={{
            position:'relative', display:'grid', placeItems:'center',
            width: 84, height: 84, borderRadius: 22,
            background: 'linear-gradient(180deg, var(--paper) 0%, var(--cream) 100%)',
            border:'1px solid rgba(60,40,20,.10)',
            boxShadow: '0 4px 16px rgba(60,40,20,.08), inset 0 1px 0 rgba(255,255,255,.6)',
            fontSize: 44,
          }}>
            <WxBackgroundAnimation condition={forecast.condition} />
            <span style={{ position:'relative', zIndex:1, filter: 'drop-shadow(0 1px 2px rgba(60,40,20,.18))' }}>
              {emojiFor(forecast.condition)}
            </span>
          </span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.05,
              textTransform: 'capitalize',
            }}>{dateLabel}</div>
            <div style={{
              fontSize: 14.5, color: 'var(--ink-700)', marginTop: 6,
              fontWeight: 600, letterSpacing: -.005,
            }}>{conditionLabel(forecast.condition)}</div>
            <div style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 6, marginTop: 8,
              fontFamily: 'var(--font-serif)',
            }}>
              <span style={{ fontSize: 32, fontWeight: 500, color: 'var(--terracotta-700)', lineHeight: 1, letterSpacing: -.02 }}>{forecast.tMax}°</span>
              <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink-400)', lineHeight: 1 }}>/ {forecast.tMin}°</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'var(--paper)', border:'1px solid rgba(60,40,20,.10)',
            cursor:'pointer', color:'var(--ink-700)', fontFamily:'inherit',
            fontSize:13, fontWeight:650, padding:'7px 14px',
            borderRadius: 999, flexShrink: 0,
          }}>Tancar</button>
        </div>

        {/* Stats grid — more padding, bigger numbers */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 10,
          padding: '0 22px',
        }}>
          <DetailCard label="Temperatura" value={`${forecast.tMin}° – ${forecast.tMax}°`} />
          <DetailCard label="Probab. pluja" value={`${forecast.precipProb}%`} tone={forecast.precipProb >= 50 ? 'sky' : 'ink'} />
          <DetailCard label="Vent màxim" value={`${forecast.windKmh} km/h`} tone={forecast.windKmh >= 40 ? 'rose' : 'ink'} />
        </div>

        {/* Hourly forecast + curve — taller, breathier */}
        {forecast.hourly && forecast.hourly.length > 0 && (
          <>
            <HourlyStrip slots={forecast.hourly} dateIso={forecast.date} />
            <HourlyCurve  slots={forecast.hourly} tMin={forecast.tMin} tMax={forecast.tMax} dateIso={forecast.date} />
          </>
        )}

        {/* Operational insights — each alert/warning/info gets its own card.
            Highest severity is rendered first (handled by the lib). */}
        {insights.length > 0 && (
          <div style={{ padding: '22px 22px 4px' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
              letterSpacing: .08, textTransform: 'uppercase', marginBottom: 10,
            }}>Què cal tenir en compte</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map(it => <InsightCard key={it.id} ins={it} />)}
            </div>
          </div>
        )}

        {/* Source attribution */}
        <div style={{
          padding: '18px 22px 4px',
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
    <div style={{ padding: '22px 22px 0' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
        letterSpacing: .08, textTransform: 'uppercase', marginBottom: 10,
      }}>Per hores</div>
      <div
        // Mark this scroller as owning its horizontal gesture so the shell-
        // level day-swipe handler ignores it. Without this, dragging the
        // strip would also flip the day in the background.
        data-swipeable="true"
        className="scroll wx-hourly-strip"
        style={{
          display: 'flex', gap: 8,
          overflowX: 'auto', paddingBottom: 8,
          // Touch panning — vertical scroll still bubbles up to the sheet.
          touchAction: 'pan-x',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {slots.map(s => {
          const isCurrent = s.hour === currentHour;
          return (
            <div key={s.hour} style={{
              flexShrink: 0, width: 64,
              padding: '12px 6px 10px', borderRadius: 14,
              background: isCurrent
                ? 'linear-gradient(180deg, var(--terracotta-50) 0%, var(--paper) 100%)'
                : 'var(--paper)',
              border: isCurrent ? '1.5px solid var(--terracotta-500)' : '1px solid rgba(60,40,20,.08)',
              boxShadow: isCurrent
                ? '0 2px 8px rgba(168,74,42,.14)'
                : '0 1px 2px rgba(60,40,20,.04)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: isCurrent ? 'var(--terracotta-700)' : 'var(--ink-500)',
                letterSpacing: .04,
              }}>{String(s.hour).padStart(2, '0')}</div>
              <div style={{
                fontSize: 22, lineHeight: 1,
                filter: 'drop-shadow(0 1px 1px rgba(60,40,20,.10))',
              }}>{hourEmoji(s.condition)}</div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500,
                color: 'var(--ink-900)', lineHeight: 1, letterSpacing: -.005,
              }}>{s.temp}°</div>
              {s.precipProb >= 30 && (
                <div style={{
                  fontSize: 9.5, fontWeight: 700, color: 'var(--sky-700)',
                  fontFamily: 'var(--font-mono)', letterSpacing: .04,
                  padding: '1px 6px', borderRadius: 999,
                  background: 'var(--sky-50)',
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
  // Layout — much taller than before so the curve has room to breathe.
  // The whole sheet has plenty of vertical real-estate on iPad/desktop;
  // the previous 90 px felt cramped.
  const W = 600, H = 200, P = { l: 18, r: 18, t: 28, b: 26 };
  const innerW = W - P.l - P.r;
  const innerH = H - P.t - P.b;
  // Pad the range so peaks/troughs don't kiss the chart edges
  const min = tMin - 2;
  const max = tMax + 2;
  const range = Math.max(1, max - min);
  const x = (i: number) => P.l + (i / Math.max(1, slots.length - 1)) * innerW;
  const y = (t: number) => P.t + (1 - (t - min) / range) * innerH;

  // Smooth path with cubic bezier control points at the midpoints
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

  let iMin = 0, iMax = 0;
  slots.forEach((s, i) => {
    if (s.temp < slots[iMin].temp) iMin = i;
    if (s.temp > slots[iMax].temp) iMax = i;
  });

  const nowIso = new Date().toISOString().slice(0, 10);
  const isToday = dateIso === nowIso;
  const currentHour = isToday ? new Date().getHours() : -1;
  const currentIdx = currentHour >= 0 ? slots.findIndex(s => s.hour === currentHour) : -1;

  // Unique gradient ids per render so multiple instances don't clash
  const gid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  return (
    <div style={{ padding: '22px 22px 4px' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
        letterSpacing: .08, textTransform: 'uppercase', marginBottom: 10,
      }}>Temperatura · 24h</div>
      <div style={{
        padding: '12px 8px', borderRadius: 16,
        background: 'linear-gradient(180deg, var(--paper) 0%, var(--cream) 100%)',
        border: '1px solid rgba(60,40,20,.08)',
        boxShadow: '0 2px 10px rgba(60,40,20,.04)',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto"
          preserveAspectRatio="none"
          style={{ display: 'block', maxHeight: 220 }}>
          <defs>
            <linearGradient id={`wxFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--terracotta-500)" stopOpacity="0.42" />
              <stop offset="55%"  stopColor="var(--clay-500)"       stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--sky-500)"        stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id={`wxStroke-${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="var(--sky-600)" />
              <stop offset="50%"  stopColor="var(--olive-600)" />
              <stop offset="100%" stopColor="var(--terracotta-600)" />
            </linearGradient>
            {/* Subtle glow filter for the dots */}
            <filter id={`wxGlow-${gid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          {/* Gridlines — 5 horizontal lines at quintiles for more reference */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <line key={f}
              x1={P.l} x2={P.l + innerW}
              y1={P.t + f * innerH} y2={P.t + f * innerH}
              stroke="rgba(60,40,20,.06)" strokeWidth="1" strokeDasharray="3 5" />
          ))}

          {/* Filled area under curve */}
          <path d={fillPath} fill={`url(#wxFill-${gid})`} />
          {/* The curve itself — thicker so it reads from a distance */}
          <path d={d} fill="none" stroke={`url(#wxStroke-${gid})`}
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Now indicator */}
          {currentIdx >= 0 && (
            <>
              <line x1={x(currentIdx)} x2={x(currentIdx)} y1={P.t} y2={P.t + innerH}
                stroke="var(--terracotta-600)" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 4" />
              {/* Halo */}
              <circle cx={x(currentIdx)} cy={y(slots[currentIdx].temp)} r="9"
                fill="var(--terracotta-600)" opacity="0.18" filter={`url(#wxGlow-${gid})`}>
                <animate attributeName="r" values="7;10;7" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.12;0.28;0.12" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx={x(currentIdx)} cy={y(slots[currentIdx].temp)} r="4.5"
                fill="var(--terracotta-600)" stroke="white" strokeWidth="2" />
            </>
          )}

          {/* Min/Max — glow halos + larger dots + labels with background */}
          <circle cx={x(iMax)} cy={y(slots[iMax].temp)} r="8" fill="var(--terracotta-700)" opacity="0.15" filter={`url(#wxGlow-${gid})`} />
          <circle cx={x(iMax)} cy={y(slots[iMax].temp)} r="4" fill="var(--terracotta-700)" stroke="white" strokeWidth="1.5" />
          <rect x={x(iMax) - 18} y={y(slots[iMax].temp) - 22} width="36" height="15" rx="7.5"
            fill="white" stroke="var(--terracotta-700)" strokeWidth="1" strokeOpacity="0.35" />
          <text x={x(iMax)} y={y(slots[iMax].temp) - 11}
            textAnchor="middle" fontSize="11.5" fontFamily="var(--font-serif)"
            fontWeight="600" fill="var(--terracotta-700)">
            {slots[iMax].temp}°
          </text>

          <circle cx={x(iMin)} cy={y(slots[iMin].temp)} r="8" fill="var(--sky-700)" opacity="0.15" filter={`url(#wxGlow-${gid})`} />
          <circle cx={x(iMin)} cy={y(slots[iMin].temp)} r="4" fill="var(--sky-700)" stroke="white" strokeWidth="1.5" />
          <rect x={x(iMin) - 18} y={y(slots[iMin].temp) + 8} width="36" height="15" rx="7.5"
            fill="white" stroke="var(--sky-700)" strokeWidth="1" strokeOpacity="0.35" />
          <text x={x(iMin)} y={y(slots[iMin].temp) + 19}
            textAnchor="middle" fontSize="11.5" fontFamily="var(--font-serif)"
            fontWeight="600" fill="var(--sky-700)">
            {slots[iMin].temp}°
          </text>

          {/* X-axis labels at 0/6/12/18/24 */}
          {[0, 6, 12, 18].map(h => {
            const idx = slots.findIndex(s => s.hour === h);
            if (idx < 0) return null;
            return (
              <g key={h}>
                <line x1={x(idx)} x2={x(idx)} y1={P.t + innerH} y2={P.t + innerH + 4}
                  stroke="rgba(60,40,20,.18)" strokeWidth="1" />
                <text x={x(idx)} y={H - 6}
                  textAnchor="middle" fontSize="10.5" fontFamily="var(--font-mono)"
                  fontWeight="600" fill="var(--ink-500)">{String(h).padStart(2, '0')}:00</text>
              </g>
            );
          })}
        </svg>
      </div>
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

function InsightCard({ ins }: { ins: OperationalInsight }) {
  // Severity → color treatment. Alert is terracotta (action needed), warn is
  // clay (heads up), info is sky (good-news / neutral).
  const palette =
    ins.severity === 'alert' ? { bg: 'var(--terracotta-50)', fg: 'var(--terracotta-700)', border: 'rgba(168,74,42,.24)' } :
    ins.severity === 'warn'  ? { bg: 'var(--clay-50)',       fg: 'var(--clay-700)',        border: 'rgba(176,118,54,.24)' } :
                                { bg: 'var(--sky-50)',        fg: 'var(--sky-700)',         border: 'rgba(58,134,165,.22)' };
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 14,
      background: `linear-gradient(180deg, ${palette.bg} 0%, rgba(255,255,255,.4) 100%)`,
      border: `1px solid ${palette.border}`,
      boxShadow: '0 2px 8px rgba(60,40,20,.04), inset 0 1px 0 rgba(255,255,255,.5)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{ins.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: palette.fg, lineHeight: 1.4,
        }}>{ins.text}</div>
        {ins.when && (
          <div style={{
            fontSize: 11, fontWeight: 700, color: palette.fg, opacity: .7,
            marginTop: 3, fontFamily: 'var(--font-mono)', letterSpacing: .04,
          }}>{ins.when}</div>
        )}
      </div>
    </div>
  );
}

function DetailCard({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'sky' | 'rose' }) {
  // Paper-elevated card with tone driven by a left accent + value color.
  // Matches the KPI cards in StatsScreen and the rest of the new visual lang.
  const palette = {
    ink:  { fg: 'var(--ink-900)',  accent: 'var(--ink-300)' },
    sky:  { fg: 'var(--sky-700)',  accent: 'var(--sky-500)' },
    rose: { fg: 'var(--rose-700)', accent: 'var(--rose-600)' },
  }[tone];
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
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)',
        letterSpacing: .08, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
        color: palette.fg, marginTop: 5, lineHeight: 1.05, letterSpacing: -.01,
      }}>{value}</div>
    </div>
  );
}
