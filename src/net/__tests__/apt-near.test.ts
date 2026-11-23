import { describe, expect, it } from 'vitest';
import { AccountAddress, ChainId, EntryFunction, RawTransaction, TransactionPayloadEntryFunction, U64, Ed25519PrivateKey, SignedTransaction, TransactionAuthenticatorEd25519, Ed25519PublicKey, Ed25519Signature, generateSigningMessageForTransaction, SimpleTransaction } from '@aptos-labs/ts-sdk';
import { createTransaction, actionCreators as actions, encodeTransaction, decodeSignedTransaction, SignedTransaction as NearSigned, Signature as NearSig } from '@near-js/transactions';
import { PublicKey as NearPk } from '@near-js/crypto';
import { base58, base64 } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { aptRawTransaction, aptSigningMessage, checkAptAddress, signApt, type AptTx } from '../send/apt';
import { checkNearAccount, nearTransaction, signNear, type NearTx } from '../send/near';
import { CHAINS } from '../../wallet/chains';
import { deriveAccount, deriveEdPrivateKey } from '../../wallet/derive';
import { seedFromMnemonic } from '../../wallet/mnemonic';

const seed = seedFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
const aptC = CHAINS.find((c) => c.id === 'apt')!, nearC = CHAINS.find((c) => c.id === 'near')!;

describe('Aptos (checked against @aptos-labs/ts-sdk)', () => {
  const from = deriveAccount(seed, aptC, 'testnet').address;
  const to = '0x' + '5a'.repeat(32);
  const t: AptTx = { from, to, amount: 123_456_789n, seq: 42n, maxGas: 2000n, gasPrice: 100n, expiration: 1_900_000_000n, chainId: 2 };
  const ref = new RawTransaction(AccountAddress.from(from), 42n, new TransactionPayloadEntryFunction(EntryFunction.build('0x1::aptos_account', 'transfer', [], [AccountAddress.from(to), new U64(123_456_789n)])), 2000n, 100n, 1_900_000_000n, new ChainId(2));
  it('raw transaction bytes identical', () => {
    expect(Buffer.from(aptRawTransaction(t)).toString('hex')).toBe(Buffer.from(ref.bcsToBytes()).toString('hex'));
  });
  it('signing message and signed transaction identical', () => {
    const msg = generateSigningMessageForTransaction(new SimpleTransaction(ref));
    expect(Buffer.from(aptSigningMessage(aptRawTransaction(t))).toString('hex')).toBe(Buffer.from(msg).toString('hex'));
    const pk = deriveEdPrivateKey(seed, aptC, 'testnet');
    const sdkKey = new Ed25519PrivateKey(pk);
    expect(sdkKey.publicKey().authKey().derivedAddress().toString()).toBe(from); // address matches the key
    const sig = sdkKey.sign(msg);
    const signedRef = new SignedTransaction(ref, new TransactionAuthenticatorEd25519(new Ed25519PublicKey(sdkKey.publicKey().toUint8Array()), new Ed25519Signature(sig.toUint8Array())));
    expect(Buffer.from(signApt(t, pk)).toString('hex')).toBe(Buffer.from(signedRef.bcsToBytes()).toString('hex'));
    pk.fill(0);
  });
  it('address checks', () => {
    expect(() => checkAptAddress('0x1')).toThrow(/pełny/);
    expect(() => checkAptAddress('0xzz')).toThrow();
  });
});

describe('NEAR (checked against @near-js/transactions)', () => {
  const from = deriveAccount(seed, nearC, 'testnet');
  const pub = Uint8Array.from(Buffer.from(from.publicKey, 'hex'));
  const bh = base58.encode(new Uint8Array(32).fill(3));
  for (const to of ['b'.repeat(64), 'oramus.testnet']) {
    it('transfer to ' + to.slice(0, 10) + ': bytes and signed tx identical', () => {
      const t: NearTx = { signerId: from.address, publicKey: pub, nonce: 1234567890123n, receiverId: to, blockHash: bh, amount: 10n ** 22n };
      const ref = createTransaction(from.address, NearPk.fromString('ed25519:' + base58.encode(pub)), to, 1234567890123n, [actions.transfer(10n ** 22n)], base58.decode(bh));
      const refBytes = encodeTransaction(ref);
      expect(Buffer.from(nearTransaction(t)).toString('hex')).toBe(Buffer.from(refBytes).toString('hex'));
      const pk = deriveEdPrivateKey(seed, nearC, 'testnet');
      const mine = signNear(t, pk);
      pk.fill(0);
      const signedBytes = base64.decode(mine.b64);
      const decoded = decodeSignedTransaction(signedBytes);
      expect(Buffer.from(encodeTransaction(decoded.transaction)).toString('hex')).toBe(Buffer.from(refBytes).toString('hex'));
      expect(mine.hash).toBe(base58.encode(sha256(refBytes)));
      const re = new NearSigned({ transaction: ref, signature: new NearSig({ keyType: 0, data: signedBytes.slice(-64) }) }).encode();
      expect(Buffer.from(re).toString('hex')).toBe(Buffer.from(signedBytes).toString('hex'));
    });
  }
  it('account name checks', () => {
    expect(checkNearAccount('a'.repeat(64))).toBe('a'.repeat(64));
    expect(() => checkNearAccount('A'.repeat(64))).toThrow();
    expect(checkNearAccount('alice.testnet')).toBe('alice.testnet');
    expect(() => checkNearAccount('Alice!')).toThrow();
  });
});
