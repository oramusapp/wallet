import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenCapture from 'expo-screen-capture';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DerivedAccount } from './src/wallet/derive';
import { assetsFor, evmParents, type Asset } from './src/net/assets';
import { tokenToAsset, type StoredToken } from './src/net/tokens';
import { RELEASE_SIGNED } from './src/config';
import { fetchBalance } from './src/net/balances';
import { checkDevice, hasWallet, loadAccounts, loadNetwork, loadTokens, revealMnemonic, saveNetwork, saveTokens, saveWallet, unlockApp, wipeWallet } from './src/vault';
import { Btn, C } from './src/ui/kit';
import { CheckWords, DeviceProblem, ImportWords, newWords, ShowWords, Welcome } from './src/ui/Onboarding';
import { AssetDetail, Home, Receive, type Bals } from './src/ui/Wallet';
import { Send } from './src/ui/Send';
import { Addresses, NetworkScreen, Security, SeedView, Settings } from './src/ui/Settings';
import { Tokens } from './src/ui/Tokens';

const LOCK_AFTER_MS = 30_000;

type Phase =
  | { k: 'loading' } | { k: 'device'; reason: string } | { k: 'welcome' }
  | { k: 'create'; words: string[] } | { k: 'check'; words: string[]; pos: number[] } | { k: 'import' }
  | { k: 'locked' } | { k: 'main' };
type Tab = 'wallet' | 'receive' | 'send' | 'settings';
type Overlay = null | { k: 'asset'; a: Asset } | { k: 'send'; a?: Asset } | { k: 'receive'; a?: Asset } | { k: 'seed'; words: string[] } | { k: 'addresses' } | { k: 'security' } | { k: 'network' } | { k: 'tokens' };

export default function App() {
  return <SafeAreaProvider><Root /></SafeAreaProvider>;
}

