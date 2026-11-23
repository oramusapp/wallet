// Minimum amounts, account reserves and typical network fees — read live from the network where possible.
import type { Asset } from './assets';
import { http, jsonRpc } from './balances';
import { formatAmount } from './units';
import { solRentMin, solTransferMessage } from './send/sol';
import { erc20TransferData, opStackL1Fee } from './send/evm';
import { utxoFeeRate } from './send/utxo';
import { APT_MAX_GAS } from './send/apt';
import { suiBudget } from './send/sui';
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

export const HL_MIN_DEPOSIT_USDC = 5_000_000n; // 5 USDC (6 decimals) — Hyperliquid docs: smaller deposits are lost

export async function getLimits(asset: Asset, from: string): Promise<Limits> {
  const f = (v: bigint) => formatAmount(v, asset.decimals, asset.decimals) + ' ' + asset.symbol;
  switch (asset.kind) {
    case 'evm':
    case 'erc20': {
      const rpc = asset.rpc!;
      const isToken = asset.kind === 'erc20';
      const NS = asset.feeSymbol ?? asset.symbol;
      const fe = (v: bigint) => formatAmount(v, 18, 18) + ' ' + NS;
      const [block, tipHex, gasHex] = await Promise.all([
        jsonRpc<{ baseFeePerGas?: string }>(rpc, 'eth_getBlockByNumber', ['latest', false]),
        jsonRpc<string>(rpc, 'eth_maxPriorityFeePerGas', []).catch(() => '0x3b9aca00'),
        isToken
          ? jsonRpc<string>(rpc, 'eth_estimateGas', [{ from, to: asset.token, value: '0x0', data: erc20TransferData(from as `0x${string}`, 0n) }]).catch(() => '0xea60')
          : jsonRpc<string>(rpc, 'eth_estimateGas', [{ from, to: from, value: '0x0' }]).catch(() => '0x5208')
      ]);
      const base = BigInt(block.baseFeePerGas ?? '0x0'), tip = BigInt(tipHex);
      const gas = (BigInt(gasHex) * 12n + 9n) / 10n;
      let l1 = 0n;
      if (asset.opStack) {
        try { l1 = await opStackL1Fee(asset, { type: 'eip1559', chainId: asset.evmChainId!, nonce: 1, to: from as `0x${string}`, value: 1n, gas, maxFeePerGas: base * 2n + tip, maxPriorityFeePerGas: tip }); } catch { /* shown without L1 part */ }
      }
      const fee = gas * (base + tip) + l1, feeMax = gas * (base * 2n + tip) + l1;
      return { minSend: 1n, minNewAccount: 0n, reserve: 0n, fee, feeMax, feeLabel: 'gas ' + gas + ' × ' + gwei(base + tip) + ' gwei',
        lines: [isToken ? 'Token nie ma minimalnej kwoty.' : 'Sieć nie ma minimalnej kwoty.', 'Opłatę (gas) płacisz w ' + NS + ' tej sieci: zwykle ' + fe(fee) + ', maksymalnie ' + fe(feeMax) + '.']
          .concat(l1 ? ['W tym opłata za zapis w Ethereum (L1): ' + fe(l1) + '.'] : [])
          .concat(isToken ? ['Do wysłania ' + asset.symbol + ' potrzebujesz też trochę ' + NS + ' w tej sieci.'] : []) };
    }
    case 'utxo': {
      const cfg = asset.utxo!;
      const rate = await utxoFeeRate(cfg);
      const vb = cfg.segwit ? 141n : 226n; // 1 input + 2 outputs: P2WPKH ~141 vB, P2PKH ~226 B
      const fee = rate * vb;
      return { minSend: cfg.dust, minNewAccount: 0n, reserve: 0n, fee, feeLabel: rate + ' sat/' + (cfg.segwit ? 'vB' : 'B') + ' × ok. ' + vb,
        lines: ['Minimum: ' + f(cfg.dust) + ' (mniejszej kwoty sieć nie przekaże).', 'Opłata: ok. ' + f(fee) + ' (' + rate + ' sat/' + (cfg.segwit ? 'vB' : 'bajt') + '); rośnie z liczbą wpłat, z których składa się transakcja.'] };
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
    case 'apt': {
      const r = await http(asset.rpc + '/estimate_gas_price');
      const gp = BigInt((await r.json()).gas_estimate ?? 100);
      const feeMax = APT_MAX_GAS * gp, fee = 60n * gp; // a plain transfer used 52 gas units on testnet (checked 23.11.2026)
      return { minSend: 1n, minNewAccount: 0n, reserve: 0n, fee, feeMax,
        lines: ['Brak minimalnej kwoty; transfer sam tworzy konto odbiorcy, jeśli go nie ma.', 'Opłata: zwykle ok. ' + f(fee) + ', maksymalnie ' + f(feeMax) + ' (limit ' + APT_MAX_GAS + ' jednostek gazu × ' + gp + ').'] };
    }
    case 'near': {
      const rpc = asset.rpc!;
      const [gp, cfg, me] = await Promise.all([
        jsonRpc<{ gas_price: string }>(rpc, 'gas_price', [null]),
        jsonRpc<{ runtime_config: { storage_amount_per_byte: string } }>(rpc, 'EXPERIMENTAL_protocol_config', { finality: 'final' }),
        jsonRpc<{ storage_usage?: number }>(rpc, 'query', { request_type: 'view_account', finality: 'final', account_id: from }).catch(() => ({ storage_usage: undefined }))
      ]);
      const perByte = BigInt(cfg.runtime_config.storage_amount_per_byte);
      const feeMax = 3_000_000_000_000n * BigInt(gp.gas_price), minNew = 182n * perByte;
      const reserve = me.storage_usage !== undefined ? BigInt(me.storage_usage) * perByte : minNew;
      const fn = (v: bigint) => formatAmount(v, 24, 6) + ' NEAR';
      return { minSend: 1n, minNewAccount: minNew, reserve, fee: feeMax, feeMax,
        lines: ['Nowe konto ukryte (64 znaki hex): pierwsza wpłata min. ok. ' + fn(minNew) + ' (opłata za przechowywanie konta).', 'Na Twoim koncie musi zostać ' + fn(reserve) + ' (przechowywanie danych konta).', 'Opłata: maks. ' + fn(feeMax) + ' (zwykle mniej; nadwyżka gazu wraca).'] };
    }
    case 'sui': {
      const r = await http(asset.rpc!, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '{ epoch { referenceGasPrice } }' }) });
      const gp = BigInt((await r.json()).data.epoch.referenceGasPrice);
      const feeMax = suiBudget(gp);
      return { minSend: 1n, minNewAccount: 0n, reserve: 0n, fee: feeMax, feeMax,
        lines: ['Brak minimalnej kwoty.', 'Opłata: maks. ' + f(feeMax) + ' (budżet gazu; niewykorzystana część wraca).'] };
    }
    default:
      return { minSend: 0n, minNewAccount: 0n, reserve: 0n, lines: [] };
  }
}

function gwei(wei: bigint): string {
  return formatAmount(wei, 9, 3);
}
