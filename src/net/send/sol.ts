// SOL transfer (System Program) built by hand: legacy message + one ed25519 signature.
// Layout: https://solana.com/docs/core/transactions — verified in tests against @solana/web3.js.
import { ed25519 } from '@noble/curves/ed25519.js';
import { base58, base64 } from '@scure/base';
import type { Asset } from '../assets';
import { jsonRpc } from '../balances';
import { formatAmount } from '../units';

const SYSTEM_PROGRAM = new Uint8Array(32);
const fmt = (v: bigint) => formatAmount(v, 9, 9);

function compactU16(n: number): number[] {
  const out: number[] = [];
  for (;;) { let b = n & 0x7f; n >>= 7; if (n) { out.push(b | 0x80); } else { out.push(b); return out; } }
}
function u64le(v: bigint): number[] { const o: number[] = []; for (let i = 0; i < 8; i++) { o.push(Number(v & 0xffn)); v >>= 8n; } return o; }

export function checkSolAddress(a: string): string {
  const t = a.trim();
  let b: Uint8Array;
  try { b = base58.decode(t); } catch { throw new Error('To nie jest adres Solana.'); }
  if (b.length !== 32) throw new Error('To nie jest adres Solana (zła długość).');
  return t;
}

/** Message bytes for: from -> to, `lamports`, with `blockhash`. */
export function solTransferMessage(from: string, to: string, lamports: bigint, blockhash: string): Uint8Array {
  const f = base58.decode(from), t = base58.decode(to), bh = base58.decode(blockhash);
  if (f.length !== 32 || t.length !== 32 || bh.length !== 32) throw new Error('Zły adres albo blockhash');
  const data = [2, 0, 0, 0, ...u64le(lamports)]; // SystemInstruction::Transfer = 2
  const bytes = [
    1, 0, 1, // 1 signer (from), 0 readonly signed, 1 readonly unsigned (system program)
    ...compactU16(3), ...f, ...t, ...SYSTEM_PROGRAM,
    ...bh,
    ...compactU16(1), 2, ...compactU16(2), 0, 1, ...compactU16(data.length), ...data
  ];
  return new Uint8Array(bytes);
}

export function signSol(message: Uint8Array, privateKey32: Uint8Array): string {
  const sig = ed25519.sign(message, privateKey32);
  const tx = new Uint8Array([...compactU16(1), ...sig, ...message]);
  return base64.encode(tx);
}

export interface SolQuote {
  to: string;
  value: bigint;
  fee: bigint;
  blockhash: string;
  balance: bigint;
  rentMin: bigint;
  recipientNew: boolean;
  message: Uint8Array;
}

export async function solRentMin(asset: Asset): Promise<bigint> {
  return BigInt(await jsonRpc<number>(asset.rpc!, 'getMinimumBalanceForRentExemption', [0]));
}

export async function quoteSol(asset: Asset, from: string, toRaw: string, value: bigint): Promise<SolQuote> {
  const to = checkSolAddress(toRaw);
  const rpc = asset.rpc!;
  const [bh, bal, toBal, rentMin] = await Promise.all([
    jsonRpc<{ value: { blockhash: string } }>(rpc, 'getLatestBlockhash', [{ commitment: 'confirmed' }]),
    jsonRpc<{ value: number }>(rpc, 'getBalance', [from, { commitment: 'confirmed' }]),
    jsonRpc<{ value: number }>(rpc, 'getBalance', [to, { commitment: 'confirmed' }]),
    solRentMin(asset)
  ]);
  const message = solTransferMessage(from, to, value, bh.value.blockhash);
  const feeR = await jsonRpc<{ value: number | null }>(rpc, 'getFeeForMessage', [base64.encode(message), { commitment: 'confirmed' }]);
  const fee = BigInt(feeR.value ?? 5000);
  const balance = BigInt(bal.value);
  const recipientNew = toBal.value === 0;
  if (recipientNew && value < rentMin) throw new Error('Konto odbiorcy jest puste: pierwsza wpłata musi wynosić co najmniej ' + fmt(rentMin) + ' SOL (minimum sieci Solana).');
  const after = balance - value - fee;
  if (after < 0n) throw new Error('Za mało środków: potrzeba ' + fmt(value + fee) + ' SOL razem z opłatą, masz ' + fmt(balance) + '.');
  if (after > 0n && after < rentMin) throw new Error('Na koncie musi zostać 0 albo co najmniej ' + fmt(rentMin) + ' SOL (minimum sieci). Zmniejsz kwotę albo wyślij wszystko (' + fmt(balance - fee) + ').');
  return { to, value, fee, blockhash: bh.value.blockhash, balance, rentMin, recipientNew, message };
}

export async function broadcastSol(asset: Asset, txBase64: string): Promise<string> {
  return jsonRpc<string>(asset.rpc!, 'sendTransaction', [txBase64, { encoding: 'base64', preflightCommitment: 'confirmed' }]);
}
