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
    const q = await quoteEvm(assetById(id)!, from, '0x000000000000000000000000000000000000dead', 0n);
    console.log(id, 'nonce', q.nonce, 'gas', q.gas, 'maxFee wei', q.maxFee);
    expect(q.gas > 0n && q.maxFee > 0n).toBe(true);
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
