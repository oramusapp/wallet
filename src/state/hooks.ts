import { useMemo } from 'react';
import { CASH_COIN } from '../config/coins';
import { positions, totals } from '../lib/portfolio';
import { usePrices } from './prices';
import { useWallet } from './wallet';

/** Active account portfolio, split the way the home screen shows it. */
export function usePortfolio() {
  const { active } = useWallet();
  const { prices } = usePrices();
  return useMemo(() => {
    const all = positions(active.holdings, prices);
    const cash = all.find((p) => p.coin.id === CASH_COIN);
    const tokens = all.filter((p) => p.coin.id !== CASH_COIN);
    const visibleTokens = tokens.filter((p) => !active.hidden.includes(p.coin.id));
    const visibleAll = all.filter((p) => !active.hidden.includes(p.coin.id) || p.coin.id === CASH_COIN);
    return {
      all,
      cash,
      cashValue: cash?.value ?? 0,
      tokens,
      visibleTokens,
      total: totals(visibleAll),
      isEmpty: all.length === 0,
    };
  }, [active, prices]);
}
