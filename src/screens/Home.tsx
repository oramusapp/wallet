import { useMemo, useState } from 'react';
import { MARKET_FILTERS, matchesFilter, type MarketFilter } from '../config/coins';
import { fmtUsd, fmtUsdDeltaPrecise, signClass } from '../lib/format';
import { compareMarkets, marketCap } from '../lib/portfolio';
import { usePortfolio } from '../state/hooks';
import { useNav } from '../state/nav';
import { usePrices } from '../state/prices';
import { useWallet } from '../state/wallet';
import { Button, Chip, Icon, MarketRow, Pct, SectionTitle, Skeleton, TokenCard } from '../components/ui';


export function Home() {
  const { active, state } = useWallet();
  const { prices, status, coins } = usePrices();
  const nav = useNav();
  const pf = usePortfolio();
  const [filter, setFilter] = useState<MarketFilter>('all');
  const loading = status === 'loading';

  const markets = useMemo(() => {
    const list = coins.filter((c) => matchesFilter(c, filter, state.favorites));
    return list.sort((a, b) => compareMarkets(a, b, prices)).slice(0, 6);
  }, [filter, prices, state.favorites, coins]);

  return (
    <div className="screen">
      <button type="button" className="account-name" onClick={() => nav.open({ kind: 'accounts' })}>
        {active.name} <Icon name="chevronDown" size={14} />
      </button>

      {loading ? (
        <Skeleton h={70} />
      ) : (
        <div className="balance">
          <div className="balance-value">{fmtUsd(pf.total.value)}</div>
          <div className="balance-delta">
            <span className={signClass(pf.total.delta24h)}>{fmtUsdDeltaPrecise(pf.total.delta24h)}</span>
            <Pct value={pf.total.change24h} badge />
          </div>
        </div>
      )}

      {pf.isEmpty && !loading ? (
        <div className="welcome card">
          <div className="welcome-art" aria-hidden="true">
            {['btc', 'eth', 'sol', 'hype'].map((c) => (
              <img key={c} src={`./coins/${c}.png`} alt="" />
            ))}
          </div>
          <h3>Welcome to Oramus</h3>
          <p>Fund your account to start trading.</p>
          <Button onClick={() => nav.open({ kind: 'deposit' })}>Deposit</Button>
        </div>
      ) : (
        <>
          <div className="action-row">
            <Button variant="secondary" onClick={() => nav.open({ kind: 'send' })}>
              <Icon name="send" size={16} filled /> Send
            </Button>
            <Button variant="secondary" onClick={() => nav.open({ kind: 'deposit' })}>
              <Icon name="plus" size={16} /> Deposit
            </Button>
          </div>

          <button type="button" className="cash-row card" onClick={() => nav.open({ kind: 'cash' })}>
            <Icon name="cash" />
            <span className="row-title grow">Cash</span>
            <span className="row-title">{fmtUsd(pf.cashValue)}</span>
          </button>

          {pf.visibleTokens.length > 0 && (
            <section>
              <SectionTitle onClick={() => nav.open({ kind: 'tokens' })}>Tokens</SectionTitle>
              <div className="stack">
                {pf.visibleTokens.map((p) => (
                  <TokenCard key={p.coin.id} p={p} onClick={() => nav.open({ kind: 'token', coin: p.coin.id })} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section>
        <SectionTitle onClick={() => nav.setTab('markets')}>Explore Markets</SectionTitle>
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
        <div className="list">
          {loading
            ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h={56} />)
            : markets.map((c) => (
                <MarketRow key={c.id} coin={c} stats={prices[c.id]} mc={marketCap(c, prices)} onClick={() => nav.open({ kind: 'token', coin: c.id })} />
              ))}
          {!loading && markets.length === 0 && <div className="empty small">No favorites yet — tap ♥ on a token.</div>}
        </div>
        <button type="button" className="show-more" onClick={() => nav.setTab('markets')}>
          Show More
        </button>
      </section>
    </div>
  );
}
