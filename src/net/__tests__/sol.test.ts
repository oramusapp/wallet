import { describe, expect, it } from 'vitest';
import { Transaction, SystemProgram, SystemInstruction, PublicKey, Keypair } from '@solana/web3.js';
import { base64 } from '@scure/base';
import { ed25519 } from '@noble/curves/ed25519.js';
import { checkSolAddress, signSol, solTransferMessage } from '../send/sol';
import { CHAINS } from '../../wallet/chains';
import { deriveAccount, deriveEdPrivateKey } from '../../wallet/derive';
import { seedFromMnemonic } from '../../wallet/mnemonic';

const seed = seedFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
const sol = CHAINS.find((c) => c.id === 'sol')!;
const BH = 'EMvKm1Lwz3WnhREdxqfuvCkJR5nN4ewUjn3fukcj9ikR';

describe('Solana transfer (checked independently with @solana/web3.js)', () => {
  it('message is byte-identical to web3.js', () => {
    const from = deriveAccount(seed, sol, 'testnet').address;
    const to = Keypair.fromSeed(new Uint8Array(32).fill(9)).publicKey.toBase58();
    const ref = new Transaction({ feePayer: new PublicKey(from), recentBlockhash: BH })
      .add(SystemProgram.transfer({ fromPubkey: new PublicKey(from), toPubkey: new PublicKey(to), lamports: 1_234_567 }));
    const mine = solTransferMessage(from, to, 1_234_567n, BH);
    expect(Buffer.from(mine).toString('hex')).toBe(ref.serializeMessage().toString('hex'));
  });
  it('signature verifies and the signed tx parses back to the same transfer', () => {
    const from = deriveAccount(seed, sol, 'testnet').address;
    const to = Keypair.fromSeed(new Uint8Array(32).fill(7)).publicKey.toBase58();
    const msg = solTransferMessage(from, to, 5_000_000n, BH);
    const pk = deriveEdPrivateKey(seed, sol, 'testnet');
    const tx = Transaction.from(base64.decode(signSol(msg, pk)));
    pk.fill(0);
    expect(tx.verifySignatures()).toBe(true);
    const ix = SystemInstruction.decodeTransfer(tx.instructions[0]);
    expect(ix.fromPubkey.toBase58()).toBe(from);
    expect(ix.toPubkey.toBase58()).toBe(to);
    expect(BigInt(ix.lamports)).toBe(5_000_000n);
  });
  it('rejects bad addresses', () => {
    expect(() => checkSolAddress('0x9858EfFD232B4033E47d90003D41EC34EcaEda94')).toThrow();
    expect(() => checkSolAddress('abc')).toThrow();
    expect(checkSolAddress(' GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL ')).toBe('GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL');
  });
  it('derived key matches the shown address', () => {
    const pk = deriveEdPrivateKey(seed, sol, 'testnet');
    expect(Keypair.fromSeed(pk).publicKey.toBase58()).toBe(deriveAccount(seed, sol, 'testnet').address);
    expect(ed25519.getPublicKey(pk).length).toBe(32);
    pk.fill(0);
  });
});
