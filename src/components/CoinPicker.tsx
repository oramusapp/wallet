import { useMemo, useState } from 'react';
import type { CoinId } from '../config/coins';
import { compareMarkets } from '../lib/portfolio';
import { fmtAmount, fmtPrice, fmtUsd } from '../lib/format';
import { usePrices } from '../state/prices';
import { useWallet } from '../state/wallet';
import { CoinIcon, SearchField, SheetHeader } from './ui';

interface Props {
  title: string;
  /** Only coins with a positive balance. */
  heldOnly?: boolean;
  exclude?: CoinId[];
  onPick: (c: CoinId) => void;
  onClose: () => void;
}

/** Full-screen overlay to choose a coin. */
export function CoinPicker({ title, heldOnly, exclude = [], onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const { active } = useWallet();
  const { prices, coins } = usePrices();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const held = (id: CoinId) => (active.holdings[id] ?? 0) > 0;
    return coins
      .filter((c) => !exclude.includes(c.id))
      .filter((c) => !heldOnly || held(c.id))
      .filter((c) => !s || c.symbol.toLowerCase().includes(s) || c.name.toLowerCase().includes(s))
      .sort((a, b) => Number(held(b.id)) - Number(held(a.id)) || compareMarkets(a, b, prices));
  }, [q, heldOnly, exclude, active.holdings, coins, prices]);

  return (
    <div className="overlay" role="dialog" aria-label={title}>
      <SheetHeader title={title} onClose={onClose} />
      <div className="pad">
        <SearchField value={q} onChange={setQ} autoFocus />
      </div>
      <div className="list scroll">
        {list.length === 0 && <div className="empty">No Assets</div>}
        {list.map((c) => {
          const bal = active.holdings[c.id] ?? 0;
          const p = prices[c.id]?.price;
          return (
            <button key={c.id} type="button" className="list-row" onClick={() => onPick(c.id)}>
              <CoinIcon coin={c} size={36} />
              <div className="col grow">
                <span className="row-title">
                  {c.symbol} <span className="muted small">{c.chain}</span>
                </span>
                <span className="row-sub">{bal > 0 ? fmtAmount(bal, c.symbol) : fmtPrice(p)}</span>
              </div>
              {bal > 0 && p !== undefined && <span className="row-title">{fmtUsd(bal * p)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
