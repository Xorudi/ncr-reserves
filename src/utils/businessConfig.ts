import { BUSINESSES } from '@/data/mockData';
import type { BusinessConfig, BusinessId } from '@/types';

/**
 * Effective capacity for a business.
 *
 * Settings → `businessConfigs[bizId].capacity` is the user-editable value
 * and the single source of truth at runtime. `BUSINESSES[id].capacity` is
 * a static fallback for when the store has not been hydrated yet.
 */
export function getEffectiveCapacity(
  bizId: BusinessId | string,
  businessConfigs?: Record<string, BusinessConfig>,
): number {
  const fromConfig = businessConfigs?.[bizId]?.capacity;
  if (typeof fromConfig === 'number' && fromConfig > 0) return fromConfig;
  const fromStatic = BUSINESSES.find(b => b.id === bizId)?.capacity;
  return fromStatic && fromStatic > 0 ? fromStatic : 80;
}

/**
 * Effective seat-instances per day, accounting for typical turnover.
 *
 * A 40-seat dining room serves ~80 covers per day (one lunch + one dinner
 * service). Occupancy ratios should be `pax / effectiveDailyCapacity`
 * across the whole app for consistency.
 */
export function getDailyServiceCapacity(
  bizId: BusinessId | string,
  businessConfigs?: Record<string, BusinessConfig>,
  turnover: number = 2,
): number {
  return getEffectiveCapacity(bizId, businessConfigs) * turnover;
}
