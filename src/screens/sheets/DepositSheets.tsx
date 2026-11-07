import { useState } from 'react';
import { CASH_COIN, COIN_BY_ID, isCash, type CoinId } from '../../config/coins';
import { CoinPicker } from '../../components/CoinPicker';
import { Button, CoinIcon, Icon, SheetHeader } from '../../components/ui';
import { parseAmount, sanitizeAmountInput } from '../../lib/amount';
import { fmtAmount, fmtPrice, fmtUsd } from '../../lib/format';
import { useNav } from '../../state/nav';
import { usePrices } from '../../state/prices';
import { useWallet } from '../../state/wallet';

export function DepositSheet() {
  const nav = useNav();
  return (
    <>
      <SheetHeader title="Deposit" onClose={nav.back} />
      <div className="pad stack">
        <button type="button" className="option-row card" onClick={() => nav.replace({ kind: 'receive', coin: CASH_COIN })}>
          <span className="option-icon">
            <Icon name="card" />
          </span>
          <div className="col grow">
            <span className="row-title">Add Cash</span>
            <span className="row-sub">Add USDC or USDT to your Cash balance</span>
          </div>
          <Icon name="chevronRight" size={18} />
        </button>
        <button type="button" className="option-row card" onClick={() => nav.replace({ kind: 'receive' })}>
          <span className="option-icon">
            <Icon name="receive" />
          </span>
          <div className="col grow">
            <span className="row-title">Receive Crypto</span>
            <span className="row-sub">Add any supported token</span>
          </div>
          <Icon name="chevronRight" size={18} />
        </button>
        <p className="demo-note">Demo wallet: deposits are recorded locally in this browser. No real funds or on-chain addresses are involved.</p>
      </div>
    </>
  );
}

export function ReceiveSheet({ initialCoin }: { initialCoin?: CoinId }) {
  const nav = useNav();
  const { dispatch } = useWallet();
  const { prices } = usePrices();
  const [coinId, setCoinId] = useState<CoinId | undefined>(initialCoin);
  const [picking, setPicking] = useState(!initialCoin);
  const [amountStr, setAmountStr] = useState('');
  const [done, setDone] = useState(false);
  const coin = coinId ? COIN_BY_ID[coinId] : undefined;
  const price = coinId ? prices[coinId]?.price : undefined;
  const amount = parseAmount(amountStr);
  const cash = coinId ? isCash(coinId) : false;

  if (picking || !coin) {
    return <CoinPicker title="Receive Crypto" onClose={() => (coin ? setPicking(false) : nav.back())} onPick={(c) => (setCoinId(c), setPicking(false))} />;
  }

  return (
    <div className="sheet-fill">
      <SheetHeader title={cash ? 'Add Cash' : `Receive ${coin.symbol}`} onClose={nav.back} />
      {done ? (
        <div className="pad center-screen">
          <div className="success-badge">
            <Icon name="check" size={32} />
          </div>
          <h2>Added</h2>
          <p className="muted">{fmtAmount(amount, coin.symbol)} added to your balance</p>
          <Button className="block" onClick={nav.closeAll}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <div className="pad stack">
            <div className="send-hero">
              <button type="button" className="coin-select" onClick={() => setPicking(true)}>
                <CoinIcon coin={coin} size={24} /> {coin.symbol} <Icon name="chevronDown" size={14} />
              </button>
              <div className="amount-input">
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={amountStr}
                  autoFocus
                  onChange={(e) => setAmountStr(sanitizeAmountInput(e.target.value, coin.decimals))}
                  aria-label={`Amount of ${coin.symbol}`}
                />
                <span>{coin.symbol}</span>
              </div>
              <div className="muted">{amount > 0 && price ? `≈ ${fmtUsd(amount * price)}` : `1 ${coin.symbol} = ${fmtPrice(price)}`}</div>
            </div>
            <p className="demo-note">Demo mode: this credits the balance locally at the live Hyperliquid price. It does not create a deposit address.</p>
          </div>
          <div className="sheet-footer">
            <Button
              className="block"
              disabled={!(amount > 0)}
              onClick={() => {
                dispatch({ type: 'deposit', coin: coin.id, amount, usd: amount * (price ?? 0) });
                setDone(true);
              }}
            >
              Add to balance
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
