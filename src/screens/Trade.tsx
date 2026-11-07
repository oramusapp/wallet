import { useEffect, useMemo, useState } from 'react';
import { COIN_BY_ID, type CoinId } from '../config/coins';
import { CoinPicker } from '../components/CoinPicker';
import { Button, CoinIcon, Icon } from '../components/ui';
import { parseAmount, quoteSwap, sanitizeAmountInput } from '../lib/amount';
import { fmtAmount, fmtPrice, fmtUsd, toInputString } from '../lib/format';
import { usePortfolio } from '../state/hooks';
import { useNav } from '../state/nav';
import { usePrices } from '../state/prices';
import { useWallet } from '../state/wallet';

export const SWAP_FEE_BPS = 0;

export function Trade() {
  const { active, dispatch } = useWallet();
  const { prices } = usePrices();
  const nav = useNav();
  const pf = usePortfolio();
  const firstHeld = pf.all[0]?.coin.id;

  const [from, setFrom] = useState<CoinId | undefined>(nav.swapPreset?.from ?? firstHeld);
  const [to, setTo] = useState<CoinId>(nav.swapPreset?.to ?? 'BTC');
  const [amountStr, setAmountStr] = useState('');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [step, setStep] = useState<'edit' | 'review' | 'done'>('edit');

  useEffect(() => {
    if (nav.swapPreset) {
      if (nav.swapPreset.from) setFrom(nav.swapPreset.from);
      if (nav.swapPreset.to) setTo(nav.swapPreset.to);
      setStep('edit');
      setAmountStr('');
    }
  }, [nav.swapPreset]);

  useEffect(() => {
    if (!from && firstHeld) setFrom(firstHeld);
  }, [from, firstHeld]);

  const fromCoin = from ? COIN_BY_ID[from] : undefined;
  const toCoin = COIN_BY_ID[to];
  const balance = from ? (active.holdings[from] ?? 0) : 0;
  const amount = parseAmount(amountStr);
  const fromPrice = from ? prices[from]?.price : undefined;
  const toPrice = prices[to]?.price;
  const out = useMemo(() => (fromPrice && toPrice ? quoteSwap(amount, fromPrice, toPrice, SWAP_FEE_BPS) : 0), [amount, fromPrice, toPrice]);

  const error = !fromCoin
    ? 'Deposit funds to swap'
    : from === to
      ? 'Choose two different tokens'
      : !amountStr
        ? null
        : !(amount > 0)
          ? 'Enter a valid amount'
          : amount > balance + 1e-12
            ? 'Insufficient balance'
            : !fromPrice || !toPrice
              ? 'Price unavailable'
              : null;
  const canReview = !error && amount > 0;

  const flip = () => {
    if (!from) return;
    setFrom(to);
    setTo(from);
    setAmountStr('');
  };

  const confirm = () => {
    if (!from || !canReview) return;
    dispatch({ type: 'swap', coin: from, amount: Math.min(amount, balance), toCoin: to, toAmount: out, usd: amount * (fromPrice ?? 0) });
    setStep('done');
  };

  if (step === 'done' && fromCoin) {
    return (
      <div className="screen center-screen">
        <div className="success-badge">
          <Icon name="check" size={32} />
        </div>
        <h2>Swap complete</h2>
        <p className="muted">
          {fmtAmount(amount, fromCoin.symbol)} → {fmtAmount(out, toCoin.symbol)}
        </p>
        <p className="demo-note">Simulated at the Hyperliquid mid price. No on-chain transaction was made.</p>
        <Button
          onClick={() => {
            setStep('edit');
            setAmountStr('');
          }}
        >
          New swap
        </Button>
        <Button variant="secondary" onClick={() => nav.setTab('home')}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 className="screen-title">Swap</h1>

      <div className="swap-box card">
        <div className="swap-label">
          <span>You pay</span>
          {fromCoin && (
            <button type="button" className="link-btn" onClick={() => setAmountStr(toInputString(balance, fromCoin.decimals))}>
              Balance: {fmtAmount(balance, fromCoin.symbol)} · Max
            </button>
          )}
        </div>
        <div className="swap-input">
          <input
            inputMode="decimal"
            placeholder="0"
            value={amountStr}
            disabled={step === 'review'}
            onChange={(e) => setAmountStr(sanitizeAmountInput(e.target.value, fromCoin?.decimals ?? 8))}
            aria-label="Amount to pay"
          />
          <button type="button" className="coin-select" onClick={() => setPicker('from')} disabled={step === 'review'}>
            {fromCoin ? (
              <>
                <CoinIcon coin={fromCoin} size={24} /> {fromCoin.symbol}
              </>
            ) : (
              'Select'
            )}
            <Icon name="chevronDown" size={14} />
          </button>
        </div>
        <div className="swap-usd muted">{amount > 0 && fromPrice ? fmtUsd(amount * fromPrice) : ' '}</div>
      </div>

      <button type="button" className="flip-btn" onClick={flip} aria-label="Switch tokens" disabled={step === 'review'}>
        <Icon name="swap" size={18} />
      </button>

      <div className="swap-box card">
        <div className="swap-label">
          <span>You receive</span>
        </div>
        <div className="swap-input">
          <output aria-label="Amount to receive">{out > 0 ? toInputString(out, Math.max(toCoin.decimals, 2)) : '0'}</output>
          <button type="button" className="coin-select" onClick={() => setPicker('to')} disabled={step === 'review'}>
            <CoinIcon coin={toCoin} size={24} /> {toCoin.symbol}
            <Icon name="chevronDown" size={14} />
          </button>
        </div>
        <div className="swap-usd muted">{out > 0 && toPrice ? fmtUsd(out * toPrice) : ' '}</div>
      </div>

      {fromCoin && fromPrice && toPrice && from !== to && (
        <div className="kv card">
          <div>
            <span>Rate</span>
            <span>
              1 {fromCoin.symbol} = {fmtAmount(quoteSwap(1, fromPrice, toPrice), toCoin.symbol)}
            </span>
          </div>
          <div>
            <span>{fromCoin.symbol} price</span>
            <span>{fmtPrice(fromPrice)}</span>
          </div>
          <div>
            <span>{toCoin.symbol} price</span>
            <span>{fmtPrice(toPrice)}</span>
          </div>
          <div>
            <span>Price source</span>
            <span>Hyperliquid</span>
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {step === 'edit' ? (
        <Button className="block" disabled={!canReview} onClick={() => setStep('review')}>
          Review swap
        </Button>
      ) : (
        <div className="stack">
          <p className="demo-note">Demo mode: the swap is simulated at the live Hyperliquid price and only updates this wallet's local balances.</p>
          <Button className="block" onClick={confirm}>
            Confirm swap
          </Button>
          <Button className="block" variant="secondary" onClick={() => setStep('edit')}>
            Edit
          </Button>
        </div>
      )}

      {picker && (
        <CoinPicker
          title={picker === 'from' ? 'You pay' : 'You receive'}
          heldOnly={picker === 'from'}
          exclude={picker === 'to' && from ? [from] : []}
          onClose={() => setPicker(null)}
          onPick={(c) => {
            if (picker === 'from') {
              if (c === to && from) setTo(from);
              setFrom(c);
              setAmountStr('');
            } else setTo(c);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
