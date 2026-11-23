// NEAR transfer from an implicit account (address = hex of the public key).
// Borsh written by hand; byte-for-byte checked against @near-js/transactions in tests.
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base58, base64 } from '@scure/base';
import type { Asset } from '../assets';
import { jsonRpc } from '../balances';
import { formatAmount } from '../units';

const fmt = (v: bigint) => formatAmount(v, 24, 6);
const TRANSFER_GAS_MAX = 3_000_000_000_000n; // 3 Tgas: upper bound for a transfer incl. creating an implicit account

class W {
  b: number[] = [];
  u8(n: number) { this.b.push(n & 255); }
  u32(n: number) { for (let i = 0; i < 4; i++) { this.b.push(n & 255); n >>>= 8; } }
  uN(v: bigint, bytes: number) { for (let i = 0; i < bytes; i++) { this.b.push(Number(v & 255n)); v >>= 8n; } }
  raw(a: Uint8Array) { for (const x of a) this.b.push(x); }
  str(s: string) { const e = new TextEncoder().encode(s); this.u32(e.length); this.raw(e); }
  out() { return new Uint8Array(this.b); }
}

/** Implicit (64 hex) or named account (name.testnet). */
export function checkNearAccount(a: string): string {
  const t = a.trim();
  if (/^[0-9a-f]{64}$/.test(t)) return t;
  if (/^[0-9A-F]{64}$/.test(t)) throw new Error('Konto ukryte NEAR pisze się małymi literami.');
  if (/^(?=.{2,64}$)([a-z\d]+[-_])*[a-z\d]+(\.([a-z\d]+[-_])*[a-z\d]+)*$/.test(t)) return t;
  throw new Error('To nie jest konto NEAR (64 znaki hex albo nazwa, np. ktos.testnet).');
}

export interface NearTx { signerId: string; publicKey: Uint8Array; nonce: bigint; receiverId: string; blockHash: string; amount: bigint }

export function nearTransaction(t: NearTx): Uint8Array {
  const w = new W();
  w.str(t.signerId);
  w.u8(0); w.raw(t.publicKey); // PublicKey ED25519
  w.uN(t.nonce, 8);
  w.str(t.receiverId);
  const bh = base58.decode(t.blockHash); if (bh.length !== 32) throw new Error('Zły blockhash');
  w.raw(bh);
  w.u32(1); w.u8(3); w.uN(t.amount, 16); // one Action::Transfer { deposit: u128 }
  return w.out();
}

export function signNear(t: NearTx, privateKey32: Uint8Array): { b64: string; hash: string } {
  const tx = nearTransaction(t);
  const h = sha256(tx);
  const sig = ed25519.sign(h, privateKey32);
  const out = new Uint8Array(tx.length + 65); out.set(tx); out[tx.length] = 0; out.set(sig, tx.length + 1);
  return { b64: base64.encode(out), hash: base58.encode(h) };
}

export interface NearQuote { to: string; value: bigint; fee: bigint; balance: bigint; tx: NearTx; recipientNew: boolean; reserve: bigint; minNew: bigint }

export async function quoteNear(asset: Asset, from: string, publicKeyHex: string, toRaw: string, value: bigint): Promise<NearQuote> {
  const to = checkNearAccount(toRaw);
  const rpc = asset.rpc!;
  const pub = Uint8Array.from(publicKeyHex.match(/../g)!.map((x) => parseInt(x, 16)));
  const pk = 'ed25519:' + base58.encode(pub);
  const viewAcc = (id: string) => jsonRpc<{ amount?: string; locked: string; storage_usage: number; error?: string }>(rpc, 'query', { request_type: 'view_account', finality: 'final', account_id: id }).then((r) => { if (r.error || r.amount === undefined) throw new Error(r.error ?? 'brak konta'); return r as { amount: string; locked: string; storage_usage: number }; });
  const [me, key, gp, cfg, them] = await Promise.all([
    viewAcc(from).catch(() => null),
    // NEAR reports a missing key inside `result.error`, not as a JSON-RPC error
    jsonRpc<{ nonce?: number; block_hash: string; error?: string }>(rpc, 'query', { request_type: 'view_access_key', finality: 'final', account_id: from, public_key: pk }).then((r) => (r.error || r.nonce === undefined ? null : r), () => null),
    jsonRpc<{ gas_price: string }>(rpc, 'gas_price', [null]),
    jsonRpc<{ runtime_config: { storage_amount_per_byte: string } }>(rpc, 'EXPERIMENTAL_protocol_config', { finality: 'final' }),
    viewAcc(to).catch(() => null)
  ]);
  if (!me) throw new Error('Twoje konto NEAR jeszcze nie istnieje — najpierw otrzymaj NEAR.');
  if (!key) throw new Error('Twój klucz nie ma już dostępu do tego konta NEAR (klucz został usunięty z konta). Środki kontroluje teraz ktoś inny — nie wpłacaj tu więcej.');
  const perByte = BigInt(cfg.runtime_config.storage_amount_per_byte);
  const reserve = BigInt(me.storage_usage) * perByte; // locked for the account's own storage
  const minNew = 182n * perByte; // an implicit account with one full-access key uses about 182 bytes
  const fee = TRANSFER_GAS_MAX * BigInt(gp.gas_price);
  const balance = BigInt(me.amount);
  const recipientNew = !them;
  if (recipientNew && /^[0-9a-f]{64}$/.test(to) && value < minNew) throw new Error('Konto odbiorcy nie istnieje: pierwsza wpłata musi pokryć jego przechowywanie, min. ok. ' + fmt(minNew) + ' NEAR.');
  if (recipientNew && !/^[0-9a-f]{64}$/.test(to)) throw new Error('Konto ' + to + ' nie istnieje. Nazwane konta trzeba najpierw utworzyć.');
  if (balance - value - fee < reserve) throw new Error('Na koncie musi zostać ' + fmt(reserve) + ' NEAR (opłata za przechowywanie danych konta). Możesz wysłać najwyżej ' + fmt(balance - fee - reserve > 0n ? balance - fee - reserve : 0n) + ' NEAR.');
  const tx: NearTx = { signerId: from, publicKey: pub, nonce: BigInt(key.nonce!) + 1n, receiverId: to, blockHash: key.block_hash, amount: value };
  return { to, value, fee, balance, tx, recipientNew, reserve, minNew };
}

export async function broadcastNear(asset: Asset, b64: string): Promise<string> {
  const r = await jsonRpc<{ transaction?: { hash: string }; transaction_outcome?: { id: string } }>(asset.rpc!, 'send_tx', { signed_tx_base64: b64, wait_until: 'INCLUDED' });
  return r.transaction?.hash ?? r.transaction_outcome?.id ?? '';
}
