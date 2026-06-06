import { describe, it, expect } from 'vitest';
import { shouldProcessAuthSession } from './cloudSync';

// shouldProcessAuthSession holds module-level state (the last session key),
// so these assertions run as one ordered sequence.
describe('shouldProcessAuthSession (auth dedupe)', () => {
  it('processes the first session, dedupes identical echoes, processes real changes', () => {
    // First time for this user/expiry → process.
    expect(shouldProcessAuthSession('user-a', 1000)).toBe(true);
    // Same user + same expiry (a duplicate SIGNED_IN echo) → skip.
    expect(shouldProcessAuthSession('user-a', 1000)).toBe(false);
    expect(shouldProcessAuthSession('user-a', 1000)).toBe(false);
    // Token refreshed (new expiry) → process.
    expect(shouldProcessAuthSession('user-a', 2000)).toBe(true);
    // Different user → process.
    expect(shouldProcessAuthSession('user-b', 2000)).toBe(true);
    // Re-echo of the latest → skip.
    expect(shouldProcessAuthSession('user-b', 2000)).toBe(false);
  });

  it('treats null user/expiry as a stable key', () => {
    expect(shouldProcessAuthSession(null, null)).toBe(true);
    expect(shouldProcessAuthSession(null, null)).toBe(false);
  });
});
