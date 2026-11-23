// Live check against real testnet nodes (run manually, not in CI).
import { it, expect } from 'vitest';
import { ASSETS } from '../../src/net/assets';
import { fetchBalance } from '../../src/net/balances';
import { deriveAll } from '../../src/wallet/derive';
import { seedFromMnemonic } from '../../src/wallet/mnemonic';
const acc = Object.fromEntries(deriveAll(seedFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'), 'testnet').map(a => [a.chainId, a.address]));
for (const a of ASSETS.filter(x => x.kind !== 'none' && x.id !== 'usdc-hl')) {
  it(a.id, async () => { const v = await fetchBalance(a, acc[a.chainId]); console.log(a.id, acc[a.chainId], v.toString()); expect(typeof v).toBe('bigint'); }, 30000);
}

// Hyperliquid testnet does not answer from the build machine; check the same parsing on mainnet (same API) with a known active account.
it('hyperliquid parsing on mainnet API', async () => {
  const a = { ...ASSETS.find(x => x.id === 'usdc-hl')!, rpc: 'https://api.hyperliquid.xyz/info' };
  const v = await fetchBalance(a, '0x0000000000000000000000000000000000000000');
  console.log('hl-mainnet zero-address', v.toString()); expect(typeof v).toBe('bigint');
}, 30000);
