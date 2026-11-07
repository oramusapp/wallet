const usd2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Decimals needed to show `sig` significant digits of |v| (v < 1). */
function sigDecimals(v: number, sig: number): number {
  const mag = Math.floor(Math.log10(Math.abs(v)));
  return Math.min(Math.max(sig - 1 - mag, 0), 20);
}

/** $75,889.23 · $1.00 · $0.999 · $0.0718 · $0.00000491 */
export function fmtPrice(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) return '—';
  if (p === 0) return '$0.00';
  if (Math.abs(p) >= 1) return `$${usd2.format(p)}`;
  return `$${Math.abs(p).toFixed(sigDecimals(p, 3))}`;
}

/** Balances: $0.52 · <$0.01 · $0.00 */
export function fmtUsd(v: number): string {
  if (v === 0 || !Number.isFinite(v)) return '$0.00';
  if (Math.abs(v) < 0.01) return v < 0 ? '-<$0.01' : '<$0.01';
  return `${v < 0 ? '-' : ''}$${usd2.format(Math.abs(v))}`;
}

/** Row deltas: +$0.52 · -<$0.01 · +<$0.01 */
export function fmtUsdDelta(v: number): string {
  if (v === 0 || !Number.isFinite(v)) return '$0.00';
  const sign = v > 0 ? '+' : '-';
  const a = Math.abs(v);
  if (a < 0.01) return `${sign}<$0.01`;
  return `${sign}$${usd2.format(a)}`;
}

/** Header delta keeps precision for tiny portfolios: -$0.000259 */
export function fmtUsdDeltaPrecise(v: number): string {
  if (v === 0 || !Number.isFinite(v)) return '$0.00';
  const sign = v > 0 ? '+' : '-';
  const a = Math.abs(v);
  if (a >= 0.01) return `${sign}$${usd2.format(a)}`;
  return `${sign}$${a.toFixed(sigDecimals(a, 3))}`;
}

/** +0.02% · -2.16% · 0% */
export function fmtPct(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  const r = Math.round(v * 100) / 100;
  if (r === 0) return '0%';
  return `${r > 0 ? '+' : ''}${r.toFixed(2)}%`;
}

/** Two significant digits: $1.5T · $22B · $8.8B · $2.1M */
export function fmtCompactUsd(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v) || v <= 0) return '—';
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [n, u] of units) {
    if (v >= n) {
      const x = v / n;
      const s = x >= 100 ? x.toFixed(0) : Number(x.toPrecision(2)).toString();
      return `$${s}${u}`;
    }
  }
  return `$${v.toFixed(0)}`;
}

/** Token quantities: 0.00581 SOL · < 0.00001 ETH · 1 DADDY · 1,204.5 XRP */
export function fmtAmount(q: number, symbol: string): string {
  if (q === 0) return `0 ${symbol}`;
  if (q > 0 && q < 0.00001) return `< 0.00001 ${symbol}`;
  if (q >= 1) {
    const s = new Intl.NumberFormat('en-US', { maximumFractionDigits: q >= 1000 ? 2 : 4 }).format(q);
    return `${s} ${symbol}`;
  }
  return `${Number(q.toFixed(sigDecimals(q, 3)))} ${symbol}`;
}

/** Plain number for inputs, no exponent, trailing zeros trimmed. */
export function toInputString(q: number, decimals: number): string {
  if (!Number.isFinite(q) || q <= 0) return '';
  const s = q.toFixed(Math.min(decimals, 12));
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

export function trendClass(v: number | undefined): 'up' | 'down' | 'flat' {
  if (v === undefined || !Number.isFinite(v)) return 'flat';
  const r = Math.round(v * 100) / 100;
  return r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
}

/** Colour by raw sign (for USD deltas, where tiny values still matter). */
export function signClass(v: number): 'up' | 'down' | 'flat' {
  return v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
}

export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
