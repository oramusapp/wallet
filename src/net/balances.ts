// Read-only balance queries. Every function returns the balance in the asset's smallest unit.
import type { Asset } from './assets';
import { decimalStringToUnits } from './units';
import { utxoBalance } from './send/utxo';

const TIMEOUT_MS = 15_000;

export async function http(url: string, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

export async function jsonRpc<T>(url: string, method: string, params: unknown[] | Record<string, unknown>): Promise<T> {
  const r = await http(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (!r.ok) throw new Error(method + ': HTTP ' + r.status);
  const j = await r.json();
  if (j.error) throw new Error(method + ': ' + (j.error.message || JSON.stringify(j.error)));
  return j.result as T;
}

async function getJson(url: string, okMissing = false): Promise<any | null> {
  const r = await http(url);
  if (okMissing && r.status === 404) return null;
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function fetchBalance(asset: Asset, address: string): Promise<bigint> {
  const rpc = asset.rpc!;
  switch (asset.kind) {
    case 'evm':
      return BigInt(await jsonRpc<string>(rpc, 'eth_getBalance', [address, 'latest']));
    case 'erc20': {
      const data = '0x70a08231' + address.toLowerCase().replace(/^0x/, '').padStart(64, '0'); // balanceOf(address)
      return BigInt(await jsonRpc<string>(rpc, 'eth_call', [{ to: asset.token, data }, 'latest']));
    }
    case 'hl': {
      const post = (type: string) => http(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, user: address }) }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      const [perp, spot] = await Promise.all([post('clearinghouseState'), post('spotClearinghouseState')]);
      const perpV = decimalStringToUnits(perp?.marginSummary?.accountValue ?? '0', asset.decimals);
      const usdc = (spot?.balances ?? []).find((b: any) => b.coin === 'USDC');
      return perpV + decimalStringToUnits(usdc?.total ?? '0', asset.decimals);
    }
    case 'utxo':
      return utxoBalance(asset.utxo!, address);
    case 'sol':
      return BigInt((await jsonRpc<{ value: number }>(rpc, 'getBalance', [address, { commitment: 'confirmed' }])).value);
    case 'sui': {
      // Sui retired JSON-RPC on public nodes; GraphQL instead. The address is checked by the caller (0x + 64 hex).
      if (!/^0x[0-9a-f]{64}$/.test(address)) throw new Error('Zły adres Sui');
      const r = await http(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '{ address(address: "' + address + '") { balance(coinType: "0x2::sui::SUI") { totalBalance } } }' }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.errors?.length) throw new Error(j.errors[0].message);
      return BigInt(j.data?.address?.balance?.totalBalance ?? '0');
    }
    case 'apt': {
      const j = await getJson(rpc + '/accounts/' + address + '/balance/0x1::aptos_coin::AptosCoin', true);
      return j == null ? 0n : BigInt(j);
    }
    case 'near': {
      try {
        const r = await jsonRpc<{ amount: string }>(rpc, 'query', { request_type: 'view_account', finality: 'final', account_id: address });
        return BigInt(r.amount);
      } catch (e) {
        if (/does not exist|UNKNOWN_ACCOUNT/i.test((e as Error).message)) return 0n;
        throw e;
      }
    }
    case 'xlm': {
      const j = await getJson(rpc + '/accounts/' + address, true);
      if (!j) return 0n;
      const n = (j.balances ?? []).find((b: any) => b.asset_type === 'native');
      return decimalStringToUnits(n?.balance ?? '0', asset.decimals);
    }
    case 'algo': {
      const j = await getJson(rpc + '/v2/accounts/' + address + '?exclude=all', true);
      return j == null ? 0n : BigInt(j.amount);
    }
    default:
      throw new Error('Brak salda dla tej sieci');
  }
}
