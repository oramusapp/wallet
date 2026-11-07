import { useState } from 'react';
import { COIN_BY_ID, type CoinId } from '../../config/coins';
import { PriceChart } from '../../components/PriceChart';
import { CoinIcon, Icon, Pct, SheetHeader } from '../../components/ui';
import { fmtAmount, fmtCompactUsd, fmtPct, fmtPrice, fmtUsd, fmtUsdDelta, signClass, trendClass } from '../../lib/format';
import { marketCap } from '../../lib/portfolio';
import { useNav } from '../../state/nav';
import { usePrices } from '../../state/prices';
import { useWallet } from '../../state/wallet';

export function TokenDetailSheet({ coinId }: { coinId: CoinId }) {
  const coin = COIN_BY_ID[coinId];
  const nav = useNav();
  const { prices } = usePrices();
  const { active, state, dispatch } = useWallet();
  const [scrub, setScrub] = useState<{ price: number; change: number } | null>(null);
  const stats = prices[coinId];
  const bal = active.holdings[coinId] ?? 0;
  const fav = state.favorites.includes(coinId);
  const src = coin.source;
  const sourceLabel = src.kind === 'perp' ? `${src.market}-USD perp` : src.kind === 'spot' ? 'USDT0/USDC spot' : 'Quote asset ($1)';
  const shownPrice = scrub?.price ?? stats?.price;
  const shownChange = scrub ? scrub.change : stats?.change24h;

  return (
    <>
      <SheetHeader
        title={coin.name}
        onBack={nav.stack.length > 1 ? nav.back : undefined}
        onClose={nav.stack.length > 1 ? undefined : nav.closeAll}
        right={
          <button type="button" className={`icon-btn${fav ? ' fav' : ''}`} aria-pressed={fav} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} onClick={() => dispatch({ type: 'toggleFavorite', coin: coinId })}>
            <Icon name="heart" filled={fav} />
          </button>
        }
      />
      <div className="pad">
        <div className="detail-head">
          <CoinIcon coin={coin} size={40} />
          <span className="muted">{coin.symbol}</span>
        </div>
        <div className="balance">
          <div className="balance-value">{fmtPrice(shownPrice)}</div>
          <div className="balance-delta">
            <Pct value={shownChange} />
            <span className="muted small">{scrub ? '' : '24h'}</span>
          </div>
        </div>
        <PriceChart coin={coin} livePrice={stats?.price} onScrub={setScrub} />

        <div className="action-grid">
          <button type="button" onClick={() => nav.push({ kind: 'send', coin: coinId })} disabled={bal <= 0}>
            <Icon name="send" filled />
            Send
          </button>
          <button type="button" onClick={() => nav.push({ kind: 'receive', coin: coinId })}>
            <Icon name="receive" />
            Receive
          </button>
          <button type="button" onClick={() => nav.goSwap(bal > 0 ? { from: coinId } : { to: coinId })}>
            <Icon name="swap" />
            {bal > 0 ? 'Swap' : 'Buy'}
          </button>
        </div>

        {bal > 0 && stats && (
          <>
            <h2 className="section-title">Your Balance</h2>
            <div className="token-card static">
              <CoinIcon coin={coin} />
              <div className="col grow">
                <span className="row-title">{coin.name}</span>
                <span className="row-sub">{fmtAmount(bal, coin.symbol)}</span>
              </div>
              <div className="col end">
                <span className="row-title">{fmtUsd(bal * stats.price)}</span>
                <span className={`row-sub ${signClass(bal * (stats.price - stats.prevDayPrice))}`}>{fmtUsdDelta(bal * (stats.price - stats.prevDayPrice))}</span>
              </div>
            </div>
          </>
        )}

        <h2 className="section-title">Info</h2>
        <div className="kv card">
          <div>
            <span>Market cap (est.)</span>
            <span>{fmtCompactUsd(marketCap(coin, prices))}</span>
          </div>
          <div>
            <span>24h change</span>
            <span className={trendClass(stats?.change24h)}>{fmtPct(stats?.change24h)}</span>
          </div>
          {stats && stats.volume24h > 0 && (
            <div>
              <span>24h volume (Hyperliquid)</span>
              <span>{fmtCompactUsd(stats.volume24h)}</span>
            </div>
          )}
          {stats?.openInterestUsd !== undefined && Number.isFinite(stats.openInterestUsd) && (
            <div>
              <span>Open interest</span>
              <span>{fmtCompactUsd(stats.openInterestUsd)}</span>
            </div>
          )}
          {stats?.funding !== undefined && Number.isFinite(stats.funding) && (
            <div>
              <span>Funding (1h)</span>
              <span>{(stats.funding * 100).toFixed(4)}%</span>
            </div>
          )}
          <div>
            <span>Network</span>
            <span>{coin.chain}</span>
          </div>
          <div>
            <span>Price source</span>
            <span>Hyperliquid · {sourceLabel}</span>
          </div>
        </div>
      </div>
    </>
  );
}
