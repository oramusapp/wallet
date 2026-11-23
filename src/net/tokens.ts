// Custom ERC-20 tokens added by the user by contract address. Metadata is read on-chain, never typed in.
import { decodeFunctionResult, encodeFunctionData, erc20Abi } from 'viem';
import { erc20, assetById, type Asset } from './assets';
import { jsonRpc } from './balances';
import { checkEvmAddress } from './send/evm';

export interface StoredToken { net: 'testnet' | 'mainnet'; parentId: string; token: string; symbol: string; name: string; decimals: number }

async function call(parent: Asset, token: string, fn: 'symbol' | 'name' | 'decimals'): Promise<unknown> {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: fn } as any);
  const r = await jsonRpc<`0x${string}`>(parent.rpc!, 'eth_call', [{ to: token, data }, 'latest']);
  return decodeFunctionResult({ abi: erc20Abi, functionName: fn, data: r } as any);
}

export async function readTokenMeta(parent: Asset, address: string): Promise<StoredToken> {
  const token = checkEvmAddress(address);
  const code = await jsonRpc<string>(parent.rpc!, 'eth_getCode', [token, 'latest']);
  if (!code || code === '0x') throw new Error('Pod tym adresem nie ma kontraktu w sieci ' + parent.network + '.');
  let symbol: string, name: string, decimals: number;
  try {
    [symbol, name, decimals] = await Promise.all([call(parent, token, 'symbol') as Promise<string>, call(parent, token, 'name') as Promise<string>, call(parent, token, 'decimals') as Promise<number>]);
  } catch { throw new Error('To nie wygląda na token ERC-20 (brak symbolu, nazwy albo liczby miejsc po przecinku).'); }
  if (!/^[\x20-\x7e]{1,16}$/.test(symbol) || decimals > 36) throw new Error('Nietypowe dane tokena — nie dodano.');
  return { net: parent.net, parentId: parent.id, token, symbol, name: String(name).slice(0, 40), decimals: Number(decimals) };
}

export function tokenToAsset(t: StoredToken): Asset | null {
  const parent = assetById(t.parentId);
  if (!parent) return null;
  return erc20(parent, 'tok-' + t.parentId + '-' + t.token.toLowerCase(), t.symbol, t.name, t.decimals, t.token, '#8a7dff', true);
}
