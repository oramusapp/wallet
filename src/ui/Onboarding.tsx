import { useState } from 'react';
import { Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { isValidMnemonic, mnemonicFromEntropy, normalizeMnemonic, pickCheckPositions, WORDLIST } from '../wallet/mnemonic';
import { Btn, C, Card, Field, Note, P, Screen, Steps } from './kit';

export function Welcome({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  return (
    <Screen footer={<><Btn label="Utwórz nowy portfel" onPress={onCreate} /><Btn label="Mam już słowa — przywróć" kind="ghost" onPress={onImport} /></>}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 28 }}>
        <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 44, fontWeight: '900', color: C.accentInk }}>O</Text>
        </View>
        <Text style={{ color: C.ink, fontSize: 30, fontWeight: '900', marginTop: 18 }}>Oramus Wallet</Text>
        <Text style={{ color: C.accent, fontWeight: '800', marginTop: 6 }}>TESTNET · bez prawdziwych środków</Text>
      </View>
      {[
        ['🔑', 'Klucz tylko na tym telefonie', 'Nikt inny go nie ma — także twórca aplikacji.'],
        ['👆', 'Odcisk palca przy każdym podpisie', 'Bez Ciebie nic nie wyjdzie z portfela.'],
        ['📝', '24 słowa na kartce', 'To jedyna kopia. Zgodna z Trust Wallet.']
      ].map(([i, t, d]) => (
        <View key={t} style={{ flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 24 }}>{i}</Text>
          <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontWeight: '800', fontSize: 16 }}>{t}</Text><Text style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>{d}</Text></View>
        </View>
      ))}
    </Screen>
  );
}

export function newWords(): string[] {
  return mnemonicFromEntropy(Crypto.getRandomBytes(32)).split(' ');
}

export function ShowWords({ words, onNext, onBack }: { words: string[]; onNext: (pos: number[]) => void; onBack: () => void }) {
  return (
    <Screen title="Zapisz słowa" onBack={onBack}
      footer={<Btn label="Zapisałem wszystkie 24" onPress={() => onNext(pickCheckPositions(Crypto.getRandomBytes(16), words.length, 3))} />}>
      <Steps step={1} total={3} label="zapis na kartce" />
      <Note>Długopis i kartka. Bez zdjęć i bez notatek w telefonie. Kto zna te słowa, ma Twoje środki.</Note>
      <WordGrid words={words} />
    </Screen>
  );
}

export function WordGrid({ words }: { words: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {words.map((w, i) => (
        <View key={i} style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.muted, width: 26, fontSize: 13, fontWeight: '700' }}>{i + 1}.</Text>
          <Text style={{ color: C.ink, fontSize: 17, fontWeight: '800' }}>{w}</Text>
        </View>
      ))}
    </View>
  );
}

export function CheckWords({ words, pos, onOk, onBack, busy }: { words: string[]; pos: number[]; onOk: () => void; onBack: () => void; busy: boolean }) {
  const [vals, setVals] = useState<string[]>(pos.map(() => ''));
  const okAt = (i: number) => normalizeMnemonic(vals[i]) === words[pos[i]];
  const all = pos.every((_, i) => okAt(i));
  return (
    <Screen title="Sprawdź kartkę" onBack={onBack} footer={<Btn label="Zabezpiecz odciskiem palca" disabled={!all} busy={busy} onPress={onOk} />}>
      <Steps step={2} total={3} label="sprawdzenie" />
      <P muted>Wpisz te słowa z kartki. Tak upewniamy się, że zapis jest bez błędów.</P>
      {pos.map((p, i) => (
        <Field key={p} label={'Słowo nr ' + (p + 1)} value={vals[i]} keyboardType="visible-password"
          onChangeText={(t) => setVals(vals.map((v, j) => (j === i ? t : v)))}
          right={vals[i] ? <Text style={{ color: okAt(i) ? C.ok : C.muted, fontSize: 18, paddingHorizontal: 10 }}>{okAt(i) ? '✓' : '…'}</Text> : null} />
      ))}
      <P muted>Krok 3: telefon poprosi o odcisk palca, a portfel zapisze klucz w bezpiecznym magazynie.</P>
    </Screen>
  );
}

export function ImportWords({ onOk, onBack, busy }: { onOk: (m: string) => void; onBack: () => void; busy: boolean }) {
  const [t, setT] = useState('');
  const words = normalizeMnemonic(t).split(' ').filter(Boolean);
  const bad = words.filter((w) => !WORDLIST.includes(w));
  const valid = isValidMnemonic(t);
  const status = !words.length ? 'Wpisz 12 albo 24 słowa, oddzielone spacją.'
    : bad.length ? 'Nieznane słowo: ' + bad[0]
    : valid ? 'Wszystko się zgadza (' + words.length + ' słów).'
    : words.length + ' słów · ' + (words.length === 12 || words.length === 24 ? 'suma kontrolna się nie zgadza — sprawdź kolejność' : 'potrzeba 12 albo 24');
  return (
    <Screen title="Przywróć portfel" onBack={onBack} footer={<Btn label="Zabezpiecz odciskiem palca" disabled={!valid} busy={busy} onPress={() => onOk(t)} />}>
      <Note tone="info">Wpisuj ręcznie, bez kopiowania przez schowek (inne aplikacje mogą go czytać). Żadna strona ani osoba nie powinna nigdy prosić o te słowa.</Note>
      <Field label="Słowa" value={t} onChangeText={setT} multiline keyboardType="visible-password" placeholder="słowo1 słowo2 słowo3 …"
        style={{ minHeight: 130, textAlignVertical: 'top' }} />
      <Text style={{ color: valid ? C.ok : bad.length ? C.danger : C.muted, fontWeight: '700', marginTop: -4, marginBottom: 12 }}>{status}</Text>
    </Screen>
  );
}

export function DeviceProblem({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  return (
    <Screen title="Najpierw zabezpiecz telefon" footer={<Btn label="Sprawdź ponownie" onPress={onRetry} />}>
      <Card><Text style={{ color: C.ink, fontSize: 16, lineHeight: 23 }}>{reason}</Text></Card>
      <P muted>Portfel trzyma klucz w bezpiecznym magazynie telefonu, odblokowywanym biometrią. Bez blokady ekranu i odcisku palca nie wystartuje.</P>
    </Screen>
  );
}
