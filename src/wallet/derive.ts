// Seed -> keys -> addresses. Pure functions, no I/O; private keys are wiped after use.
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256, sha512_256 } from '@noble/hashes/sha2.js';
import { keccak_256, sha3_256 } from '@noble/hashes/sha3.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { bytesToHex, concatBytes } from '@noble/hashes/utils.js';
import { base32nopad, base58, bech32, createBase58check } from '@scure/base';
import { ed25519DerivePath } from './slip10';
import { CHAINS, type ChainDef, type Network } from './chains';

const base58check = createBase58check(sha256);
const hash160 = (b: Uint8Array) => ripemd160(sha256(b));

export function evmAddress(uncompressedPub: Uint8Array): string {
  const addr = bytesToHex(keccak_256(uncompressedPub.slice(1)).slice(-20));
  const h = bytesToHex(keccak_256(new TextEncoder().encode(addr)));
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(h[i], 16) >= 8 ? addr[i].toUpperCase() : addr[i];
  return out;
}

function crc16xmodem(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

export function stellarAddress(pub: Uint8Array): string {
  const payload = concatBytes(new Uint8Array([6 << 3]), pub);
  const c = crc16xmodem(payload);
  return base32nopad.encode(concatBytes(payload, new Uint8Array([c & 0xff, c >> 8])));
}

export function algorandAddress(pub: Uint8Array): string {
  return base32nopad.encode(concatBytes(pub, sha512_256(pub).slice(-4)));
}

function encode(chain: ChainDef, network: Network, pub: Uint8Array, pubUncompressed?: Uint8Array): string {
  const a = chain.address;
  switch (a.type) {
    case 'evm': return evmAddress(pubUncompressed!);
    case 'p2wpkh': return bech32.encode(a.hrp[network], [0, ...bech32.toWords(hash160(pub))]);
    case 'p2pkh': return base58check.encode(concatBytes(new Uint8Array(a.version[network]), hash160(pub)));
    case 'solana': return base58.encode(pub);
    case 'sui': return '0x' + bytesToHex(blake2b(concatBytes(new Uint8Array([0]), pub), { dkLen: 32 }));
    case 'aptos': return '0x' + bytesToHex(sha3_256(concatBytes(pub, new Uint8Array([0]))));
    case 'near': return bytesToHex(pub);
    case 'stellar': return stellarAddress(pub);
    case 'algorand': return algorandAddress(pub);
  }
}

export interface DerivedAccount {
  chainId: string;
  network: Network;
  path: string;
  address: string;
  /** Public key, hex (compressed for secp256k1). Safe to store. */
  publicKey: string;
}

/** Public data only: the private key is derived, used for the public key and wiped. */
export function deriveAccount(seed: Uint8Array, chain: ChainDef, network: Network): DerivedAccount {
  const path = chain.path[network];
  if (chain.curve === 'secp256k1') {
    const node = HDKey.fromMasterSeed(seed).derive(path);
    if (!node.privateKey || !node.publicKey) throw new Error('Derivation failed');
    const pub = node.publicKey;
    const unc = secp256k1.getPublicKey(node.privateKey, false);
    node.wipePrivateData();
    return { chainId: chain.id, network, path, address: encode(chain, network, pub, unc), publicKey: bytesToHex(pub) };
  }
  const n = ed25519DerivePath(seed, path);
  const pub = ed25519.getPublicKey(n.key);
  n.key.fill(0); n.chainCode.fill(0);
  return { chainId: chain.id, network, path, address: encode(chain, network, pub), publicKey: bytesToHex(pub) };
}

export function deriveAll(seed: Uint8Array, network: Network): DerivedAccount[] {
  return CHAINS.map((c) => deriveAccount(seed, c, network));
}
