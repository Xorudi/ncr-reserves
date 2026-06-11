/**
 * tableSuggest — concrete table combinations for groups without a table.
 *
 * The briefing already detects "big group, no table assigned"; this turns
 * the warning into a solution: given the live floor state for the day, it
 * proposes the best combination of FREE tables in a single zone whose
 * combined capacity covers the party.
 *
 * Heuristics (head-of-room logic, not an optimizer):
 *   • Tables must share a zone — splitting one group across the dining
 *     room and the terrace is never a suggestion a maître would make.
 *   • Greedy biggest-first, then trim any table whose removal still
 *     covers the party — favors few, large tables over many small ones.
 *   • Across zones, prefer the fewest tables, then the least overshoot
 *     (a 20-pax group on 22 seats beats the same group on 30).
 *
 * Pure function of (pax, plan, dayRes) — trivially testable, no store.
 */
import { effectiveTable } from './tableStatus';
import type { FloorPlan, FloorTable, Reservation } from '@/types';

export interface TableSuggestion {
  zoneId:    string;
  zoneLabel: string;
  tables:    FloorTable[];
  totalCap:  number;
}

/** Natural-order display name, "10" < "10-bis" < "11". */
function byName(a: FloorTable, b: FloorTable): number {
  return (a.name ?? a.id).localeCompare(b.name ?? b.id, undefined, { numeric: true });
}

export function suggestTablesFor(
  pax: number,
  plan: FloorPlan | undefined,
  dayRes: Reservation[],
): TableSuggestion | null {
  if (!plan || pax <= 0) return null;

  // Cap how many tables a single suggestion may join. Beyond this the
  // operator is reorganizing the room, not assigning a table — manual job.
  const maxTables = Math.min(10, Math.max(3, Math.ceil(pax / 4) + 1));

  const freeByZone = new Map<string, FloorTable[]>();
  for (const t of plan.tables) {
    const live = effectiveTable(t, dayRes);
    if (live.status !== 'free') continue;
    const list = freeByZone.get(live.zone) ?? [];
    list.push(live);
    freeByZone.set(live.zone, list);
  }

  let best: TableSuggestion | null = null;

  for (const [zoneId, list] of freeByZone) {
    // Greedy biggest-first until the party fits.
    const sorted = [...list].sort((a, b) => b.cap - a.cap);
    const combo: FloorTable[] = [];
    let sum = 0;
    for (const t of sorted) {
      if (sum >= pax || combo.length >= maxTables) break;
      combo.push(t);
      sum += t.cap;
    }
    if (sum < pax) continue; // this zone can't host the group

    // Trim pass — drop any table whose removal still covers the party.
    // Walk smallest-first so we shed the least useful seats.
    for (let i = combo.length - 1; i >= 0; i--) {
      if (combo.length > 1 && sum - combo[i].cap >= pax) {
        sum -= combo[i].cap;
        combo.splice(i, 1);
      }
    }

    const cand: TableSuggestion = {
      zoneId,
      zoneLabel: plan.zones.find(z => z.id === zoneId)?.label ?? zoneId,
      tables: combo.sort(byName),
      totalCap: sum,
    };

    if (
      !best ||
      cand.tables.length < best.tables.length ||
      (cand.tables.length === best.tables.length &&
        cand.totalCap - pax < best.totalCap - pax)
    ) {
      best = cand;
    }
  }

  return best;
}

/** "13 + 14 + 15" — display string for a suggestion's tables. */
export function suggestionLabel(s: TableSuggestion): string {
  return s.tables.map(t => t.name ?? t.id).join(' + ');
}
