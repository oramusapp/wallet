// EVM transfers (EIP-1559): the native coin or an ERC-20 token. Signing uses @noble with the key as bytes,
// so the private key never becomes a JS string and can be wiped after use.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { encodeFunctionData, erc20Abi, getAddress, isAddress, keccak256, serializeTransaction, type Hex, type TransactionSerializableEIP1559 } from 'viem';
import type { Asset } from '../assets';
import { jsonRpc } from '../balances';
import { formatAmount } from '../units';

const fmtEth = (v: bigint) => formatAmount(v, 18, 18);

export interface EvmQuote {
  /** Recipient shown to the user (for a token: the person, not the token contract). */
  to: `0x${string}`;
  /** Amount in the asset's units (token units for ERC-20). */
  value: bigint;
  /** What actually goes into the transaction. */
  txTo: `0x${string}`;
  txValue: bigint;
  data?: Hex;
  nonce: number;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  /** Worst-case fee in the native coin: gas * maxFeePerGas + L1 data fee (OP-stack). */
  maxFee: bigint;
  /** Expected fee at the current base fee (native coin). */
  fee: bigint;
  /** OP-stack L1 data fee included in fee/maxFee (0 elsewhere). */
  l1Fee: bigint;
  /** Balance of the asset being sent (token balance for ERC-20). */
  balance: bigint;
  /** Native coin balance that pays the fee. */
  nativeBalance: bigint;
  /** Recipient address has contract code. */
  toIsContract: boolean;
}

/** Strict: lower/upper-case-only addresses are accepted; mixed case must have a valid EIP-55 checksum. */
export function checkEvmAddress(a: string): `0x${string}` {
  const t = a.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(t)) throw new Error('To nie jest adres EVM (0x + 40 znaków).');
  if (!isAddress(t, { strict: true })) throw new Error('Błędna suma kontrolna adresu — sprawdź, czy nic nie zostało zmienione.');
  const g = getAddress(t);
  if (g === '0x0000000000000000000000000000000000000000') throw new Error('To adres zerowy — środki przepadłyby.');
  return g;
}

export function erc20TransferData(to: `0x${string}`, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] });
}

export async function quoteEvm(asset: Asset, from: string, toRaw: string, value: bigint): Promise<EvmQuote> {
  const to = checkEvmAddress(toRaw);
  const rpc = asset.rpc!;
  const isToken = asset.kind === 'erc20';
  if (isToken && to.toLowerCase() === asset.token!.toLowerCase()) throw new Error('To adres kontraktu tokena, nie odbiorcy. Tokeny wysłane tutaj przepadają.');
  const balanceOf = '0x70a08231' + from.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const [nonceHex, balHex, block, tipHex, chainHex, code, tokenHex] = await Promise.all([
    jsonRpc<string>(rpc, 'eth_getTransactionCount', [from, 'pending']),
    jsonRpc<string>(rpc, 'eth_getBalance', [from, 'latest']),
    jsonRpc<{ baseFeePerGas?: string }>(rpc, 'eth_getBlockByNumber', ['latest', false]),
    jsonRpc<string>(rpc, 'eth_maxPriorityFeePerGas', []).catch(() => '0x3b9aca00'),
    jsonRpc<string>(rpc, 'eth_chainId', []),
    jsonRpc<string>(rpc, 'eth_getCode', [to, 'latest']).catch(() => '0x'),
    isToken ? jsonRpc<string>(rpc, 'eth_call', [{ to: asset.token, data: balanceOf }, 'latest']) : Promise.resolve('0x0')
  ]);
  if (Number(BigInt(chainHex)) !== asset.evmChainId) throw new Error('Węzeł zwrócił inną sieć niż oczekiwana. Przerwano.');
  const nativeBalance = BigInt(balHex);
  const balance = isToken ? BigInt(tokenHex) : nativeBalance;
  const f = (v: bigint) => formatAmount(v, asset.decimals, asset.decimals);
  if (value > balance) throw new Error('Za mało środków. Masz ' + f(balance) + ' ' + asset.symbol + ', chcesz wysłać ' + f(value) + '.');

  const txTo = isToken ? (getAddress(asset.token!) as `0x${string}`) : to;
  const txValue = isToken ? 0n : value;
  const data = isToken ? erc20TransferData(to, value) : undefined;
  let gasHex: string;
  try { gasHex = await jsonRpc<string>(rpc, 'eth_estimateGas', [{ from, to: txTo, value: '0x' + txValue.toString(16), ...(data ? { data } : {}) }]); }
  catch (e) {
    const m = (e as Error).message;
    if (/insufficient funds/i.test(m)) throw new Error('Za mało ETH na opłatę sieci' + (isToken ? ' (opłatę za token płacisz w ETH).' : '.'));
    throw new Error('Sieć nie przyjmie tej transakcji: ' + m.slice(0, 160));
  }
  const base = BigInt(block.baseFeePerGas ?? '0x0');
  const tip = BigInt(tipHex);
  const maxFeePerGas = base * 2n + tip; // room for two full blocks of base-fee growth
  const gas = (BigInt(gasHex) * 12n + 9n) / 10n; // +20% headroom; unused gas is not charged
  const nonce = Number(BigInt(nonceHex));
  const tx: TransactionSerializableEIP1559 = { type: 'eip1559', chainId: asset.evmChainId!, nonce, to: txTo, value: txValue, gas, maxFeePerGas, maxPriorityFeePerGas: tip, data };
  const l1Fee = asset.opStack ? await opStackL1Fee(asset, tx) : 0n;
  const maxFee = gas * maxFeePerGas + l1Fee;
  const need = maxFee + txValue;
  if (need > nativeBalance) throw new Error('Za mało ETH: potrzeba ' + fmtEth(need) + ' ETH' + (isToken ? ' na opłatę' : ' razem z maks. opłatą') + ', masz ' + fmtEth(nativeBalance) + '.');
  return { to, value, txTo, txValue, data, nonce, gas, maxFeePerGas, maxPriorityFeePerGas: tip, maxFee, fee: gas * (base + tip) + l1Fee, l1Fee, balance, nativeBalance, toIsContract: !!code && code !== '0x' };
}

export function signEvm(asset: Asset, q: EvmQuote, privateKey: Uint8Array): Hex {
  const tx: TransactionSerializableEIP1559 = {
    type: 'eip1559', chainId: asset.evmChainId!, nonce: q.nonce, to: q.txTo, value: q.txValue, gas: q.gas,
    maxFeePerGas: q.maxFeePerGas, maxPriorityFeePerGas: q.maxPriorityFeePerGas, data: q.data
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
