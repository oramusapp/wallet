/** Parses a user-typed amount ("1,5", "0.25", ".5"). Returns NaN for invalid input. */
export function parseAmount(s: string): number {
  const t = s.trim().replace(',', '.');
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return NaN;
  return Number(t);
}

/** Keeps only characters valid in a decimal amount, limited to `decimals` fraction digits. */
export function sanitizeAmountInput(s: string, decimals: number): string {
  let t = s.replace(',', '.').replace(/[^\d.]/g, '');
  const i = t.indexOf('.');
  if (i !== -1) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
  if (i !== -1 && decimals >= 0) t = t.slice(0, i + 1 + decimals);
  if (decimals === 0) t = t.replace('.', '');
  return t;
}

/** Converts `amount` of A into B at the given USD prices, minus a fee in basis points. */
export function quoteSwap(amount: number, fromPrice: number, toPrice: number, feeBps = 0): number {
  if (!(amount > 0) || !(fromPrice > 0) || !(toPrice > 0)) return 0;
  return ((amount * fromPrice) / toPrice) * (1 - feeBps / 10_000);
}

export type AddressCheck = { ok: true } | { ok: false; reason: string };

/** Light format check per chain. Not a checksum validation. */
export function checkAddress(chain: string, addr: string): AddressCheck {
  const a = addr.trim();
  if (!a) return { ok: false, reason: 'Enter a recipient address' };
  const rules: Record<string, RegExp> = {
    Bitcoin: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
    Ethereum: /^0x[0-9a-fA-F]{40}$/,
    Hyperliquid: /^0x[0-9a-fA-F]{40}$/,
    Solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    'XRP Ledger': /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
    Sui: /^0x[0-9a-fA-F]{64}$/,
    Dogecoin: /^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/,
    Zcash: /^(t1|t3)[1-9A-HJ-NP-Za-km-z]{33}$|^(zs1|u1)[0-9a-z]{40,}$/,
    Monero: /^[48][1-9A-HJ-NP-Za-km-z]{94}$/,
  };
  const re = rules[chain];
  if (re && !re.test(a)) return { ok: false, reason: `Not a valid ${chain} address` };
  return { ok: true };
}
