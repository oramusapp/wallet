import { useMemo, useState } from 'react';
import { COINS, MARKET_FILTERS } from '../config/coins';
import { marketCap } from '../lib/portfolio';
import { useNav } from '../state/nav';
import { usePrices } from '../state/prices';
import { useWallet } from '../state/wallet';
import { Chip, Icon, MarketRow, Skeleton } from '../components/ui';

type Filter = (typeof MARKET_FILTERS)[number]['id'];
type Sort = 'mc' | 'gainers' | 'losers' | 'volume';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'mc', label: 'Market cap' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
  { id: 'volume', label: 'Volume' },
];

export function Markets({ query }: { query: string }) {
  const { prices, status } = usePrices();
  const { state } = useWallet();
  const nav = useNav();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('mc');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = COINS.filter((c) => (filter === 'all' ? true : filter === 'fav' ? state.favorites.includes(c.id) : c.category === filter)).filter(
      (c) => !q || c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
    const ch = (id: (typeof items)[number]['id']) => prices[id]?.change24h ?? 0;
    return items.sort((a, b) => {
      switch (sort) {
        case 'gainers':
          return ch(b.id) - ch(a.id);
        case 'losers':
          return ch(a.id) - ch(b.id);
        case 'volume':
          return (prices[b.id]?.volume24h ?? 0) - (prices[a.id]?.volume24h ?? 0);
        default:
          return (marketCap(b, prices) ?? 0) - (marketCap(a, prices) ?? 0);
      }
    });
  }, [query, filter, sort, prices, state.favorites]);

  return (
    <div className="screen">
      <h1 className="screen-title">Explore Markets</h1>
      <div className="chips">
        <Chip active={filter === 'fav'} onClick={() => setFilter(filter === 'fav' ? 'all' : 'fav')}>
          <Icon name="heart" size={14} filled={filter === 'fav'} />
        </Chip>
        {MARKET_FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="chips sorts">
        {SORTS.map((s) => (
          <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>
      <div className="list">
        {status === 'loading'
          ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={56} />)
          : list.map((c) => (
              <MarketRow key={c.id} coin={c} stats={prices[c.id]} mc={marketCap(c, prices)} onClick={() => nav.open({ kind: 'token', coin: c.id })} />
            ))}
        {status !== 'loading' && list.length === 0 && <div className="empty">No Assets</div>}
      </div>
      <p className="footnote">
        Prices: Hyperliquid (perp mid; USDT = USDT0/USDC spot; USDC = $1 quote asset). MC is an estimate: Hyperliquid price × approximate circulating supply.
      </p>
    </div>
  );
}
