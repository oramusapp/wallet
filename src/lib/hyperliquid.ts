import type { Coin, CoinId } from '../config/coins';
import { buildRegistry, type PerpAsset, type SpotPair, type SpotToken } from '../config/registry';

export const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
export const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws';

export interface MarketStats {
  /** Latest price in USD for one unit of the coin (scale already applied). */
  price: number;
  /** Price 24h ago (scale applied). */
  prevDayPrice: number;
  /** 24h change in percent. */
  change24h: number;
  /** 24h notional volume on Hyperliquid, USD. */
  volume24h: number;
  /** Perp open interest in USD (undefined for spot / fixed). */
  openInterestUsd?: number;
  /** Hourly funding rate (perp only), as a fraction. */
  funding?: number;
}

export type PriceMap = Partial<Record<CoinId, MarketStats>>;

interface PerpCtx {
  markPx: string;
  midPx?: string | null;
  prevDayPx: string;
  dayNtlVlm: string;
  openInterest: string;
  funding: string;
}
interface SpotCtx {
  coin: string;
  markPx: string;
  midPx?: string | null;
  prevDayPx: string;
  dayNtlVlm: string;
}

type PerpResponse = [{ universe: PerpAsset[] }, PerpCtx[]];
type SpotResponse = [{ tokens: SpotToken[]; universe: SpotPair[] }, SpotCtx[]];


async function info<T>(body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(HL_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Hyperliquid ${res.status}`);
  return (await res.json()) as T;
}

export function changePct(price: number, prev: number): number {
  return prev > 0 ? ((price - prev) / prev) * 100 : 0;
}

function num(s: string | null | undefined): number {
  const n = s == null ? NaN : Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Builds stats for every configured coin from raw Hyperliquid responses. */
export function buildStats(
  perp: [{ universe: { name: string }[] }, PerpCtx[]],
  spot: [unknown, SpotCtx[]],
  coins: Coin[],
): PriceMap {
  const perpByName = new Map<string, PerpCtx>();
  perp[0].universe.forEach((u, i) => {
    if (perp[1][i]) perpByName.set(u.name, perp[1][i]);
  });
  // Spot contexts carry their own `coin` id, which is not always aligned with universe order.
  const spotByCoin = new Map(spot[1].map((c) => [c.coin, c]));

  const out: PriceMap = {};
  for (const c of coins) {
    const s = c.source;
    if (s.kind === 'fixed') {
      out[c.id] = { price: s.price, prevDayPrice: s.price, change24h: 0, volume24h: 0 };
      continue;
    }
    const ctx = s.kind === 'perp' ? perpByName.get(s.market) : spotByCoin.get(s.market);
    if (!ctx) continue;
    const raw = num(ctx.midPx) || num(ctx.markPx);
    const price = raw * c.priceScale;
    const prevDayPrice = num(ctx.prevDayPx) * c.priceScale;
    const stats: MarketStats = {
      price,
      prevDayPrice,
      change24h: changePct(price, prevDayPrice),
      volume24h: num(ctx.dayNtlVlm) || 0,
    };
    if (s.kind === 'perp') {
      const p = ctx as PerpCtx;
      stats.openInterestUsd = num(p.openInterest) * num(p.markPx);
      stats.funding = num(p.funding);
    }
    out[c.id] = stats;
  }
  return out;
}

/** Every Hyperliquid coin we list, plus a stats snapshot for each. */
export async function fetchMarketData(signal?: AbortSignal): Promise<{ coins: Coin[]; stats: PriceMap }> {
  const [perp, spot] = await Promise.all([
    info<PerpResponse>({ type: 'metaAndAssetCtxs' }, signal),
    info<SpotResponse>({ type: 'spotMetaAndAssetCtxs' }, signal),
  ]);
  const coins = buildRegistry(perp[0].universe, spot[0], spot[1]);
  return { coins, stats: buildStats(perp, spot, coins) };
}

/** Maps an `allMids` payload onto coin prices (scale applied). */
export function midsToPrices(mids: Record<string, string>, coins: Coin[]): Partial<Record<CoinId, number>> {
  const out: Partial<Record<CoinId, number>> = {};
  for (const c of coins) {
    if (c.source.kind === 'fixed') continue;
    const v = num(mids[c.source.market]);
    if (Number.isFinite(v)) out[c.id] = v * c.priceScale;
  }
  return out;
}

export async function fetchMids(signal?: AbortSignal): Promise<Record<string, string>> {
  return info<Record<string, string>>({ type: 'allMids' }, signal);
}

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export async function fetchCandles(
  coin: Coin,
  interval: CandleInterval,
  startTime: number,
  endTime = Date.now(),
  signal?: AbortSignal,
): Promise<Candle[]> {
  if (coin.source.kind === 'fixed') {
    const p = coin.source.price;
    return [
      { t: startTime, o: p, h: p, l: p, c: p },
      { t: endTime, o: p, h: p, l: p, c: p },
    ];
  }
  const raw = await info<{ t: number; o: string; h: string; l: string; c: string }[]>(
    { type: 'candleSnapshot', req: { coin: coin.source.market, interval, startTime, endTime } },
    signal,
  );
  const k = coin.priceScale;
  return raw.map((r) => ({ t: r.t, o: +r.o * k, h: +r.h * k, l: +r.l * k, c: +r.c * k }));
}

/**
 * Live mids over WebSocket with automatic reconnect.
 * Returns an unsubscribe function.
 */
export function subscribeMids(
  onMids: (mids: Record<string, string>) => void,
  onStatus: (s: 'live' | 'reconnecting') => void,
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(HL_WS_URL);
    ws.onopen = () => {
      retry = 0;
      onStatus('live');
      ws?.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
      ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ method: 'ping' })), 30_000);
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.channel === 'allMids' && msg.data?.mids) onMids(msg.data.mids);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      clearInterval(ping);
      if (closed) return;
      onStatus('reconnecting');
      timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
    };
    ws.onerror = () => ws?.close();
  };
  connect();

  return () => {
    closed = true;
    clearTimeout(timer);
    clearInterval(ping);
    ws?.close();
  };
}
