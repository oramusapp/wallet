import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ASSETS, type Asset } from '../net/assets';
import { formatAmount } from '../net/units';
import { getLimits, type Limits } from '../net/limits';
import { Btn, C, Card, Chip, CoinIcon, KV, Note, P, Screen } from './kit';
import { QR } from './QR';

/** Polish plural: 1 aktywo, 2–4 aktywa, 5+ aktywów (12–14 aktywów). */
export function plAktywa(n: number): string {
  if (n === 1) return 'aktywo';
  const d = n % 10, t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'aktywa' : 'aktywów';
}

export type Bal = { v?: bigint; err?: string; loading?: boolean };
export type Bals = Record<string, Bal>;

export function balText(a: Asset, b?: Bal, frac = 6): string {
  if (a.kind === 'none') return '—';
  if (!b || (b.loading && b.v === undefined)) return '…';
  if (b.v === undefined) return 'błąd';
  return formatAmount(b.v, a.decimals, frac);
}

export function Home({ bals, refreshing, onRefresh, onOpen, onSend, onReceive }: {
  bals: Bals; refreshing: boolean; onRefresh: () => void; onOpen: (a: Asset) => void; onSend: () => void; onReceive: () => void;
}) {
  const ins = useSafeAreaInsets();
  const live = ASSETS.filter((a) => a.kind !== 'none');
  const later = ASSETS.filter((a) => a.kind === 'none');
  const funded = live.filter((a) => (bals[a.id]?.v ?? 0n) > 0n).length;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: ins.top + 12, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
      <Text style={{ color: C.muted, fontWeight: '800', fontSize: 13, letterSpacing: 0.6 }}>PORTFEL · TESTNET</Text>
      <Text style={{ color: C.ink, fontSize: 30, fontWeight: '900', marginTop: 4 }}>{funded ? funded + ' ' + plAktywa(funded) + ' z saldem' : 'Pusty portfel'}</Text>
      <Text style={{ color: C.muted, marginTop: 4, marginBottom: 18 }}>Monety testowe nie mają wartości. Przeciągnij w dół, aby odświeżyć.</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
        <Btn label="↓  Odbierz" kind="soft" onPress={onReceive} style={{ flex: 1 }} />
        <Btn label="↑  Wyślij" onPress={onSend} style={{ flex: 1 }} />
      </View>
      {live.map((a) => <AssetRow key={a.id} a={a} b={bals[a.id]} onPress={() => onOpen(a)} />)}
      <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 0.6, marginTop: 18, marginBottom: 8 }}>TYLKO ADRES (SALDA W KOLEJNYM ETAPIE)</Text>
      {later.map((a) => <AssetRow key={a.id} a={a} onPress={() => onOpen(a)} />)}
    </ScrollView>
  );
}

function AssetRow({ a, b, onPress }: { a: Asset; b?: Bal; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a.name + ' ' + a.network + ', saldo ' + balText(a, b)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, opacity: pressed ? 0.6 : 1, minHeight: 64 })}>
      <CoinIcon symbol={a.symbol} color={a.color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.ink, fontSize: 17, fontWeight: '800' }}>{a.name}</Text>
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{a.network}{a.canSend ? '' : a.kind === 'none' ? '' : ' · tylko odbiór'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: b?.err && b.v === undefined ? C.danger : C.ink, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{balText(a, b)}</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>{a.symbol}</Text>
      </View>
    </Pressable>
  );
}

