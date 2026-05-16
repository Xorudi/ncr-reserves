import type { Customer, Reservation, BusinessId } from '../types';

// ─── Configuration ────────────────────────────────────────────────────────────
// Per-event point rewards. Tweak here without touching the rest of the system.

export const POINTS = {
  completed:      10,  // base: client came and finished
  weekendBonus:    5,  // extra if completed reservation falls on Sat/Sun
  largeGroupBonus: 5,  // extra if pax >= 6
  nightBonus:      3,  // extra if reservation time >= 21:00
  noshow:        -20,  // penalty: client didn't show up
  cancelledLate:  -5,  // penalty: cancelled within 24h (heuristic — placeholder)
} as const;

// ─── Levels — Riot-style tiers ────────────────────────────────────────────────
// Thresholds are cumulative point requirements.

export interface Level {
  id:     LevelId;
  name:   string;
  min:    number;     // inclusive lower bound of points
  color:  string;     // CSS color for the badge
  bg:     string;     // CSS background tint
  icon:   string;     // emoji
}

export type LevelId =
  | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

export const LEVELS: Level[] = [
  { id: 'bronze',   name: 'Bronze',   min:    0, color: '#8a5a2b', bg: '#f3e5d3', icon: '🥉' },
  { id: 'silver',   name: 'Silver',   min:  100, color: '#5e6671', bg: '#e6e9ee', icon: '🥈' },
  { id: 'gold',     name: 'Gold',     min:  250, color: '#a37314', bg: '#faedc8', icon: '🥇' },
  { id: 'platinum', name: 'Platinum', min:  500, color: '#1f7a8c', bg: '#d5edf2', icon: '💎' },
  { id: 'diamond',  name: 'Diamond',  min:  900, color: '#5b2c83', bg: '#e6d8f2', icon: '💠' },
  { id: 'master',   name: 'Master',   min: 1500, color: '#7a1f1f', bg: '#f1d4d4', icon: '👑' },
];

