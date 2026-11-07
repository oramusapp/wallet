import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { CoinId } from '../config/coins';

export type Holdings = Partial<Record<CoinId, number>>;

export interface Account {
  id: string;
  name: string;
  holdings: Holdings;
  hidden: CoinId[];
  createdAt: number;
}

export type Tx =
  | { id: string; accountId: string; ts: number; kind: 'send'; coin: CoinId; amount: number; to: string; usd: number }
  | { id: string; accountId: string; ts: number; kind: 'deposit'; coin: CoinId; amount: number; usd: number }
  | {
      id: string;
      accountId: string;
      ts: number;
      kind: 'swap';
      coin: CoinId;
      amount: number;
      toCoin: CoinId;
      toAmount: number;
      usd: number;
    };

export interface WalletState {
  version: 1;
  accounts: Account[];
  activeId: string;
  txs: Tx[];
  favorites: CoinId[];
}

export type Action =
  | { type: 'createAccount'; name: string }
  | { type: 'renameAccount'; id: string; name: string }
  | { type: 'removeAccount'; id: string }
  | { type: 'selectAccount'; id: string }
  | { type: 'toggleHidden'; coin: CoinId }
  | { type: 'toggleFavorite'; coin: CoinId }
  | { type: 'deposit'; coin: CoinId; amount: number; usd: number }
  | { type: 'send'; coin: CoinId; amount: number; to: string; usd: number }
  | { type: 'swap'; coin: CoinId; amount: number; toCoin: CoinId; toAmount: number; usd: number }
  | { type: 'reset' };

const STORAGE_KEY = 'oramus-wallet:v1';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function initialState(): WalletState {
  const id = uid();
  return {
    version: 1,
    // Seeded with the balances from the reference screenshot (SOL + ETH dust).
    accounts: [{ id, name: 'Account 1', holdings: { SOL: 0.00581, ETH: 0.0000089 }, hidden: [], createdAt: Date.now() }],
    activeId: id,
    txs: [],
    favorites: [],
  };
}

function load(): WalletState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as WalletState;
      if (s.version === 1 && s.accounts?.length) return s;
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return initialState();
}

const EPS = 1e-12;

function updateActive(s: WalletState, fn: (a: Account) => Account): WalletState {
  return { ...s, accounts: s.accounts.map((a) => (a.id === s.activeId ? fn(a) : a)) };
}

function addTo(h: Holdings, coin: CoinId, delta: number): Holdings {
  const v = (h[coin] ?? 0) + delta;
  const out = { ...h };
  if (v <= EPS) delete out[coin];
  else out[coin] = v;
  return out;
}

export function nextAccountName(accounts: Account[]): string {
  let n = accounts.length + 1;
  while (accounts.some((a) => a.name === `Account ${n}`)) n++;
  return `Account ${n}`;
}

export function reducer(s: WalletState, a: Action): WalletState {
  const active = s.accounts.find((x) => x.id === s.activeId)!;
  switch (a.type) {
    case 'createAccount': {
      const id = uid();
      const name = a.name.trim() || nextAccountName(s.accounts);
      return {
        ...s,
        accounts: [...s.accounts, { id, name, holdings: {}, hidden: [], createdAt: Date.now() }],
        activeId: id,
      };
    }
    case 'renameAccount':
      return { ...s, accounts: s.accounts.map((x) => (x.id === a.id ? { ...x, name: a.name.trim() || x.name } : x)) };
    case 'removeAccount': {
      if (s.accounts.length <= 1) return s;
      const accounts = s.accounts.filter((x) => x.id !== a.id);
      return {
        ...s,
        accounts,
        activeId: s.activeId === a.id ? accounts[0].id : s.activeId,
        txs: s.txs.filter((t) => t.accountId !== a.id),
      };
    }
    case 'selectAccount':
      return s.accounts.some((x) => x.id === a.id) ? { ...s, activeId: a.id } : s;
    case 'toggleHidden':
      return updateActive(s, (x) => ({
        ...x,
        hidden: x.hidden.includes(a.coin) ? x.hidden.filter((c) => c !== a.coin) : [...x.hidden, a.coin],
      }));
    case 'toggleFavorite':
      return {
        ...s,
        favorites: s.favorites.includes(a.coin) ? s.favorites.filter((c) => c !== a.coin) : [...s.favorites, a.coin],
      };
    case 'deposit': {
      if (!(a.amount > 0)) return s;
      const next = updateActive(s, (x) => ({ ...x, holdings: addTo(x.holdings, a.coin, a.amount) }));
      return {
        ...next,
        txs: [{ id: uid(), accountId: s.activeId, ts: Date.now(), kind: 'deposit', coin: a.coin, amount: a.amount, usd: a.usd }, ...s.txs],
      };
    }
    case 'send': {
      const bal = active.holdings[a.coin] ?? 0;
      if (!(a.amount > 0) || a.amount > bal + EPS) return s;
      const next = updateActive(s, (x) => ({ ...x, holdings: addTo(x.holdings, a.coin, -a.amount) }));
      return {
        ...next,
        txs: [
          { id: uid(), accountId: s.activeId, ts: Date.now(), kind: 'send', coin: a.coin, amount: a.amount, to: a.to, usd: a.usd },
          ...s.txs,
        ],
      };
    }
    case 'swap': {
      const bal = active.holdings[a.coin] ?? 0;
      if (!(a.amount > 0) || !(a.toAmount > 0) || a.amount > bal + EPS || a.coin === a.toCoin) return s;
      const next = updateActive(s, (x) => ({
        ...x,
        holdings: addTo(addTo(x.holdings, a.coin, -a.amount), a.toCoin, a.toAmount),
      }));
      return {
        ...next,
        txs: [
          {
            id: uid(),
            accountId: s.activeId,
            ts: Date.now(),
            kind: 'swap',
            coin: a.coin,
            amount: a.amount,
            toCoin: a.toCoin,
            toAmount: a.toAmount,
            usd: a.usd,
          },
          ...s.txs,
        ],
      };
    }
    case 'reset':
      return initialState();
  }
}

interface WalletValue {
  state: WalletState;
  active: Account;
  dispatch: Dispatch<Action>;
}

const WalletContext = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode etc. */
    }
  }, [state]);
  const active = state.accounts.find((a) => a.id === state.activeId) ?? state.accounts[0];
  return <WalletContext.Provider value={{ state, active, dispatch }}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const v = useContext(WalletContext);
  if (!v) throw new Error('useWallet outside WalletProvider');
  return v;
}
