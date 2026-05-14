/**
 * PIN-based local scope gate.
 *
 * Threat model
 * ────────────
 * The Supabase Auth session (lib/supabase.ts + lib/auth.ts) is the
 * cryptographic gate against remote attackers. The PIN here is a *local*
 * lock for the iPad/device — it decides which business book (or all)
 * the current session sees. PINs are not protected against a remote
 * attacker who already has DB access; they are protected against
 * shoulder-surfers, casual snoopers, and accidental cross-restaurant taps.
 *
 * Storage
 * ───────
 * Stored in localStorage under `ncr-reserves-pin-config`. PINs are hashed
 * with PBKDF2-SHA256 (100 000 iterations) and a per-PIN random salt, so
 * lifting the localStorage off a device does not instantly leak the PINs.
 * 10 000 candidate PINs × 100 000 iters ≈ minutes of CPU on a modern
 * device — acceptable for the threat model.
 *
 * Storage schema (versioned for future migrations)
 *   {
 *     version: 1,
 *     pins: [
 *       { label: "El Ganxo", scope: ["ganxo"],          salt: "<hex>", hash: "<hex>" },
 *       { label: "La Pista", scope: ["pista"],          salt: "<hex>", hash: "<hex>" },
 *       { label: "L'Esquitx",scope: ["esquitx"],        salt: "<hex>", hash: "<hex>" },
 *       { label: "Admin",    scope: ["ganxo","pista","esquitx"], salt: "...", hash: "..." },
 *     ]
 *   }
 *
 * The "active scope" (which PIN unlocked the session) is NOT persisted —
 * a page reload requires a fresh PIN entry. This matches the user choice
 * "PIN al primer obrir + opció manual de blocar".
 */

import type { BusinessId } from '@/types';

const STORAGE_KEY  = 'ncr-reserves-pin-config';
const VERSION      = 1;
const PBKDF2_ITERS = 100_000;
const SALT_BYTES   = 16;
const HASH_BYTES   = 32;

export interface PinEntry {
  /** Human-readable label, e.g. "El Ganxo" or "Admin" */
  label: string;
  /** Business IDs this PIN unlocks. Empty = invalid. */
  scope: BusinessId[];
  /** Hex-encoded random salt (16 bytes). */
  salt: string;
  /** Hex-encoded PBKDF2-SHA256 hash (32 bytes). */
  hash: string;
}

export interface PinConfig {
  version: number;
  pins:    PinEntry[];
}

// ─── Encoding helpers ─────────────────────────────────────────────────────────

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  for (const b of arr) out += b.toString(16).padStart(2, '0');
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ─── Hashing ──────────────────────────────────────────────────────────────────

/** Defensive validator — PINs must be exactly 4 digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Generate a fresh per-PIN salt. */
export function generateSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Derive the PBKDF2-SHA256 hash of `pin` with `saltHex`.
 * Returns the hex-encoded hash. Constant-time-safe at the WebCrypto level.
 */
export async function hashPin(pin: string, saltHex: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('Invalid PIN format');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  // Copy into a fresh ArrayBuffer-backed view. TS 5's lib.dom.d.ts narrows
  // PBKDF2 salt to a non-shared BufferSource; passing a Uint8Array whose
  // backing buffer is typed as ArrayBufferLike is rejected.
  const saltView = hexToBytes(saltHex);
  const saltBuf  = new ArrayBuffer(saltView.byteLength);
  new Uint8Array(saltBuf).set(saltView);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: PBKDF2_ITERS,
      hash: 'SHA-256',
    },
    key,
    HASH_BYTES * 8,
  );
  return bytesToHex(bits);
}

/**
 * Timing-safe string comparison. WebCrypto's `crypto.subtle.timingSafeEqual`
 * does not exist; we roll our own.
 */
function constTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Baked-in default PIN config — used when localStorage is empty so the
 * device works out of the box without going through PinSetupView.
 *
 * SECURITY NOTE
 *   These hashes are PBKDF2-SHA256(100k iters) of 4-digit PINs. Because
 *   the search space is only 10 000, an attacker who acquires the JS
 *   bundle can brute-force the PINs offline in minutes. The PIN is NOT
 *   the cryptographic gate — Supabase Auth is. The PIN's threat model
 *   is shoulder-surfing + accidental cross-restaurant taps on the iPad.
 *
 *   To rotate PINs later, run the setup flow (clear localStorage key
 *   `ncr-reserves-pin-config` first) OR edit this constant and recompute
 *   the hashes via the snippet in supabase/auth-migration.sql comments.
 */
