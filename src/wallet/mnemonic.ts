// BIP39: 24 words from 256 bits of entropy supplied by the caller (the phone's secure RNG).
import { entropyToMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const WORDLIST = wordlist;

export function mnemonicFromEntropy(entropy: Uint8Array): string {
  if (entropy.length !== 32) throw new Error('Need 32 bytes of entropy');
  if (entropy.every((b) => b === entropy[0])) throw new Error('Entropy looks broken');
  return entropyToMnemonic(entropy, wordlist);
}

/** Lower-case, single spaces; does not change the words themselves. */
export function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).join(' ');
}

export function isValidMnemonic(m: string): boolean {
  const n = normalizeMnemonic(m);
  const count = n.split(' ').length;
  return (count === 12 || count === 24) && validateMnemonic(n, wordlist);
}

export function seedFromMnemonic(m: string): Uint8Array {
  return mnemonicToSeedSync(normalizeMnemonic(m), '');
}

/** Picks `count` distinct word positions (0-based) to check that the backup was written down. */
export function pickCheckPositions(random: Uint8Array, words: number, count = 3): number[] {
  const out: number[] = [];
  for (let i = 0; out.length < count && i < random.length; i++) {
    const p = random[i] % words;
    if (!out.includes(p)) out.push(p);
  }
  for (let p = 0; out.length < count; p++) if (!out.includes(p)) out.push(p);
  return out.sort((a, b) => a - b);
}
