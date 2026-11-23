import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CHAINS } from '../wallet/chains';
import type { DerivedAccount } from '../wallet/derive';
import { Btn, C, Card, KV, Note, P, Screen } from './kit';
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

export function Settings({ onSeed, onAddresses, onSecurity, onWipe }: { onSeed: () => void; onAddresses: () => void; onSecurity: () => void; onWipe: () => void }) {
  return (
    <Screen title="Ustawienia">
      <Row icon="📝" title="Pokaż 24 słowa" sub="Po potwierdzeniu odciskiem palca" onPress={onSeed} />
      <Row icon="🧭" title="Wszystkie adresy i ścieżki" sub="12 sieci, zgodne z Trust Wallet" onPress={onAddresses} />
      <Row icon="🛡️" title="Jak chronimy klucz" onPress={onSecurity} />
      <Row icon="🗑️" title="Usuń portfel z telefonu" sub="Środki zostają; odzyskasz je z kartki" onPress={onWipe} danger />
      <Text style={{ color: C.muted, marginTop: 20, fontSize: 13 }}>Oramus Wallet 0.2 · faza 2 · testnet</Text>
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
    <Screen title="Adresy" onBack={onBack} sub="Testnet. Stuknij i przytrzymaj adres, aby go zaznaczyć.">
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
