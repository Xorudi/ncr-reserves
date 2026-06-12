/**
 * Input validation + sanitisation.
 *
 * Two layers:
 *
 *  1. UI: forms apply `maxLength` / `pattern` / `inputMode` so the user
 *     gets immediate feedback and can't paste 10 MB into a notes field.
 *
 *  2. Store: every `add*` / `update*` mutator runs the payload through
 *     these sanitisers before persisting. This is the *real* guard —
 *     anything that hits localStorage or Supabase has been bounded,
 *     trimmed, type-coerced, and stripped of control characters,
 *     regardless of where it came from (form, import, future code).
 *
 * Limits are defensive caps, not business rules. They protect against
 * accidental floods and pathological inputs. They are deliberately
 * generous (a real RFC-compliant email can reach 254 chars).
 */

// ─── Limits (single source of truth) ──────────────────────────────────────────
export const LIMITS = {
  /** Display name of a person or organisation */
  NAME:           80,
  /** Phone number: international format, spaces, dashes, parens, leading + */
  PHONE:          30,
  /** RFC 5321 hard cap is 254 */
  EMAIL:          254,
  /** Single tag string */
  TAG:            30,
  /** Total number of tags on a record */
  TAGS_COUNT:     20,
  /** Free-text notes inside a reservation. Raised 1000 → 2000: notes now
   *  carry full structured comandes (sections + per-dish lines for 77-pax
   *  group menus) and the big ones brushed against the old cap. */
  RES_NOTES:      2_000,
  /** Free-text notes inside a customer record */
  CUST_NOTES:     2_000,
  /** Single shift note body */
  SHIFT_NOTE:     2_000,
  /** App event title */
  EVENT_TITLE:    120,
  /** App event description */
  EVENT_DESC:     1_000,
  /** Employee role name */
  ROLE_NAME:      40,
  /** Initials shown on the avatar */
  INITIALS:       4,
  /** Waitlist note (compatibility / table preferences) */
  WAIT_NOTE:      200,
  /** Minimum reservation party size */
  PAX_MIN:        1,
  /** Maximum reservation party size (defensive cap; restaurant should
   *  reject groups beyond their capacity in business logic, not here). */
  PAX_MAX:        200,
} as const;

// ─── Primitive coercers ───────────────────────────────────────────────────────

/**
 * Strip control chars (except \n \r \t), trim ends, and clamp to maxLen.
 * Always returns a string (never null/undefined → ''), so the caller does
 * not need to special-case nullish input.
 */
export function sanitizeText(raw: unknown, maxLen: number): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw);
  // U+0000–U+001F minus tab/LF/CR, and U+007F (DEL). Strip silently —
  // these are never legitimate in a name/phone/email/note and have
  // appeared in real-world XSS bypass attempts.
  const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  const trimmed = cleaned.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * As above, but preserves internal whitespace structure (does NOT trim).
 * Useful for free-text fields where the user may be mid-edit.
 */
export function sanitizeTextPreserve(raw: unknown, maxLen: number): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw);
  const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

/**
 * Phone numbers: allow + and digits and a small set of formatting chars.
 * Anything else is silently stripped. Capped at LIMITS.PHONE.
 */
export function sanitizePhone(raw: unknown): string {
  const cleaned = sanitizeText(raw, LIMITS.PHONE * 2);
  return cleaned.replace(/[^\d+()\s.\-]/g, '').slice(0, LIMITS.PHONE);
}

/**
 * Emails: trim, lowercase, cap at 254. Does NOT validate format here —
 * the form's input type=email + pattern handles UX feedback. The store
 * accepts whatever passed the form because we are not the auth layer.
 */
export function sanitizeEmail(raw: unknown): string {
  return sanitizeText(raw, LIMITS.EMAIL).toLowerCase();
}

/**
 * Integer coercion with [min, max] clamp. NaN / non-finite → fallback.
 */
export function sanitizeInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.trunc(n);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

/**
 * Cap the length of a string[] and sanitise each item.
 */
export function sanitizeTags(raw: unknown, perItemMax = LIMITS.TAG, listMax = LIMITS.TAGS_COUNT): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= listMax) break;
    const s = sanitizeText(item, perItemMax);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Date strings (YYYY-MM-DD). Anything else → fallback.
 */
