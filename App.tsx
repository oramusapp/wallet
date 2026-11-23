import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { CHAINS, type Network } from './src/wallet/chains';
import type { DerivedAccount } from './src/wallet/derive';
import { isValidMnemonic, mnemonicFromEntropy, normalizeMnemonic, pickCheckPositions } from './src/wallet/mnemonic';
import { checkDevice, hasWallet, loadAccounts, revealMnemonic, saveWallet, unlockApp, wipeWallet } from './src/vault';

// Phase 1: testnet only. Mainnet addresses are derived and stored, but not shown until sending is tested.
const NETWORK: Network = 'testnet';
const LOCK_AFTER_MS = 30_000;

type Screen =
  | { k: 'loading' }
  | { k: 'device'; reason: string }
  | { k: 'welcome' }
  | { k: 'create'; words: string[] }
  | { k: 'check'; words: string[]; pos: number[] }
  | { k: 'import' }
  | { k: 'locked' }
  | { k: 'home' }
  | { k: 'seed'; words: string[] };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ k: 'loading' });
  const [accounts, setAccounts] = useState<DerivedAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const bgAt = useRef<number | null>(null);

  // No screenshots or screen recording anywhere in the app (Android FLAG_SECURE), blurred app switcher.
  useEffect(() => { ScreenCapture.preventScreenCaptureAsync('app').catch(() => {}); }, []);

  const start = useCallback(async () => {
    const dev = await checkDevice();
    if (!dev.ok) { setScreen({ k: 'device', reason: dev.reason! }); return; }
    if (await hasWallet()) { setAccounts(await loadAccounts()); setScreen({ k: 'locked' }); }
    else setScreen({ k: 'welcome' });
  }, []);
  useEffect(() => { start(); }, [start]);

  // Lock after the app was in the background for a while; drop the words from memory immediately.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') { bgAt.current = Date.now(); setScreen((s) => (s.k === 'seed' ? { k: 'home' } : s)); return; }
      if (bgAt.current && Date.now() - bgAt.current > LOCK_AFTER_MS) setScreen((s) => (s.k === 'home' ? { k: 'locked' } : s));
      bgAt.current = null;
    });
    return () => sub.remove();
  }, []);

  const unlock = async () => { if (await unlockApp()) setScreen({ k: 'home' }); };
  useEffect(() => { if (screen.k === 'locked') unlock(); }, [screen.k]);

  const newWallet = () => {
    const m = mnemonicFromEntropy(Crypto.getRandomBytes(32));
    setScreen({ k: 'create', words: m.split(' ') });
  };

  const store = async (mnemonic: string) => {
    setBusy(true);
    try { setAccounts(await saveWallet(mnemonic)); setScreen({ k: 'home' }); }
    catch (e) { Alert.alert('Nie zapisano', (e as Error).message); }
    finally { setBusy(false); }
  };

  const showSeed = async () => {
    try { const m = await revealMnemonic(); setScreen({ k: 'seed', words: m.split(' ') }); }
    catch (e) { Alert.alert('Brak dostępu', (e as Error).message); }
  };

  const wipe = () => Alert.alert('Usunąć portfel z telefonu?', 'Środki zostają na blockchainach. Odzyskasz je tylko z 24 słów na kartce. Bez kartki stracisz wszystko.', [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: async () => { await wipeWallet(); setAccounts([]); setScreen({ k: 'welcome' }); } }
  ]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {busy ? <View style={s.center}><ActivityIndicator color={C.accent} /></View> : render()}
    </View>
  );

  function render() {
    switch (screen.k) {
      case 'loading': return <View style={s.center}><ActivityIndicator color={C.accent} /></View>;
      case 'device': return (
        <Page title="Telefon nie spełnia wymagań">
          <P>{screen.reason}</P>
          <P muted>Portfel trzyma klucz tylko w bezpiecznym magazynie telefonu, odblokowywanym biometrią. Bez tego nie startuje.</P>
          <Btn label="Sprawdź ponownie" onPress={start} />
        </Page>);
      case 'welcome': return (
        <Page title="Oramus Wallet">
          <Badge />
          <P>Portfel non-custodial: klucz powstaje i zostaje tylko na tym telefonie. Nikt inny, także twórca aplikacji, nie ma do niego dostępu.</P>
          <Btn label="Utwórz nowy portfel" onPress={newWallet} />
          <Btn label="Mam już 24 słowa (import)" kind="ghost" onPress={() => setScreen({ k: 'import' })} />
        </Page>);
      case 'create': return (
        <Page title="Zapisz 24 słowa">
          <Warn>Zapisz na papierze, w tej kolejności. Bez zdjęć, bez notatek w telefonie, bez chmury. Kto zna te słowa, ma Twoje środki. Kto je zgubi, traci środki na zawsze.</Warn>
          <Words words={screen.words} />
          <Btn label="Zapisałem na kartce" onPress={() => setScreen({ k: 'check', words: screen.words, pos: pickCheckPositions(Crypto.getRandomBytes(16), screen.words.length, 3) })} />
          <Btn label="Anuluj" kind="ghost" onPress={() => setScreen({ k: 'welcome' })} />
        </Page>);
      case 'check': return <CheckWords words={screen.words} pos={screen.pos} onOk={() => store(screen.words.join(' '))} onBack={() => setScreen({ k: 'create', words: screen.words })} />;
      case 'import': return <ImportWords onOk={store} onBack={() => setScreen({ k: 'welcome' })} />;
      case 'locked': return (
        <View style={s.center}>
          <Text style={s.h1}>Oramus Wallet</Text>
          <Btn label="Odblokuj" onPress={unlock} />
        </View>);
      case 'home': return <Home accounts={accounts.filter((a) => a.network === NETWORK)} onSeed={showSeed} onWipe={wipe} />;
      case 'seed': return <SeedView words={screen.words} onClose={() => setScreen({ k: 'home' })} />;
    }
  }
}

