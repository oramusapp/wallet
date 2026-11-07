import { useMemo } from 'react';
import { isCash } from '../config/coins';
import { positions, totals } from '../lib/portfolio';
import { usePrices } from './prices';
import { useWallet } from './wallet';

/** Active account portfolio, split the way the home screen shows it. */
export function usePortfolio() {
  const { active } = useWallet();
  const { prices } = usePrices();
  return useMemo(() => {
    const all = positions(active.holdings, prices);
    const cash = all.filter((p) => isCash(p.coin.id));
    const tokens = all.filter((p) => !isCash(p.coin.id));
    const visibleTokens = tokens.filter((p) => !active.hidden.includes(p.coin.id));
    const visibleAll = [...cash, ...visibleTokens];
    return {
      all,
      cash,
      cashValue: totals(cash).value,
      cashDelta: totals(cash).delta24h,
      tokens,
      visibleTokens,
      total: totals(visibleAll),
      isEmpty: all.length === 0,
    };
  }, [active, prices]);
}
