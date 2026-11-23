// Bitcoin-family transfers with @scure/btc-signer: BTC and LTC (P2WPKH, mempool-style API),
// DOGE and DASH (P2PKH, BlockCypher API; legacy inputs need the full previous transaction).
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import type { Asset } from '../assets';
import { http } from '../balances';

export interface BtcNet { bech32: string; pubKeyHash: number; scriptHash: number; wif: number }
export interface UtxoCfg { api: 'mempool' | 'blockcypher'; base: string; net: BtcNet; segwit: boolean; dust: bigint }

export const NETS = {
  btcMain: { bech32: 'bc', pubKeyHash: 0x00, scriptHash: 0x05, wif: 0x80 },
  btcTest: { bech32: 'tb', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef },
  ltcMain: { bech32: 'ltc', pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0 },
  ltcTest: { bech32: 'tltc', pubKeyHash: 0x6f, scriptHash: 0x3a, wif: 0xef },
  dogeMain: { bech32: 'doge', pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e },
  dashMain: { bech32: 'dash', pubKeyHash: 0x4c, scriptHash: 0x10, wif: 0xcc }
} satisfies Record<string, BtcNet>;

export interface Utxo { txid: string; vout: number; value: number; raw?: string }

export interface UtxoQuote {
  to: string;
  value: bigint;
  feeRate: bigint; // sat per vbyte (per byte for legacy)
  fee: bigint;
  change: boolean;
  utxos: Utxo[];
  balance: bigint;
}

export function checkUtxoAddress(a: string, cfg: UtxoCfg): string {
  const t = a.trim();
  try { btc.Address(cfg.net).decode(t); } catch { throw new Error('To nie jest adres tej sieci (sprawdź, czy to nie adres innej sieci).'); }
  return t;
}

function inputsFor(utxos: Utxo[], pub: Uint8Array, cfg: UtxoCfg) {
  const own = cfg.segwit ? btc.p2wpkh(pub, cfg.net) : btc.p2pkh(pub, cfg.net);
  const inputs = utxos.map((u) => cfg.segwit
    ? { txid: hex.decode(u.txid), index: u.vout, witnessUtxo: { amount: BigInt(u.value), script: own.script } }
    : { txid: hex.decode(u.txid), index: u.vout, nonWitnessUtxo: hex.decode(u.raw!) });
  return { own, inputs };
}

/** Pure: picks inputs and computes the fee. Throws when funds are too low. */
export function planUtxo(utxos: Utxo[], pub: Uint8Array, to: string, value: bigint, feeRate: bigint, cfg: UtxoCfg) {
  const { own, inputs } = inputsFor(utxos, pub, cfg);
  const sel = btc.selectUTXO(inputs, [{ address: to, amount: value }], 'default', {
    feePerByte: feeRate, changeAddress: own.address!, network: cfg.net, createTx: true, bip69: true, dust: cfg.dust
  });
  if (!sel || !sel.tx || sel.fee === undefined) throw new Error('Za mało środków na kwotę i opłatę.');
  return sel;
}

async function getJson(url: string): Promise<any> {
  const r = await http(url);
  if (!r.ok) throw new Error('Węzeł nie odpowiada (HTTP ' + r.status + ').');
  return r.json();
}

export async function utxoBalance(cfg: UtxoCfg, address: string): Promise<bigint> {
  if (cfg.api === 'mempool') {
    const j = await getJson(cfg.base + '/address/' + address);
    const c = j.chain_stats, m = j.mempool_stats;
    return BigInt(c.funded_txo_sum - c.spent_txo_sum + m.funded_txo_sum - m.spent_txo_sum);
  }
  const j = await getJson(cfg.base + '/addrs/' + address + '/balance');
  return BigInt(j.final_balance);
}

export async function utxoFeeRate(cfg: UtxoCfg): Promise<bigint> {
  if (cfg.api === 'mempool') {
    const f = await getJson(cfg.base + '/v1/fees/recommended');
    return BigInt(Math.max(1, Math.ceil(Number(f.halfHourFee) || 1)));
  }
  const j = await getJson(cfg.base);
  return BigInt(Math.max(1, Math.ceil(Number(j.medium_fee_per_kb) / 1000)));
}

async function listUtxos(cfg: UtxoCfg, address: string): Promise<Utxo[]> {
  if (cfg.api === 'mempool') return (await getJson(cfg.base + '/address/' + address + '/utxo')).map((u: any) => ({ txid: u.txid, vout: u.vout, value: u.value }));
  const j = await getJson(cfg.base + '/addrs/' + address + '?unspentOnly=true&limit=50');
  const refs = [...(j.txrefs ?? []), ...(j.unconfirmed_txrefs ?? [])];
  const list: Utxo[] = refs.map((r: any) => ({ txid: r.tx_hash, vout: r.tx_output_n, value: r.value }))
    .sort((a: Utxo, b: Utxo) => b.value - a.value).slice(0, 20); // legacy inputs need the full previous tx each
  for (const u of list) u.raw = (await getJson(cfg.base + '/txs/' + u.txid + '?includeHex=true')).hex;
  return list;
}

export async function quoteUtxo(asset: Asset, fromAddress: string, fromPubkeyHex: string, toRaw: string, value: bigint): Promise<UtxoQuote> {
  const cfg = asset.utxo!;
  const to = checkUtxoAddress(toRaw, cfg);
  if (value < cfg.dust) throw new Error('Za mała kwota: minimum sieci to ' + cfg.dust + ' najmniejszych jednostek.');
  const [utxos, feeRate] = await Promise.all([listUtxos(cfg, fromAddress), utxoFeeRate(cfg)]);
  const balance = utxos.reduce((t, u) => t + BigInt(u.value), 0n);
  const sel = planUtxo(utxos, hex.decode(fromPubkeyHex), to, value, feeRate, cfg);
  return { to, value, feeRate, fee: sel.fee!, change: sel.change, utxos, balance };
}

/** Rebuilds the same plan, signs every input, returns raw tx hex. Refuses if the fee changed since the preview. */
export function signUtxo(q: UtxoQuote, privateKey: Uint8Array, cfg: UtxoCfg): { hex: string; txid: string } {
  const pub = secp256k1.getPublicKey(privateKey, true);
  const sel = planUtxo(q.utxos, pub, q.to, q.value, q.feeRate, cfg);
  if (sel.fee !== q.fee) throw new Error('Opłata zmieniła się od podglądu. Spróbuj jeszcze raz.');
  const tx = sel.tx!;
  tx.sign(privateKey);
  tx.finalize();
  return { hex: tx.hex, txid: tx.id };
}

export async function broadcastUtxo(asset: Asset, rawHex: string): Promise<string> {
  const cfg = asset.utxo!;
  if (cfg.api === 'mempool') {
    const r = await http(cfg.base + '/tx', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: rawHex });
    const t = await r.text();
    if (!r.ok) throw new Error('Odrzucone przez sieć: ' + t.slice(0, 200));
    return t.trim();
  }
  const r = await http(cfg.base + '/txs/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tx: rawHex }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Odrzucone przez sieć: ' + String(j.error ?? JSON.stringify(j)).slice(0, 200));
  return j.tx?.hash ?? '';
}
