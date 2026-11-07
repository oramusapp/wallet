import { useMemo, useState } from 'react';
import { CASH_COIN, CHAINS, COIN_BY_ID, COINS, type CoinId } from '../../config/coins';
import { Button, Chip, CoinIcon, Icon, SearchField, SheetHeader } from '../../components/ui';
import { checkAddress, parseAmount, sanitizeAmountInput } from '../../lib/amount';
import { fmtAmount, fmtUsd, shortAddress, toInputString } from '../../lib/format';
import { useNav } from '../../state/nav';
import { usePrices } from '../../state/prices';
import { useWallet } from '../../state/wallet';

type Step = 'pick' | 'form' | 'review' | 'done';

export function SendSheet({ initialCoin }: { initialCoin?: CoinId }) {
  const nav = useNav();
  const { active, dispatch } = useWallet();
  const { prices } = usePrices();
  const [step, setStep] = useState<Step>(initialCoin ? 'form' : 'pick');
  const [coinId, setCoinId] = useState<CoinId | undefined>(initialCoin);
  const [q, setQ] = useState('');
  const [chain, setChain] = useState<string>('All');
  const [amountStr, setAmountStr] = useState('');
  const [to, setTo] = useState('');
  const [touched, setTouched] = useState(false);

  const assets = useMemo(() => {
    const s = q.trim().toLowerCase();
    const held = COINS.filter((c) => (active.holdings[c.id] ?? 0) > 0);
    // Cash first, like the reference
    held.sort((a, b) => (a.id === CASH_COIN ? -1 : b.id === CASH_COIN ? 1 : 0));
    return held
      .filter((c) => chain === 'All' || c.chain === chain)
      .filter((c) => !s || c.symbol.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || (c.id === CASH_COIN && 'cash'.includes(s)));
  }, [q, chain, active.holdings]);

  const coin = coinId ? COIN_BY_ID[coinId] : undefined;
  const balance = coinId ? (active.holdings[coinId] ?? 0) : 0;
  const price = coinId ? prices[coinId]?.price : undefined;
  const amount = parseAmount(amountStr);
  const addr = coin ? checkAddress(coin.chain, to) : { ok: false as const, reason: '' };
  const amountError = !amountStr ? null : !(amount > 0) ? 'Enter a valid amount' : amount > balance + 1e-12 ? 'Insufficient balance' : null;
  const canContinue = amount > 0 && !amountError && addr.ok;

  const title = step === 'pick' ? 'Send' : step === 'done' ? 'Sent' : `Send ${coin?.symbol ?? ''}`;

  return (
    <div className="sheet-fill">
      <SheetHeader
        title={title}
        onClose={step === 'pick' || step === 'done' || initialCoin ? nav.back : undefined}
        onBack={step === 'form' && !initialCoin ? () => setStep('pick') : step === 'review' ? () => setStep('form') : undefined}
      />

      {step === 'pick' && (
        <>
          <div className="pad">
            <SearchField value={q} onChange={setQ} />
          </div>
          <div className="chips pad-x">
            {['All', ...CHAINS].map((c) => (
              <Chip key={c} active={chain === c} onClick={() => setChain(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="list pad-x scroll">
            {assets.length === 0 && <div className="empty">No Assets</div>}
            {assets.map((c) => {
              const bal = active.holdings[c.id] ?? 0;
              const p = prices[c.id]?.price;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="list-row"
                  onClick={() => {
                    setCoinId(c.id);
                    setStep('form');
                  }}
                >
                  <CoinIcon coin={c} size={36} />
                  <div className="col grow">
                    <span className="row-title">
                      {c.id === CASH_COIN ? 'Cash' : c.symbol} <span className="muted small">{c.chain}</span>
                    </span>
                    <span className="row-sub">{p !== undefined ? fmtUsd(bal * p) : fmtAmount(bal, c.symbol)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 'form' && coin && (
        <>
          <div className="pad stack">
            <div className="send-hero">
              <CoinIcon coin={coin} size={56} />
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
              <div className="muted">{amount > 0 && price ? `≈ ${fmtUsd(amount * price)}` : ' '}</div>
              <button type="button" className="link-btn" onClick={() => setAmountStr(toInputString(balance, coin.decimals))}>
                Available: {fmtAmount(balance, coin.symbol)} · Max
              </button>
            </div>
            {amountError && <p className="error-text">{amountError}</p>}
            <label className="field-label" htmlFor="recipient">
              Recipient ({coin.chain})
            </label>
            <textarea
              id="recipient"
              className="text-area"
              rows={2}
              placeholder={`${coin.chain} address`}
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              onBlur={() => setTouched(true)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            {touched && !addr.ok && addr.reason && <p className="error-text">{addr.reason}</p>}
          </div>
          <div className="sheet-footer">
            <Button className="block" disabled={!canContinue} onClick={() => setStep('review')}>
              Next
            </Button>
          </div>
        </>
      )}

      {step === 'review' && coin && (
        <>
          <div className="pad stack">
            <div className="send-hero">
              <CoinIcon coin={coin} size={56} />
              <div className="big-amount">{fmtAmount(amount, coin.symbol)}</div>
              <div className="muted">{price ? fmtUsd(amount * price) : ''}</div>
            </div>
            <div className="kv card">
              <div>
                <span>To</span>
                <span className="mono">{shortAddress(to)}</span>
              </div>
              <div>
                <span>Network</span>
                <span>{coin.chain}</span>
              </div>
              <div>
                <span>Price (Hyperliquid)</span>
                <span>{price ? fmtUsd(price) : '—'}</span>
              </div>
            </div>
            <p className="demo-note">Demo mode: nothing is broadcast to {coin.chain}. Only this wallet's local balance changes.</p>
          </div>
          <div className="sheet-footer">
            <Button
              className="block"
              onClick={() => {
                dispatch({ type: 'send', coin: coin.id, amount: Math.min(amount, balance), to, usd: amount * (price ?? 0) });
                setStep('done');
              }}
            >
              Send
            </Button>
          </div>
        </>
      )}

      {step === 'done' && coin && (
        <div className="pad center-screen">
          <div className="success-badge">
            <Icon name="check" size={32} />
          </div>
          <h2>Sent</h2>
          <p className="muted">
            {fmtAmount(amount, coin.symbol)} to {shortAddress(to)}
          </p>
          <Button className="block" onClick={nav.closeAll}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
