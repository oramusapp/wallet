import { describe, expect, it } from 'vitest';
import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { decodeFunctionData, erc20Abi, parseTransaction, recoverTransactionAddress, type Hex } from 'viem';
import { assetById } from '../assets';
import { checkEvmAddress, erc20TransferData, signEvm, type EvmQuote } from '../send/evm';
import { checkUtxoAddress, planUtxo, signUtxo, type UtxoQuote } from '../send/utxo';
import * as bitcoin from 'bitcoinjs-lib';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { formatAmount, parseAmount, decimalStringToUnits } from '../units';
import { CHAINS } from '../../wallet/chains';
import { deriveAccount, deriveSecpPrivateKey } from '../../wallet/derive';
import { seedFromMnemonic } from '../../wallet/mnemonic';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const seed = seedFromMnemonic(M);
const evmChain = CHAINS.find((c) => c.id === 'evm')!;
const btcChain = CHAINS.find((c) => c.id === 'btc')!;

describe('amounts', () => {
  it('parses exact decimals', () => {
    expect(parseAmount('0.01', 18)).toBe(10n ** 16n);
    expect(parseAmount('1,5', 8)).toBe(150_000_000n);
    expect(parseAmount('.5', 2)).toBe(50n);
    expect(() => parseAmount('0', 8)).toThrow();
    expect(() => parseAmount('1.123456789', 8)).toThrow();
    expect(() => parseAmount('1e5', 8)).toThrow();
    expect(() => parseAmount('-1', 8)).toThrow();
  });
  it('formats', () => {
    expect(formatAmount(123_456_789n, 8)).toBe('1.23456789');
    expect(formatAmount(10n ** 18n, 18)).toBe('1');
    expect(formatAmount(1n, 18, 6)).toBe('0');
    expect(decimalStringToUnits('12.3456789', 6)).toBe(12_345_678n);
  });
});

describe('EVM', () => {
  it('address checks', () => {
    expect(checkEvmAddress('0x9858effd232b4033e47d90003d41ec34ecaeda94')).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(() => checkEvmAddress('0x9858EfFD232B4033E47d90003D41EC34EcaEda95'.replace('Ef', 'eF'))).toThrow();
    expect(() => checkEvmAddress('0x1234')).toThrow();
  });
  it('signs a tx that recovers to our address on the right chain', async () => {
    const asset = assetById('eth-sepolia')!;
    const from = deriveAccount(seed, evmChain, 'testnet').address;
    const q: EvmQuote = { to: '0x000000000000000000000000000000000000dEaD', value: 10n ** 15n, nonce: 7, gas: 21000n, maxFeePerGas: 3_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n, maxFee: 0n, fee: 0n, l1Fee: 0n, balance: 0n,
      txTo: '0x000000000000000000000000000000000000dEaD', txValue: 10n ** 15n, nativeBalance: 0n, toIsContract: false };
    const pk = deriveSecpPrivateKey(seed, evmChain, 'testnet');
    const raw = signEvm(asset, q, pk);
    pk.fill(0);
    const tx = parseTransaction(raw);
    expect(tx.chainId).toBe(11155111);
    expect(tx.nonce).toBe(7);
    expect(tx.value).toBe(10n ** 15n);
    expect(tx.to?.toLowerCase()).toBe('0x000000000000000000000000000000000000dead');
    expect(await recoverTransactionAddress({ serializedTransaction: raw as Hex & { __brand?: never } as any })).toBe(from);
  });
});

describe('ERC-20 (USDC)', () => {
  it('signs transfer(to, amount) sent to the token contract with zero ETH value', async () => {
    const asset = assetById('usdc-arb-sepolia')!;
    const from = deriveAccount(seed, evmChain, 'testnet').address;
    const to = '0x000000000000000000000000000000000000dEaD' as const;
    const q: EvmQuote = { to, value: 5_000_000n, txTo: asset.token as `0x${string}`, txValue: 0n, data: erc20TransferData(to, 5_000_000n),
      nonce: 1, gas: 60000n, maxFeePerGas: 1n, maxPriorityFeePerGas: 1n, maxFee: 0n, fee: 0n, l1Fee: 0n, balance: 0n, nativeBalance: 0n, toIsContract: false };
    const pk = deriveSecpPrivateKey(seed, evmChain, 'testnet');
    const raw = signEvm(asset, q, pk); pk.fill(0);
    const tx = parseTransaction(raw);
    expect(tx.chainId).toBe(421614);
    expect(tx.to?.toLowerCase()).toBe(asset.token!.toLowerCase());
    expect(tx.value ?? 0n).toBe(0n);
    const d = decodeFunctionData({ abi: erc20Abi, data: tx.data! });
    expect(d.functionName).toBe('transfer');
    expect((d.args![0] as string).toLowerCase()).toBe(to.toLowerCase());
    expect(d.args![1]).toBe(5_000_000n);
    expect(await recoverTransactionAddress({ serializedTransaction: raw as any })).toBe(from);
  });
  it('rejects the zero address', () => {
    expect(() => checkEvmAddress('0x0000000000000000000000000000000000000000')).toThrow();
  });
});