export function AssetDetail({ a, b, address, onBack, onSend, onReceive }: { a: Asset; b?: Bal; address: string; onBack: () => void; onSend: () => void; onReceive: () => void }) {
  return (
    <Screen onBack={onBack} title={a.name}
      footer={<View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn label="↓  Odbierz" kind="soft" onPress={onReceive} style={{ flex: 1 }} />
        <Btn label="↑  Wyślij" onPress={onSend} disabled={!a.canSend} style={{ flex: 1 }} />
      </View>}>
      <View style={{ alignItems: 'center', marginVertical: 18 }}>
        <CoinIcon symbol={a.symbol} color={a.color} size={64} />
        <Text style={{ color: C.ink, fontSize: 34, fontWeight: '900', marginTop: 14, fontVariant: ['tabular-nums'] }}>{balText(a, b, 8)} <Text style={{ color: C.muted, fontSize: 20 }}>{a.symbol}</Text></Text>
        <Text style={{ color: C.muted, marginTop: 4 }}>{a.network}</Text>
      </View>
      {b?.err && b.v === undefined ? <Note tone="danger">Nie udało się pobrać salda: {b.err}</Note> : null}
      {a.note ? <Note tone="info">{a.note}</Note> : null}
      {!a.canSend && a.kind !== 'none' ? <Note tone="info">Wysyłka z tej sieci będzie w kolejnym etapie. Odbiór działa.</Note> : null}
      {a.kind !== 'none' ? <LimitsCard a={a} address={address} /> : null}
      <Card>
        <KV k="Twój adres" v={address} mono />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {a.explorerAddr ? <Chip label="Eksplorator ↗" onPress={() => Linking.openURL(a.explorerAddr!(address))} /> : null}
          {a.faucet ? <Chip label="Testowe monety (faucet) ↗" onPress={() => Linking.openURL(a.faucet!)} /> : null}
        </View>
      </Card>
    </Screen>
  );
}

export function Receive({ assets, accountFor, initial, onBack }: { assets: Asset[]; accountFor: (a: Asset) => string; initial?: Asset; onBack?: () => void }) {
  const [a, setA] = useState<Asset>(initial ?? assets[0]);
  const [copied, setCopied] = useState(false);
  const addr = accountFor(a);
  const copy = async () => { await Clipboard.setStringAsync(addr); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <Screen title="Odbierz" onBack={onBack}
      footer={<View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn label={copied ? 'Skopiowano ✓' : 'Kopiuj adres'} onPress={copy} style={{ flex: 1 }} />
        <Btn label="Udostępnij" kind="soft" onPress={() => Share.share({ message: addr })} style={{ flex: 1 }} />
      </View>}>
      <AssetPicker assets={assets} value={a} onChange={setA} />
      <View style={{ marginVertical: 16 }}><QR value={addr} /></View>
      <Text selectable style={{ color: C.ink, fontFamily: 'monospace', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 14 }}>{addr}</Text>
      <Note>Wysyłaj tu tylko {a.symbol} w sieci {a.network}. Inna sieć = ryzyko utraty środków.</Note>
      {a.chainId === 'evm' ? <P muted>Ten sam adres działa na wszystkich sieciach EVM (Ethereum, Arbitrum, Base, BNB, Avalanche, HyperEVM…).</P> : null}
      {a.kind !== 'none' ? <LimitsCard a={a} address={addr} /> : null}
    </Screen>
  );
}

export function AssetPicker({ assets, value, onChange }: { assets: Asset[]; value: Asset; onChange: (a: Asset) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {assets.map((x) => {
        const on = x.id === value.id;
        return (
          <Pressable key={x.id} onPress={() => onChange(x)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, borderRadius: 14, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accent + '1f' : C.card }}>
            <CoinIcon symbol={x.symbol} color={x.color} size={28} />
            <View><Text style={{ color: C.ink, fontWeight: '800', fontSize: 14 }}>{x.symbol}</Text><Text style={{ color: C.muted, fontSize: 11 }}>{x.network}</Text></View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function LimitsCard({ a, address }: { a: Asset; address: string }) {
  const [lim, setLim] = useState<Limits | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { let live = true; getLimits(a, address).then((l) => live && setLim(l), (e) => live && setErr((e as Error).message)); return () => { live = false; }; }, [a.id, address]);
  return (
    <Card>
      <Text style={{ color: C.ink, fontWeight: '800', fontSize: 15, marginBottom: 6 }}>Minimum, rezerwa i opłata (na żywo z sieci)</Text>
      {lim ? (lim.lines.length ? lim.lines.map((l) => <Text key={l} style={{ color: C.ink2, fontSize: 14, lineHeight: 20, marginBottom: 4 }}>• {l}</Text>) : <Text style={{ color: C.muted }}>Brak danych dla tej sieci.</Text>)
        : err ? <Text style={{ color: C.danger }}>Nie udało się pobrać: {err}</Text> : <ActivityIndicator color={C.accent} style={{ alignSelf: 'flex-start' }} />}
    </Card>
  );
}
