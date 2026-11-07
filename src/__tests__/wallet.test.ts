import { describe, expect, it } from 'vitest';
import { checkAddress, parseAmount, quoteSwap, sanitizeAmountInput } from '../lib/amount';
import { positions, totals } from '../lib/portfolio';
import { initialState, reducer } from '../state/wallet';

describe('wallet reducer', () => {
  it('sends, rejects overspend, swaps and deposits', () => {
    let s = initialState();
    expect(s.accounts[0].holdings.SOL).toBe(0.00581);

    const over = reducer(s, { type: 'send', coin: 'SOL', amount: 1, to: 'x', usd: 0 });
    expect(over).toBe(s);

    s = reducer(s, { type: 'send', coin: 'SOL', amount: 0.00081, to: 'x', usd: 0.07 });
    expect(s.accounts[0].holdings.SOL).toBeCloseTo(0.005, 12);
    expect(s.txs[0].kind).toBe('send');

    s = reducer(s, { type: 'swap', coin: 'SOL', amount: 0.005, toCoin: 'USDC', toAmount: 0.45, usd: 0.45 });
    expect(s.accounts[0].holdings.SOL).toBeUndefined();
    expect(s.accounts[0].holdings.USDC).toBe(0.45);

    s = reducer(s, { type: 'deposit', coin: 'BTC', amount: 0.01, usd: 759 });
    expect(s.accounts[0].holdings.BTC).toBe(0.01);
    expect(s.txs).toHaveLength(3);
  });

  it('creates, selects and removes accounts', () => {
    let s = initialState();
    s = reducer(s, { type: 'createAccount', name: '' });
    expect(s.accounts.map((a) => a.name)).toEqual(['Account 1', 'Account 2']);
    expect(s.activeId).toBe(s.accounts[1].id);
    s = reducer(s, { type: 'removeAccount', id: s.accounts[1].id });
    expect(s.accounts).toHaveLength(1);
    expect(s.activeId).toBe(s.accounts[0].id);
    expect(reducer(s, { type: 'removeAccount', id: s.accounts[0].id })).toBe(s);
  });
});

describe('portfolio', () => {
  it('totals with 24h delta', () => {
    const list = positions(
      { SOL: 0.00581, ETH: 0.0000089 },
      {
        SOL: { price: 89.85, prevDayPrice: 90.308, change24h: 0, volume24h: 0 },
        ETH: { price: 2244.1, prevDayPrice: 2240.4, change24h: 0, volume24h: 0 },
      },
    );
    const t = totals(list);
    expect(t.value).toBeCloseTo(0.00581 * 89.85 + 0.0000089 * 2244.1, 10);
    expect(t.delta24h).toBeCloseTo(0.00581 * (89.85 - 90.308) + 0.0000089 * (2244.1 - 2240.4), 12);
    expect(list[0].coin.id).toBe('SOL');
  });
});

describe('amount helpers', () => {
  it('parses and sanitizes', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('.5')).toBe(0.5);
    expect(parseAmount('abc')).toBeNaN();
    expect(sanitizeAmountInput('1.2.3abc', 8)).toBe('1.23');
    expect(sanitizeAmountInput('0.123456789', 6)).toBe('0.123456');
    expect(sanitizeAmountInput('12.5', 0)).toBe('12');
  });
  it('quotes swaps', () => {
    expect(quoteSwap(1, 89.85, 2244.1)).toBeCloseTo(89.85 / 2244.1, 12);
    expect(quoteSwap(0, 1, 1)).toBe(0);
    expect(quoteSwap(100, 1, 1, 30)).toBeCloseTo(99.7, 10);
  });
  it('checks address formats', () => {
    expect(checkAddress('Ethereum', '0x' + 'a'.repeat(40)).ok).toBe(true);
    expect(checkAddress('Ethereum', '0x123').ok).toBe(false);
    expect(checkAddress('Solana', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU').ok).toBe(true);
    expect(checkAddress('Bitcoin', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq').ok).toBe(true);
    expect(checkAddress('Solana', '').ok).toBe(false);
  });
});

describe('cash grouping', () => {
  it('treats USDC and USDT as cash, not tokens', async () => {
    const { isCash, CASH_COINS } = await import('../config/coins');
    expect(CASH_COINS).toEqual(['USDC', 'USDT']);
    expect(isCash('USDT')).toBe(true);
    expect(isCash('USDC')).toBe(true);
    expect(isCash('BTC')).toBe(false);
  });
});
