/**
 * Z_INDEX — single source of truth for stacking order.
 *
 * Any overlay/sheet/popover/modal/toast in the app must use a value from
 * this table. Inline `zIndex: 9999` and ad-hoc numbers are forbidden —
 * they cause modals-behind-backdrop bugs, double-backdrop competitions,
 * and pickers-behind-sheets the moment a new layer joins the system.
 *
 * Scale:
 *   • base        the app shell, rail, header
 *   • sheet       the primary AnimatedSheet (Nova reserva, detail, etc.)
 *   • action      a secondary sheet that opens on top of `sheet`
 *                 (e.g. BriefingActionSheet picks an action from inside
 *                 BriefingSheet)
 *   • picker      date/time pickers + table selector — always on top of
 *                 the sheet the user opened them from
 *   • toast       transient confirmation messages
 *
 * Each tier reserves a 10-point window so an AnimatedSheet can pick
 * `zIndex` for the panel and `zIndex - 1` for the backdrop.
 */
export const Z_INDEX = {
  base:    0,
  sheet:   200,   // backdrop sits at 199
  action:  220,   // backdrop sits at 219
  picker:  300,   // backdrop sits at 299
  toast:   500,
} as const;
