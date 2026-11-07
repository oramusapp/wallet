import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { changePct, fetchMarketStats, fetchMids, midsToPrices, subscribeMids, type PriceMap } from '../lib/hyperliquid';
import type { CoinId } from '../config/coins';

export type FeedStatus = 'loading' | 'live' | 'polling' | 'error';

interface PricesValue {
  prices: PriceMap;
  status: FeedStatus;
  updatedAt: number | null;
}

const PricesContext = createContext<PricesValue>({ prices: {}, status: 'loading', updatedAt: null });

const STATS_REFRESH_MS = 60_000;
const POLL_MS = 5_000;

export function PricesProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const wsLive = useRef(false);

  const applyMids = (mids: Record<string, string>) => {
    const next = midsToPrices(mids);
    setPrices((prev) => {
      const out: PriceMap = { ...prev };
      for (const [id, price] of Object.entries(next) as [CoinId, number][]) {
        const s = prev[id];
        if (!s) continue; // wait for the stats snapshot to know prevDayPx
        out[id] = { ...s, price, change24h: changePct(price, s.prevDayPrice) };
      }
      return out;
    });
    setUpdatedAt(Date.now());
  };

  // Full snapshot (24h reference price, volume, OI, funding).
  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const stats = await fetchMarketStats(ctrl.signal);
        setPrices((prev) => {
          // keep fresher websocket prices, take new reference values from the snapshot
          const out: PriceMap = { ...stats };
          for (const id of Object.keys(stats) as CoinId[]) {
            const live = prev[id];
            const s = stats[id]!;
            if (live && wsLive.current) out[id] = { ...s, price: live.price, change24h: changePct(live.price, s.prevDayPrice) };
          }
          return out;
        });
        setUpdatedAt(Date.now());
        setStatus((s) => (s === 'loading' || s === 'error' ? (wsLive.current ? 'live' : 'polling') : s));
      } catch (e) {
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

  return <PricesContext.Provider value={{ prices, status, updatedAt }}>{children}</PricesContext.Provider>;
}

export const usePrices = () => useContext(PricesContext);
