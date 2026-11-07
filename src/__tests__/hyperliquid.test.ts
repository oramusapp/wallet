import { describe, expect, it } from 'vitest';
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
    const s = buildStats(perp, spot);
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
    const p = midsToPrices({ BTC: '75938.5', kPEPE: '0.004908', '@166': '0.998955', XMR: 'bad' });
    expect(p.BTC).toBe(75938.5);
    expect(p.PEPE).toBeCloseTo(0.000004908, 12);
    expect(p.USDT).toBe(0.998955);
    expect(p.XMR).toBeUndefined();
    expect(p.USDC).toBeUndefined();
  });
});
