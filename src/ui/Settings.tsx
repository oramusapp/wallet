import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CHAINS } from '../wallet/chains';
import type { DerivedAccount } from '../wallet/derive';
import { Btn, C, Card, Field, KV, Note, P, Screen } from './kit';
import { APP_VERSION, RELEASE_SIGNED } from '../config';
import { WordGrid } from './Onboarding';

function Row({ icon, title, sub, onPress, danger }: { icon: string; title: string; sub?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, minHeight: 60, opacity: pressed ? 0.6 : 1, borderBottomWidth: 1, borderBottomColor: C.line })}>
      <Text style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? C.danger : C.ink, fontSize: 16, fontWeight: '800' }}>{title}</Text>
        {sub ? <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      <Text style={{ color: C.muted, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}

export function Settings({ net, onNetwork, onTokens, onSeed, onAddresses, onSecurity, onWipe }: {
  net: 'testnet' | 'mainnet'; onNetwork: () => void; onTokens: () => void; onSeed: () => void; onAddresses: () => void; onSecurity: () => void; onWipe: () => void;
}) {
  return (
    <Screen title="Ustawienia">
      <Row icon={net === 'mainnet' ? '🔴' : '🧪'} title={'Sieć: ' + (net === 'mainnet' ? 'główna (prawdziwe środki)' : 'testowa')} sub="Przełącz testnet / sieć główną" onPress={onNetwork} />
      <Row icon="🪙" title="Własne tokeny" sub="Dodaj token ERC-20 po adresie kontraktu" onPress={onTokens} />
      <Row icon="📝" title="Pokaż 24 słowa" sub="Po potwierdzeniu odciskiem palca" onPress={onSeed} />
      <Row icon="🧭" title="Wszystkie adresy i ścieżki" sub="Zgodne z Trust Wallet" onPress={onAddresses} />
      <Row icon="🛡️" title="Jak chronimy klucz" onPress={onSecurity} />
      <Row icon="🗑️" title="Usuń portfel z telefonu" sub="Środki zostają; odzyskasz je z kartki" onPress={onWipe} danger />
      <Text style={{ color: C.muted, marginTop: 20, fontSize: 13 }}>Oramus Wallet {APP_VERSION} · {RELEASE_SIGNED ? 'wersja podpisana prywatnym kluczem' : 'wersja testowa (klucz debug)'}</Text>
    </Screen>
  );
}

const CONFIRM_WORD = 'PRAWDZIWE';

export function NetworkScreen({ net, onSet, onBack }: { net: 'testnet' | 'mainnet'; onSet: (n: 'testnet' | 'mainnet') => void; onBack: () => void }) {
  const [typed, setTyped] = useState('');
  if (net === 'mainnet') {
    return (
      <Screen title="Sieć główna" onBack={onBack} footer={<Btn label="Wróć do sieci testowej" kind="soft" onPress={() => onSet('testnet')} />}>
        <Note tone="danger">Jesteś w sieci głównej. Każda wysyłka przenosi prawdziwe pieniądze i nie da się jej cofnąć.</Note>
        <P muted>Adresy w sieci testowej i głównej pochodzą z tych samych 24 słów (dla Bitcoina, Litecoina, Dogecoina i Dasha są inne ścieżki testowe).</P>
      </Screen>
    );
  }
  if (!RELEASE_SIGNED) {
    return (
      <Screen title="Sieć główna" onBack={onBack}>
        <Note tone="warn">Ta wersja aplikacji jest podpisana publicznym kluczem testowym, więc sieć główna jest zablokowana.</Note>
        <Card>
          <Text style={{ color: C.ink, fontWeight: '800', fontSize: 16, marginBottom: 6 }}>Dlaczego?</Text>
          <P muted>Kluczem testowym może podpisać aplikację każdy. Ktoś mógłby podsunąć Ci podróbkę jako „aktualizację”. Prawdziwe środki odblokowuje dopiero wersja podpisana Twoim prywatnym kluczem.</P>
          <Text style={{ color: C.ink, fontWeight: '800', fontSize: 16, marginBottom: 6 }}>Jak odblokować</Text>
          <P muted>1. Wygeneruj prywatny klucz podpisu i wpisz go w GitHub Secrets (instrukcja: plik SIGNING.md w repozytorium).{'\n'}2. GitHub zbuduje nowy APK podpisany Twoim kluczem.{'\n'}3. Odinstaluj tę wersję, zainstaluj nową i przywróć portfel z 24 słów.</P>
        </Card>
      </Screen>
    );
  }
  return (
    <Screen title="Włącz sieć główną" onBack={onBack}
      footer={<Btn label="Przełącz na sieć główną" kind="danger" disabled={typed.trim().toUpperCase() !== CONFIRM_WORD} onPress={() => onSet('mainnet')} />}>
      <Note tone="danger">Sieć główna = prawdziwe pieniądze. Błędny adres albo sieć oznacza utratę środków bez możliwości odzyskania.</Note>
      {['Zacznij od małych kwot i sprawdź pierwszą wysyłkę w eksploratorze.',
        'Te same 24 słowa = ten sam portfel. Kartka musi być bezpieczna.',
        'Wszystkie zabezpieczenia działają tak samo: podgląd, 4 ostatnie znaki nowego adresu, ostrzeżenie o podobnym adresie, odcisk palca.',
        'Wpłaty na Hyperliquid (CCTP) i wysyłka ZEC nie są jeszcze w aplikacji.'].map((t) => <Text key={t} style={{ color: C.ink2, fontSize: 15, lineHeight: 22, marginBottom: 8 }}>• {t}</Text>)}
      <Field label={'Wpisz ' + CONFIRM_WORD + ', aby potwierdzić'} value={typed} onChangeText={setTyped} autoCapitalize="characters" placeholder={CONFIRM_WORD} />
    </Screen>
  );
}

export function SeedView({ words, onClose }: { words: string[]; onClose: () => void }) {
  useEffect(() => { const id = setTimeout(onClose, 60_000); return () => clearTimeout(id); }, [onClose]);
  return (
    <Screen title="Twoje 24 słowa" onBack={onClose} footer={<Btn label="Zamknij" onPress={onClose} />}>
      <Note>Nikt nigdy nie powinien o nie prosić. Ekran zamknie się sam po 60 s.</Note>
      <WordGrid words={words} />
    </Screen>
  );
}

export function Addresses({ accounts, onBack }: { accounts: DerivedAccount[]; onBack: () => void }) {
  return (
    <Screen title="Adresy" onBack={onBack} sub="Stuknij i przytrzymaj adres, aby go zaznaczyć.">
      {(['A', 'B', 'C'] as const).map((g) => (
        <View key={g} style={{ marginBottom: 8 }}>
          <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 0.6, marginBottom: 8 }}>{g === 'A' ? 'GRUPA A · EVM' : g === 'B' ? 'GRUPA B · BITCOIN I PODOBNE' : 'GRUPA C · SOLANA I PODOBNE'}</Text>
          {CHAINS.filter((c) => c.group === g).map((c) => {
            const a = accounts.find((x) => x.chainId === c.id);
            return a ? <Card key={c.id}><Text style={{ color: C.ink, fontWeight: '800', fontSize: 16 }}>{c.name}</Text><Text style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>{c.coins.join(' · ')}</Text><KV k={a.path} v={a.address} mono /></Card> : null;
          })}
        </View>
      ))}
    </Screen>
  );
}

