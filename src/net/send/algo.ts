// Algorand payment: canonical msgpack written by hand; byte-for-byte checked against algosdk in tests.
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha512_256 } from '@noble/hashes/sha2.js';
import { base32nopad, base64 } from '@scure/base';
import type { Asset } from '../assets';
import { http } from '../balances';
import { formatAmount } from '../units';

const fmt = (v: bigint) => formatAmount(v, 6, 6);

export function decodeAlgoAddress(addr: string): Uint8Array {
  const t = addr.trim();
  let raw: Uint8Array;
  try { raw = base32nopad.decode(t); } catch { throw new Error('To nie jest adres Algorand.'); }
  if (t.length !== 58 || raw.length !== 36) throw new Error('To nie jest adres Algorand (58 znaków).');
  const pk = raw.slice(0, 32), chk = sha512_256(pk).slice(-4);
  if (!chk.every((b, i) => b === raw[32 + i])) throw new Error('Błędna suma kontrolna adresu Algorand.');
  return pk;
}

// --- minimal canonical msgpack (only what a payment needs) ---
type MP = bigint | string | Uint8Array | { [k: string]: MP };
function enc(v: MP, out: number[]): void {
  if (typeof v === 'bigint') {
    if (v < 0n) throw new Error('neg');
    if (v < 128n) out.push(Number(v));
    else if (v < 256n) out.push(0xcc, Number(v));
    else if (v < 65536n) out.push(0xcd, Number(v >> 8n), Number(v & 255n));
    else if (v < 4294967296n) { out.push(0xce); for (let s = 24n; s >= 0n; s -= 8n) out.push(Number((v >> s) & 255n)); }
    else { out.push(0xcf); for (let s = 56n; s >= 0n; s -= 8n) out.push(Number((v >> s) & 255n)); }
  } else if (typeof v === 'string') {
    const b = new TextEncoder().encode(v);
    if (b.length < 32) out.push(0xa0 | b.length); else out.push(0xd9, b.length);
    out.push(...b);
  } else if (v instanceof Uint8Array) {
    out.push(0xc4, v.length, ...v);
  } else {
    const keys = Object.keys(v).sort();
    out.push(0x80 | keys.length);
    for (const k of keys) { enc(k, out); enc(v[k], out); }
  }
}
export function msgpack(v: MP): Uint8Array { const out: number[] = []; enc(v, out); return new Uint8Array(out); }

export interface AlgoTx { from: string; to: string; amount: bigint; fee: bigint; firstValid: bigint; lastValid: bigint; genesisId: string; genesisHash: Uint8Array; note?: Uint8Array }

export function algoTxnMap(t: AlgoTx): { [k: string]: MP } {
  const m: { [k: string]: MP } = { fee: t.fee, fv: t.firstValid, gen: t.genesisId, gh: t.genesisHash, lv: t.lastValid, rcv: decodeAlgoAddress(t.to), snd: decodeAlgoAddress(t.from), type: 'pay' };
  if (t.amount > 0n) m.amt = t.amount; // canonical encoding omits zero values
  if (t.note && t.note.length) m.note = t.note;
  return m;
}

export function algoBytesToSign(t: AlgoTx): Uint8Array {
  const body = msgpack(algoTxnMap(t));
  const out = new Uint8Array(2 + body.length); out.set([0x54, 0x58]); out.set(body, 2); // "TX"
  return out;
}

export function algoTxId(t: AlgoTx): string {
  return base32nopad.encode(sha512_256(algoBytesToSign(t)));
}

export function signAlgo(t: AlgoTx, privateKey32: Uint8Array): Uint8Array {
  const sig = ed25519.sign(algoBytesToSign(t), privateKey32);
  return msgpack({ sig, txn: algoTxnMap(t) });
}

export interface AlgoQuote { to: string; value: bigint; fee: bigint; balance: bigint; tx: AlgoTx; recipientNew: boolean; minBalance: bigint }

export async function quoteAlgo(asset: Asset, from: string, toRaw: string, value: bigint): Promise<AlgoQuote> {
  const to = toRaw.trim(); decodeAlgoAddress(to);
  const [pR, meR, toR] = await Promise.all([http(asset.rpc + '/v2/transactions/params'), http(asset.rpc + '/v2/accounts/' + from + '?exclude=all'), http(asset.rpc + '/v2/accounts/' + to + '?exclude=all')]);
  if (!pR.ok || !meR.ok) throw new Error('Węzeł Algorand nie odpowiada.');
  const p = await pR.json(), me = await meR.json(), them = toR.ok ? await toR.json() : null;
  const fee = BigInt(p['min-fee'] ?? 1000);
  const balance = BigInt(me.amount ?? 0), minBalance = BigInt(me['min-balance'] ?? 100_000);
  const recipientNew = !them || BigInt(them.amount ?? 0) === 0n;
  if (recipientNew && value < 100_000n) throw new Error('Konto odbiorcy jest puste: pierwsza wpłata musi wynosić min. ' + fmt(100_000n) + ' ALGO.');
  if (balance - value - fee < minBalance) throw new Error('Na Twoim koncie musi zostać min. ' + fmt(minBalance) + ' ALGO. Możesz wysłać najwyżej ' + fmt(balance - fee - minBalance > 0n ? balance - fee - minBalance : 0n) + ' ALGO.');
  const fv = BigInt(p['last-round']);
  const tx: AlgoTx = { from, to, amount: value, fee, firstValid: fv, lastValid: fv + 1000n, genesisId: p['genesis-id'], genesisHash: base64.decode(p['genesis-hash']) };
  return { to, value, fee, balance, tx, recipientNew, minBalance };
}

export async function broadcastAlgo(asset: Asset, signed: Uint8Array): Promise<string> {
  const r = await http(asset.rpc + '/v2/transactions', { method: 'POST', headers: { 'content-type': 'application/x-binary' }, body: signed as unknown as BodyInit });
  const j = await r.json();
  if (!r.ok) throw new Error('Odrzucone: ' + String(j.message ?? JSON.stringify(j)).slice(0, 200));
  return j.txId;
}
