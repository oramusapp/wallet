import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CoinId } from '../config/coins';

export type SheetRoute =
  | { kind: 'tokens' }
  | { kind: 'cash' }
  | { kind: 'manageTokens' }
  | { kind: 'accounts' }
  | { kind: 'createAccount' }
  | { kind: 'send'; coin?: CoinId }
  | { kind: 'deposit' }
  | { kind: 'receive'; coin?: CoinId }
  | { kind: 'token'; coin: CoinId }
  | { kind: 'history' }
  | { kind: 'settings' };

export type Tab = 'home' | 'trade' | 'markets';

interface NavValue {
  tab: Tab;
  setTab: (t: Tab) => void;
  stack: SheetRoute[];
  push: (r: SheetRoute) => void;
  /** Replace the whole stack with a single route. */
  open: (r: SheetRoute) => void;
  replace: (r: SheetRoute) => void;
  back: () => void;
  closeAll: () => void;
  drawer: boolean;
  setDrawer: (v: boolean) => void;
  swapPreset: { from?: CoinId; to?: CoinId } | null;
  goSwap: (p: { from?: CoinId; to?: CoinId }) => void;
}

const NavContext = createContext<NavValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<SheetRoute[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [swapPreset, setSwapPreset] = useState<{ from?: CoinId; to?: CoinId } | null>(null);

  const push = useCallback((r: SheetRoute) => setStack((s) => [...s, r]), []);
  const open = useCallback((r: SheetRoute) => setStack([r]), []);
  const replace = useCallback((r: SheetRoute) => setStack((s) => [...s.slice(0, -1), r]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const closeAll = useCallback(() => setStack([]), []);
  const goSwap = useCallback((p: { from?: CoinId; to?: CoinId }) => {
    setSwapPreset(p);
    setStack([]);
    setDrawer(false);
    setTab('trade');
  }, []);

  const value = useMemo(
    () => ({ tab, setTab, stack, push, open, replace, back, closeAll, drawer, setDrawer, swapPreset, goSwap }),
    [tab, stack, drawer, swapPreset, push, open, replace, back, closeAll, goSwap],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavValue {
  const v = useContext(NavContext);
  if (!v) throw new Error('useNav outside NavProvider');
  return v;
}
