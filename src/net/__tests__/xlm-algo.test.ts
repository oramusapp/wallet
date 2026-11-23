import { describe, expect, it } from 'vitest';
import * as Stellar from '@stellar/stellar-sdk';
import algosdk from 'algosdk';
import { base64 } from '@scure/base';
import { decodeStellarAddress, signXlm, xlmTransactionXdr, type XlmTx } from '../send/xlm';
import { algoBytesToSign, algoTxId, decodeAlgoAddress, signAlgo, type AlgoTx } from '../send/algo';
import { CHAINS } from '../../wallet/chains';
import { deriveAccount, deriveEdPrivateKey } from '../../wallet/derive';
import { seedFromMnemonic } from '../../wallet/mnemonic';

const seed = seedFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
const xlmChain = CHAINS.find((c) => c.id === 'xlm')!;
const algoChain = CHAINS.find((c) => c.id === 'algo')!;

describe('Stellar (checked against @stellar/stellar-sdk)', () => {
  const from = deriveAccount(seed, xlmChain, 'testnet').address;
  const to = Stellar.Keypair.fromRawEd25519Seed(Buffer.alloc(32, 5)).publicKey();
  for (const create of [false, true]) for (const memo of [undefined, 'giełda 123']) {
    it((create ? 'createAccount' : 'payment') + (memo ? ' + memo' : '') + ': XDR and signature identical to the SDK', () => {
      const t: XlmTx = { from, to, amount: 12_345_678n, create, fee: 100, seq: 4242424242n, maxTime: 1_900_000_000n, memo };
      const acc = new Stellar.Account(from, (t.seq - 1n).toString());
      const op = create ? Stellar.Operation.createAccount({ destination: to, startingBalance: '1.2345678' }) : Stellar.Operation.payment({ destination: to, asset: Stellar.Asset.native(), amount: '1.2345678' });
      const b = new Stellar.TransactionBuilder(acc, { fee: '100', networkPassphrase: Stellar.Networks.TESTNET, timebounds: { minTime: 0, maxTime: 1_900_000_000 } }).addOperation(op);
      if (memo) b.addMemo(Stellar.Memo.text(memo));
      const ref = b.build();
      expect(Buffer.from(xlmTransactionXdr(t)).toString('hex')).toBe(Buffer.from(ref.tx.toXDR()).toString('hex'));
      const pk = deriveEdPrivateKey(seed, xlmChain, 'testnet');
      ref.sign(Stellar.Keypair.fromRawEd25519Seed(Buffer.from(pk)));
      expect(signXlm(t, pk)).toBe(Buffer.from(ref.toEnvelope().toXDR()).toString('base64'));
      pk.fill(0);
    });
  }
  it('address checksum', () => {
    expect(decodeStellarAddress(from).length).toBe(32);
    expect(() => decodeStellarAddress(from.slice(0, -1) + (from.endsWith('A') ? 'B' : 'A'))).toThrow();
  });
});

describe('Algorand (checked against algosdk)', () => {
  const from = deriveAccount(seed, algoChain, 'testnet').address;
  const to = algosdk.generateAccount().addr.toString();
  const gh = base64.decode('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=');
  for (const amount of [250_000n, 0n, 5_000_000_000n]) {
    it('payment amt=' + amount + ': bytes, txid and signed blob identical to algosdk', () => {
      const t: AlgoTx = { from, to, amount, fee: 1000n, firstValid: 69532625n, lastValid: 69533625n, genesisId: 'testnet-v1.0', genesisHash: gh };
      const ref = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: from, receiver: to, amount, suggestedParams: { fee: 1000, flatFee: true, firstValid: 69532625, lastValid: 69533625, genesisID: 'testnet-v1.0', genesisHash: gh, minFee: 1000 } });
      expect(Buffer.from(algoBytesToSign(t)).toString('hex')).toBe(Buffer.from(ref.bytesToSign()).toString('hex'));
      expect(algoTxId(t)).toBe(ref.txID());
      const pk = deriveEdPrivateKey(seed, algoChain, 'testnet');
      const sk = new Uint8Array(64); sk.set(pk); sk.set(algosdk.decodeAddress(from).publicKey, 32);
      expect(Buffer.from(signAlgo(t, pk)).toString('hex')).toBe(Buffer.from(ref.signTxn(sk)).toString('hex'));
      pk.fill(0); sk.fill(0);
    });
  }
  it('address checksum', () => {
    expect(decodeAlgoAddress(from).length).toBe(32);
    expect(() => decodeAlgoAddress(from.slice(0, -1) + (from.endsWith('A') ? 'B' : 'A'))).toThrow();
  });
});
