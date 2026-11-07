import { useMemo, useState } from 'react';
import { MARKET_FILTERS, matchesFilter, type MarketFilter } from '../config/coins';
import { compareMarkets, marketCap } from '../lib/portfolio';
import { useNav } from '../state/nav';
import { usePrices } from '../state/prices';
import { useWallet } from '../state/wallet';
import { Chip, Icon, MarketRow, Skeleton } from '../components/ui';

type Sort = 'mc' | 'gainers' | 'losers' | 'volume';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'mc', label: 'Market cap' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
  { id: 'volume', label: 'Volume' },
];

export function Markets({ query }: { query: string }) {
  const { prices, status, coins } = usePrices();
  const { state } = useWallet();
  const nav = useNav();
  const [filter, setFilter] = useState<MarketFilter>('all');
  const [sort, setSort] = useState<Sort>('mc');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = coins.filter((c) => matchesFilter(c, filter, state.favorites)).filter(
      (c) => !q || c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
    const ch = (id: string) => prices[id]?.change24h ?? 0;
    return items.sort((a, b) => {
      switch (sort) {
        case 'gainers':
          return ch(b.id) - ch(a.id);
        case 'losers':
          return ch(a.id) - ch(b.id);
        case 'volume':
          return (prices[b.id]?.volume24h ?? 0) - (prices[a.id]?.volume24h ?? 0);
        default:
          return compareMarkets(a, b, prices);
      }
    });
  }, [query, filter, sort, prices, state.favorites, coins]);

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
      {status !== 'loading' && <div className="muted small">{list.length} tokens · Hyperliquid</div>}
      <div className="list">
        {status === 'loading'
          ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={56} />)
          : list.map((c) => (
              <MarketRow key={c.id} coin={c} stats={prices[c.id]} mc={marketCap(c, prices)} onClick={() => nav.open({ kind: 'token', coin: c.id })} />
            ))}
        {status !== 'loading' && list.length === 0 && <div className="empty">No Assets</div>}
      </div>
      <p className="footnote">
        All tokens listed on Hyperliquid: every active perp and every USDC spot pair that traded in the last 24h. Prices are Hyperliquid mid prices
        (USDT = USDT0/USDC spot; USDC = $1 quote asset). MC is an estimate (price × approximate circulating supply) for the main coins; for the rest, Hyperliquid 24h volume is shown instead.
      </p>
    </div>
  );
}
