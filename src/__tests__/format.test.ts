import { describe, expect, it } from 'vitest';
import { fmtAmount, fmtCompactUsd, fmtPct, fmtPrice, fmtUsd, fmtUsdDelta, fmtUsdDeltaPrecise } from '../lib/format';

describe('format (matches reference screenshots)', () => {
  it('prices', () => {
    expect(fmtPrice(75889.23)).toBe('$75,889.23');
    expect(fmtPrice(1295.08)).toBe('$1,295.08');
    expect(fmtPrice(1)).toBe('$1.00');
    expect(fmtPrice(0.999)).toBe('$0.999');
    expect(fmtPrice(0.869)).toBe('$0.869');
    expect(fmtPrice(0.0718)).toBe('$0.0718');
    expect(fmtPrice(0.00000491)).toBe('$0.00000491');
    expect(fmtPrice(undefined)).toBe('—');
  });
  it('market caps', () => {
    expect(fmtCompactUsd(1.513e12)).toBe('$1.5T');
    expect(fmtCompactUsd(22.3e9)).toBe('$22B');
    expect(fmtCompactUsd(8.8e9)).toBe('$8.8B');
    expect(fmtCompactUsd(183e9)).toBe('$183B');
    expect(fmtCompactUsd(2.2e6)).toBe('$2.2M');
  });
  it('percent', () => {
    expect(fmtPct(0)).toBe('0%');
    expect(fmtPct(0.0004)).toBe('0%');
    expect(fmtPct(0.02)).toBe('+0.02%');
    expect(fmtPct(-2.164)).toBe('-2.16%');
  });
  it('balances and deltas', () => {
    expect(fmtUsd(0.52)).toBe('$0.52');
    expect(fmtUsd(0.004)).toBe('<$0.01');
    expect(fmtUsd(0)).toBe('$0.00');
    expect(fmtUsdDelta(-0.003)).toBe('-<$0.01');
    expect(fmtUsdDelta(0.003)).toBe('+<$0.01');
    expect(fmtUsdDelta(1.5)).toBe('+$1.50');
    expect(fmtUsdDeltaPrecise(-0.000259)).toBe('-$0.000259');
  });
  it('amounts', () => {
    expect(fmtAmount(0.00581, 'SOL')).toBe('0.00581 SOL');
    expect(fmtAmount(0.0000089, 'ETH')).toBe('< 0.00001 ETH');
    expect(fmtAmount(1, 'DADDY')).toBe('1 DADDY');
    expect(fmtAmount(1204.5, 'XRP')).toBe('1,204.5 XRP');
  });
});