function Home({ accounts, onSeed, onWipe }: { accounts: DerivedAccount[]; onSeed: () => void; onWipe: () => void }) {
  const [copied, setCopied] = useState('');
  const copy = async (a: DerivedAccount) => { await Clipboard.setStringAsync(a.address); setCopied(a.chainId); setTimeout(() => setCopied(''), 1500); };
  return (
    <Page title="Adresy">
      <Badge />
      {(['A', 'B', 'C'] as const).map((g) => (
        <View key={g} style={{ marginTop: 14 }}>
          <Text style={s.group}>{g === 'A' ? 'Grupa A · EVM (jeden adres na wszystkich sieciach EVM)' : g === 'B' ? 'Grupa B · Bitcoin i podobne' : 'Grupa C · Solana i podobne'}</Text>
          {CHAINS.filter((c) => c.group === g).map((c) => {
            const a = accounts.find((x) => x.chainId === c.id);
            if (!a) return null;
            return (
              <Pressable key={c.id} style={s.card} onPress={() => copy(a)} accessibilityLabel={'Kopiuj adres ' + c.name}>
                <Text style={s.cardT}>{c.name}</Text>
                <Text style={s.coins}>{c.coins.join(' · ')}</Text>
                <Text style={s.addr} selectable>{a.address}</Text>
                <Text style={s.meta}>{copied === c.id ? 'Skopiowano' : 'Stuknij, aby skopiować · ' + a.path}{c.sendLater ? '\n' + c.sendLater : ''}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ height: 18 }} />
      <Btn label="Pokaż 24 słowa (biometria)" kind="ghost" onPress={onSeed} />
      <Btn label="Usuń portfel z telefonu" kind="danger" onPress={onWipe} />
    </Page>
  );
}

function CheckWords({ words, pos, onOk, onBack }: { words: string[]; pos: number[]; onOk: () => void; onBack: () => void }) {
  const [vals, setVals] = useState<string[]>(pos.map(() => ''));
  const ok = pos.every((p, i) => normalizeMnemonic(vals[i]) === words[p]);
  return (
    <Page title="Sprawdź kartkę">
      <P>Wpisz słowa z kartki, żeby potwierdzić, że zapis jest poprawny.</P>
      {pos.map((p, i) => (
        <TextInput key={p} style={s.input} placeholder={'Słowo nr ' + (p + 1)} placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} spellCheck={false}
          importantForAutofill="no" keyboardType="visible-password" value={vals[i]} onChangeText={(t) => setVals(vals.map((v, j) => (j === i ? t : v)))} />
      ))}
      <Btn label="Zapisz portfel na telefonie" disabled={!ok} onPress={onOk} />
      <Btn label="Wróć do słów" kind="ghost" onPress={onBack} />
    </Page>
  );
}

function ImportWords({ onOk, onBack }: { onOk: (m: string) => void; onBack: () => void }) {
  const [t, setT] = useState('');
  const n = normalizeMnemonic(t).split(' ').filter(Boolean).length;
  const valid = isValidMnemonic(t);
  return (
    <Page title="Import 12 albo 24 słów">
      <Warn>Wpisuj tylko na tym telefonie. Nigdy nie wklejaj słów na stronach ani w czatach.</Warn>
      <TextInput style={[s.input, { minHeight: 120, textAlignVertical: 'top' }]} multiline autoCapitalize="none" autoCorrect={false} spellCheck={false}
        importantForAutofill="no" keyboardType="visible-password" placeholder="słowo1 słowo2 …" placeholderTextColor={C.muted} value={t} onChangeText={setT} />
      <P muted>{n} słów · {valid ? 'suma kontrolna OK' : 'jeszcze nieprawidłowe'}</P>
      <Btn label="Zapisz portfel na telefonie" disabled={!valid} onPress={() => onOk(t)} />
      <Btn label="Anuluj" kind="ghost" onPress={onBack} />
    </Page>
  );
}

function SeedView({ words, onClose }: { words: string[]; onClose: () => void }) {
  useEffect(() => { const id = setTimeout(onClose, 60_000); return () => clearTimeout(id); }, [onClose]);
  return (
    <Page title="Twoje 24 słowa">
      <Warn>Nikt z obsługi ani żadna strona nigdy nie poprosi o te słowa. Ekran zamknie się sam po 60 s.</Warn>
      <Words words={words} />
      <Btn label="Zamknij" onPress={onClose} />
    </Page>
  );
}

// ---------- small UI pieces ----------
const C = { bg: '#0b0f14', card: '#141b24', line: '#223040', ink: '#e8eef5', muted: '#8aa0b5', accent: '#f2c14e', warn: '#ff8a65', danger: '#ff5c5c', ok: '#4cd38a' };

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{title}</Text>
      {children}
    </ScrollView>
  );
}
const P = ({ children, muted }: { children: React.ReactNode; muted?: boolean }) => <Text style={[s.p, muted && { color: C.muted }]}>{children}</Text>;
const Warn = ({ children }: { children: React.ReactNode }) => <Text style={s.warn}>{children}</Text>;
const Badge = () => <Text style={s.badge}>TESTNET · faza 1 · bez prawdziwych środków</Text>;
function Btn({ label, onPress, kind = 'main', disabled }: { label: string; onPress: () => void; kind?: 'main' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={[s.btn, kind === 'ghost' && s.btnGhost, kind === 'danger' && s.btnDanger, disabled && { opacity: 0.4 }]}>
      <Text style={[s.btnT, kind !== 'main' && { color: kind === 'danger' ? C.danger : C.ink }]}>{label}</Text>
    </Pressable>
  );
}
function Words({ words }: { words: string[] }) {
  return (
    <View style={s.words}>
      {words.map((w, i) => (
        <View key={i} style={s.word}><Text style={s.wordN}>{i + 1}</Text><Text style={s.wordT}>{w}</Text></View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: RNStatusBar.currentHeight ?? 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  page: { padding: 20, paddingBottom: 48 },
  h1: { color: C.ink, fontSize: 26, fontWeight: '800', marginBottom: 12 },
  p: { color: C.ink, fontSize: 16, lineHeight: 23, marginBottom: 12 },
  warn: { color: C.warn, fontSize: 15, lineHeight: 22, marginBottom: 14, borderWidth: 1, borderColor: C.warn, borderRadius: 12, padding: 12 },
  badge: { color: C.bg, backgroundColor: C.accent, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, fontWeight: '800', fontSize: 12, marginBottom: 14, overflow: 'hidden' },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.danger },
  btnT: { color: C.bg, fontSize: 16, fontWeight: '800' },
  input: { backgroundColor: C.card, color: C.ink, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12, fontSize: 16, marginBottom: 10 },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  word: { width: '31%', flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 8, gap: 6 },
  wordN: { color: C.muted, fontSize: 12, width: 18, textAlign: 'right' },
  wordT: { color: C.ink, fontSize: 15, fontWeight: '700' },
  group: { color: C.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  cardT: { color: C.ink, fontSize: 16, fontWeight: '800' },
  coins: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  addr: { color: C.ink, fontFamily: 'monospace', fontSize: 13.5, marginTop: 8 },
  meta: { color: C.muted, fontSize: 12, marginTop: 6 }
});