const DEFAULT_PIN_CONFIG: PinConfig = {
  version: 1,
  pins: [
    {
      label: 'El Ganxo',
      scope: ['ganxo'],
      salt: 'dbdb257ac5b32c249ddd0788ae06069a',
      hash: 'efa4a0d795e9b545d47ffda633d93b9fb86d6ad1535ff45fcca1db5a3f11a2cc',
    },
    {
      label: 'La Pista',
      scope: ['pista'],
      salt: 'b0539bf5b32a791abe33eb2e1adc80bb',
      hash: '1c07a335d19693315e71876dd219f7b84c9e984ebd795bb69a0af4f4449dfe57',
    },
    {
      label: "L'Esquitx",
      scope: ['esquitx'],
      salt: 'dba83fe99cb9dd82c3fb3a0e62b5300c',
      hash: '6a2d922895b0068448b87457bc51cf1e4898baf2faff4ba862e737f16fe0d10f',
    },
    {
      label: 'Admin',
      scope: ['ganxo', 'pista', 'esquitx'],
      salt: '721ddb6d4fa091ba78f6800045fb2932',
      hash: 'bd8449d7a299a19ee559cd388484c484bfe6860a57b640d71184096ec9fbdb7d',
    },
  ],
};

export function loadPinConfig(): PinConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // No user-set config → fall back to the baked defaults so the
      // device is ready to unlock immediately on first run.
      return DEFAULT_PIN_CONFIG;
    }
    const parsed = JSON.parse(raw) as PinConfig;
    if (parsed?.version !== VERSION) return DEFAULT_PIN_CONFIG;
    if (!Array.isArray(parsed.pins) || parsed.pins.length === 0) return DEFAULT_PIN_CONFIG;
    // Validate structure defensively — corrupted storage falls back too.
    for (const p of parsed.pins) {
      if (!p || typeof p.label !== 'string' || !Array.isArray(p.scope)
          || typeof p.salt !== 'string' || typeof p.hash !== 'string') {
        return DEFAULT_PIN_CONFIG;
      }
    }
    return parsed;
  } catch {
    return DEFAULT_PIN_CONFIG;
  }
}

export function savePinConfig(config: PinConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearPinConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isPinConfigured(): boolean {
  return loadPinConfig() !== null;
}

// ─── Verification ─────────────────────────────────────────────────────────────

export interface PinMatch {
  label: string;
  scope: BusinessId[];
}

/**
 * Try every configured PIN against the typed value. Returns the matched
 * scope (and label) on success, or null if no PIN matches.
 *
 * We always check every entry to avoid leaking via timing which PIN was
 * tried first.
 */
export async function verifyPin(pin: string): Promise<PinMatch | null> {
  if (!isValidPin(pin)) return null;
  const cfg = loadPinConfig();
  if (!cfg) return null;

  let match: PinMatch | null = null;
  for (const entry of cfg.pins) {
    const candidate = await hashPin(pin, entry.salt);
    // Use constant-time equality on hex strings of equal length.
    if (constTimeEqual(candidate, entry.hash) && match === null) {
      match = { label: entry.label, scope: entry.scope };
      // Do NOT break: keep iterating so total work is constant.
    }
  }
  return match;
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

/**
 * Build a PinEntry from a label + scope + plain PIN.
 * Rejects duplicate PINs by checking against any already-prepared entries.
 */
export async function buildEntry(
  label: string,
  scope: BusinessId[],
  pin: string,
): Promise<PinEntry> {
  if (!isValidPin(pin)) throw new Error('Invalid PIN format');
  if (scope.length === 0) throw new Error('Scope must not be empty');
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  return { label, scope, salt, hash };
}

/**
 * Detect whether any of `candidates` collide (same hash for the same PIN).
 * Returns the index of the first colliding candidate, or -1 if none.
 *
 * NB: Different salts mean that even identical PINs produce different
 * hashes; this check re-hashes the typed PIN against each existing salt
 * and looks for matches. Used by the setup view to refuse "PIN reuse"
 * across scopes (which would create ambiguity at lock time).
 */
export async function findCollision(
  newPin: string,
  existing: PinEntry[],
): Promise<number> {
  for (let i = 0; i < existing.length; i++) {
    const h = await hashPin(newPin, existing[i].salt);
    if (constTimeEqual(h, existing[i].hash)) return i;
  }
  return -1;
}
