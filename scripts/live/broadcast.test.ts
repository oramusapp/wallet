// Real broadcast on public testnets with the well-known test mnemonic (worthless test coins), sending to itself.
// Run only on purpose: LIVE=1 BROADCAST=1 NODE_USE_ENV_PROXY=1 npx vitest run scripts/live/broadcast.test.ts
import { it, expect } from 'vitest';
import { assetById } from '../../src/net/assets';
import { CHAINS } from '../../src/wallet/chains';
import { deriveAccount, deriveEdPrivateKey } from '../../src/wallet/derive';
import { seedFromMnemonic } from '../../src/wallet/mnemonic';
import { quoteXlm, signXlm, broadcastXlm } from '../../src/net/send/xlm';
import { quoteAlgo, signAlgo, broadcastAlgo } from '../../src/net/send/algo';
const seed = seedFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
const run = process.env.BROADCAST ? it : it.skip;
run('ALGO self-transfer accepted by testnet', async () => {
  const c = CHAINS.find(x => x.id === 'algo')!; const me = deriveAccount(seed, c, 'testnet').address;
  const q = await quoteAlgo(assetById('algo-testnet')!, me, me, 1000n);
  const pk = deriveEdPrivateKey(seed, c, 'testnet'); const blob = signAlgo(q.tx, pk); pk.fill(0);
  const id = await broadcastAlgo(assetById('algo-testnet')!, blob);
  console.log('ALGO txid', id); expect(id.length).toBe(52);
}, 60000);
run('XLM self-payment accepted by testnet', async () => {
  const c = CHAINS.find(x => x.id === 'xlm')!; const me = deriveAccount(seed, c, 'testnet').address;
  const q = await quoteXlm(assetById('xlm-testnet')!, me, me, 1n, 'oramus test');
  const pk = deriveEdPrivateKey(seed, c, 'testnet'); const env = signXlm(q.tx, pk); pk.fill(0);
  const h = await broadcastXlm(assetById('xlm-testnet')!, env);
  console.log('XLM hash', h); expect(h.length).toBe(64);
}, 60000);
