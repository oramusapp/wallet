import { Icon, SheetHeader } from '../../components/ui';
import { isIOS, isStandalone } from '../../lib/display';
import { useNav } from '../../state/nav';
import { usePrices } from '../../state/prices';
import { useWallet } from '../../state/wallet';

export function SettingsSheet() {
  const nav = useNav();
  const { state, dispatch } = useWallet();
  const { status, updatedAt } = usePrices();

  return (
    <>
      <SheetHeader title="Settings" onClose={nav.closeAll} />
      <div className="pad stack">
        <div className="kv card">
          <div>
            <span>Price feed</span>
            <span>{status === 'live' ? 'Live (WebSocket)' : status === 'polling' ? 'Polling (REST)' : status === 'loading' ? 'Connecting…' : 'Offline'}</span>
          </div>
          <div>
            <span>Price source</span>
            <span>Hyperliquid</span>
          </div>
          <div>
            <span>Last update</span>
            <span>{updatedAt ? new Date(updatedAt).toLocaleTimeString('en-US') : '—'}</span>
          </div>
          <div>
            <span>Accounts</span>
            <span>{state.accounts.length}</span>
          </div>
          <div>
            <span>Display</span>
            <span>{isStandalone() ? 'Web app (home screen)' : 'Browser'}</span>
          </div>
          <div>
            <span>App version</span>
            <span className="mono">{__APP_VERSION__.slice(0, 7)}</span>
          </div>
        </div>

        {!isStandalone() && (
          <p className="demo-note">
            {isIOS()
              ? 'To open without the address bar: in Safari tap Share → Add to Home Screen, turn on "Open as Web App", then tap Add. Remove the old icon first.'
              : 'To open without the address bar, install the app from your browser menu (Install app / Add to Home Screen).'}
          </p>
        )}

        <button type="button" className="option-row card" onClick={() => nav.push({ kind: 'manageTokens' })}>
          <span className="option-icon">
            <Icon name="coins" />
          </span>
          <span className="row-title grow">Manage Tokens</span>
          <Icon name="chevronRight" size={18} />
        </button>

        <button
          type="button"
          className="option-row card danger-row"
          onClick={() => {
            if (confirm('Reset all demo accounts, balances and history?')) {
              dispatch({ type: 'reset' });
              nav.closeAll();
              nav.setTab('home');
            }
          }}
        >
          <span className="option-icon">
            <Icon name="trash" />
          </span>
          <div className="col grow">
            <span className="row-title">Reset demo data</span>
            <span className="row-sub">Deletes all accounts, balances and history in this browser</span>
          </div>
        </button>
      </div>
    </>
  );
}
