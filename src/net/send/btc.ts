// Bitcoin (testnet4) P2WPKH transfer with @scure/btc-signer. UTXOs and fees from mempool.space.
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import type { Asset } from '../assets';
import { http } from '../balances';

export const BTC_TESTNET = btc.TEST_NETWORK; // bech32 'tb'

export interface Utxo { txid: string; vout: number; value: number; status?: { confirmed: boolean } }

export interface BtcQuote {
  to: string;
  value: bigint;
  feeRate: bigint; // sat/vB
  fee: bigint;
  change: boolean;
  utxos: Utxo[];
  balance: bigint;
}

export function checkBtcAddress(a: string, network = BTC_TESTNET): string {
  const t = a.trim();
  try { btc.Address(network).decode(t); } catch { throw new Error('To nie jest adres Bitcoin testnet (tb1…).'); }
  return t;
}

/** Pure part: picks inputs and computes the fee. Throws when funds are too low. */
export function planBtc(utxos: Utxo[], fromPubkey: Uint8Array, to: string, value: bigint, feeRate: bigint, network = BTC_TESTNET) {
  const spend = btc.p2wpkh(fromPubkey, network);
  const inputs = utxos.map((u) => ({ txid: hex.decode(u.txid), index: u.vout, witnessUtxo: { amount: BigInt(u.value), script: spend.script } }));
  const sel = btc.selectUTXO(inputs, [{ address: to, amount: value }], 'default', { feePerByte: feeRate, changeAddress: spend.address!, network, createTx: true, bip69: true });
  if (!sel || !sel.tx || sel.fee === undefined) throw new Error('Za mało środków na kwotę i opłatę.');
  return sel;
}

export async function quoteBtc(asset: Asset, fromAddress: string, fromPubkeyHex: string, toRaw: string, value: bigint): Promise<BtcQuote> {
  const to = checkBtcAddress(toRaw);
  if (value < 546n) throw new Error('Minimalna kwota to 546 sat.');
  const [uR, fR] = await Promise.all([http(asset.rpc + '/address/' + fromAddress + '/utxo'), http(asset.rpc + '/v1/fees/recommended')]);
  if (!uR.ok || !fR.ok) throw new Error('Węzeł nie odpowiada (HTTP ' + (uR.ok ? fR.status : uR.status) + ').');
  const utxos: Utxo[] = await uR.json();
  const fees = await fR.json();
  const feeRate = BigInt(Math.max(1, Math.ceil(Number(fees.halfHourFee) || 1)));
  const balance = utxos.reduce((t, u) => t + BigInt(u.value), 0n);
  const sel = planBtc(utxos, hex.decode(fromPubkeyHex), to, value, feeRate);
  return { to, value, feeRate, fee: sel.fee!, change: sel.change, utxos, balance };
}

/** Rebuilds the same plan, signs every input with `privateKey`, returns raw tx hex. */
export function signBtc(q: BtcQuote, privateKey: Uint8Array, network = BTC_TESTNET): { hex: string; txid: string } {
  const pub = secp256k1.getPublicKey(privateKey, true);
  const sel = planBtc(q.utxos, pub, q.to, q.value, q.feeRate, network);
  if (sel.fee !== q.fee) throw new Error('Opłata zmieniła się od podglądu. Spróbuj jeszcze raz.');
  const tx = sel.tx!;
  tx.sign(privateKey);
  tx.finalize();
  return { hex: tx.hex, txid: tx.id };
}

export async function broadcastBtc(asset: Asset, rawHex: string): Promise<string> {
  const r = await http(asset.rpc + '/tx', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: rawHex });
  const t = await r.text();
  if (!r.ok) throw new Error('Odrzucone przez sieć: ' + t.slice(0, 200));
  return t.trim();
}
