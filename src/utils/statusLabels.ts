import type { ReservationStatus, TableStatus } from '@/types';

/**
 * Single source of truth for status labels and colors across the app.
 * Import from here instead of hardcoding per screen.
 */

export interface StatusPalette {
  label: string;
  bg:    string;  // CSS variable or color
  fg:    string;
  ring:  string;  // typically a translucent border color
}

export const RESERVATION_STATUS: Record<ReservationStatus, StatusPalette> = {
  pending: {
    label: 'Pendent',
    bg:    'var(--clay-50)',
    fg:    'var(--clay-700)',
    ring:  'rgba(176,118,54,.28)',
  },
  confirmed: {
    label: 'Confirmada',
    bg:    'var(--olive-50)',
    fg:    'var(--olive-700)',
    ring:  'rgba(116,133,74,.28)',
  },
  seated: {
    label: 'A taula',
    bg:    'var(--terracotta-50)',
    fg:    'var(--terracotta-700)',
    ring:  'rgba(168,74,42,.28)',
  },
  completed: {
    label: 'Acabada',
    bg:    'var(--ink-100)',
    fg:    'var(--ink-600)',
    ring:  'rgba(60,40,20,.18)',
  },
  cancelled: {
    label: 'Cancel·lada',
    bg:    '#f2ebe4',
    fg:    'var(--ink-500)',
    ring:  'rgba(60,40,20,.14)',
  },
  noshow: {
    label: 'No-show',
    bg:    'var(--rose-50)',
    fg:    'var(--rose-700)',
    ring:  'rgba(194,74,74,.28)',
  },
};

/** Lookup with a safe fallback for unknown statuses. */
export function resPalette(status: ReservationStatus | string | undefined): StatusPalette {
  if (status && (RESERVATION_STATUS as Record<string, StatusPalette>)[status]) {
    return (RESERVATION_STATUS as Record<string, StatusPalette>)[status];
  }
  return RESERVATION_STATUS.pending;
}

/** Just the label, with a safe fallback. */
export function resLabel(status: ReservationStatus | string | undefined): string {
  return resPalette(status).label;
}

/** Table statuses share names with reservation statuses where they overlap. */
export const TABLE_STATUS: Record<TableStatus, { label: string }> = {
  free:      { label: 'Lliure'     },
  reserved:  { label: 'Reservada'  },
  pending:   { label: 'Pendent'    },
  confirmed: { label: 'Confirmada' },
  seated:    { label: 'A taula'    },
  blocked:   { label: 'Bloquejada' },
  playing:   { label: 'Jugant'     },
};

export function tableLabel(status: TableStatus | string | undefined): string {
  if (status && (TABLE_STATUS as Record<string, { label: string }>)[status]) {
    return (TABLE_STATUS as Record<string, { label: string }>)[status].label;
  }
  return 'Lliure';
}
