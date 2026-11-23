import { useState } from 'react';
import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Asset } from '../net/assets';
import { readTokenMeta, type StoredToken } from '../net/tokens';
import { Btn, C, Card, Chip, Field, KV, Note, Screen } from './kit';
import { AssetPicker } from './Wallet';

export function Tokens({ parents, tokens, onAdd, onRemove, onBack }: {
  parents: Asset[]; tokens: StoredToken[]; onAdd: (t: StoredToken) => void; onRemove: (t: StoredToken) => void; onBack: () => void;
}) {
  const [p, setP] = useState<Asset>(parents[0]);
  const [addr, setAddr] = useState('');
  const [found, setFound] = useState<StoredToken | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = tokens.filter((t) => t.net === p.net);

  const check = async () => {
    setBusy(true); setErr(''); setFound(null);
    try {
      const t = await readTokenMeta(p, addr);
      if (tokens.some((x) => x.parentId === t.parentId && x.token.toLowerCase() === t.token.toLowerCase())) throw new Error('Ten token już jest na liście.');
      setFound(t);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen title="Własne tokeny" onBack={onBack}
      footer={found
        ? <Btn label={'Dodaj ' + found.symbol} onPress={() => { onAdd(found); setFound(null); setAddr(''); }} />
        : <Btn label="Sprawdź kontrakt" onPress={check} busy={busy} disabled={!addr.trim()} />}>
      <Note tone="info">Dodajesz token po adresie kontraktu. Nazwa i liczba miejsc po przecinku są czytane z blockchaina. Adres bierz tylko z oficjalnej strony projektu — fałszywe tokeny mają te same nazwy.</Note>
      <Text style={{ color: C.ink2, fontWeight: '700', marginBottom: 8 }}>Sieć</Text>
      <AssetPicker assets={parents} value={p} onChange={(x) => { setP(x); setFound(null); setErr(''); }} />
      <View style={{ height: 14 }} />
      <Field label="Adres kontraktu tokena" value={addr} onChangeText={(t) => { setAddr(t); setFound(null); setErr(''); }} placeholder="0x…" error={err || null}
        right={<Chip label="Wklej" onPress={async () => setAddr((await Clipboard.getStringAsync()).trim())} />} />
      {found ? (
        <Card style={{ borderColor: C.accent }}>
          <KV k="Symbol" v={found.symbol} strong />
          <KV k="Nazwa" v={found.name} />
          <KV k="Miejsca po przecinku" v={String(found.decimals)} />
          <KV k={'Kontrakt (' + p.network + ')'} v={found.token} mono />
          <Text style={{ color: C.warn, marginTop: 10 }}>Porównaj adres kontraktu ze źródłem, zanim dodasz.</Text>
        </Card>
      ) : null}
      <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 0.6, marginTop: 16, marginBottom: 8 }}>DODANE ({p.net === 'mainnet' ? 'SIEĆ GŁÓWNA' : 'TESTNET'})</Text>
      {mine.length ? mine.map((t) => (
        <Card key={t.parentId + t.token}>
          <Text style={{ color: C.ink, fontWeight: '800', fontSize: 16 }}>{t.symbol} <Text style={{ color: C.muted, fontWeight: '600' }}>· {parents.find((x) => x.id === t.parentId)?.network ?? t.parentId}</Text></Text>
          <Text style={{ color: C.muted, fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>{t.token}</Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}><Chip label="Usuń z listy" onPress={() => onRemove(t)} /></View>
        </Card>
      )) : <Text style={{ color: C.muted }}>Brak własnych tokenów w tej sieci.</Text>}
    </Screen>
  );
}
