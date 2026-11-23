import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Asset } from '../net/assets';
import { formatAmount, parseAmount } from '../net/units';
import { getLimits, type Limits } from '../net/limits';
import { chunks, isKnown, lastCharsMatch, lookAlike } from '../net/recipients';
import { broadcastEvm, checkEvmAddress, quoteEvm, signEvm, type EvmQuote } from '../net/send/evm';
import { broadcastBtc, checkBtcAddress, quoteBtc, signBtc, type BtcQuote } from '../net/send/btc';
import { broadcastSol, checkSolAddress, quoteSol, signSol, type SolQuote } from '../net/send/sol';
import { broadcastXlm, decodeStellarAddress, quoteXlm, signXlm, type XlmQuote } from '../net/send/xlm';
import { broadcastAlgo, decodeAlgoAddress, quoteAlgo, signAlgo, type AlgoQuote } from '../net/send/algo';
import { loadRecipients, rememberRecipient, withEdKey, withSecpKey } from '../vault';
import { Btn, C, Card, Chip, CoinIcon, Field, KV, Note, Screen } from './kit';
import { AssetPicker, balText, type Bals } from './Wallet';

type Quote = { kind: 'evm'; q: EvmQuote } | { kind: 'btc'; q: BtcQuote } | { kind: 'sol'; q: SolQuote } | { kind: 'xlm'; q: XlmQuote } | { kind: 'algo'; q: AlgoQuote };
type Step = { k: 'form' } | { k: 'confirm'; quote: Quote; at: number } | { k: 'done'; hash: string; quote: Quote };
const QUOTE_TTL_MS = 60_000;

function checkAddress(a: Asset, to: string): string {
  if (a.kind === 'evm' || a.kind === 'erc20') return checkEvmAddress(to);
  if (a.kind === 'btc') return checkBtcAddress(to);
  if (a.kind === 'sol') return checkSolAddress(to);
  if (a.kind === 'xlm') { decodeStellarAddress(to); return to.trim(); }
  if (a.kind === 'algo') { decodeAlgoAddress(to); return to.trim(); }
  throw new Error('Wysyłka z tej sieci jeszcze nie działa.');
}
const feeOf = (q: Quote) => (q.kind === 'evm' ? q.q.maxFee : q.q.fee);
const caseless = (a: Asset) => a.kind === 'evm' || a.kind === 'erc20';

