import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { byIdOf, CURATED_COINS, type Coin, type CoinId } from '../config/coins';
import { changePct, fetchMarketData, fetchMids, midsToPrices, subscribeMids, type PriceMap } from '../lib/hyperliquid';

export type FeedStatus = 'loading' | 'live' | 'polling' | 'error';

interface PricesValue {
  /** Every listed coin (curated + all Hyperliquid perps/spot). */
  coins: Coin[];
  byId: Record<CoinId, Coin>;
  prices: PriceMap;
  status: FeedStatus;
  updatedAt: number | null;
}

const PricesContext = createContext<PricesValue>({
  coins: CURATED_COINS,
  byId: byIdOf(CURATED_COINS),
  prices: {},
  status: 'loading',
  updatedAt: null,
});

const STATS_REFRESH_MS = 60_000;
const POLL_MS = 5_000;
const COINS_CACHE_KEY = 'oramus-wallet:coins:v1';

/** Last known coin list, so held Hyperliquid tokens show up before the first fetch. */
function cachedCoins(): Coin[] {
  try {
    const raw = localStorage.getItem(COINS_CACHE_KEY);
    const list = raw ? (JSON.parse(raw) as Coin[]) : null;
    if (Array.isArray(list) && list.length >= CURATED_COINS.length) {
      // curated definitions always come from the code, never from the cache
      const curatedIds = new Set(CURATED_COINS.map((c) => c.id));
      return [...CURATED_COINS, ...list.filter((c) => !c.curated && !curatedIds.has(c.id))];
    }
  } catch {
    /* ignore */
  }
  return CURATED_COINS;
}

export function PricesProvider({ children }: { children: ReactNode }) {
  const [coins, setCoins] = useState<Coin[]>(cachedCoins);
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const wsLive = useRef(false);
  const coinsRef = useRef(coins);
  coinsRef.current = coins;

  const applyMids = (mids: Record<string, string>) => {
    const next = midsToPrices(mids, coinsRef.current);
    setPrices((prev) => {
      const out: PriceMap = { ...prev };
      for (const [id, price] of Object.entries(next)) {
        const s = prev[id];
        if (!s || price === undefined) continue; // wait for the stats snapshot to know prevDayPx
        out[id] = { ...s, price, change24h: changePct(price, s.prevDayPrice) };
      }
      return out;
    });
    setUpdatedAt(Date.now());
  };

  // Coin list + snapshot (24h reference price, volume, OI, funding, supply).
  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const { coins: list, stats } = await fetchMarketData(ctrl.signal);
        setCoins(list);
        try {
          localStorage.setItem(COINS_CACHE_KEY, JSON.stringify(list.filter((c) => !c.curated)));
        } catch {
          /* storage full or unavailable */
        }
        setPrices((prev) => {
          // keep fresher websocket prices, take new reference values from the snapshot
          const out: PriceMap = { ...stats };
          for (const id of Object.keys(stats)) {
            const live = prev[id];
            const s = stats[id]!;
            if (live && wsLive.current) out[id] = { ...s, price: live.price, change24h: changePct(live.price, s.prevDayPrice) };
          }
          return out;
        });
        setUpdatedAt(Date.now());
        setStatus((s) => (s === 'loading' || s === 'error' ? (wsLive.current ? 'live' : 'polling') : s));
      } catch {
        if (!ctrl.signal.aborted) setStatus((s) => (s === 'loading' ? 'error' : s));
      }
    };
    load();
    const id = setInterval(load, STATS_REFRESH_MS);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, []);

  // Live mids over websocket; REST polling while the socket is down.
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => {
      if (poll) return;
      poll = setInterval(async () => {
        try {
          applyMids(await fetchMids());
        } catch {
          /* next tick */
        }
      }, POLL_MS);
    };
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };
    const unsub = subscribeMids(applyMids, (s) => {
      wsLive.current = s === 'live';
      if (s === 'live') {
        stopPolling();
        setStatus('live');
      } else {
        startPolling();
        setStatus((cur) => (cur === 'loading' ? cur : 'polling'));
      }
    });
    return () => {
      unsub();
      stopPolling();
    };
  }, []);

  const byId = useMemo(() => byIdOf(coins), [coins]);

  return <PricesContext.Provider value={{ coins, byId, prices, status, updatedAt }}>{children}</PricesContext.Provider>;
}

export const usePrices = () => useContext(PricesContext);
