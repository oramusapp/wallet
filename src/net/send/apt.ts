// Aptos transfer: 0x1::aptos_account::transfer(to, amount) — also creates the recipient account if missing.
// BCS written by hand; byte-for-byte checked against @aptos-labs/ts-sdk in tests.
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha3_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import type { Asset } from '../assets';
import { http } from '../balances';
import { formatAmount } from '../units';

const fmt = (v: bigint) => formatAmount(v, 8, 8);
export const APT_MAX_GAS = 2000n; // gas units; a plain transfer uses far less, account creation more

class B {
  b: number[] = [];
  u8(n: number) { this.b.push(n & 255); }
  u64(v: bigint) { for (let i = 0; i < 8; i++) { this.b.push(Number(v & 255n)); v >>= 8n; } }
  uleb(n: number) { do { let x = n & 0x7f; n >>>= 7; if (n) x |= 0x80; this.b.push(x); } while (n); }
  raw(a: Uint8Array) { for (const x of a) this.b.push(x); }
  bytes(a: Uint8Array) { this.uleb(a.length); this.raw(a); }
  str(s: string) { this.bytes(new TextEncoder().encode(s)); }
  out() { return new Uint8Array(this.b); }
}

export function checkAptAddress(a: string): Uint8Array {
  const t = a.trim().toLowerCase();
  if (!/^0x[0-9a-f]{1,64}$/.test(t)) throw new Error('To nie jest adres Aptos (0x + do 64 znaków hex).');
  if (t.length !== 66) throw new Error('Podaj pełny adres Aptos (0x + 64 znaki), żeby uniknąć pomyłki.');
  return hexToBytes(t.slice(2));
}

export interface AptTx { from: string; to: string; amount: bigint; seq: bigint; maxGas: bigint; gasPrice: bigint; expiration: bigint; chainId: number }

export function aptRawTransaction(t: AptTx): Uint8Array {
  const w = new B();
  w.raw(checkAptAddress(t.from));
  w.u64(t.seq);
  w.uleb(2); // TransactionPayload::EntryFunction
  w.raw(hexToBytes('00'.repeat(31) + '01')); w.str('aptos_account'); w.str('transfer');
  w.uleb(0); // no type args
  w.uleb(2); w.bytes(checkAptAddress(t.to)); { const a = new B(); a.u64(t.amount); w.bytes(a.out()); }
  w.u64(t.maxGas); w.u64(t.gasPrice); w.u64(t.expiration); w.u8(t.chainId);
  return w.out();
}

export function aptSigningMessage(raw: Uint8Array): Uint8Array {
  const prefix = sha3_256(new TextEncoder().encode('APTOS::RawTransaction'));
  const m = new Uint8Array(prefix.length + raw.length); m.set(prefix); m.set(raw, prefix.length);
  return m;
}

export function signApt(t: AptTx, privateKey32: Uint8Array): Uint8Array {
  const raw = aptRawTransaction(t);
  const sig = ed25519.sign(aptSigningMessage(raw), privateKey32);
  const w = new B();
  w.raw(raw);
  w.uleb(0); // TransactionAuthenticator::Ed25519
  w.bytes(ed25519.getPublicKey(privateKey32)); w.bytes(sig);
  return w.out();
}

export interface AptQuote { to: string; value: bigint; fee: bigint; balance: bigint; tx: AptTx; recipientNew: boolean }

export async function quoteApt(asset: Asset, from: string, toRaw: string, value: bigint): Promise<AptQuote> {
  const to = '0x' + bytesToHex(checkAptAddress(toRaw));
  const [meR, toR, gpR, balR, infoR] = await Promise.all([
    http(asset.rpc + '/accounts/' + from), http(asset.rpc + '/accounts/' + to), http(asset.rpc + '/estimate_gas_price'),
    http(asset.rpc + '/accounts/' + from + '/balance/0x1::aptos_coin::AptosCoin'), http(asset.rpc!)
  ]);
  if (meR.status === 404) throw new Error('Twoje konto Aptos jeszcze nie istnieje — najpierw otrzymaj APT.');
  if (!meR.ok || !gpR.ok || !balR.ok || !infoR.ok) throw new Error('Węzeł Aptos nie odpowiada.');
  const me = await meR.json(), gp = await gpR.json(), info = await infoR.json();
  if (Number(info.chain_id) !== asset.aptChainId) throw new Error('Węzeł zwrócił inną sieć niż oczekiwana. Przerwano.');
  const balance = BigInt(await balR.json());
  const gasPrice = BigInt(gp.gas_estimate ?? 100);
  const fee = APT_MAX_GAS * gasPrice;
  if (value + fee > balance) throw new Error('Za mało środków: potrzeba ' + fmt(value + fee) + ' APT razem z maks. opłatą, masz ' + fmt(balance) + '.');
  const tx: AptTx = { from, to, amount: value, seq: BigInt(me.sequence_number), maxGas: APT_MAX_GAS, gasPrice, expiration: BigInt(Math.floor(Date.now() / 1000) + 600), chainId: asset.aptChainId! };
  return { to, value, fee, balance, tx, recipientNew: toR.status === 404 };
}

export async function broadcastApt(asset: Asset, signed: Uint8Array): Promise<string> {
  const r = await http(asset.rpc + '/transactions', { method: 'POST', headers: { 'content-type': 'application/x.aptos.signed_transaction+bcs' }, body: signed as unknown as BodyInit });
  const j = await r.json();
  if (!r.ok) throw new Error('Odrzucone: ' + String(j.message ?? JSON.stringify(j)).slice(0, 200));
  return j.hash;
}
