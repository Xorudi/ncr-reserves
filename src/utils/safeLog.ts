/**
 * Production-safe console wrapper.
 *
 * Rationale:
 *   • Information disclosure — verbose logging can leak app structure,
 *     internal IDs, sync errors, etc. to anyone with DevTools.
 *   • The app already has 7 call sites in cloudSync + backupScheduler that
 *     log sync/back-up activity. Silence them in production builds while
 *     keeping them in dev for debuggability.
 *
 * Usage: import { log, warn, error } from '@/utils/safeLog';
 *        log('something happened', value);
 */
const IS_DEV = import.meta.env.DEV;

/* eslint-disable no-console */
export const log   = IS_DEV ? console.log.bind(console)   : () => { /* silent */ };
export const warn  = IS_DEV ? console.warn.bind(console)  : () => { /* silent */ };
export const info  = IS_DEV ? console.info.bind(console)  : () => { /* silent */ };

/**
 * Errors are always emitted (they may be needed for incident analysis)
 * but PII-bearing fields should be redacted by the caller before passing
 * them in. NEVER log raw customer rows / reservation rows here.
 */
export const error = console.error.bind(console);
