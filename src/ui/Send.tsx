import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Asset } from '../net/assets';
import { formatAmount, parseAmount } from '../net/units';
import { broadcastEvm, checkEvmAddress, quoteEvm, signEvm, type EvmQuote } from '../net/send/evm';
import { broadcastBtc, checkBtcAddress, quoteBtc, signBtc, type BtcQuote } from '../net/send/btc';
import { withSecpKey } from '../vault';
import { Btn, C, Card, Chip, CoinIcon, Field, KV, Note, Screen } from './kit';
import { AssetPicker, balText, type Bals } from './Wallet';

type Quote = { kind: 'evm'; q: EvmQuote } | { kind: 'btc'; q: BtcQuote };
type Step = { k: 'form' } | { k: 'confirm'; quote: Quote; at: number } | { k: 'done'; hash: string };
const QUOTE_TTL_MS = 60_000;

const short = (a: string) => (a.length > 20 ? a.slice(0, 10) + '…' + a.slice(-8) : a);

export function Send({ assets, initial, bals, accountFor, pubkeyFor, onBack, onSent }: {
  assets: Asset[]; initial?: Asset; bals: Bals; accountFor: (a: Asset) => string; pubkeyFor: (a: Asset) => string; onBack?: () => void; onSent: () => void;
}) {
  const [a, setA] = useState<Asset>(initial && initial.canSend ? initial : assets[0]);
  const [to, setTo] = useState('');
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState<{ to?: string; amt?: string; top?: string }>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ k: 'form' });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (step.k !== 'confirm') return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [step.k]);

  const from = accountFor(a);
  const pick = (x: Asset) => { setA(x); setTo(''); setAmt(''); setErr({}); };

  const review = async () => {
    const e: typeof err = {};
    let value = 0n;
    try { a.kind === 'evm' ? checkEvmAddress(to) : checkBtcAddress(to); } catch (x) { e.to = (x as Error).message; }
    if (!e.to && to.trim().toLowerCase() === from.toLowerCase()) e.to = 'To Twój własny adres.';
    try { value = parseAmount(amt, a.decimals); } catch (x) { e.amt = (x as Error).message; }
    setErr(e);
    if (e.to || e.amt) return;
    setBusy(true);
    try {
      let quote: Quote;
      if (a.kind === 'evm') {
        const q = await quoteEvm(a, from, to, value);
        if (q.value + q.maxFee > q.balance) throw new Error('Za mało środków: potrzeba ' + formatAmount(q.value + q.maxFee, 18) + ' ETH razem z maks. opłatą, masz ' + formatAmount(q.balance, 18) + '.');
        quote = { kind: 'evm', q };
      } else {
        quote = { kind: 'btc', q: await quoteBtc(a, from, pubkeyFor(a), to, value) };
      }
      setStep({ k: 'confirm', quote, at: Date.now() }); setNow(Date.now());
    } catch (x) { setErr({ top: (x as Error).message }); }
    finally { setBusy(false); }
  };

  const send = async (quote: Quote) => {
    setBusy(true);
    try {
      let hash: string;
      if (quote.kind === 'evm') {
        const raw = await withSecpKey(a.chainId, 'testnet', (k) => signEvm(a, quote.q, k));
        hash = await broadcastEvm(a, raw);
      } else {
        const signed = await withSecpKey(a.chainId, 'testnet', (k) => signBtc(quote.q, k));
        const id = await broadcastBtc(a, signed.hex);
        hash = id || signed.txid;
      }
      setStep({ k: 'done', hash }); onSent();
    } catch (x) { setErr({ top: (x as Error).message }); setStep({ k: 'form' }); }
    finally { setBusy(false); }
  };

  if (step.k === 'done') {
    return (
      <Screen title="Wysłano" footer={<Btn label="Gotowe" onPress={() => { setStep({ k: 'form' }); setTo(''); setAmt(''); onBack?.(); }} />}>
        <View style={{ alignItems: 'center', marginVertical: 24 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.ok + '33', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.ok, fontSize: 44, fontWeight: '900' }}>✓</Text></View>
          <Text style={{ color: C.ink, fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>Transakcja wysłana do sieci {a.network}</Text>
          <Text style={{ color: C.muted, marginTop: 6, textAlign: 'center' }}>Potwierdzenie zajmie od kilku sekund do kilkunastu minut.</Text>
        </View>
        <Card><KV k="Identyfikator transakcji" v={step.hash} mono /></Card>
        {a.explorerTx ? <View style={{ flexDirection: 'row' }}><Chip label="Zobacz w eksploratorze ↗" onPress={() => Linking.openURL(a.explorerTx!(step.hash))} /></View> : null}
      </Screen>
    );
  }

  if (step.k === 'confirm') {
    const qq = step.quote;
    const fee = qq.kind === 'evm' ? qq.q.maxFee : qq.q.fee;
    const value = qq.q.value;
    const stale = now - step.at > QUOTE_TTL_MS;
    return (
      <Screen title="Sprawdź i potwierdź" onBack={() => setStep({ k: 'form' })}
        footer={stale
          ? <Btn label="Podgląd wygasł — odśwież opłatę" onPress={review} busy={busy} />
          : <Btn label="Wyślij · potwierdź odciskiem" onPress={() => send(qq)} busy={busy} />}>
        <View style={{ alignItems: 'center', marginVertical: 14 }}>
          <CoinIcon symbol={a.symbol} color={a.color} size={56} />
          <Text style={{ color: C.ink, fontSize: 34, fontWeight: '900', marginTop: 12, fontVariant: ['tabular-nums'] }}>{formatAmount(value, a.decimals, 8)} {a.symbol}</Text>
          <Text style={{ color: C.muted }}>{a.network}</Text>
        </View>
        <Card>
          <KV k="Do" v={qq.q.to} mono />
          <KV k={qq.kind === 'evm' ? 'Opłata sieci (maksymalnie)' : 'Opłata sieci (' + qq.q.feeRate + ' sat/vB)'} v={formatAmount(fee, a.decimals, a.decimals) + ' ' + a.symbol} />
          <KV k="Razem z konta" v={formatAmount(value + fee, a.decimals, a.decimals) + ' ' + a.symbol} strong />
        </Card>
        <Note>Transakcji w blockchainie nie da się cofnąć. Sprawdź początek i koniec adresu: {short(qq.q.to)}</Note>
        {!stale ? <Text style={{ color: C.muted, textAlign: 'center' }}>Podgląd ważny jeszcze {Math.max(0, Math.ceil((QUOTE_TTL_MS - (now - step.at)) / 1000))} s</Text> : null}
        {err.top ? <Note tone="danger">{err.top}</Note> : null}
      </Screen>
    );
  }

  return (
    <Screen title="Wyślij" onBack={onBack} footer={<Btn label="Dalej" onPress={review} busy={busy} disabled={!to || !amt} />}>
      <AssetPicker assets={assets} value={a} onChange={pick} />
      <View style={{ height: 16 }} />
      <Field label="Adres odbiorcy" value={to} onChangeText={(t) => { setTo(t); setErr({ ...err, to: undefined }); }} placeholder={a.kind === 'evm' ? '0x…' : 'tb1…'} error={err.to}
        right={<Chip label="Wklej" onPress={async () => setTo((await Clipboard.getStringAsync()).trim())} />} />
      <Field label={'Kwota (' + a.symbol + ')'} value={amt} onChangeText={(t) => { setAmt(t); setErr({ ...err, amt: undefined }); }} keyboardType="decimal-pad" placeholder="0.00" error={err.amt}
        right={<Text style={{ color: C.muted, fontWeight: '800', paddingHorizontal: 10 }}>{a.symbol}</Text>} />
      <Text style={{ color: C.muted, marginTop: -6, marginBottom: 14 }}>Dostępne: {balText(a, bals[a.id], 8)} {a.symbol} · opłatę zobaczysz w następnym kroku</Text>
      {err.top ? <Note tone="danger">{err.top}</Note> : null}
      <Note tone="info">Testnet: wysyłasz monety testowe bez wartości. Przed podpisem zobaczysz podsumowanie i opłatę.</Note>
    </Screen>
  );
}