export function levelForPoints(points: number): Level {
  // Iterate from highest to lowest; first match wins.
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

export function nextLevel(points: number): Level | null {
  return LEVELS.find(l => l.min > points) ?? null;
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export interface Badge {
  id:          string;
  label:       string;
  description: string;
  icon:        string;     // emoji
  earned:      boolean;
}

// ─── Customer stats (derived from reservation history) ───────────────────────

export interface CustomerStats {
  customerId:  string;
  total:       number;     // total reservations (any status)
  completed:   number;
  noshows:     number;
  cancelled:   number;
  upcoming:    number;     // pending/confirmed/seated
  weekend:     number;     // completed on Sat/Sun
  night:       number;     // completed at >= 21:00
  largeGroup:  number;     // completed with pax >= 6
  lastVisit?:  string;     // date string of most recent completed
  points:      number;
  level:       Level;
  nextLevel:   Level | null;
  progressPct: number;     // 0..100 toward next level
  badges:      Badge[];
}

function isWeekend(dateStr: string): boolean {
  // dateStr is 'YYYY-MM-DD'. Using UTC to avoid timezone drift.
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function isNight(time: string): boolean {
  const h = parseInt(time.split(':')[0], 10);
  return h >= 21;
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + 'T00:00:00').getTime();
  const b = new Date(bIso + 'T00:00:00').getTime();
  return Math.floor((b - a) / 86400000);
}

export function computePointsForReservation(r: Reservation): number {
  let pts = 0;
  if (r.status === 'completed') {
    pts += POINTS.completed;
    if (isWeekend(r.date))   pts += POINTS.weekendBonus;
    if (isNight(r.time))     pts += POINTS.nightBonus;
    if ((r.pax ?? 0) >= 6)   pts += POINTS.largeGroupBonus;
  } else if (r.status === 'noshow') {
    pts += POINTS.noshow;
  } else if (r.status === 'cancelled') {
    pts += POINTS.cancelledLate;
  }
  return pts;
}

export function computeCustomerStats(
  customer: Customer,
  reservations: Reservation[],
  today: string = new Date().toISOString().slice(0, 10),
): CustomerStats {
  // We match reservations to a customer by phone first (most reliable), then by name.
  // This is a heuristic — once we have a real customerId link, this becomes trivial.
  const mine = reservations.filter(r =>
    (customer.phone && r.phone === customer.phone) ||
    (r.name && r.name.trim().toLowerCase() === customer.name.trim().toLowerCase())
  );

  let completed = 0, noshows = 0, cancelled = 0, upcoming = 0;
  let weekend = 0, night = 0, largeGroup = 0;
  let points = 0;
  let lastVisit: string | undefined;

  for (const r of mine) {
    points += computePointsForReservation(r);
    if (r.status === 'completed') {
      completed++;
      if (isWeekend(r.date)) weekend++;
      if (isNight(r.time))   night++;
      if ((r.pax ?? 0) >= 6) largeGroup++;
      if (!lastVisit || r.date > lastVisit) lastVisit = r.date;
    } else if (r.status === 'noshow') {
      noshows++;
    } else if (r.status === 'cancelled') {
      cancelled++;
    } else {
      upcoming++;
    }
  }

  // Clamp points to non-negative for level calculation, but allow display of negatives.
  const lvl  = levelForPoints(Math.max(0, points));
  const next = nextLevel(Math.max(0, points));
  const progressPct = next
    ? Math.min(100, Math.max(0, ((Math.max(0, points) - lvl.min) / (next.min - lvl.min)) * 100))
    : 100;

  const badges: Badge[] = [
    {
      id: 'habitual',
      label: 'Habitual',
      description: 'Més de 20 visites completades',
      icon: '⭐',
      earned: completed >= 20,
    },
    {
      id: 'weekend-fan',
      label: 'Fan del cap de setmana',
      description: 'Més de 10 visites en cap de setmana',
      icon: '🍷',
      earned: weekend >= 10,
    },
    {
      id: 'night-owl',
      label: 'Client nocturn',
      description: 'Més de 10 visites a partir de les 21h',
      icon: '🌙',
      earned: night >= 10,
    },
    {
      id: 'group-host',
      label: 'Amfitrió',
      description: 'Més de 5 reserves amb grup gran (6+ pax)',
      icon: '🎉',
      earned: largeGroup >= 5,
    },
    {
      id: 'no-noshow-6m',
      label: 'Sense no-shows 6 mesos',
      description: 'Cap no-show en els últims 180 dies',
      icon: '🛡️',
      earned:
        completed >= 3 &&
        !mine.some(r => r.status === 'noshow' && daysBetween(r.date, today) <= 180),
    },
    {
      id: 'fresh-visit',
      label: 'Visita recent',
      description: 'Ha visitat en els últims 30 dies',
      icon: '🔥',
      earned: !!lastVisit && daysBetween(lastVisit, today) <= 30,
    },
  ];

  return {
    customerId:  customer.id,
    total:       mine.length,
    completed, noshows, cancelled, upcoming,
    weekend, night, largeGroup,
    lastVisit,
    points,
    level:       lvl,
    nextLevel:   next,
    progressPct,
    badges,
  };
}

// ─── Period filter (for ranking) ──────────────────────────────────────────────

/** Time-window for visit counts in the ranking view. */
export type Period = 'week' | 'month' | 'year' | 'all';

/** Human-readable label used as the suffix in row counters. */
export function periodLabel(p: Period): string {
  switch (p) {
    case 'week':  return 'aquesta setmana';
    case 'month': return 'aquest mes';
    case 'year':  return 'aquest any';
    case 'all':   return 'totals';
  }
}

/**
 * Inclusive start date (YYYY-MM-DD) for the period, or null for 'all'.
 * Week starts on Monday (Catalonia ISO convention).
 */
export function periodStartIso(
  p: Period,
  today: string = new Date().toISOString().slice(0, 10),
): string | null {
  if (p === 'all') return null;
  const t = new Date(today + 'T00:00:00');
  if (p === 'week') {
    const dow = t.getDay();             // 0 = Sunday, 1 = Monday, …
    const back = (dow + 6) % 7;         // days since the latest Monday
    const start = new Date(t);
    start.setDate(start.getDate() - back);
    return start.toISOString().slice(0, 10);
  }
  if (p === 'month') {
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
  }
  // year
  return `${t.getFullYear()}-01-01`;
}

/**
 * Count completed reservations for `customer` inside `period`.
 * Uses the same phone/name match as `computeCustomerStats` for consistency.
 *
 * Future-dated reservations are NEVER counted (a "visit" must have happened).
 */
export function countVisitsInPeriod(
  customer: Customer,
  reservations: Reservation[],
  period: Period,
  today: string = new Date().toISOString().slice(0, 10),
): number {
  const startIso = periodStartIso(period, today);
  const cname = customer.name.trim().toLowerCase();
  let count = 0;
  for (const r of reservations) {
    if (r.status !== 'completed') continue;
    if (r.date > today) continue;                                   // ignore future
    if (startIso && r.date < startIso) continue;                    // before window
    const phoneMatch = !!(customer.phone && r.phone === customer.phone);
    const nameMatch  = !!(r.name && r.name.trim().toLowerCase() === cname);
    if (!phoneMatch && !nameMatch) continue;
    count++;
  }
  return count;
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

export interface RankedCustomer {
  customer: Customer;
  stats:    CustomerStats;
  rank:     number;        // 1-based
}

export function rankCustomers(
  customers: Customer[],
  reservations: Reservation[],
  bizFilter?: BusinessId,
): RankedCustomer[] {
  const scoped = bizFilter
    ? customers.filter(c => c.biz.includes(bizFilter))
    : customers;
  const resScoped = bizFilter
    ? reservations.filter(r => r.bizId === bizFilter)
    : reservations;

  const rows = scoped.map(c => ({
    customer: c,
    stats:    computeCustomerStats(c, resScoped),
  }));

  rows.sort((a, b) => b.stats.points - a.stats.points);

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}