function Root() {
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [tab, setTab] = useState<Tab>('wallet');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [accounts, setAccounts] = useState<DerivedAccount[]>([]);
  const [bals, setBals] = useState<Bals>({});
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [net, setNet] = useState<'testnet' | 'mainnet'>('testnet');
  const [tokens, setTokens] = useState<StoredToken[]>([]);
  const bgAt = useRef<number | null>(null);

  useEffect(() => { ScreenCapture.preventScreenCaptureAsync('app').catch(() => {}); }, []);

  const start = useCallback(async () => {
    const dev = await checkDevice();
    if (!dev.ok) { setPhase({ k: 'device', reason: dev.reason! }); return; }
    if (await hasWallet()) {
      setAccounts(await loadAccounts());
      const n = await loadNetwork();
      setNet(n === 'mainnet' && !RELEASE_SIGNED ? 'testnet' : n); // a debug-signed build never opens on mainnet
      setTokens(await loadTokens<StoredToken>());
      setPhase({ k: 'locked' });
    }
    else setPhase({ k: 'welcome' });
  }, []);
  useEffect(() => { start(); }, [start]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') { bgAt.current = Date.now(); setOverlay((o) => (o?.k === 'seed' ? null : o)); return; }
      if (bgAt.current && Date.now() - bgAt.current > LOCK_AFTER_MS) setPhase((p) => (p.k === 'main' ? { k: 'locked' } : p));
      bgAt.current = null;
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => { if (await unlockApp()) setPhase({ k: 'main' }); }, []);
  useEffect(() => { if (phase.k === 'locked') unlock(); }, [phase.k, unlock]);

  const assets = assetsFor(net, tokens.map(tokenToAsset).filter((x): x is Asset => !!x));
  const acc = (a: Asset) => accounts.find((x) => x.chainId === a.chainId && x.network === a.net);
  const accountFor = (a: Asset) => acc(a)?.address ?? '';
  const pubkeyFor = (a: Asset) => acc(a)?.publicKey ?? '';

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const live = assets.filter((a) => a.kind !== 'none');
    setBals((b) => ({ ...b, ...Object.fromEntries(live.map((a) => [a.id, { ...b[a.id], loading: true }])) }));
    await Promise.all(live.map(async (a) => {
      const addr = accounts.find((x) => x.chainId === a.chainId && x.network === a.net)?.address;
      if (!addr) return;
      try { const v = await fetchBalance(a, addr); setBals((b) => ({ ...b, [a.id]: { v } })); }
      catch (e) { setBals((b) => ({ ...b, [a.id]: { v: b[a.id]?.v, err: (e as Error).message } })); }
    }));
    setRefreshing(false);
  }, [accounts, net, tokens]);
  useEffect(() => { if (phase.k === 'main') refresh(); }, [phase.k, refresh]);

  const store = async (m: string) => {
    setBusy(true);
    try { setAccounts(await saveWallet(m)); setTab('wallet'); setOverlay(null); setPhase({ k: 'main' }); }
    catch (e) { Alert.alert('Nie zapisano', (e as Error).message); }
    finally { setBusy(false); }
  };

  const showSeed = async () => {
    try { setOverlay({ k: 'seed', words: (await revealMnemonic()).split(' ') }); }
    catch (e) { Alert.alert('Brak dostępu', (e as Error).message); }
  };

  const wipe = () => Alert.alert('Usunąć portfel z telefonu?', 'Środki zostają na blockchainach. Odzyskasz je tylko z 24 słów na kartce. Bez kartki stracisz wszystko.', [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: async () => { await wipeWallet(); setAccounts([]); setBals({}); setTokens([]); setNet('testnet'); setOverlay(null); setPhase({ k: 'welcome' }); } }
  ]);

  const sendable = assets.filter((a) => a.canSend);
  const receivable = assets;
  const setNetwork = async (n: 'testnet' | 'mainnet') => {
    if (n === 'mainnet' && !RELEASE_SIGNED) return;
    await saveNetwork(n); setNet(n); setOverlay(null); setTab('wallet');
  };
  const addToken = async (t: StoredToken) => { const l = [...tokens, t]; await saveTokens(l); setTokens(l); };
  const removeToken = async (t: StoredToken) => { const l = tokens.filter((x) => !(x.parentId === t.parentId && x.token === t.token)); await saveTokens(l); setTokens(l); };

  function body() {
    switch (phase.k) {
      case 'loading': return <View style={{ flex: 1 }} />;
      case 'device': return <DeviceProblem reason={phase.reason} onRetry={start} />;
      case 'welcome': return <Welcome onCreate={() => setPhase({ k: 'create', words: newWords() })} onImport={() => setPhase({ k: 'import' })} />;
      case 'create': return <ShowWords words={phase.words} onBack={() => setPhase({ k: 'welcome' })} onNext={(pos) => setPhase({ k: 'check', words: phase.words, pos })} />;
      case 'check': return <CheckWords words={phase.words} pos={phase.pos} busy={busy} onBack={() => setPhase({ k: 'create', words: phase.words })} onOk={() => store(phase.words.join(' '))} />;
      case 'import': return <ImportWords busy={busy} onBack={() => setPhase({ k: 'welcome' })} onOk={store} />;
      case 'locked': return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}><Text style={{ fontSize: 38, fontWeight: '900', color: C.accentInk }}>O</Text></View>
          <Text style={{ color: C.ink, fontSize: 22, fontWeight: '900', marginBottom: 24 }}>Portfel zablokowany</Text>
          <Btn label="Odblokuj odciskiem palca" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        </View>);
      case 'main': return main();
    }
  }

  function main() {
    const back = () => setOverlay(null);
    if (overlay) {
      switch (overlay.k) {
        case 'asset': return <AssetDetail a={overlay.a} b={bals[overlay.a.id]} address={accountFor(overlay.a)} onBack={back}
          onSend={() => setOverlay({ k: 'send', a: overlay.a })} onReceive={() => setOverlay({ k: 'receive', a: overlay.a })} />;
        case 'send': return <Send key={net} assets={sendable} initial={overlay.a} bals={bals} accountFor={accountFor} pubkeyFor={pubkeyFor} onBack={back} onSent={refresh} />;
        case 'receive': return <Receive key={net} assets={receivable} initial={overlay.a} accountFor={accountFor} onBack={back} />;
        case 'seed': return <SeedView words={overlay.words} onClose={back} />;
        case 'addresses': return <Addresses accounts={accounts.filter((a) => a.network === net)} onBack={back} />;
        case 'network': return <NetworkScreen net={net} onSet={setNetwork} onBack={back} />;
        case 'tokens': return <Tokens parents={evmParents(net)} tokens={tokens} onAdd={addToken} onRemove={removeToken} onBack={back} />;
        case 'security': return <Security onBack={back} />;
      }
    }
    switch (tab) {
      case 'wallet': return <Home assets={assets} net={net} bals={bals} refreshing={refreshing} onRefresh={refresh} onOpen={(a) => setOverlay({ k: 'asset', a })} onSend={() => setTab('send')} onReceive={() => setTab('receive')} />;
      case 'receive': return <Receive key={net} assets={receivable} accountFor={accountFor} />;
      case 'send': return <Send key={net} assets={sendable} bals={bals} accountFor={accountFor} pubkeyFor={pubkeyFor} onSent={refresh} onBack={() => setTab('wallet')} />;
      case 'settings': return <Settings net={net} onNetwork={() => setOverlay({ k: 'network' })} onTokens={() => setOverlay({ k: 'tokens' })} onSeed={showSeed} onAddresses={() => setOverlay({ k: 'addresses' })} onSecurity={() => setOverlay({ k: 'security' })} onWipe={wipe} />;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>{body()}</View>
      {phase.k === 'main' && !overlay ? <TabBar tab={tab} onTab={setTab} /> : null}
    </View>
  );
}

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const ins = useSafeAreaInsets();
  const items: [Tab, string, string][] = [['wallet', '◎', 'Portfel'], ['receive', '↓', 'Odbierz'], ['send', '↑', 'Wyślij'], ['settings', '⚙', 'Ustawienia']];
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card, paddingBottom: Math.max(ins.bottom, 8) }} accessibilityRole="tablist">
      {items.map(([k, icon, label]) => {
        const on = tab === k;
        return (
          <Pressable key={k} onPress={() => onTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
            style={{ flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 6, minHeight: 58 }}>
            <Text style={{ fontSize: 20, color: on ? C.accent : C.muted, fontWeight: '900' }}>{icon}</Text>
            <Text style={{ fontSize: 12, marginTop: 2, color: on ? C.accent : C.muted, fontWeight: on ? '800' : '600' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
