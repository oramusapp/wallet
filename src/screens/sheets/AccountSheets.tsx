import { useState } from 'react';
import { Avatar, Button, Icon, IconButton, SheetHeader } from '../../components/ui';
import { positions, totals } from '../../lib/portfolio';
import { fmtUsd } from '../../lib/format';
import { useNav } from '../../state/nav';
import { usePrices } from '../../state/prices';
import { nextAccountName, useWallet } from '../../state/wallet';

export function AccountsSheet() {
  const { state, dispatch } = useWallet();
  const { prices, coins } = usePrices();
  const nav = useNav();
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      <SheetHeader title="Your Accounts" onClose={nav.closeAll} right={<IconButton icon="plus" label="Add account" onClick={() => nav.push({ kind: 'createAccount' })} />} />
      <div className="pad stack">
        <h2 className="section-title">Accounts</h2>
        {state.accounts.map((a) => {
          const value = totals(positions(a.holdings, prices, coins)).value;
          const selected = a.id === state.activeId;
          return (
            <div key={a.id} className={`account-row card${selected ? ' selected' : ''}`}>
              <button
                type="button"
                className="account-main"
                onClick={() => {
                  dispatch({ type: 'selectAccount', id: a.id });
                  nav.closeAll();
                }}
              >
                <Avatar name={a.name} size={36} />
                {editing?.id === a.id ? (
                  <input
                    className="inline-input"
                    value={editing.name}
                    autoFocus
                    maxLength={32}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditing({ id: a.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        dispatch({ type: 'renameAccount', id: a.id, name: editing.name });
                        setEditing(null);
                      }
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    onBlur={() => {
                      dispatch({ type: 'renameAccount', id: a.id, name: editing.name });
                      setEditing(null);
                    }}
                    aria-label="Account name"
                  />
                ) : (
                  <div className="col grow">
                    <span className="row-title">{a.name}</span>
                    <span className="row-sub">{fmtUsd(value)}</span>
                  </div>
                )}
                {selected && <Icon name="check" size={18} className="accent" />}
              </button>
              <IconButton icon="dots" label={`${a.name} options`} onClick={() => setMenu(menu === a.id ? null : a.id)} />
              {menu === a.id && (
                <div className="popover" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setEditing({ id: a.id, name: a.name });
                      setMenu(null);
                    }}
                  >
                    <Icon name="pencil" size={16} /> Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    disabled={state.accounts.length <= 1}
                    onClick={() => {
                      if (confirm(`Remove ${a.name}? Its demo balances and history will be deleted.`)) dispatch({ type: 'removeAccount', id: a.id });
                      setMenu(null);
                    }}
                  >
                    <Icon name="trash" size={16} /> Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function CreateAccountSheet() {
  const { state, dispatch } = useWallet();
  const nav = useNav();
  const [name, setName] = useState(() => nextAccountName(state.accounts));
  const [creating, setCreating] = useState(false);

  const create = () => {
    setCreating(true);
    setTimeout(() => {
      dispatch({ type: 'createAccount', name });
      nav.closeAll();
      nav.setTab('home');
    }, 500);
  };

  return (
    <div className="sheet-fill">
      <SheetHeader title="Create Account" onBack={nav.back} />
      <div className="pad">
        <label className="text-field">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoFocus aria-label="Account name" onKeyDown={(e) => e.key === 'Enter' && name.trim() && create()} />
          {name && <IconButton icon="close" label="Clear" onClick={() => setName('')} />}
        </label>
      </div>
      <div className="sheet-footer">
        <Button className="block" onClick={create} disabled={!name.trim() || creating}>
          {creating ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </div>
  );
}
