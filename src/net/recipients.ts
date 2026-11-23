// Guards against sending to the wrong address: known recipients, look-alike addresses
// ("address poisoning": a scam address with the same start and end as one you used), readable chunks.

const norm = (a: string, caseInsensitive: boolean) => (caseInsensitive ? a.trim().toLowerCase() : a.trim());
const body = (a: string) => a.replace(/^(0x|tb1q|bc1q|tltc1q|ltc1q)/i, '');

export function isKnown(list: string[], addr: string, caseInsensitive: boolean): boolean {
  const n = norm(addr, caseInsensitive);
  return list.some((x) => norm(x, caseInsensitive) === n);
}

/** A saved address that shares the first and last 4 characters but is NOT the same address. */
export function lookAlike(list: string[], addr: string, caseInsensitive: boolean): string | null {
  const n = norm(addr, caseInsensitive), b = body(n);
  for (const x of list) {
    const m = norm(x, caseInsensitive), c = body(m);
    if (m !== n && c.slice(0, 4) === b.slice(0, 4) && c.slice(-4) === b.slice(-4)) return x;
  }
  return null;
}

/** "0x 9858 EfFD 232B …" — groups of 4 for reading aloud / comparing ("0x" kept apart so EVM groups are even). */
export function chunks(addr: string, size = 4): string[] {
  const out: string[] = [];
  let rest = addr;
  if (/^0x/i.test(addr)) { out.push(addr.slice(0, 2)); rest = addr.slice(2); }
  for (let i = 0; i < rest.length; i += size) out.push(rest.slice(i, i + size));
  return out;
}

/** The user types the last characters of the address to prove they compared it with the source. */
export function lastCharsMatch(addr: string, typed: string, n = 4, caseInsensitive = true): boolean {
  const want = addr.trim().slice(-n), got = typed.trim();
  return got.length === n && (caseInsensitive ? want.toLowerCase() === got.toLowerCase() : want === got);
}
