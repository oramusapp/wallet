import { COINS, type Coin, type CoinId } from '../config/coins';
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

export function positions(holdings: Holdings, prices: PriceMap, exclude: CoinId[] = []): Position[] {
  return COINS.filter((c) => (holdings[c.id] ?? 0) > 0 && !exclude.includes(c.id))
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

export function marketCap(coin: Coin, prices: PriceMap): number | undefined {
  const p = prices[coin.id]?.price;
  return p ? p * coin.approxSupply : undefined;
}
