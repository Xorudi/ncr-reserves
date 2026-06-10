/**
 * PIN attempt throttle — service-friendly brute-force damper.
 *
 * Design constraints (in order):
 *   1. A waiter mid-service who fat-fingers the PIN must NEVER be locked
 *      out of the reservations book. The first FREE_ATTEMPTS failures
 *      carry zero penalty, and the cooldown is hard-capped at MAX_WAIT_S
 *      seconds — there is no permanent lock, ever.
 *   2. An opportunistic attacker walking the 10 000-PIN space must face
 *      enough friction that the attack stops being worth it: after the
 *      free window, every failure costs an escalating wait (10 → 30 →
 *      60 s), which stretches a full sweep from minutes to ~a week of
 *      standing at the device.
 *
 * Threat model matches lib/pinAuth.ts: shoulder-surfers and casual
 * snoopers with physical access. Someone who can open devtools and clear
 * localStorage is outside this layer's scope — Supabase Auth remains the
 * cryptographic gate.
 *
 * This module deliberately does NOT touch pinAuth.ts (hashing /
 * verification are frozen); it only meters how often the UI may call
 * verifyPin.
 */

const STORAGE_KEY = 'ncr-reserves-pin-throttle';

/** Failures with no penalty at all — honest typos live here. */
const FREE_ATTEMPTS = 5;
/** Escalating waits (seconds) for failures past the free window. */
const WAIT_STEPS_S = [10, 30, 60];
/** Hard cap — the device is never unusable for longer than this. */
const MAX_WAIT_S = 60;
/** A long stretch with no failures wipes the slate clean. */
const RESET_AFTER_MS = 12 * 60 * 60 * 1000; // 12 h

interface ThrottleState {
  fails: number;
  /** Epoch ms until which attempts are paused. 0 = not paused. */
  lockedUntil: number;
  /** Epoch ms of the most recent failure (drives the auto-reset). */
  lastFailAt: number;
}

const EMPTY: ThrottleState = { fails: 0, lockedUntil: 0, lastFailAt: 0 };

function load(): ThrottleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<ThrottleState>;
    if (typeof p.fails !== 'number' || typeof p.lockedUntil !== 'number') {
      return { ...EMPTY };
    }
    const state: ThrottleState = {
      fails:       Math.max(0, Math.floor(p.fails)),
      lockedUntil: Math.max(0, p.lockedUntil),
      lastFailAt:  typeof p.lastFailAt === 'number' ? p.lastFailAt : 0,
    };
    // Stale streak (e.g. a typo-heavy evening last week) → forgive.
    if (state.lastFailAt && Date.now() - state.lastFailAt > RESET_AFTER_MS) {
      return { ...EMPTY };
    }
    return state;
  } catch {
    return { ...EMPTY };
  }
}

function save(state: ThrottleState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** Milliseconds left in the current cooldown. 0 when input is allowed. */
export function getPinCooldownMs(): number {
  const s = load();
  return Math.max(0, s.lockedUntil - Date.now());
}

/**
 * Record one failed verification. Returns the cooldown in ms that now
 * applies (0 while inside the free window).
 */
export function recordPinFailure(): number {
  const s = load();
  s.fails += 1;
  s.lastFailAt = Date.now();
  let waitMs = 0;
  if (s.fails > FREE_ATTEMPTS) {
    const step = Math.min(s.fails - FREE_ATTEMPTS - 1, WAIT_STEPS_S.length - 1);
    waitMs = Math.min(WAIT_STEPS_S[step], MAX_WAIT_S) * 1000;
    s.lockedUntil = Date.now() + waitMs;
  }
  save(s);
  return waitMs;
}

/** Successful unlock — wipe the streak so the next typo starts fresh. */
export function clearPinThrottle(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
