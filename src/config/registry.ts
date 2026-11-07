import { CURATED_COINS, type Category, type Coin } from './coins';

/** Icons served by the Hyperliquid app (falls back to a lettered avatar if missing). */
const HL_ICON = (name: string) => `https://app.hyperliquid.xyz/coins/${encodeURIComponent(name)}.svg`;

export interface PerpAsset {
  name: string;
  szDecimals?: number;
  isDelisted?: boolean;
}
export interface SpotToken {
  name: string;
  index: number;
  szDecimals?: number;
}
export interface SpotPair {
  name: string;
  tokens: [number, number];
}
export interface SpotCtxLite {
  coin: string;
  dayNtlVlm: string;
}

const MEMES = new Set(['DOGE', 'PEPE', 'SHIB', 'BONK', 'FLOKI', 'WIF', 'POPCAT', 'BRETT', 'MOODENG', 'GOAT', 'PNUT', 'FARTCOIN', 'TRUMP', 'MELANIA', 'MEME', 'TURBO', 'NEIRO', 'BOME', 'PENGU', 'SPX', 'MEW', 'LUNC', 'CASHCAT', 'USELESS', 'PURR', 'HMSTR', 'PUMP']);

/** "kPEPE" → { id: "PEPE", scale: 1/1000 }; other names unchanged. */
export function unscalePerpName(name: string): { id: string; scale: number } {
  if (/^k[A-Z0-9]{2,}$/.test(name)) return { id: name.slice(1), scale: 1 / 1000 };
  return { id: name, scale: 1 };
}

function category(id: string): Category {
  if (MEMES.has(id)) return 'meme';
  if (/^USD/.test(id)) return 'stable';
  return 'other';
}

/**
 * Builds the full coin list: curated coins first, then every active perp on
 * Hyperliquid's main dex, then every USDC-quoted spot token that traded in the
 * last 24h. A symbol already listed (curated or perp) is not added again.
 */
export function buildRegistry(
  perps: PerpAsset[],
  spot: { tokens: SpotToken[]; universe: SpotPair[] },
  spotCtxs: SpotCtxLite[],
  curated: Coin[] = CURATED_COINS,
): Coin[] {
  const out: Coin[] = [...curated];
  const ids = new Set(curated.map((c) => c.id));
  const usedMarkets = new Set(curated.flatMap((c) => (c.source.kind === 'fixed' ? [] : [c.source.market])));

  for (const p of perps) {
    if (p.isDelisted || usedMarkets.has(p.name)) continue;
    const { id, scale } = unscalePerpName(p.name);
    if (ids.has(id)) continue;
    ids.add(id);
    out.push({
      id,
      symbol: id,
      name: id,
      chain: 'Hyperliquid',
      icon: HL_ICON(p.name),
      category: category(id),
      source: { kind: 'perp', market: p.name },
      priceScale: scale,
      decimals: 8,
    });
  }

  const tokenByIndex = new Map(spot.tokens.map((t) => [t.index, t]));
  const volume = new Map(spotCtxs.map((c) => [c.coin, Number(c.dayNtlVlm) || 0]));
  for (const pair of spot.universe) {
    if (pair.tokens[1] !== 0 || usedMarkets.has(pair.name)) continue; // USDC-quoted only
    if (!(volume.get(pair.name)! > 0)) continue; // skip pairs with no trading in 24h
    const base = tokenByIndex.get(pair.tokens[0]);
    if (!base || ids.has(base.name)) continue;
    ids.add(base.name);
    out.push({
      id: base.name,
      symbol: base.name,
      // fullName is free text set by the deployer, so the ticker is used instead
      name: base.name,
      chain: 'Hyperliquid',
      icon: HL_ICON(`${base.name}_USDC`),
      category: category(base.name),
      source: { kind: 'spot', market: pair.name },
      priceScale: 1,
      decimals: Math.min(8, Math.max(2, base.szDecimals ?? 8)),
    });
  }
  return out;
}
