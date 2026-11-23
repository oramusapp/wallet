// Read-only checks of every mainnet endpoint (balances, limits/fees) with the public test mnemonic. Sends nothing.
import { it, expect } from 'vitest';
import { MAINNET_ASSETS } from '../../src/net/assets';
import { fetchBalance } from '../../src/net/balances';
import { getLimits } from '../../src/net/limits';
import { deriveAll } from '../../src/wallet/derive';
import { seedFromMnemonic } from '../../src/wallet/mnemonic';
const acc = Object.fromEntries(deriveAll(seedFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'), 'mainnet').map(a => [a.chainId, a.address]));
for (const a of MAINNET_ASSETS.filter(x => x.kind !== 'none')) {
  it('mainnet ' + a.id, async () => {
    const v = await fetchBalance(a, acc[a.chainId]);
    const l = a.kind === 'hl' ? null : await getLimits(a, acc[a.chainId]).catch((e) => ({ lines: ['limits error: ' + (e as Error).message] }));
    console.log(a.id.padEnd(14), String(v).padEnd(24), l ? l.lines.join(' | ').slice(0, 140) : '');
    expect(typeof v).toBe('bigint');
  }, 40000);
}
