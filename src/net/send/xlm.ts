// Stellar XLM transfer: Payment (existing account) or CreateAccount (new account, min. 2 × base reserve).
// XDR written by hand; byte-for-byte checked against @stellar/stellar-sdk in tests.
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base32nopad, base64 } from '@scure/base';
import type { Asset } from '../assets';
import { http } from '../balances';
import { decimalStringToUnits, formatAmount } from '../units';

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const fmt = (v: bigint) => formatAmount(v, 7, 7);

class W {
  b: number[] = [];
  u32(n: number) { this.b.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255); }
  i64(v: bigint) { const x = BigInt.asUintN(64, v); this.u32(Number(x >> 32n)); this.u32(Number(x & 0xffffffffn)); }
  bytes(a: Uint8Array) { for (const x of a) this.b.push(x); }
  varOpaque(a: Uint8Array) { this.u32(a.length); this.bytes(a); while (this.b.length % 4) this.b.push(0); }
  out() { return new Uint8Array(this.b); }
}

function crc16xmodem(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) { crc ^= b << 8; for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; }
  return crc;
}

/** G… address -> 32-byte ed25519 public key, with version byte and checksum verified. */
export function decodeStellarAddress(addr: string): Uint8Array {
  const t = addr.trim();
  let raw: Uint8Array;
  try { raw = base32nopad.decode(t); } catch { throw new Error('To nie jest adres Stellar (G…).'); }
  if (raw.length !== 35 || raw[0] !== 6 << 3) throw new Error('To nie jest adres konta Stellar (G…).');
  const c = crc16xmodem(raw.slice(0, 33));
  if (raw[33] !== (c & 0xff) || raw[34] !== c >> 8) throw new Error('Błędna suma kontrolna adresu Stellar.');
  return raw.slice(1, 33);
}

export interface XlmTx {
  from: string; to: string; amount: bigint; create: boolean; fee: number; seq: bigint; maxTime: bigint; memo?: string;
}

export function xlmTransactionXdr(t: XlmTx): Uint8Array {
  const w = new W();
  w.u32(0); w.bytes(decodeStellarAddress(t.from)); // sourceAccount: MuxedAccount KEY_TYPE_ED25519
  w.u32(t.fee);
  w.i64(t.seq);
  w.u32(1); w.i64(0n); w.i64(t.maxTime); // PRECOND_TIME, TimeBounds{min 0, max}
  if (t.memo) { const m = new TextEncoder().encode(t.memo); if (m.length > 28) throw new Error('Memo: max 28 bajtów'); w.u32(1); w.varOpaque(m); } else w.u32(0); // MEMO_TEXT / MEMO_NONE
  w.u32(1); // one operation
  w.u32(0); // no op source account
  if (t.create) { w.u32(0); w.u32(0); w.bytes(decodeStellarAddress(t.to)); w.i64(t.amount); } // CREATE_ACCOUNT {AccountID, startingBalance}
  else { w.u32(1); w.u32(0); w.bytes(decodeStellarAddress(t.to)); w.u32(0); w.i64(t.amount); } // PAYMENT {MuxedAccount, ASSET_TYPE_NATIVE, amount}
  w.u32(0); // ext v0
  return w.out();
}

export function xlmSignatureBase(txXdr: Uint8Array, passphrase = TESTNET_PASSPHRASE): Uint8Array {
  const net = sha256(new TextEncoder().encode(passphrase));
  const out = new Uint8Array(32 + 4 + txXdr.length);
  out.set(net, 0); out.set([0, 0, 0, 2], 32); out.set(txXdr, 36); // ENVELOPE_TYPE_TX
  return sha256(out);
}

/** TransactionEnvelope (ENVELOPE_TYPE_TX) with one signature, base64. */
export function signXlm(t: XlmTx, privateKey32: Uint8Array, passphrase = TESTNET_PASSPHRASE): string {
  const txXdr = xlmTransactionXdr(t);
  const sig = ed25519.sign(xlmSignatureBase(txXdr, passphrase), privateKey32);
  const pub = ed25519.getPublicKey(privateKey32);
  const w = new W();
  w.u32(2); w.bytes(txXdr);
  w.u32(1); w.bytes(pub.slice(28, 32)); w.varOpaque(sig);
  return base64.encode(w.out());
}

export interface XlmQuote { to: string; value: bigint; fee: bigint; balance: bigint; tx: XlmTx; recipientNew: boolean; minBalance: bigint; memo?: string }

export async function quoteXlm(asset: Asset, from: string, toRaw: string, value: bigint, memo?: string): Promise<XlmQuote> {
  const to = toRaw.trim(); decodeStellarAddress(to);
  if (memo && new TextEncoder().encode(memo).length > 28) throw new Error('Memo może mieć najwyżej 28 bajtów.');
  const [meR, toR, ledR] = await Promise.all([http(asset.rpc + '/accounts/' + from), http(asset.rpc + '/accounts/' + to), http(asset.rpc + '/ledgers?order=desc&limit=1')]);
  if (meR.status === 404) throw new Error('Twoje konto Stellar jeszcze nie istnieje — najpierw wpłać min. 1 XLM.');
  if (!meR.ok || !ledR.ok) throw new Error('Węzeł Stellar nie odpowiada.');
  const me = await meR.json(), led = (await ledR.json())._embedded.records[0];
  const baseReserve = BigInt(led.base_reserve_in_stroops), fee = BigInt(led.base_fee_in_stroops);
  const balance = decimalStringToUnits(me.balances.find((b: any) => b.asset_type === 'native')?.balance ?? '0', 7);
  const minBalance = (2n + BigInt(me.subentry_count ?? 0)) * baseReserve;
  const recipientNew = toR.status === 404;
  if (recipientNew && value < 2n * baseReserve) throw new Error('Konto odbiorcy nie istnieje: pierwsza wpłata musi wynosić min. ' + fmt(2n * baseReserve) + ' XLM.');
  if (balance - value - fee < minBalance) throw new Error('Na Twoim koncie musi zostać min. ' + fmt(minBalance) + ' XLM. Możesz wysłać najwyżej ' + fmt(balance - fee - minBalance > 0n ? balance - fee - minBalance : 0n) + ' XLM.');
  const tx: XlmTx = { from, to, amount: value, create: recipientNew, fee: Number(fee), seq: BigInt(me.sequence) + 1n, maxTime: BigInt(Math.floor(Date.now() / 1000) + 300), memo: memo || undefined };
  return { to, value, fee, balance, tx, recipientNew, minBalance, memo: memo || undefined };
}

export async function broadcastXlm(asset: Asset, envelopeB64: string): Promise<string> {
  const r = await http(asset.rpc + '/transactions', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'tx=' + encodeURIComponent(envelopeB64) });
  const j = await r.json();
  if (!r.ok) throw new Error('Odrzucone: ' + JSON.stringify(j.extras?.result_codes ?? j.title ?? j).slice(0, 200));
  return j.hash;
}
