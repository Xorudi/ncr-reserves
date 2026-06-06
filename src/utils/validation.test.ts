import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  sanitizeText, sanitizePhone, sanitizeEmail, sanitizeInt,
  sanitizeTags, sanitizeIsoDate, sanitizeIsoTime,
  sanitizeReservation, sanitizeCustomer, sanitizeWaitlistEntry,
} from './validation';

describe('sanitizeText', () => {
  it('strips control characters and trims', () => {
    expect(sanitizeText('  hola\x00\x07 ', 100)).toBe('hola');
  });
  it('caps at maxLen', () => {
    expect(sanitizeText('a'.repeat(50), 10)).toHaveLength(10);
  });
  it('null/undefined → empty string', () => {
    expect(sanitizeText(null, 10)).toBe('');
    expect(sanitizeText(undefined, 10)).toBe('');
  });
});

describe('sanitizePhone', () => {
  it('keeps digits and formatting chars, drops letters', () => {
    expect(sanitizePhone('+34 600-12 34 (56) abc')).toBe('+34 600-12 34 (56) ');
  });
  it('strips an XSS-y payload to nothing useful', () => {
    expect(sanitizePhone('<script>')).toBe('');
  });
});

describe('sanitizeEmail', () => {
  it('lowercases and trims', () => {
    expect(sanitizeEmail('  JordI@Example.COM ')).toBe('jordi@example.com');
  });
});

describe('sanitizeInt', () => {
  it('clamps to [min,max]', () => {
    expect(sanitizeInt(9999, 1, 99, 1)).toBe(99);
    expect(sanitizeInt(-5, 1, 99, 1)).toBe(1);
  });
  it('non-finite → fallback', () => {
    expect(sanitizeInt('abc', 1, 99, 2)).toBe(2);
    expect(sanitizeInt(NaN, 1, 99, 2)).toBe(2);
  });
  it('truncates floats', () => {
    expect(sanitizeInt(4.9, 1, 99, 1)).toBe(4);
  });
});

describe('sanitizeTags', () => {
  it('caps the list length', () => {
    const many = Array.from({ length: 50 }, (_, i) => `t${i}`);
    expect(sanitizeTags(many).length).toBeLessThanOrEqual(LIMITS.TAGS_COUNT);
  });
  it('non-array → empty', () => {
    expect(sanitizeTags('nope')).toEqual([]);
  });
});

describe('sanitizeIsoDate / sanitizeIsoTime', () => {
  it('accepts valid, rejects invalid to fallback', () => {
    expect(sanitizeIsoDate('2026-06-06', '2000-01-01')).toBe('2026-06-06');
    expect(sanitizeIsoDate('06/06/2026', '2000-01-01')).toBe('2000-01-01');
    expect(sanitizeIsoTime('20:30', '00:00')).toBe('20:30');
    expect(sanitizeIsoTime('25:99', '00:00')).toBe('00:00');
  });
});

describe('sanitizeReservation', () => {
  it('clamps pax, falls back name, keeps extra fields', () => {
    const out = sanitizeReservation({
      name: '', pax: 99999, date: 'bad', time: 'bad',
      tags: [], source: 'walk-in', id: 'x1',
    });
    expect(out.name).toBe('Sense nom');
    expect(out.pax).toBe(LIMITS.PAX_MAX);
    expect(out.time).toBe('20:00');
    expect(out.source).toBe('walk-in'); // unknown field passed through
    expect(out.id).toBe('x1');
  });
  it('does not mutate the input', () => {
    const input = { name: '  Joan  ', pax: 4, tags: [] };
    const out = sanitizeReservation(input);
    expect(input.name).toBe('  Joan  ');
    expect(out).not.toBe(input);
  });
});

describe('sanitizeCustomer / sanitizeWaitlistEntry', () => {
  it('customer normalises phone + email', () => {
    const c = sanitizeCustomer({ name: 'A', phone: '+34 600 abc', email: 'X@Y.COM', tags: [] });
    expect(c.email).toBe('x@y.com');
    expect(c.phone).not.toContain('abc');
  });
  it('waitlist entry sanitises without throwing', () => {
    expect(() => sanitizeWaitlistEntry({ name: 'Pop', pax: 2, bizId: 'pista' })).not.toThrow();
  });
});
