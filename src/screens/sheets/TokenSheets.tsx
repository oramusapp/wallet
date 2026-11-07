import { useMemo, useState } from 'react';
import { CASH_COIN, COIN_BY_ID } from '../../config/coins';
import { CoinIcon, IconButton, Pct, SearchField, SheetHeader, TokenCard, Toggle } from '../../components/ui';
import { fmtAmount, fmtUsd, fmtUsdDeltaPrecise, signClass, timeAgo } from '../../lib/format';
import { usePortfolio } from '../../state/hooks';
import { useNav } from '../../state/nav';
import { useWallet } from '../../state/wallet';

export function TokensSheet() {
  const nav = useNav();
  const { active } = useWallet();
  const pf = usePortfolio();
  return (
    <>
      <SheetHeader title="Tokens" onClose={nav.closeAll} right={<IconButton icon="sliders" label="Manage tokens" onClick={() => nav.push({ kind: 'manageTokens' })} />} />
      <div className="pad">
        <div className="balance">
          <div className="balance-value">{fmtUsd(pf.total.value)}</div>
          <div className="balance-delta">
            <span className={signClass(pf.total.delta24h)}>{fmtUsdDeltaPrecise(pf.total.delta24h)}</span>
            <Pct value={pf.total.change24h} badge />
          </div>
        </div>
        <div className="stack">
          {pf.all
            .filter((p) => p.coin.id === CASH_COIN || !active.hidden.includes(p.coin.id))
            .map((p) => (
              <TokenCard key={p.coin.id} p={p} onClick={() => nav.push({ kind: 'token', coin: p.coin.id })} />
            ))}
          {pf.isEmpty && <div className="empty">No tokens yet</div>}
        </div>
      </div>
    </>
  );
}

export function ManageTokensSheet() {
  const nav = useNav();
  const { active, dispatch } = useWallet();
  const pf = usePortfolio();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pf.tokens.filter((p) => !s || p.coin.symbol.toLowerCase().includes(s) || p.coin.name.toLowerCase().includes(s));
  }, [pf.tokens, q]);

  return (
    <>
      <SheetHeader title="Manage Tokens" onBack={nav.back} />
      <div className="pad stack">
        <SearchField value={q} onChange={setQ} />
        {list.map((p) => (
          <div key={p.coin.id} className="list-row static">
            <CoinIcon coin={p.coin} size={40} />
            <div className="col grow">
              <span className="row-title">{p.coin.name}</span>
              <span className="row-sub">{fmtAmount(p.amount, p.coin.symbol)}</span>
            </div>
            <Toggle on={!active.hidden.includes(p.coin.id)} label={`Show ${p.coin.name}`} onChange={() => dispatch({ type: 'toggleHidden', coin: p.coin.id })} />
          </div>
        ))}
        {list.length === 0 && <div className="empty">No tokens</div>}
      </div>
    </>
  );
}

export function HistorySheet() {
  const nav = useNav();
  const { state, active } = useWallet();
  const txs = state.txs.filter((t) => t.accountId === active.id);
  return (
    <>
      <SheetHeader title="History" onClose={nav.closeAll} />
      <div className="pad stack">
        {txs.length === 0 && <div className="empty">No activity yet</div>}
        {txs.map((t) => {
          const c = COIN_BY_ID[t.coin];
          const title = t.kind === 'send' ? `Sent ${c.symbol}` : t.kind === 'deposit' ? `Received ${c.symbol}` : `Swapped ${c.symbol} → ${COIN_BY_ID[t.toCoin].symbol}`;
          const sub = t.kind === 'send' ? `To ${t.to.length > 12 ? `${t.to.slice(0, 4)}…${t.to.slice(-4)}` : t.to}` : timeAgo(t.ts);
          return (
            <div key={t.id} className="list-row static">
              <CoinIcon coin={c} size={40} />
              <div className="col grow">
                <span className="row-title">{title}</span>
                <span className="row-sub">{t.kind === 'send' ? `${sub} · ${timeAgo(t.ts)}` : sub}</span>
              </div>
              <div className="col end">
                <span className={`row-title ${t.kind === 'deposit' ? 'up' : ''}`}>
                  {t.kind === 'swap' ? `+${fmtAmount(t.toAmount, COIN_BY_ID[t.toCoin].symbol)}` : `${t.kind === 'send' ? '-' : '+'}${fmtAmount(t.amount, c.symbol)}`}
                </span>
                <span className="row-sub">{fmtUsd(t.usd)}</span>
              </div>
            </div>
          );
        })}
        {txs.length > 0 && <p className="demo-note">Demo activity — stored only in this browser.</p>}
      </div>
    </>
  );
}
