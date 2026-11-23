// Minimum amounts, account reserves and typical network fees — read live from the network where possible.
import type { Asset } from './assets';
import { http, jsonRpc } from './balances';
import { formatAmount } from './units';
import { solRentMin, solTransferMessage } from './send/sol';
import { opStackL1Fee } from './send/evm';
import { base64 } from '@scure/base';

export interface Limits {
  /** Smallest amount the network will carry (smallest unit). */
  minSend: bigint;
  /** First payment to an empty account must be at least this (0 = no rule). */
  minNewAccount: bigint;
  /** What must stay on the sender's account (0 = may go to zero). */
  reserve: bigint;
  /** Typical fee for one transfer and, where it differs, the maximum the wallet allows. */
  fee?: bigint;
  feeMax?: bigint;
  feeLabel?: string;
  lines: string[];
}

export const BTC_DUST = 546n; // P2PKH dust threshold; the wallet uses it for every output (conservative)
export const BTC_TX_VBYTES = 141n; // 1 P2WPKH input, 2 P2WPKH outputs
export const HL_MIN_DEPOSIT_USDC = 5_000_000n; // 5 USDC (6 decimals) — Hyperliquid docs: smaller deposits are lost

export async function getLimits(asset: Asset, from: string): Promise<Limits> {
  const f = (v: bigint) => formatAmount(v, asset.decimals, asset.decimals) + ' ' + asset.symbol;
  switch (asset.kind) {
    case 'evm': {
      const rpc = asset.rpc!;
      const [block, tipHex, gasHex] = await Promise.all([
        jsonRpc<{ baseFeePerGas?: string }>(rpc, 'eth_getBlockByNumber', ['latest', false]),
        jsonRpc<string>(rpc, 'eth_maxPriorityFeePerGas', []).catch(() => '0x3b9aca00'),
        jsonRpc<string>(rpc, 'eth_estimateGas', [{ from, to: from, value: '0x0' }]).catch(() => '0x5208')
      ]);
      const base = BigInt(block.baseFeePerGas ?? '0x0'), tip = BigInt(tipHex);
      const gas = (BigInt(gasHex) * 12n + 9n) / 10n;
      let l1 = 0n;
      if (asset.opStack) {
        try { l1 = await opStackL1Fee(asset, { type: 'eip1559', chainId: asset.evmChainId!, nonce: 1, to: from as `0x${string}`, value: 1n, gas, maxFeePerGas: base * 2n + tip, maxPriorityFeePerGas: tip }); } catch { /* shown without L1 part */ }
      }
      const fee = gas * (base + tip) + l1, feeMax = gas * (base * 2n + tip) + l1;
      return { minSend: 1n, minNewAccount: 0n, reserve: 0n, fee, feeMax, feeLabel: 'gas ' + gas + ' × ' + gwei(base + tip) + ' gwei',
        lines: ['Sieć nie ma minimalnej kwoty.', 'Opłatę (gas) płacisz w ETH tej sieci: zwykle ' + f(fee) + ', maksymalnie ' + f(feeMax) + '.'].concat(l1 ? ['W tym opłata za zapis w Ethereum (L1): ' + f(l1) + '.'] : []) };
    }
    case 'btc': {
      const r = await http(asset.rpc + '/v1/fees/recommended');
      const rate = BigInt(Math.max(1, Math.ceil(Number((await r.json()).halfHourFee) || 1)));
      const fee = rate * BTC_TX_VBYTES;
      return { minSend: BTC_DUST, minNewAccount: 0n, reserve: 0n, fee, feeLabel: rate + ' sat/vB × ok. ' + BTC_TX_VBYTES + ' vB',
        lines: ['Minimum: ' + f(BTC_DUST) + ' (546 sat — mniejszej kwoty sieć nie przekaże).', 'Opłata: ok. ' + f(fee) + ' (' + rate + ' sat/vB); rośnie z liczbą wpłat, z których składa się transakcja.'] };
    }
    case 'sol': {
      const rent = await solRentMin(asset);
      let fee = 5000n;
      try {
        const bh = await jsonRpc<{ value: { blockhash: string } }>(asset.rpc!, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
        const msg = solTransferMessage(from, from, 1n, bh.value.blockhash);
        const v = await jsonRpc<{ value: number | null }>(asset.rpc!, 'getFeeForMessage', [base64.encode(msg), { commitment: 'confirmed' }]);
        if (v.value != null) fee = BigInt(v.value);
      } catch { /* keep the protocol base fee */ }
      return { minSend: 1n, minNewAccount: rent, reserve: rent, fee,
        lines: ['Pusty adres odbiorcy: pierwsza wpłata min. ' + f(rent) + ' (rezerwa konta w sieci Solana).', 'Na Twoim koncie musi zostać 0 albo min. ' + f(rent) + '.', 'Opłata: ' + f(fee) + '.'] };
    }
    case 'xlm': {
      const r = await http(asset.rpc + '/ledgers?order=desc&limit=1');
      const rec = (await r.json())._embedded.records[0];
      const baseReserve = BigInt(rec.base_reserve_in_stroops), fee = BigInt(rec.base_fee_in_stroops);
      const minAcc = baseReserve * 2n;
      return { minSend: 1n, minNewAccount: minAcc, reserve: minAcc, fee,
        lines: ['Nowe konto Stellar powstaje przy pierwszej wpłacie min. ' + f(minAcc) + '.', 'Na koncie musi zostać min. ' + f(minAcc) + ' (+ ' + f(baseReserve) + ' za każdy dodatkowy token).', 'Opłata: ' + f(fee) + '.'] };
    }
    case 'algo': {
      const [pR, aR] = await Promise.all([http(asset.rpc + '/v2/transactions/params'), http(asset.rpc + '/v2/accounts/' + from + '?exclude=all')]);
      const p = await pR.json(); const a = aR.ok ? await aR.json() : null;
      const fee = BigInt(p['min-fee'] ?? 1000), minAcc = 100_000n, mine = BigInt(a?.['min-balance'] ?? 100_000);
      return { minSend: 0n, minNewAccount: minAcc, reserve: mine, fee,
        lines: ['Pusty adres odbiorcy: pierwsza wpłata min. ' + f(minAcc) + '.', 'Na Twoim koncie musi zostać min. ' + f(mine) + ' (rośnie z liczbą tokenów).', 'Opłata: ' + f(fee) + '.'] };
    }
    case 'hl':
      return { minSend: HL_MIN_DEPOSIT_USDC, minNewAccount: 0n, reserve: 0n,
        lines: ['Wpłata na Hyperliquid (most z Arbitrum): min. 5 USDC — mniejsza kwota przepada (dokumentacja Hyperliquid).'] };
    case 'sui':
    case 'apt':
      return { minSend: 1n, minNewAccount: 0n, reserve: 0n, lines: ['Brak minimalnej kwoty. Opłatę płacisz w ' + asset.symbol + '.'] };
    default:
      return { minSend: 0n, minNewAccount: 0n, reserve: 0n, lines: [] };
  }
}

function gwei(wei: bigint): string {
  return formatAmount(wei, 9, 3);
}
