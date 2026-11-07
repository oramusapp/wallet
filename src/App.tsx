import { useEffect, useState } from 'react';
import { Avatar, Icon } from './components/ui';
import { Home } from './screens/Home';
import { Markets } from './screens/Markets';
import { Trade } from './screens/Trade';
import { AccountsSheet, CreateAccountSheet } from './screens/sheets/AccountSheets';
import { DepositSheet, ReceiveSheet } from './screens/sheets/DepositSheets';
import { SendSheet } from './screens/sheets/SendSheet';
import { TokenDetailSheet } from './screens/sheets/TokenDetailSheet';
import { HistorySheet, ManageTokensSheet, TokensSheet } from './screens/sheets/TokenSheets';
import { useNav, type SheetRoute, type Tab } from './state/nav';
import { usePrices } from './state/prices';
import { useWallet } from './state/wallet';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'trade', label: 'Trade' },
  { id: 'markets', label: 'Markets' },
];

function routeKey(r: SheetRoute, i: number): string {
  return `${i}-${r.kind}-${'coin' in r ? (r.coin ?? '') : ''}`;
}

function SheetBody({ route }: { route: SheetRoute }) {
  switch (route.kind) {
    case 'tokens':
      return <TokensSheet />;
    case 'manageTokens':
      return <ManageTokensSheet />;
    case 'accounts':
      return <AccountsSheet />;
    case 'createAccount':
      return <CreateAccountSheet />;
    case 'send':
      return <SendSheet initialCoin={route.coin} />;
    case 'deposit':
      return <DepositSheet />;
    case 'receive':
      return <ReceiveSheet initialCoin={route.coin} />;
    case 'token':
      return <TokenDetailSheet coinId={route.coin} />;
    case 'history':
      return <HistorySheet />;
  }
}

function SheetHost() {
  const nav = useNav();
  const top = nav.stack[nav.stack.length - 1];
  const open = !!top;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && nav.back();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, nav]);

  return (
    <>
      <div className={`scrim${open ? ' show' : ''}`} onClick={nav.closeAll} aria-hidden="true" />
      <div className={`sheet${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <div className="grabber" onClick={nav.closeAll} />
        {top && (
          <div className="sheet-body" key={routeKey(top, nav.stack.length)}>
            <SheetBody route={top} />
          </div>
        )}
      </div>
    </>
  );
}

function Drawer() {
  const nav = useNav();
  const { active, dispatch } = useWallet();
  const { status } = usePrices();
  const go = (r: SheetRoute) => {
    nav.setDrawer(false);
    nav.open(r);
  };
  const items: { icon: Parameters<typeof Icon>[0]['name']; label: string; onClick: () => void }[] = [
    { icon: 'history', label: 'History', onClick: () => go({ kind: 'history' }) },
    { icon: 'coins', label: 'Manage Tokens', onClick: () => go({ kind: 'manageTokens' }) },
    { icon: 'plus', label: 'Add Account', onClick: () => go({ kind: 'createAccount' }) },
  ];
  return (
    <>
      <div className={`scrim${nav.drawer ? ' show' : ''}`} onClick={() => nav.setDrawer(false)} aria-hidden="true" />
      <nav className={`drawer${nav.drawer ? ' open' : ''}`} aria-hidden={!nav.drawer} aria-label="Account menu">
        <div className="drawer-top">
          <Avatar name={active.name} size={40} />
        </div>
        <button type="button" className="drawer-account" onClick={() => go({ kind: 'accounts' })}>
          {active.name} <Icon name="chevronDown" size={18} />
        </button>
        <div className="drawer-items">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={it.onClick}>
              <Icon name={it.icon} size={18} /> {it.label}
            </button>
          ))}
        </div>
        <div className="drawer-bottom">
          <button
            type="button"
            onClick={() => {
              if (confirm('Reset all demo accounts, balances and history?')) {
                dispatch({ type: 'reset' });
                nav.setDrawer(false);
              }
            }}
          >
            <Icon name="settings" size={18} /> Reset demo data
          </button>
          <div className={`feed-status ${status}`}>
            <span className="dot" />
            {status === 'live' ? 'Live · Hyperliquid' : status === 'polling' ? 'Polling · Hyperliquid' : status === 'loading' ? 'Connecting…' : 'Price feed offline'}
          </div>
        </div>
      </nav>
    </>
  );
}

export default function App() {
  const nav = useNav();
  const { active } = useWallet();
  const { status } = usePrices();
  const [query, setQuery] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [nav.tab]);

  return (
    <div className="app">
      <header className="topbar">
        <Avatar name={active.name} size={34} onClick={() => nav.setDrawer(true)} />
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={nav.tab === t.id} className={nav.tab === t.id ? 'active' : ''} onClick={() => nav.setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {status === 'error' && <div className="banner">Can't reach Hyperliquid. Retrying…</div>}

      <main>
        {nav.tab === 'home' && <Home />}
        {nav.tab === 'trade' && <Trade />}
        {nav.tab === 'markets' && <Markets query={query} />}
      </main>

      <div className="bottombar">
        <label className="search-field">
          <Icon name="search" size={16} />
          <input
            placeholder="Search tokens"
            value={query}
            onFocus={() => nav.setTab('markets')}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tokens"
          />
        </label>
        <button type="button" className="fab" aria-label="Deposit" onClick={() => nav.open({ kind: 'deposit' })}>
          <Icon name="plus" size={22} />
        </button>
      </div>

      <Drawer />
      <SheetHost />
    </div>
  );
}
