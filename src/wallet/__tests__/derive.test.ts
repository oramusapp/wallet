import { describe, expect, it } from 'vitest';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { ed25519Master, ed25519DerivePath, parseHardenedPath } from '../slip10';
import { deriveAll } from '../derive';
import { CHAINS } from '../chains';
import { entropyToMnemonic } from '@scure/bip39';
import { WORDLIST, isValidMnemonic, mnemonicFromEntropy, pickCheckPositions, seedFromMnemonic } from '../mnemonic';

// Standard test mnemonic. Expected addresses were produced independently with
// @trustwallet/wallet-core 4.9.0 (HDWallet.getAddressForCoin / AnyAddress), not with this code.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const MAINNET: Record<string, string> = {
  evm: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  btc: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
  ltc: 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh',
  doge: 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC',
  dash: 'XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5',
  zec: 't1XVXWCvpMgBvUaed4XDqWtgQgJSu1Ghz7F',
  sol: 'GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL',
  sui: '0x5e93a736d04fbb25737aa40bee40171ef79f65fae833749e3c089fe7cc2161f1',
  apt: '0xeb663b681209e7087d681c5d3eed12aaa8e1915e7c87794542c3f96e94b3d3bf',
  near: '5510e2b44cae6eb807e3e0e45d579dda058c274abcba15e5cb84636f5d1ee412',
  xlm: 'GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX',
  algo: 'EP2D7TV7IAFANZHK3B6QLKB53N5UTD7RARVXZTWCPCRQQBKYVGM2XIMT2Q'
};

const TESTNET: Record<string, string> = {
  btc: 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl',
  ltc: 'tltc1q6rz28mcfaxtmd6v789l9rrlrusdprr9pesrjxk',
  doge: 'nZVmfmUtKPmskB9Ds4P9GUJy9eYFqPKHqH',
  dash: 'yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt'
};

describe('addresses (Trust Wallet compatible)', () => {
  const seed = seedFromMnemonic(M);
  it('mainnet: every chain matches the reference', () => {
    const got = Object.fromEntries(deriveAll(seed, 'mainnet').map((a) => [a.chainId, a.address]));
    expect(Object.keys(MAINNET).sort()).toEqual(CHAINS.map((c) => c.id).sort());
    expect(got).toEqual(MAINNET);
  });
  it('testnet: UTXO chains match the reference, the rest equal mainnet', () => {
    const got = Object.fromEntries(deriveAll(seed, 'testnet').map((a) => [a.chainId, a.address]));
    for (const [k, v] of Object.entries(TESTNET)) expect(got[k]).toBe(v);
    for (const k of ['evm', 'sol', 'sui', 'apt', 'near', 'xlm', 'algo']) expect(got[k]).toBe(MAINNET[k]);
  });
});

describe('SLIP-0010 ed25519 (official test vector 1)', () => {
  const seed = hexToBytes('000102030405060708090a0b0c0d0e0f');
  it('master', () => {
    const m = ed25519Master(seed);
    expect(bytesToHex(m.chainCode)).toBe('90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb');
    expect(bytesToHex(m.key)).toBe('2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7');
  });
  it("m/0'", () => {
    const n = ed25519DerivePath(seed, "m/0'");
    expect(bytesToHex(n.chainCode)).toBe('8b59aa11380b624e81507a27fedda59fea6d0b779a778918a2fd3590e16e9c69');
    expect(bytesToHex(n.key)).toBe('68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3');
  });
  it('rejects non-hardened steps', () => {
    expect(() => parseHardenedPath("m/44'/0")).toThrow();
  });
});

describe('mnemonic', () => {
  it('BIP39 vector 0x7f×32 (encoder) and the broken-RNG guard', () => {
    expect(() => mnemonicFromEntropy(new Uint8Array(32))).toThrow();
    expect(() => mnemonicFromEntropy(new Uint8Array(32).fill(0x7f))).toThrow();
    const m = entropyToMnemonic(new Uint8Array(32).fill(0x7f), WORDLIST);
    expect(m).toBe('legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title');
  });
  it('validates checksum and length', () => {
    expect(isValidMnemonic(M)).toBe(true);
    expect(isValidMnemonic('  ABANDON ' + M.slice(8))).toBe(true);
    expect(isValidMnemonic(M.replace('about', 'abandon'))).toBe(false);
    expect(isValidMnemonic('abandon abandon')).toBe(false);
  });
  it('picks distinct check positions', () => {
    const p = pickCheckPositions(new Uint8Array([5, 5, 5, 29, 7]), 24, 3);
    expect(p).toEqual([0, 5, 7]);
  });
});