export function Security({ onBack }: { onBack: () => void }) {
  return (
    <Screen title="Jak chronimy klucz" onBack={onBack}>
      {[
        ['Bezpieczny magazyn', '24 słowa są zaszyfrowane kluczem w Android Keystore. Odczyt tylko po odcisku palca lub twarzy.'],
        ['Bez kopii w chmurze', 'Kopia zapasowa Androida jest wyłączona dla portfela.'],
        ['Bez zrzutów ekranu', 'Zrzuty i nagrywanie ekranu są zablokowane w całej aplikacji.'],
        ['Podpis tylko na telefonie', 'Klucz prywatny powstaje na chwilę do podpisu i jest od razu czyszczony z pamięci.'],
        ['Blokada', 'Aplikacja blokuje się przy starcie i po 30 s w tle.'],
        ['Zgodność', 'Te same słowa odtworzą portfel w Trust Wallet (sprawdzone testami).']
      ].map(([t, d]) => <Card key={t}><Text style={{ color: C.ink, fontWeight: '800', fontSize: 16 }}>{t}</Text><P muted>{d}</P></Card>)}
      <Note>Uwaga: nowy odcisk palca w telefonie unieważnia klucz w magazynie. Wtedy przywracasz portfel z kartki.</Note>
    </Screen>
  );
}
