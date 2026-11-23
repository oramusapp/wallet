import { it, expect } from 'vitest';
import { assetById } from '../../src/net/assets';
import { quoteEvm } from '../../src/net/send/evm';
import { quoteBtc } from '../../src/net/send/btc';
import { CHAINS } from '../../src/wallet/chains';
import { deriveAccount } from '../../src/wallet/derive';
import { seedFromMnemonic } from '../../src/wallet/mnemonic';
const seed = seedFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
for (const id of ['eth-sepolia', 'eth-arb-sepolia', 'eth-base-sepolia']) {
  it('evm quote ' + id, async () => {
    const from = deriveAccount(seed, CHAINS[0], 'testnet').address;
    // Either a full quote, or the app's own "not enough ETH for the fee" stop (the shared test wallet is nearly empty).
    try {
      const q = await quoteEvm(assetById(id)!, from, '0x000000000000000000000000000000000000dead', 0n);
      console.log(id, 'nonce', q.nonce, 'gas', q.gas, 'maxFee wei', q.maxFee);
      expect(q.gas > 0n && q.maxFee > 0n).toBe(true);
    } catch (e) { console.log(id, (e as Error).message); expect((e as Error).message).toMatch(/Za mało ETH/); }
  }, 30000);
}
it('btc quote reaches the node (no funds -> clear error)', async () => {
  const a = deriveAccount(seed, CHAINS.find(c => c.id === 'btc')!, 'testnet');
  await expect(quoteBtc(assetById('btc-testnet4')!, a.address, a.publicKey, 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', 10_000n)).rejects.toThrow(/Za mało/);
}, 30000);
import { getLimits } from '../../src/net/limits';
import { quoteSol } from '../../src/net/send/sol';
import { ASSETS } from '../../src/net/assets';
for (const a of ASSETS.filter(x => ['evm', 'btc', 'sol', 'xlm', 'algo'].includes(x.kind))) {
  it('limits ' + a.id, async () => {
    const from = deriveAccount(seed, CHAINS.find(c => c.id === a.chainId)!, 'testnet').address;
    const l = await getLimits(a, from);
    console.log(a.id, l.lines.join(' | '));
    expect(l.lines.length).toBeGreaterThan(0);
  }, 30000);
}
it('sol quote: new-account minimum enforced', async () => {
  const from = deriveAccount(seed, CHAINS.find(c => c.id === 'sol')!, 'testnet').address;
  await expect(quoteSol(assetById('sol-devnet')!, from, 'Hn5mVTp8dGfqmZPT6XcW8HnoCbNUoe6jLm3uRT2Sm3Hf', 1000n)).rejects.toThrow(/puste|Za mało/i);
}, 30000);
for (const id of ['usdc-arb-sepolia', 'usdc-base-sepolia']) {
  it('erc20 balance + quote ' + id, async () => {
    const a = assetById(id)!;
    const from = deriveAccount(seed, CHAINS[0], 'testnet').address;
    const { fetchBalance } = await import('../../src/net/balances');
    const bal = await fetchBalance(a, from);
    console.log(id, 'USDC balance', bal);
    // With USDC: reaches the fee check (gas estimated for transfer) — quote or "not enough ETH for the fee". Without: "Za mało".
    await quoteEvm(a, from, '0x000000000000000000000000000000000000dead', 1n).then(
      (q) => expect(q.data?.startsWith('0xa9059cbb')).toBe(true),
      (e) => { console.log(id, (e as Error).message); expect((e as Error).message).toMatch(bal > 0n ? /na opłatę/ : /Za mało/); });
  }, 30000);
}
import { quoteXlm } from '../../src/net/send/xlm';
import { quoteAlgo } from '../../src/net/send/algo';
it('xlm quote (live)', async () => {
  const from = deriveAccount(seed, CHAINS.find(c => c.id === 'xlm')!, 'testnet').address;
  await quoteXlm(assetById('xlm-testnet')!, from, 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', 20_000_000n, 'test').then(
    (q) => { console.log('xlm', 'create', q.recipientNew, 'fee', q.fee, 'seq', q.tx.seq, 'minBal', q.minBalance); expect(q.fee > 0n).toBe(true); },
    (e) => { console.log('xlm', (e as Error).message); expect((e as Error).message).toMatch(/nie istnieje|musi zostać|Za mało/); });
}, 30000);
it('algo quote (live)', async () => {
  const from = deriveAccount(seed, CHAINS.find(c => c.id === 'algo')!, 'testnet').address;
  await quoteAlgo(assetById('algo-testnet')!, from, 'EP2D7TV7IAFANZHK3B6QLKB53N5UTD7RARVXZTWCPCRQQBKYVGM2XIMT2Q'.replace('EP2D', 'EP2D'), 200_000n).then(
    (q) => { console.log('algo', 'fee', q.fee, 'fv', q.tx.firstValid, 'gen', q.tx.genesisId, 'new', q.recipientNew); expect(q.tx.genesisId).toBe('testnet-v1.0'); },
    (e) => { console.log('algo', (e as Error).message); expect((e as Error).message).toMatch(/musi zostać|puste/); });
}, 30000);
