import { useEffect, useMemo, useRef, useState } from 'react';
import type { Coin } from '../config/coins';
import { fetchCandles, type Candle, type CandleInterval } from '../lib/hyperliquid';
import { fmtPct, fmtPrice } from '../lib/format';

const RANGES: { id: string; label: string; ms: number; interval: CandleInterval }[] = [
  { id: '1H', label: '1H', ms: 3600e3, interval: '1m' },
  { id: '1D', label: '1D', ms: 86400e3, interval: '15m' },
  { id: '1W', label: '1W', ms: 7 * 86400e3, interval: '1h' },
  { id: '1M', label: '1M', ms: 30 * 86400e3, interval: '4h' },
  { id: '1Y', label: '1Y', ms: 365 * 86400e3, interval: '1d' },
];

const W = 360;
const H = 180;
const PAD = 8;

interface Props {
  coin: Coin;
  livePrice: number | undefined;
  /** Called while scrubbing with the hovered price/change, or null when released. */
  onScrub: (v: { price: number; change: number; t: number } | null) => void;
}

export function PriceChart({ coin, livePrice, onScrub }: Props) {
  const [range, setRange] = useState(RANGES[1]);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setCandles(null);
    setError(false);
    const now = Date.now();
    fetchCandles(coin, range.interval, now - range.ms, now, ctrl.signal)
      .then(setCandles)
      .catch(() => !ctrl.signal.aborted && setError(true));
    return () => ctrl.abort();
  }, [coin, range]);

  const series = useMemo(() => {
    if (!candles?.length) return null;
    const pts = candles.map((c) => ({ t: c.t, p: c.c }));
    if (livePrice !== undefined) pts.push({ t: Date.now(), p: livePrice });
    const ps = pts.map((x) => x.p);
    let min = Math.min(...ps);
    let max = Math.max(...ps);
    if (max - min < max * 1e-6) {
      min -= max * 0.001 || 1;
      max += max * 0.001 || 1;
    }
    const x = (i: number) => PAD + (i / Math.max(1, pts.length - 1)) * (W - PAD * 2);
    const y = (p: number) => PAD + (1 - (p - min) / (max - min)) * (H - PAD * 2);
    const d = pts.map((pt, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pt.p).toFixed(1)}`).join('');
    return { pts, x, y, d, first: pts[0].p };
  }, [candles, livePrice]);

  const up = series ? series.pts[series.pts.length - 1].p >= series.first : true;

  const handleMove = (clientX: number) => {
    if (!series || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const rel = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((rel - PAD) / (W - PAD * 2)) * (series.pts.length - 1));
    const idx = Math.max(0, Math.min(series.pts.length - 1, i));
    setHover(idx);
    const pt = series.pts[idx];
    onScrub({ price: pt.p, change: ((pt.p - series.first) / series.first) * 100, t: pt.t });
  };
  const release = () => {
    setHover(null);
    onScrub(null);
  };

  return (
    <div className="chart">
      <div className="chart-canvas">
        {series ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onPointerMove={(e) => handleMove(e.clientX)}
            onPointerDown={(e) => handleMove(e.clientX)}
            onPointerLeave={release}
            onPointerUp={release}
            role="img"
            aria-label={`${coin.symbol} price chart, ${range.label}: ${fmtPct(((series.pts[series.pts.length - 1].p - series.first) / series.first) * 100)}`}
          >
            <defs>
              <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={up ? 'var(--green)' : 'var(--red)'} stopOpacity="0.25" />
                <stop offset="1" stopColor={up ? 'var(--green)' : 'var(--red)'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${series.d}L${W - PAD},${H}L${PAD},${H}Z`} fill="url(#fill)" />
            <path d={series.d} fill="none" stroke={up ? 'var(--green)' : 'var(--red)'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {hover !== null && (
              <>
                <line x1={series.x(hover)} x2={series.x(hover)} y1={0} y2={H} stroke="var(--text-2)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                <circle cx={series.x(hover)} cy={series.y(series.pts[hover].p)} r="4" fill="var(--text)" />
              </>
            )}
          </svg>
        ) : error ? (
          <div className="chart-empty">Chart unavailable</div>
        ) : (
          <div className="chart-empty skeleton" />
        )}
      </div>
      {hover !== null && series && (
        <div className="chart-time">
          {new Date(series.pts[hover].t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {fmtPrice(series.pts[hover].p)}
        </div>
      )}
      <div className="chart-ranges" role="tablist">
        {RANGES.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={r.id === range.id} className={r.id === range.id ? 'active' : ''} onClick={() => setRange(r)}>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
