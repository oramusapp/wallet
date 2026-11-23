// Exact decimal <-> integer conversion (no floating point for amounts).

/** "0,015" or "0.015" with `decimals` -> bigint in the smallest unit. Throws on bad input or too many decimals. */
export function parseAmount(input: string, decimals: number): bigint {
  const s = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s) && !/^\.\d+$/.test(s)) throw new Error('Wpisz kwotę, np. 0.01');
  const [i, f = ''] = s.split('.');
  if (f.length > decimals) throw new Error('Za dużo miejsc po przecinku (max ' + decimals + ')');
  const v = BigInt((i || '0') + f.padEnd(decimals, '0'));
  if (v <= 0n) throw new Error('Kwota musi być większa od zera');
  return v;
}

/** bigint -> "1.2345" (trailing zeros trimmed, at most `maxFrac` fraction digits shown, rounded down). */
export function formatAmount(v: bigint, decimals: number, maxFrac = 8): string {
  const neg = v < 0n; if (neg) v = -v;
  const base = 10n ** BigInt(decimals);
  const i = v / base;
  let f = (v % base).toString().padStart(decimals, '0').slice(0, Math.min(decimals, maxFrac)).replace(/0+$/, '');
  return (neg ? '-' : '') + i.toString() + (f ? '.' + f : '');
}

/** Decimal string from an API (e.g. "12.5") -> bigint with `decimals`; extra digits are cut, not rounded. */
export function decimalStringToUnits(s: string, decimals: number): bigint {
  const t = String(s).trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return 0n;
  const [i, f = ''] = t.split('.');
  return BigInt(i + f.slice(0, decimals).padEnd(decimals, '0'));
}
