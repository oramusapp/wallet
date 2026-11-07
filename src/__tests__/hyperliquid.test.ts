import { describe, expect, it } from 'vitest';
import { CURATED_COINS } from '../config/coins';
import { buildRegistry, unscalePerpName } from '../config/registry';
import { buildStats, midsToPrices } from '../lib/hyperliquid';

const perpCtx = (markPx: string, prevDayPx: string, midPx: string | null = markPx) => ({
  markPx,
  midPx,
  prevDayPx,
  dayNtlVlm: '1000',
  openInterest: '10',
  funding: '0.0000125',
});

describe('hyperliquid mapping', () => {
  const perp: Parameters<typeof buildStats>[0] = [
    { universe: [{ name: 'BTC' }, { name: 'kPEPE' }, { name: 'ETH' }] },
    [perpCtx('75932', '76101', '75931.5'), perpCtx('0.004906', '0.005064'), perpCtx('2244.1', '2240.4', null)],
  ];
  // spot ctx order intentionally differs from universe order; mapping must use `coin`
  const spot: Parameters<typeof buildStats>[1] = [
    {},
    [
      { coin: '@162', markPx: '0.1165', prevDayPx: '0.12', dayNtlVlm: '1' },
      { coin: '@166', markPx: '0.999', midPx: '0.999', prevDayPx: '0.99886', dayNtlVlm: '498478' },
    ],
  ];

  it('uses mid price, scales kPEPE and maps spot by coin id', () => {
    const s = buildStats(perp, spot, CURATED_COINS);
    expect(s.BTC?.price).toBe(75931.5);
    expect(s.BTC?.change24h).toBeCloseTo(((75931.5 - 76101) / 76101) * 100, 8);
    expect(s.BTC?.openInterestUsd).toBe(759320);
    expect(s.PEPE?.price).toBeCloseTo(0.000004906, 12);
    expect(s.ETH?.price).toBe(2244.1); // falls back to markPx when midPx is null
    expect(s.USDT?.price).toBe(0.999);
    expect(s.USDC?.price).toBe(1);
    expect(s.USDC?.change24h).toBe(0);
    expect(s.XMR).toBeUndefined(); // not in this payload
  });

  it('maps allMids', () => {
    const p = midsToPrices({ BTC: '75938.5', kPEPE: '0.004908', '@166': '0.998955', XMR: 'bad' }, CURATED_COINS);
    expect(p.BTC).toBe(75938.5);
    expect(p.PEPE).toBeCloseTo(0.000004908, 12);
    expect(p.USDT).toBe(0.998955);
    expect(p.XMR).toBeUndefined();
    expect(p.USDC).toBeUndefined();
  });
});

describe('coin registry (all Hyperliquid tokens)', () => {
  const perps = [
    { name: 'BTC' },
    { name: 'kPEPE' },
    { name: 'AAVE' },
    { name: 'kSHIB' },
    { name: 'OLD', isDelisted: true },
    { name: 'PURR' },
  ];
  const spot = {
    tokens: [
      { name: 'USDC', index: 0 },
      { name: 'PURR', index: 1 },
      { name: 'HFUN', index: 2 },
      { name: 'DEAD', index: 3 },
      { name: 'USDT0', index: 4 },
    ],
    universe: [
      { name: 'PURR/USDC', tokens: [1, 0] as [number, number] },
      { name: '@2', tokens: [2, 0] as [number, number] },
      { name: '@3', tokens: [3, 0] as [number, number] },
      { name: '@166', tokens: [4, 0] as [number, number] },
    ],
  };
  const ctxs = [
    { coin: 'PURR/USDC', dayNtlVlm: '1000' },
    { coin: '@2', dayNtlVlm: '50' },
    { coin: '@3', dayNtlVlm: '0' },
    { coin: '@166', dayNtlVlm: '500000' },
  ];
  const coins = buildRegistry(perps, spot, ctxs);
  const ids = coins.map((c) => c.id);

  it('keeps curated coins first and adds every active perp once', () => {
    expect(ids.slice(0, CURATED_COINS.length)).toEqual(CURATED_COINS.map((c) => c.id));
    expect(ids).toContain('AAVE');
    expect(ids).toContain('SHIB');
    expect(ids).not.toContain('OLD');
    expect(ids.filter((i) => i === 'PEPE')).toHaveLength(1); // kPEPE already curated
    expect(ids.filter((i) => i === 'BTC')).toHaveLength(1);
  });

  it('adds traded USDC spot tokens, skipping duplicates and dead pairs', () => {
    const hfun = coins.find((c) => c.id === 'HFUN')!;
    expect(hfun.name).toBe('HFUN');
    expect(hfun.source).toEqual({ kind: 'spot', market: '@2' });
    expect(ids).not.toContain('DEAD');
    expect(ids).not.toContain('USDT0'); // curated USDT already uses @166
    expect(coins.find((c) => c.id === 'PURR')!.source.kind).toBe('perp'); // perp preferred over spot
  });

  it('unscales k-prefixed perps', () => {
    expect(unscalePerpName('kSHIB')).toEqual({ id: 'SHIB', scale: 1 / 1000 });
    expect(unscalePerpName('kaito')).toEqual({ id: 'kaito', scale: 1 });
    expect(unscalePerpName('KAITO')).toEqual({ id: 'KAITO', scale: 1 });
  });
});
