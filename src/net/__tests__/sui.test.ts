import { describe, expect, it } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { base58, base64 } from '@scure/base';
import { checkSuiAddress, signSui, suiTransactionData, type SuiTx } from '../send/sui';
import { CHAINS } from '../../wallet/chains';
import { deriveAccount, deriveEdPrivateKey } from '../../wallet/derive';
import { seedFromMnemonic } from '../../wallet/mnemonic';

const seed = seedFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
const c = CHAINS.find((x) => x.id === 'sui')!;

describe('Sui (checked against @mysten/sui)', () => {
  const from = deriveAccount(seed, c, 'testnet').address;
  const to = '0x' + '7c'.repeat(32);
  const gas = [
    { objectId: '0x' + '11'.repeat(32), version: 123456n, digest: base58.encode(new Uint8Array(32).fill(9)) },
    { objectId: '0x' + '22'.repeat(32), version: 7n, digest: base58.encode(new Uint8Array(32).fill(4)) }
  ];
  const t: SuiTx = { from, to, amount: 1_500_000_000n, gas, gasPrice: 1000n, gasBudget: 5_000_000n };
  it('transaction bytes and signature identical to the SDK', async () => {
    const tx = new Transaction();
    tx.setSender(from); tx.setGasPrice(1000); tx.setGasBudget(5_000_000);
    tx.setGasPayment(gas.map((g) => ({ objectId: g.objectId, version: g.version.toString(), digest: g.digest })));
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1_500_000_000n)]);
    tx.transferObjects([coin], tx.pure.address(to));
    const ref = await tx.build();
    expect(Buffer.from(suiTransactionData(t)).toString('hex')).toBe(Buffer.from(ref).toString('hex'));
    const pk = deriveEdPrivateKey(seed, c, 'testnet');
    const kp = Ed25519Keypair.fromSecretKey(pk);
    expect(kp.toSuiAddress()).toBe(from);
    const sdkSig = (await kp.signTransaction(ref)).signature;
    const mine = signSui(t, pk);
    pk.fill(0);
    expect(mine.signature).toBe(sdkSig);
    expect(mine.txBytes).toBe(base64.encode(ref));
  });
  it('address checks', () => {
    expect(() => checkSuiAddress('0x2')).toThrow();
    expect(checkSuiAddress(from).length).toBe(32);
  });
});
