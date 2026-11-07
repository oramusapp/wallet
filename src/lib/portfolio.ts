import type { Coin, CoinId } from '../config/coins';
import type { Holdings } from '../state/wallet';
import type { PriceMap } from './hyperliquid';

export interface Position {
  coin: Coin;
  amount: number;
  price: number | undefined;
  value: number;
  /** USD change over 24h for this position at current size. */
  delta24h: number;
}

export function positions(holdings: Holdings, prices: PriceMap, coins: Coin[], exclude: CoinId[] = []): Position[] {
  return coins.filter((c) => (holdings[c.id] ?? 0) > 0 && !exclude.includes(c.id))
    .map((coin) => {
      const amount = holdings[coin.id] ?? 0;
      const s = prices[coin.id];
      const price = s?.price;
      const value = price ? amount * price : 0;
      const delta24h = s ? amount * (s.price - s.prevDayPrice) : 0;
      return { coin, amount, price, value, delta24h };
    })
    .sort((a, b) => b.value - a.value);
}

export interface Totals {
  value: number;
  delta24h: number;
  /** percent */
  change24h: number;
}

export function totals(list: Position[]): Totals {
  const value = list.reduce((s, p) => s + p.value, 0);
  const delta24h = list.reduce((s, p) => s + p.delta24h, 0);
  const prev = value - delta24h;
  return { value, delta24h, change24h: prev > 0 ? (delta24h / prev) * 100 : 0 };
}

/**
 * Estimated market cap: Hyperliquid price × `approxSupply`, curated coins only.
 * Hyperliquid's own spot supply figures are not reliable enough for this
 * (wrapped assets and tokenized stocks report inflated totals), so other coins have none.
 */
export function marketCap(coin: Coin, prices: PriceMap): number | undefined {
  const p = prices[coin.id]?.price;
  return p && coin.approxSupply ? p * coin.approxSupply : undefined;
}

/** Sort key for market lists: market cap when known, otherwise 24h volume (ranked after MC coins). */
export function marketRank(coin: Coin, prices: PriceMap): [number, number] {
  return [marketCap(coin, prices) ?? 0, prices[coin.id]?.volume24h ?? 0];
}

export function compareMarkets(a: Coin, b: Coin, prices: PriceMap): number {
  const [ma, va] = marketRank(a, prices);
  const [mb, vb] = marketRank(b, prices);
  return mb - ma || vb - va;
}