export function sanitizeIsoDate(raw: unknown, fallback: string): string {
  const s = sanitizeText(raw, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

/**
 * Time strings (HH:MM). Anything else → fallback.
 */
export function sanitizeIsoTime(raw: unknown, fallback: string): string {
  const s = sanitizeText(raw, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : fallback;
}

// ─── Domain-specific helpers ──────────────────────────────────────────────────

/** Today's date in YYYY-MM-DD — used as a fallback when sanitising. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Sanitise a reservation payload. Returns a NEW object — never mutates
 * the input. Unknown extra fields are passed through unchanged so the
 * caller can attach metadata (seriesId, source, …) freely.
 */
export function sanitizeReservation<T extends Record<string, unknown>>(input: T): T {
  return {
    ...input,
    name:    sanitizeText(input.name,    LIMITS.NAME) || 'Sense nom',
    phone:   input.phone   != null ? sanitizePhone(input.phone) : undefined,
    notes:   input.notes   != null ? sanitizeTextPreserve(input.notes, LIMITS.RES_NOTES) : undefined,
    tags:    sanitizeTags(input.tags),
    pax:     sanitizeInt(input.pax, LIMITS.PAX_MIN, LIMITS.PAX_MAX, LIMITS.PAX_MIN),
    date:    sanitizeIsoDate(input.date, todayIso()),
    time:    sanitizeIsoTime(input.time, '20:00'),
  } as T;
}

/**
 * Sanitise a customer payload.
 */
export function sanitizeCustomer<T extends Record<string, unknown>>(input: T): T {
  return {
    ...input,
    name:  sanitizeText(input.name,  LIMITS.NAME) || 'Sense nom',
    phone: sanitizePhone(input.phone ?? ''),
    email: sanitizeEmail(input.email ?? ''),
    notes: sanitizeTextPreserve(input.notes ?? '', LIMITS.CUST_NOTES),
    tags:  sanitizeTags(input.tags),
  } as T;
}

/**
 * Sanitise an employee payload.
 */
export function sanitizeEmployee<T extends Record<string, unknown>>(input: T): T {
  return {
    ...input,
    fullName: sanitizeText(input.fullName, LIMITS.NAME) || 'Sense nom',
    initials: sanitizeText(input.initials, LIMITS.INITIALS).toUpperCase() || '—',
    phone:    input.phone != null ? sanitizePhone(input.phone) : undefined,
    email:    input.email != null ? sanitizeEmail(input.email) : undefined,
    notes:    input.notes != null ? sanitizeTextPreserve(input.notes, LIMITS.CUST_NOTES) : undefined,
  } as T;
}

/**
 * Sanitise a shift note payload.
 */
export function sanitizeShiftNote<T extends Record<string, unknown>>(input: T): T {
  return {
    ...input,
    author: sanitizeText(input.author, LIMITS.NAME) || 'Sense autor',
    body:   sanitizeTextPreserve(input.body ?? '', LIMITS.SHIFT_NOTE),
    date:   sanitizeIsoDate(input.date, todayIso()),
  } as T;
}

/**
 * Sanitise an app event payload.
 */
export function sanitizeAppEvent<T extends Record<string, unknown>>(input: T): T {
  return {
    ...input,
    title:       sanitizeText(input.title, LIMITS.EVENT_TITLE) || 'Sense títol',
    description: input.description != null ? sanitizeTextPreserve(input.description, LIMITS.EVENT_DESC) : undefined,
    time:        input.time != null && input.time !== '' ? sanitizeIsoTime(input.time, '12:00') : input.time,
    date:        sanitizeIsoDate(input.date, todayIso()),
  } as T;
}

/**
 * Sanitise a waitlist entry payload.
 */
export function sanitizeWaitlistEntry<T extends Record<string, unknown>>(input: T): T {
  return {
    ...input,
    name:  sanitizeText(input.name, LIMITS.NAME) || 'Sense nom',
    phone: input.phone != null ? sanitizePhone(input.phone) : undefined,
    note:  input.note  != null ? sanitizeTextPreserve(input.note, LIMITS.WAIT_NOTE) : undefined,
    pax:   sanitizeInt(input.pax, LIMITS.PAX_MIN, LIMITS.PAX_MAX, LIMITS.PAX_MIN),
  } as T;
}

// ─── HTML form attribute helpers ──────────────────────────────────────────────

/**
 * Standard `pattern` attributes for the form layer (UX only).
 * Browsers show a validation hint when the user submits invalid input.
 * These are NOT enforced server-side — the sanitizers above are.
 */
export const PATTERNS = {
  /** Permissive: international phone with optional + and spaces */
  PHONE: '^[+0-9 ()\\-\\.]{6,30}$',
  /** Email regex: simple enough to be useful, not RFC-5322 perfect */
  EMAIL: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
  /** YYYY-MM-DD */
  DATE:  '^\\d{4}-\\d{2}-\\d{2}$',
  /** HH:MM (24h) */
  TIME:  '^([01]\\d|2[0-3]):[0-5]\\d$',
} as const;
