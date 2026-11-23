// Native coin transfer on an EVM network (EIP-1559). Signing uses @noble with the key as bytes,
// so the private key never becomes a JS string and can be wiped after use.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { encodeFunctionData, getAddress, isAddress, keccak256, serializeTransaction, type Hex, type TransactionSerializableEIP1559 } from 'viem';
import type { Asset } from '../assets';
import { jsonRpc } from '../balances';
import { formatAmount } from '../units';

const fmtEth = (v: bigint) => formatAmount(v, 18, 8);

export interface EvmQuote {
  to: `0x${string}`;
  value: bigint;
  nonce: number;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  /** Worst-case fee: gas * maxFeePerGas + L1 data fee (OP-stack). */
  maxFee: bigint;
  /** Expected fee at the current base fee. */
  fee: bigint;
  /** OP-stack L1 data fee included in fee/maxFee (0 elsewhere). */
  l1Fee: bigint;
  balance: bigint;
}

/** Strict: lower/upper-case-only addresses are accepted; mixed case must have a valid EIP-55 checksum. */
export function checkEvmAddress(a: string): `0x${string}` {
  const t = a.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(t)) throw new Error('To nie jest adres EVM (0x + 40 znaków).');
  if (!isAddress(t, { strict: true })) throw new Error('Błędna suma kontrolna adresu — sprawdź, czy nic nie zostało zmienione.');
  return getAddress(t);
}

export async function quoteEvm(asset: Asset, from: string, toRaw: string, value: bigint): Promise<EvmQuote> {
  const to = checkEvmAddress(toRaw);
  const rpc = asset.rpc!;
  const [nonceHex, balHex, block, tipHex, chainHex] = await Promise.all([
    jsonRpc<string>(rpc, 'eth_getTransactionCount', [from, 'pending']),
    jsonRpc<string>(rpc, 'eth_getBalance', [from, 'latest']),
    jsonRpc<{ baseFeePerGas?: string }>(rpc, 'eth_getBlockByNumber', ['latest', false]),
    jsonRpc<string>(rpc, 'eth_maxPriorityFeePerGas', []).catch(() => '0x3b9aca00'),
    jsonRpc<string>(rpc, 'eth_chainId', [])
  ]);
  if (Number(BigInt(chainHex)) !== asset.evmChainId) throw new Error('Węzeł zwrócił inną sieć niż oczekiwana. Przerwano.');
  const balance0 = BigInt(balHex);
  if (value > balance0) throw new Error('Za mało środków. Masz ' + fmtEth(balance0) + ' ETH, chcesz wysłać ' + fmtEth(value) + ' ETH.');
  let gasHex: string;
  try { gasHex = await jsonRpc<string>(rpc, 'eth_estimateGas', [{ from, to, value: '0x' + value.toString(16) }]); }
  catch (e) {
    if (/insufficient funds/i.test((e as Error).message)) throw new Error('Za mało środków na kwotę razem z opłatą sieci.');
    throw new Error('Sieć nie przyjmie tej transakcji: ' + (e as Error).message.slice(0, 160));
  }
  const base = BigInt(block.baseFeePerGas ?? '0x0');
  const tip = BigInt(tipHex);
  const maxFeePerGas = base * 2n + tip; // room for two full blocks of base-fee growth
  const gas = (BigInt(gasHex) * 12n + 9n) / 10n; // +20% headroom; unused gas is not charged
  const balance = BigInt(balHex);
  const nonce = Number(BigInt(nonceHex));
  const l1Fee = asset.opStack ? await opStackL1Fee(asset, { type: 'eip1559', chainId: asset.evmChainId!, nonce, to, value, gas, maxFeePerGas, maxPriorityFeePerGas: tip }) : 0n;
  return { to, value, nonce, gas, maxFeePerGas, maxPriorityFeePerGas: tip, maxFee: gas * maxFeePerGas + l1Fee, fee: gas * (base + tip) + l1Fee, l1Fee, balance };
}

export function signEvm(asset: Asset, q: EvmQuote, privateKey: Uint8Array): Hex {
  const tx: TransactionSerializableEIP1559 = {
    type: 'eip1559', chainId: asset.evmChainId!, nonce: q.nonce, to: q.to, value: q.value, gas: q.gas,
    maxFeePerGas: q.maxFeePerGas, maxPriorityFeePerGas: q.maxPriorityFeePerGas
  };
  const hash = keccak256(serializeTransaction(tx));
  const sig = secp256k1.sign(hexBytes(hash), privateKey, { prehash: false, format: 'recovered' });
  // noble 'recovered' layout: [recovery, r(32), s(32)]
  const r = ('0x' + bytesToHex(sig.slice(1, 33))) as Hex;
  const s = ('0x' + bytesToHex(sig.slice(33, 65))) as Hex;
  return serializeTransaction(tx, { r, s, yParity: sig[0] });
}

const GAS_PRICE_ORACLE = '0x420000000000000000000000000000000000000F';
const ORACLE_ABI = [{ type: 'function', name: 'getL1Fee', stateMutability: 'view', inputs: [{ name: '_data', type: 'bytes' }], outputs: [{ type: 'uint256' }] }] as const;

/** L1 data fee on OP-stack chains, from the chain's own GasPriceOracle (+10% headroom). */
export async function opStackL1Fee(asset: Asset, tx: TransactionSerializableEIP1559): Promise<bigint> {
  const data = encodeFunctionData({ abi: ORACLE_ABI, functionName: 'getL1Fee', args: [serializeTransaction(tx)] });
  const r = await jsonRpc<string>(asset.rpc!, 'eth_call', [{ to: GAS_PRICE_ORACLE, data }, 'latest']);
  return (BigInt(r) * 11n + 9n) / 10n;
}

export async function broadcastEvm(asset: Asset, raw: Hex): Promise<string> {
  return jsonRpc<string>(asset.rpc!, 'eth_sendRawTransaction', [raw]);
}

function hexBytes(h: string): Uint8Array {
  const s = h.startsWith('0x') ? h.slice(2) : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
