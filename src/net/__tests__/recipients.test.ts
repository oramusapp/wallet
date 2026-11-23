import { describe, expect, it } from 'vitest';
import { chunks, isKnown, lastCharsMatch, lookAlike } from '../recipients';

const A = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
describe('recipient guards', () => {
  it('known address, case-insensitive for EVM', () => {
    expect(isKnown([A], A.toLowerCase(), true)).toBe(true);
    expect(isKnown([A], '0x0000000000000000000000000000000000000001', true)).toBe(false);
  });
  it('detects a poisoned look-alike (same start and end)', () => {
    const fake = '0x9858' + '1'.repeat(32) + 'da94';
    expect(lookAlike([A], fake, true)).toBe(A);
    expect(lookAlike([A], A, true)).toBe(null);
    expect(lookAlike([A], '0x1234' + '0'.repeat(32) + 'abcd', true)).toBe(null);
    const btc = 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl';
    expect(lookAlike([btc], 'tb1q6rz2' + 'x'.repeat(26) + 'pvkl', false)).toBe(btc);
  });
  it('chunks and last characters', () => {
    expect(chunks('abcdefghij')).toEqual(['abcd', 'efgh', 'ij']);
    const c = chunks(A); expect(c[0]).toBe('0x'); expect(c.length).toBe(11); expect(c[10]).toBe('da94');
    expect(lastCharsMatch(A, 'da94')).toBe(true);
    expect(lastCharsMatch(A, 'DA94')).toBe(true);
    expect(lastCharsMatch(A, 'a94')).toBe(false);
    expect(lastCharsMatch(A, 'da95')).toBe(false);
  });
});
