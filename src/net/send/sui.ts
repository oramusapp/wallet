// Sui transfer: SplitCoins(GasCoin, [amount]) + TransferObjects([coin], recipient), gas paid from your SUI coins.
// BCS written by hand; byte-for-byte checked against @mysten/sui in tests. Node access via GraphQL.
import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { base58, base64 } from '@scure/base';
import type { Asset } from '../assets';
import { http } from '../balances';
import { formatAmount } from '../units';

const fmt = (v: bigint) => formatAmount(v, 9, 9);
export const SUI_GAS_BUDGET_UNITS = 5_000n; // budget = units × reference gas price (unused part is refunded)
export const SUI_MIN_BUDGET = 10_000_000n; // 0.01 SUI: covers storage of the new coin object even when the gas price is low
export const suiBudget = (gasPrice: bigint) => { const b = SUI_GAS_BUDGET_UNITS * gasPrice; return b > SUI_MIN_BUDGET ? b : SUI_MIN_BUDGET; };

class B {
  b: number[] = [];
  u8(n: number) { this.b.push(n & 255); }
  u16(n: number) { this.b.push(n & 255, (n >> 8) & 255); }
  u64(v: bigint) { for (let i = 0; i < 8; i++) { this.b.push(Number(v & 255n)); v >>= 8n; } }
  uleb(n: number) { do { let x = n & 0x7f; n >>>= 7; if (n) x |= 0x80; this.b.push(x); } while (n); }
  raw(a: Uint8Array) { for (const x of a) this.b.push(x); }
  bytes(a: Uint8Array) { this.uleb(a.length); this.raw(a); }
  out() { return new Uint8Array(this.b); }
}

export function checkSuiAddress(a: string): Uint8Array {
  const t = a.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(t)) throw new Error('To nie jest pełny adres Sui (0x + 64 znaki hex).');
  return hexToBytes(t.slice(2));
}

export interface SuiCoinRef { objectId: string; version: bigint; digest: string }
export interface SuiTx { from: string; to: string; amount: bigint; gas: SuiCoinRef[]; gasPrice: bigint; gasBudget: bigint }

export function suiTransactionData(t: SuiTx): Uint8Array {
  const w = new B();
  w.uleb(0); // TransactionData::V1
  w.uleb(0); // TransactionKind::ProgrammableTransaction
  w.uleb(2); // inputs
  { const a = new B(); a.u64(t.amount); w.uleb(0); w.bytes(a.out()); } // Pure(u64)
  w.uleb(0); w.bytes(checkSuiAddress(t.to)); // Pure(address)
  w.uleb(2); // commands
  w.uleb(2); w.uleb(0); w.uleb(1); w.uleb(1); w.u16(0); // SplitCoins(GasCoin, [Input(0)])
  w.uleb(1); w.uleb(1); w.uleb(3); w.u16(0); w.u16(0); w.uleb(1); w.u16(1); // TransferObjects([NestedResult(0,0)], Input(1))
  w.raw(checkSuiAddress(t.from)); // sender
  w.uleb(t.gas.length);
  for (const g of t.gas) { w.raw(checkSuiAddress(g.objectId)); w.u64(g.version); w.bytes(base58.decode(g.digest)); }
  w.raw(checkSuiAddress(t.from)); w.u64(t.gasPrice); w.u64(t.gasBudget); // GasData owner, price, budget
  w.uleb(0); // TransactionExpiration::None
  return w.out();
}

export function signSui(t: SuiTx, privateKey32: Uint8Array): { txBytes: string; signature: string } {
  const data = suiTransactionData(t);
  const msg = new Uint8Array(3 + data.length); msg.set([0, 0, 0]); msg.set(data, 3); // intent: TransactionData, V0, Sui
  const sig = ed25519.sign(blake2b(msg, { dkLen: 32 }), privateKey32);
  const ser = new Uint8Array(97); ser[0] = 0; ser.set(sig, 1); ser.set(ed25519.getPublicKey(privateKey32), 65);
  return { txBytes: base64.encode(data), signature: base64.encode(ser) };
}

async function gql<T>(url: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const r = await http(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error('Sui: HTTP ' + r.status);
  const j = await r.json();
  if (j.errors?.length) throw new Error('Sui: ' + j.errors[0].message);
  return j.data as T;
}

export interface SuiQuote { to: string; value: bigint; fee: bigint; balance: bigint; tx: SuiTx }

export async function quoteSui(asset: Asset, from: string, toRaw: string, value: bigint): Promise<SuiQuote> {
  checkSuiAddress(toRaw);
  const to = toRaw.trim().toLowerCase();
  const d = await gql<any>(asset.rpc!, `query($a: SuiAddress!) { epoch { referenceGasPrice }
    address(address: $a) { balance(coinType: "0x2::sui::SUI") { totalBalance }
      objects(filter: { type: "0x2::coin::Coin<0x2::sui::SUI>" }, first: 50) { nodes { address version digest } } } }`, { a: from });
  const gasPrice = BigInt(d.epoch.referenceGasPrice);
  const balance = BigInt(d.address?.balance?.totalBalance ?? '0');
  const coins: SuiCoinRef[] = (d.address?.objects?.nodes ?? []).map((n: any) => ({ objectId: n.address, version: BigInt(n.version), digest: n.digest }));
  if (!coins.length) throw new Error('Brak monet SUI na koncie (potrzebne też do opłaty).');
  const gasBudget = suiBudget(gasPrice);
  if (value + gasBudget > balance) throw new Error('Za mało środków: potrzeba ' + fmt(value + gasBudget) + ' SUI razem z maks. opłatą, masz ' + fmt(balance) + '.');
  return { to, value, fee: gasBudget, balance, tx: { from, to, amount: value, gas: coins, gasPrice, gasBudget } };
}

export async function broadcastSui(asset: Asset, s: { txBytes: string; signature: string }): Promise<string> {
  // Schema checked live on graphql.testnet.sui.io (23.11.2026): ExecutionResult { effects { digest status executionError } }
  const d = await gql<any>(asset.rpc!, `mutation($t: String!, $s: [String!]!) { executeTransaction(transactionDataBcs: $t, signatures: $s) { effects { digest status executionError { message } } } }`, { t: s.txBytes, s: [s.signature] });
  const e = d.executeTransaction?.effects;
  if (!e) throw new Error('Sui nie zwróciło wyniku transakcji.');
  if (e.status && e.status !== 'SUCCESS') throw new Error('Transakcja nie powiodła się: ' + (e.executionError?.message ?? e.status));
  return e.digest;
}
