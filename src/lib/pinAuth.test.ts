import { describe, it, expect } from 'vitest';
import {
  isValidPin, hashPin, generateSalt, buildEntry, findCollision,
} from './pinAuth';

describe('isValidPin', () => {
  it('accepts exactly 4 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('0000')).toBe(true);
  });
  it('rejects wrong length / non-digits', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });
});

describe('hashPin (PBKDF2)', () => {
  it('is deterministic for the same pin + salt', async () => {
    const salt = generateSalt();
    const a = await hashPin('1234', salt);
    const b = await hashPin('1234', salt);
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // 32 bytes hex
  });
  it('differs for a different salt (no rainbow tables)', async () => {
    const h1 = await hashPin('1234', generateSalt());
    const h2 = await hashPin('1234', generateSalt());
    expect(h1).not.toBe(h2);
  });
  it('differs for a different pin (same salt)', async () => {
    const salt = generateSalt();
    expect(await hashPin('1234', salt)).not.toBe(await hashPin('5678', salt));
  });
  it('rejects an invalid pin', async () => {
    await expect(hashPin('12', generateSalt())).rejects.toThrow();
  });
});

describe('generateSalt', () => {
  it('produces unique 32-hex-char salts', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).toHaveLength(32);
    expect(a).not.toBe(b);
  });
});

describe('buildEntry + findCollision', () => {
  it('builds a verifiable entry', async () => {
    const entry = await buildEntry('Test', ['pista'], '4321');
    expect(entry.scope).toEqual(['pista']);
    // Re-hashing the same pin with the entry salt reproduces the stored hash.
    expect(await hashPin('4321', entry.salt)).toBe(entry.hash);
  });
  it('rejects empty scope', async () => {
    await expect(buildEntry('Bad', [], '4321')).rejects.toThrow();
  });
  it('detects a colliding pin against existing entries', async () => {
    const e = await buildEntry('A', ['pista'], '1111');
    expect(await findCollision('1111', [e])).toBe(0);   // same pin → collision at index 0
    expect(await findCollision('2222', [e])).toBe(-1);  // different pin → no collision
  });
});
