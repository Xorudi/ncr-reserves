/**
 * Weather data layer for the restaurant dashboard.
 *
 * Source: Open-Meteo (https://open-meteo.com) — free, no API key, GDPR-friendly.
 * We cache responses per (date, lat, lng) in localStorage with a 1-hour TTL
 * for today's forecast (which can shift) and 6h for fixed-future dates.
 */

export type WxCondition =
  | 'clear' | 'cloudy' | 'overcast' | 'fog'
  | 'drizzle' | 'rain' | 'showers' | 'thunder'
  | 'snow' | 'unknown';

export interface HourlySlot {
  hour:       number;       // 0..23
  temp:       number;       // °C
  code:       number;       // WMO code
  condition:  WxCondition;
  precipProb: number;       // 0..100
  windKmh:    number;
}

export interface WeatherForecast {
  date:           string;   // YYYY-MM-DD
  tMin:           number;   // °C
  tMax:           number;   // °C
  condition:      WxCondition;
  /** WMO weather code from Open-Meteo. */
  code:           number;
  /** 0-100, max during the day. */
  precipProb:     number;
  /** Max wind speed during the day in km/h. */
  windKmh:        number;
  /** 24 hourly slots when available — drives the iOS-style detail chart. */
  hourly?:        HourlySlot[];
  /** ISO timestamp the forecast was fetched. */
  fetchedAt:      number;
}

interface CacheEntry { data: WeatherForecast; fetchedAt: number; }

const CACHE_KEY    = 'ncr.weather.cache.v2';  // v2 adds hourly slots
const TTL_TODAY    = 60 * 60 * 1000;     // 1h
const TTL_FUTURE   = 6  * 60 * 60 * 1000;  // 6h
const TTL_PAST     = 30 * 24 * 60 * 60 * 1000; // 30 days (won't change)

// ─── Cache ────────────────────────────────────────────────────────────────────

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function writeCache(c: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* private mode / quota */ }
}

function cacheKey(date: string, lat: number, lng: number): string {
  return `${date}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
}

function ttlFor(date: string): number {
  const today = new Date().toISOString().slice(0, 10);
  if (date === today) return TTL_TODAY;
  if (date < today)   return TTL_PAST;
  return TTL_FUTURE;
}

// ─── WMO code → semantic condition ────────────────────────────────────────────

export function codeToCondition(code: number): WxCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57)   return 'drizzle';
  if (code >= 61 && code <= 67)   return 'rain';
  if (code >= 71 && code <= 77)   return 'snow';
  if (code >= 80 && code <= 82)   return 'showers';
  if (code >= 95 && code <= 99)   return 'thunder';
  return 'unknown';
}

export function conditionLabel(c: WxCondition): string {
  switch (c) {
    case 'clear':    return 'Cel serè';
    case 'cloudy':   return 'Parcialment ennuvolat';
    case 'overcast': return 'Ennuvolat';
    case 'fog':      return 'Boira';
    case 'drizzle':  return 'Plovisqueja';
    case 'rain':     return 'Pluja';
    case 'showers':  return 'Ruixats';
    case 'snow':     return 'Neu';
    case 'thunder':  return 'Tempesta';
    default:         return 'Sense dades';
  }
}

/**
 * Lightweight operational hint shown in the detail sheet when the forecast
 * suggests the team should adapt the service (terrassa, prep, etc.).
 */
export function operationalAlert(f: WeatherForecast): string | null {
  if (f.precipProb >= 60 && (f.condition === 'rain' || f.condition === 'showers' || f.condition === 'drizzle')) {
    return 'Pluja probable — replega la terrassa o tanca reserves exteriors.';
  }
  if (f.condition === 'thunder') {
    return 'Tempesta prevista — replega la terrassa.';
  }
  if (f.windKmh >= 40) {
    return 'Vent fort — assegura tovalloles, pissarres i para-sols.';
  }
  if (f.tMax >= 32) {
    return 'Calor — prepara aigua extra i ventiladors a sala.';
  }
  if (f.tMax <= 8) {
    return 'Fred — ofereix interior si reserves de terrassa.';
  }
  return null;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

interface FetchOpts { date: string; lat: number; lng: number; }

/**
 * Get a single-day forecast for the given date and location, using cache.
 * Returns null when offline, network fails, or the date is too far out.
 */
export async function fetchForecast(opts: FetchOpts): Promise<WeatherForecast | null> {
  const key = cacheKey(opts.date, opts.lat, opts.lng);
  const cache = readCache();
  const hit = cache[key];
  const ttl = ttlFor(opts.date);
  if (hit && Date.now() - hit.fetchedAt < ttl) return hit.data;

  // Open-Meteo: free, no key. We request both the daily summary and the
  // 24 hourly slots for the exact date — the latter powers the iOS-style
  // hourly chart in the detail sheet.
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${opts.lat}&longitude=${opts.lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,wind_speed_10m_max` +
    `&hourly=temperature_2m,weathercode,precipitation_probability,wind_speed_10m` +
    `&timezone=auto` +
    `&start_date=${opts.date}&end_date=${opts.date}`;

  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const json = await res.json() as {
      daily?: {
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        weathercode?: number[];
        precipitation_probability_max?: number[];
        wind_speed_10m_max?: number[];
      };
      hourly?: {
        time?:                      string[];
        temperature_2m?:            number[];
        weathercode?:               number[];
        precipitation_probability?: number[];
        wind_speed_10m?:            number[];
      };
    };
    const d = json.daily;
    if (!d || !d.weathercode || d.weathercode.length === 0) return null;
    const code = d.weathercode[0] ?? -1;

    // Build hourly slots — Open-Meteo returns 24 entries per requested day.
    let hourly: HourlySlot[] | undefined;
    const h = json.hourly;
    if (h && h.time && h.temperature_2m && h.weathercode) {
      hourly = h.time.map((iso, i) => {
        const hour = parseInt(iso.slice(11, 13), 10);
        const hCode = h.weathercode?.[i] ?? -1;
        return {
          hour,
          temp:       Math.round(h.temperature_2m?.[i] ?? 0),
          code:       hCode,
          condition:  codeToCondition(hCode),
          precipProb: Math.round(h.precipitation_probability?.[i] ?? 0),
          windKmh:    Math.round(h.wind_speed_10m?.[i] ?? 0),
        };
      });
    }

    const forecast: WeatherForecast = {
      date:        opts.date,
      tMin:        Math.round(d.temperature_2m_min?.[0] ?? 0),
      tMax:        Math.round(d.temperature_2m_max?.[0] ?? 0),
      code,
      condition:   codeToCondition(code),
      precipProb:  Math.round(d.precipitation_probability_max?.[0] ?? 0),
      windKmh:     Math.round(d.wind_speed_10m_max?.[0] ?? 0),
      hourly,
      fetchedAt:   Date.now(),
    };
    cache[key] = { data: forecast, fetchedAt: forecast.fetchedAt };
    // Trim very old entries to keep cache lean (drop anything more than 90 days old).
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    for (const k of Object.keys(cache)) {
      if (cache[k].fetchedAt < cutoff) delete cache[k];
    }
    writeCache(cache);
    return forecast;
  } catch {
    return null;
  }
}

// ─── Default coordinates — Les Masies de Voltregà (Osona, 08508) ──────────────
// All 3 venues are within ~2 km in this town, so a single point is enough
// for the foreseeable future. If we ever split by venue, add lat/lng to
// BUSINESSES and use those instead.
export const DEFAULT_COORDS = { lat: 42.0289, lng: 2.2336 };
