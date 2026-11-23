// SLIP-0010 key derivation for ed25519 (hardened steps only, as the standard requires).
// https://github.com/satoshilabs/slips/blob/master/slip-0010.md
import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

const HARDENED = 0x80000000;

export interface Ed25519Node {
  key: Uint8Array; // 32-byte private key (seed for ed25519)
  chainCode: Uint8Array;
}

export function ed25519Master(seed: Uint8Array): Ed25519Node {
  const I = hmac(sha512, utf8ToBytes('ed25519 seed'), seed);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function childHardened(parent: Ed25519Node, index: number): Ed25519Node {
  const data = new Uint8Array(37);
  data[0] = 0;
  data.set(parent.key, 1);
  const i = (index | HARDENED) >>> 0;
  data[33] = (i >>> 24) & 0xff;
  data[34] = (i >>> 16) & 0xff;
  data[35] = (i >>> 8) & 0xff;
  data[36] = i & 0xff;
  const I = hmac(sha512, parent.chainCode, data);
  data.fill(0);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

/** Parses "m/44'/501'/0'" — every step must be hardened for ed25519. */
export function parseHardenedPath(path: string): number[] {
  const parts = path.split('/');
  if (parts[0] !== 'm') throw new Error('Path must start with m');
  return parts.slice(1).map((p) => {
    if (!/^\d+'$/.test(p)) throw new Error('ed25519 supports hardened steps only: ' + path);
    const n = Number(p.slice(0, -1));
    if (!Number.isInteger(n) || n < 0 || n >= HARDENED) throw new Error('Bad index in ' + path);
    return n;
  });
}

export function ed25519DerivePath(seed: Uint8Array, path: string): Ed25519Node {
  let node = ed25519Master(seed);
  for (const i of parseHardenedPath(path)) {
    const next = childHardened(node, i);
    node.key.fill(0);
    node.chainCode.fill(0);
    node = next;
  }
  return node;
}