describe('UTXO: BTC (P2WPKH) and DOGE (P2PKH)', () => {
  const btcCfg = assetById('btc-testnet4')!.utxo!;
  const acc = deriveAccount(seed, btcChain, 'testnet');
  const utxos = [
    { txid: 'aa'.repeat(32), vout: 0, value: 30_000 },
    { txid: 'bb'.repeat(32), vout: 1, value: 50_000 }
  ];
  it('address checks', () => {
    expect(checkUtxoAddress(acc.address, btcCfg)).toBe(acc.address);
    expect(() => checkUtxoAddress('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', btcCfg)).toThrow(); // mainnet address on testnet
    expect(() => checkUtxoAddress('tb1qxyz', btcCfg)).toThrow();
    expect(() => checkUtxoAddress('DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC', assetById('btc')!.utxo!)).toThrow(); // DOGE address on BTC
  });
  it('plans inputs, fee and change', () => {
    const sel = planUtxo(utxos, hex.decode(acc.publicKey), 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', 40_000n, 2n, btcCfg);
    const ins = sel.inputs.reduce((t: bigint, i: any) => t + (i.witnessUtxo!.amount as bigint), 0n);
    const outs = sel.outputs.reduce((t: bigint, o: any) => t + o.amount, 0n);
    expect(ins - outs).toBe(sel.fee);
    expect(sel.fee! > 0n && sel.fee! < 2_000n).toBe(true);
    expect(() => planUtxo(utxos, hex.decode(acc.publicKey), acc.address, 79_990n, 2n, btcCfg)).toThrow();
  });
  it('signs a valid segwit transaction with change back to us', () => {
    const q: UtxoQuote = { to: 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', value: 40_000n, feeRate: 2n, fee: 0n, change: true, utxos, balance: 80_000n };
    q.fee = planUtxo(utxos, hex.decode(acc.publicKey), q.to, q.value, q.feeRate, btcCfg).fee!;
    const pk = deriveSecpPrivateKey(seed, btcChain, 'testnet');
    const { hex: raw, txid } = signUtxo(q, pk, btcCfg);
    pk.fill(0);
    const tx = btc.Transaction.fromRaw(hex.decode(raw));
    expect(tx.id).toBe(txid);
    expect(tx.isFinal).toBe(true);
    const outAddrs = Array.from({ length: tx.outputsLength }, (_, i) => btc.Address(btc.TEST_NETWORK).encode(btc.OutScript.decode(tx.getOutput(i).script!)));
    expect(outAddrs).toContain(q.to);
    expect(outAddrs).toContain(acc.address);
  });
  it('refuses to sign if the fee changed since the preview', () => {
    const q: UtxoQuote = { to: 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', value: 40_000n, feeRate: 2n, fee: 1n, change: true, utxos, balance: 80_000n };
    const pk = deriveSecpPrivateKey(seed, btcChain, 'testnet');
    expect(() => signUtxo(q, pk, btcCfg)).toThrow();
    pk.fill(0);
  });
  it('DOGE P2PKH: legacy signature verifies against a sighash computed by bitcoinjs-lib', () => {
    const doge = assetById('doge')!, cfg = doge.utxo!;
    const dogeChain = CHAINS.find((c) => c.id === 'doge')!;
    const me = deriveAccount(seed, dogeChain, 'mainnet');
    expect(me.address).toBe('DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC');
    const prev = new btc.Transaction();
    prev.addInput({ txid: new Uint8Array(32).fill(1), index: 0 });
    prev.addOutputAddress(me.address, 50_000_000_000n, cfg.net);
    const u = [{ txid: prev.id, vout: 0, value: 50_000_000_000, raw: hex.encode(prev.unsignedTx) }];
    const to = me.address; // sending to self is fine for the test
    const q: UtxoQuote = { to, value: 1_000_000_000n, feeRate: 1000n, fee: 0n, change: true, utxos: u, balance: 50_000_000_000n };
    q.fee = planUtxo(u, hex.decode(me.publicKey), to, q.value, q.feeRate, cfg).fee!;
    const pk = deriveSecpPrivateKey(seed, dogeChain, 'mainnet');
    const { hex: raw } = signUtxo(q, pk, cfg);
    pk.fill(0);
    const tx = bitcoin.Transaction.fromHex(raw);
    expect(tx.ins.length).toBe(1);
    const chunks = bitcoin.script.decompile(tx.ins[0].script)!;
    const sigWithType = chunks[0] as Uint8Array, pub = chunks[1] as Uint8Array;
    expect(Buffer.from(pub).toString('hex')).toBe(me.publicKey);
    const prevScript = btc.OutScript.encode(btc.Address(cfg.net).decode(me.address));
    const sighash = tx.hashForSignature(0, Buffer.from(prevScript), sigWithType[sigWithType.length - 1]);
    const der = sigWithType.slice(0, -1);
    expect(secp256k1.verify(der, sighash, pub, { prehash: false, format: 'der' })).toBe(true);
  });
});