export function Send({ assets, initial, bals, accountFor, pubkeyFor, onBack, onSent }: {
  assets: Asset[]; initial?: Asset; bals: Bals; accountFor: (a: Asset) => string; pubkeyFor: (a: Asset) => string; onBack?: () => void; onSent: () => void;
}) {
  const [a, setA] = useState<Asset>(initial && initial.canSend ? initial : assets[0]);
  const [to, setTo] = useState('');
  const [amt, setAmt] = useState('');
  const [memo, setMemo] = useState('');
  const [err, setErr] = useState<{ to?: string; amt?: string; top?: string }>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ k: 'form' });
  const [now, setNow] = useState(Date.now());
  const [lim, setLim] = useState<Limits | null>(null);
  const [limErr, setLimErr] = useState('');
  const [known, setKnown] = useState<string[]>([]);
  const [last4, setLast4] = useState('');
  const [ackSimilar, setAckSimilar] = useState(false);

  const from = accountFor(a);
  const bal = bals[a.id]?.v;
  const f = (v: bigint) => formatAmount(v, a.decimals, a.decimals);
  const feeSym = a.feeSymbol ?? a.symbol;
  const feeDec = a.kind === 'erc20' ? 18 : a.decimals;
  const ff = (v: bigint) => formatAmount(v, feeDec, feeDec);
  const sameUnit = feeSym === a.symbol;

  useEffect(() => { if (step.k !== 'confirm') return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [step.k]);
  useEffect(() => {
    let live = true; setLim(null); setLimErr('');
    getLimits(a, from).then((l) => live && setLim(l), (e) => live && setLimErr((e as Error).message));
    loadRecipients().then((r) => live && setKnown(r[a.id] ?? []));
    return () => { live = false; };
  }, [a.id, from]);

  const pick = (x: Asset) => { setA(x); setTo(''); setAmt(''); setMemo(''); setErr({}); };

  // Live checks while typing (no network): format, minimum, balance.
  let amtHint = '';
  let value: bigint | null = null;
  if (amt) {
    try {
      value = parseAmount(amt, a.decimals);
      if (lim && value < lim.minSend) amtHint = 'Za mało: minimum to ' + f(lim.minSend) + ' ' + a.symbol + '.';
      else if (bal !== undefined && value > bal) amtHint = 'Więcej niż masz (' + f(bal) + ' ' + a.symbol + ').';
    } catch (e) { amtHint = (e as Error).message; }
  }
  let toHint = '';
  if (to.trim().length > 8) { try { checkAddress(a, to); } catch (e) { toHint = (e as Error).message; } }

  const max = () => {
    if (bal === undefined || !lim) return;
    const fee = a.kind === 'erc20' ? 0n : lim.feeMax ?? lim.fee ?? 0n; // token fee is paid in ETH
    const keep = a.kind === 'xlm' || a.kind === 'algo' ? lim.reserve : 0n; // these networks require a reserve to stay
    const v = bal - fee - keep;
    if (v <= 0n) { setErr({ ...err, amt: 'Saldo nie pokrywa opłaty.' }); return; }
    setAmt(formatAmount(v, a.decimals, a.decimals));
  };

  const review = async () => {
    const e: typeof err = {};
    let v = 0n;
    try { checkAddress(a, to); } catch (x) { e.to = (x as Error).message; }
    if (!e.to && to.trim().toLowerCase() === from.toLowerCase()) e.to = 'To Twój własny adres.';
    try { v = parseAmount(amt, a.decimals); } catch (x) { e.amt = (x as Error).message; }
    if (!e.amt && lim && v < lim.minSend) e.amt = 'Minimum to ' + f(lim.minSend) + ' ' + a.symbol + '.';
    setErr(e);
    if (e.to || e.amt) return;
    setBusy(true);
    try {
      let quote: Quote;
      if (a.kind === 'evm' || a.kind === 'erc20') quote = { kind: 'evm', q: await quoteEvm(a, from, to, v) }; else if (a.kind === 'btc') quote = { kind: 'btc', q: await quoteBtc(a, from, pubkeyFor(a), to, v) };
      else if (a.kind === 'sol') quote = { kind: 'sol', q: await quoteSol(a, from, to, v) };
      else if (a.kind === 'xlm') quote = { kind: 'xlm', q: await quoteXlm(a, from, to, v, memo.trim()) };
      else if (a.kind === 'algo') quote = { kind: 'algo', q: await quoteAlgo(a, from, to, v) };
      else throw new Error('Wysyłka z tej sieci jeszcze nie działa.');
      setLast4(''); setAckSimilar(false);
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
      } else if (quote.kind === 'btc') {
        const signed = await withSecpKey(a.chainId, 'testnet', (k) => signBtc(quote.q, k));
        hash = (await broadcastBtc(a, signed.hex)) || signed.txid;
      } else if (quote.kind === 'sol') {
        const tx = await withEdKey(a.chainId, 'testnet', (k) => signSol(quote.q.message, k));
        hash = await broadcastSol(a, tx);
      } else if (quote.kind === 'xlm') {
        const env = await withEdKey(a.chainId, 'testnet', (k) => signXlm(quote.q.tx, k));
        hash = await broadcastXlm(a, env);
      } else {
        const blob = await withEdKey(a.chainId, 'testnet', (k) => signAlgo(quote.q.tx, k));
        hash = await broadcastAlgo(a, blob);
      }
      await rememberRecipient(a.id, quote.q.to).catch(() => {});
      setStep({ k: 'done', hash, quote }); onSent();
    } catch (x) { setErr({ top: (x as Error).message }); setStep({ k: 'form' }); }
    finally { setBusy(false); }
  };

  if (step.k === 'done') {
    const q = step.quote;
    return (
      <Screen title="Wysłano" footer={<Btn label="Gotowe" onPress={() => { setStep({ k: 'form' }); setTo(''); setAmt(''); onBack?.(); }} />}>
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.ok + '33', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.ok, fontSize: 44, fontWeight: '900' }}>✓</Text></View>
          <Text style={{ color: C.ink, fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>{f(q.q.value)} {a.symbol} wysłane do sieci {a.network}</Text>
          <Text style={{ color: C.muted, marginTop: 6, textAlign: 'center' }}>Potwierdzenie zajmie od kilku sekund do kilkunastu minut. Sprawdź status w eksploratorze.</Text>
        </View>
        <Card><KV k="Do" v={q.q.to} mono /><KV k="Identyfikator transakcji" v={step.hash} mono /></Card>
        {a.explorerTx ? <View style={{ flexDirection: 'row' }}><Chip label="Zobacz w eksploratorze ↗" onPress={() => Linking.openURL(a.explorerTx!(step.hash))} /></View> : null}
      </Screen>
    );
  }

  if (step.k === 'confirm') {
    const qq = step.quote, value = qq.q.value, fee = feeOf(qq), total = sameUnit ? value + fee : value;
    const balance = qq.q.balance, after = balance - total;
    const nativeAfter = qq.kind === 'evm' && !sameUnit ? qq.q.nativeBalance - fee : null;
    const stale = now - step.at > QUOTE_TTL_MS;
    const isNew = !isKnown(known, qq.q.to, caseless(a));
    const similar = lookAlike(known, qq.q.to, caseless(a));
    const typedOk = !isNew || lastCharsMatch(qq.q.to, last4, 4, caseless(a));
    const feePct = sameUnit && value > 0n ? Number((fee * 10000n) / value) / 100 : 0;
    const share = balance > 0n ? Number((total * 100n) / balance) : 0;
    const ready = !stale && typedOk && (!similar || ackSimilar);
    const parts = chunks(qq.q.to);
    return (
      <Screen title="Sprawdź i potwierdź" onBack={() => setStep({ k: 'form' })}
        footer={stale
          ? <Btn label="Podgląd wygasł — odśwież opłatę" onPress={review} busy={busy} />
          : <Btn label={ready ? 'Wyślij · potwierdź odciskiem' : isNew && !typedOk ? 'Wpisz 4 ostatnie znaki adresu' : 'Potwierdź ostrzeżenie'} onPress={() => send(qq)} busy={busy} disabled={!ready} />}>
        <View style={{ alignItems: 'center', marginVertical: 10 }}>
          <CoinIcon symbol={a.symbol} color={a.color} size={52} />
          <Text style={{ color: C.ink, fontSize: 32, fontWeight: '900', marginTop: 10, fontVariant: ['tabular-nums'] }}>{f(value)} {a.symbol}</Text>
          <Text style={{ color: C.muted }}>sieć {a.network}</Text>
        </View>

        <Text style={{ color: C.muted, fontWeight: '800', fontSize: 13, marginBottom: 6 }}>DO (porównaj ze źródłem, grupami po 4 znaki)</Text>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {parts.map((p, i) => {
              const first = parts[0] === '0x' ? 1 : 0;
              const edge = i === first || i === first + 1 || i === parts.length - 1 || i === parts.length - 2;
              return <Text key={i} style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: edge ? '900' : '500', color: edge ? C.accent : C.ink, backgroundColor: edge ? C.accent + '1a' : 'transparent', paddingHorizontal: 3, borderRadius: 4 }}>{p}</Text>;
            })}
          </View>
          <Text style={{ color: isNew ? C.warn : C.ok, fontWeight: '800', marginTop: 10 }}>{isNew ? '● Nowy adres — pierwszy raz tu wysyłasz' : '✓ Wysyłałeś już na ten adres'}</Text>
        </Card>

        {similar ? (
          <Card style={{ borderColor: C.danger }}>
            <Text style={{ color: C.danger, fontWeight: '900', fontSize: 16 }}>Uwaga: możliwe oszustwo</Text>
            <Text style={{ color: C.ink2, marginTop: 6, lineHeight: 21 }}>Ten adres ma taki sam początek i koniec jak adres, na który już wysyłałeś, ale w środku jest inny. Oszuści podsyłają takie „podobne” adresy w historii transakcji.</Text>
            <Text style={{ color: C.muted, fontFamily: 'monospace', marginTop: 8 }}>Znany: {similar}</Text>
            <Btn label={ackSimilar ? 'Sprawdziłem cały adres ✓' : 'Sprawdziłem cały adres ze źródłem'} kind={ackSimilar ? 'soft' : 'danger'} onPress={() => setAckSimilar(!ackSimilar)} style={{ marginTop: 12 }} />
          </Card>
        ) : null}

        {isNew ? (
          <Field label="Wpisz 4 ostatnie znaki adresu odbiorcy (z miejsca, skąd go masz)" value={last4} onChangeText={setLast4} maxLength={4} placeholder="····"
            style={{ fontFamily: 'monospace', letterSpacing: 6, fontSize: 20 }}
            error={last4.length === 4 && !typedOk ? 'Nie zgadza się z adresem powyżej. Sprawdź, czy to na pewno właściwy adres.' : null}
            right={last4.length === 4 && typedOk ? <Text style={{ color: C.ok, fontSize: 20, paddingHorizontal: 12 }}>✓</Text> : null} />
        ) : null}

        <Card>
          <KV k="Odbiorca otrzyma" v={f(value) + ' ' + a.symbol} />
          <KV k={qq.kind === 'evm' ? 'Opłata sieci (gas), maksymalnie' : qq.kind === 'btc' ? 'Opłata sieci (' + qq.q.feeRate + ' sat/vB)' : 'Opłata sieci'} v={ff(fee) + ' ' + feeSym + (qq.kind === 'evm' ? '\nzwykle ' + ff(qq.q.fee) + (qq.q.l1Fee ? ' (w tym L1 ' + ff(qq.q.l1Fee) + ')' : '') : '')} />
          <KV k="Razem z Twojego konta" v={sameUnit ? f(total) + ' ' + a.symbol : f(value) + ' ' + a.symbol + '  +  ' + ff(fee) + ' ' + feeSym + ' (opłata)'} strong />
          <KV k="Saldo po wysłaniu (co najmniej)" v={f(after) + ' ' + a.symbol + (nativeAfter !== null ? '\n' + ff(nativeAfter) + ' ' + feeSym : '')} />
        </Card>

        {qq.kind === 'evm' && qq.q.toIsContract ? <Note>Adres odbiorcy to kontrakt (np. giełda albo portfel typu smart). Upewnij się, że przyjmuje {a.symbol} w sieci {a.network}.</Note> : null}
        {feePct >= 10 ? <Note>Opłata to {feePct.toFixed(1)}% wysyłanej kwoty.</Note> : null}
        {share >= 50 ? <Note>Wysyłasz {share}% salda tej sieci.</Note> : null}
        {qq.kind === 'xlm' ? <Card><KV k="Memo" v={qq.q.memo ? qq.q.memo : 'brak'} /></Card> : null}
        {qq.kind === 'xlm' && !qq.q.memo ? <Note>Bez memo. Jeśli to adres giełdy, wróć i dodaj memo — inaczej wpłata może nie zostać przypisana.</Note> : null}
        {(qq.kind === 'xlm' || qq.kind === 'algo') && qq.q.recipientNew ? <Note tone="info">Konto odbiorcy jeszcze nie istnieje — ta wpłata je utworzy (minimum spełnione).</Note> : null}
        {(qq.kind === 'xlm' || qq.kind === 'algo') ? <Text style={{ color: C.muted, marginBottom: 10 }}>Na Twoim koncie zostaje wymagana rezerwa: {f(qq.q.minBalance)} {a.symbol}.</Text> : null}
        {qq.kind === 'sol' && qq.q.recipientNew ? <Note tone="info">Konto odbiorcy jest puste. Ta wpłata je utworzy (min. {f(qq.q.rentMin)} SOL — spełnione).</Note> : null}
        <Note tone="info">Transakcji w blockchainie nie da się cofnąć. Po stuknięciu telefon poprosi o odcisk palca.</Note>
        {!stale ? <Text style={{ color: C.muted, textAlign: 'center' }}>Podgląd opłaty ważny jeszcze {Math.max(0, Math.ceil((QUOTE_TTL_MS - (now - step.at)) / 1000))} s</Text> : null}
        {err.top ? <Note tone="danger">{err.top}</Note> : null}
      </Screen>
    );
  }

  const canMax = a.kind !== 'btc';
  return (
    <Screen title="Wyślij" onBack={onBack} footer={<Btn label="Dalej: sprawdź szczegóły" onPress={review} busy={busy} disabled={!to || !amt || !!amtHint || !!toHint} />}>
      <AssetPicker assets={assets} value={a} onChange={pick} />
      <View style={{ height: 16 }} />
      <Field label="Adres odbiorcy" value={to} onChangeText={(t) => { setTo(t); setErr({ ...err, to: undefined }); }}
        placeholder={a.kind === 'evm' || a.kind === 'erc20' ? '0x…' : a.kind === 'btc' ? 'tb1…' : a.kind === 'xlm' ? 'G…' : a.kind === 'algo' ? 'adres Algorand' : 'adres Solana'} error={err.to ?? (toHint || null)}
        right={<Chip label="Wklej" onPress={async () => setTo((await Clipboard.getStringAsync()).trim())} />} />
      <Field label={'Kwota (' + a.symbol + ')'} value={amt} onChangeText={(t) => { setAmt(t); setErr({ ...err, amt: undefined }); }} keyboardType="decimal-pad" placeholder="0.00"
        error={err.amt ?? (amtHint || null)}
        right={canMax ? <Chip label="Max" onPress={max} /> : <Text style={{ color: C.muted, fontWeight: '800', paddingHorizontal: 10 }}>{a.symbol}</Text>} />
      <Text style={{ color: C.muted, marginTop: -6, marginBottom: 14 }}>Dostępne: {balText(a, bals[a.id], 8)} {a.symbol}</Text>
      {a.kind === 'xlm' ? (
        <Field label="Memo (opcjonalnie, max 28 znaków)" value={memo} onChangeText={setMemo} maxLength={28} placeholder="np. numer z giełdy"
          error={null} />
      ) : null}
      {a.kind === 'xlm' ? <Text style={{ color: C.warn, marginTop: -6, marginBottom: 14 }}>Wpłata na giełdę? Giełdy zwykle wymagają memo — bez niego środki mogą do Ciebie nie dotrzeć.</Text> : null}

      <Card>
        <Text style={{ color: C.ink, fontWeight: '800', fontSize: 15, marginBottom: 6 }}>Minimum i opłata · {a.network}</Text>
        {lim ? lim.lines.map((l) => <Text key={l} style={{ color: C.ink2, fontSize: 14, lineHeight: 20, marginBottom: 4 }}>• {l}</Text>)
          : limErr ? <Text style={{ color: C.danger }}>Nie udało się pobrać: {limErr}</Text>
          : <ActivityIndicator color={C.accent} style={{ alignSelf: 'flex-start' }} />}
        {lim?.fee !== undefined && value ? <Text style={{ color: C.ink, fontWeight: '800', marginTop: 6 }}>{sameUnit ? 'Razem z opłatą: ok. ' + f(value + (lim.feeMax ?? lim.fee)) + ' ' + a.symbol : 'Razem: ' + f(value) + ' ' + a.symbol + ' + opłata ok. ' + ff(lim.feeMax ?? lim.fee) + ' ' + feeSym}</Text> : null}
      </Card>
      {err.top ? <Note tone="danger">{err.top}</Note> : null}
    </Screen>
  );
}
