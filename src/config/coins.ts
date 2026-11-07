export type CoinId =
  | 'BTC'
  | 'ETH'
  | 'SOL'
  | 'USDC'
  | 'USDT'
  | 'HYPE'
  | 'ZEC'
  | 'XMR'
  | 'LINK'
  | 'XRP'
  | 'SUI'
  | 'DOGE'
  | 'PEPE';

export type Category = 'major' | 'stable' | 'meme' | 'privacy';

export interface Coin {
  id: CoinId;
  symbol: string;
  name: string;
  chain: string;
  icon: string;
  category: Category;
  /**
   * Hyperliquid market used as the price source.
   * - perp: name from `meta.universe` (e.g. "BTC", "kPEPE")
   * - spot: pair id from `spotMeta.universe` (e.g. "@166" = USDT0/USDC)
   * - fixed: no market, price is pinned (USDC is Hyperliquid's quote asset)
   */
  source: { kind: 'perp'; market: string } | { kind: 'spot'; market: string } | { kind: 'fixed'; price: number };
  /** Hyperliquid quotes some assets in thousands (kPEPE = 1000 PEPE). */
  priceScale: number;
  /**
   * Approximate circulating supply, used only to estimate market cap
   * (Hyperliquid does not publish market caps). Edit as needed.
   */
  approxSupply: number;
  /** Decimals shown when entering amounts. */
  decimals: number;
}

const icon = (f: string) => `./coins/${f}.png`;

export const COINS: Coin[] = [
  { id: 'BTC', symbol: 'BTC', name: 'Bitcoin', chain: 'Bitcoin', icon: icon('btc'), category: 'major', source: { kind: 'perp', market: 'BTC' }, priceScale: 1, approxSupply: 19.95e6, decimals: 8 },
  { id: 'ETH', symbol: 'ETH', name: 'Ethereum', chain: 'Ethereum', icon: icon('eth'), category: 'major', source: { kind: 'perp', market: 'ETH' }, priceScale: 1, approxSupply: 120.7e6, decimals: 8 },
  { id: 'SOL', symbol: 'SOL', name: 'Solana', chain: 'Solana', icon: icon('sol'), category: 'major', source: { kind: 'perp', market: 'SOL' }, priceScale: 1, approxSupply: 560e6, decimals: 9 },
  { id: 'HYPE', symbol: 'HYPE', name: 'Hyperliquid', chain: 'Hyperliquid', icon: icon('hype'), category: 'major', source: { kind: 'perp', market: 'HYPE' }, priceScale: 1, approxSupply: 340e6, decimals: 6 },
  { id: 'USDC', symbol: 'USDC', name: 'USD Coin', chain: 'Ethereum', icon: icon('usdc'), category: 'stable', source: { kind: 'fixed', price: 1 }, priceScale: 1, approxSupply: 75e9, decimals: 6 },
  { id: 'USDT', symbol: 'USDT', name: 'Tether', chain: 'Ethereum', icon: icon('usdt'), category: 'stable', source: { kind: 'spot', market: '@166' }, priceScale: 1, approxSupply: 183e9, decimals: 6 },
  { id: 'ZEC', symbol: 'ZEC', name: 'Zcash', chain: 'Zcash', icon: icon('zec'), category: 'privacy', source: { kind: 'perp', market: 'ZEC' }, priceScale: 1, approxSupply: 16.5e6, decimals: 8 },
  { id: 'XMR', symbol: 'XMR', name: 'Monero', chain: 'Monero', icon: icon('xmr'), category: 'privacy', source: { kind: 'perp', market: 'XMR' }, priceScale: 1, approxSupply: 18.45e6, decimals: 8 },
  { id: 'LINK', symbol: 'LINK', name: 'Chainlink', chain: 'Ethereum', icon: icon('link'), category: 'major', source: { kind: 'perp', market: 'LINK' }, priceScale: 1, approxSupply: 700e6, decimals: 6 },
  { id: 'XRP', symbol: 'XRP', name: 'XRP', chain: 'XRP Ledger', icon: icon('xrp'), category: 'major', source: { kind: 'perp', market: 'XRP' }, priceScale: 1, approxSupply: 60.5e9, decimals: 6 },
  { id: 'SUI', symbol: 'SUI', name: 'Sui', chain: 'Sui', icon: icon('sui'), category: 'major', source: { kind: 'perp', market: 'SUI' }, priceScale: 1, approxSupply: 3.9e9, decimals: 6 },
  { id: 'DOGE', symbol: 'DOGE', name: 'Dogecoin', chain: 'Dogecoin', icon: icon('doge'), category: 'meme', source: { kind: 'perp', market: 'DOGE' }, priceScale: 1, approxSupply: 151e9, decimals: 4 },
  { id: 'PEPE', symbol: 'PEPE', name: 'Pepe', chain: 'Ethereum', icon: icon('pepe'), category: 'meme', source: { kind: 'perp', market: 'kPEPE' }, priceScale: 1 / 1000, approxSupply: 420.69e12, decimals: 0 },
];

export const COIN_BY_ID = Object.fromEntries(COINS.map((c) => [c.id, c])) as Record<CoinId, Coin>;

export const CHAINS = Array.from(new Set(COINS.map((c) => c.chain)));

/** Default coin for "Add Cash". */
export const CASH_COIN: CoinId = 'USDC';

/** Stablecoins are shown together as Cash, never in the Tokens list. */
export const CASH_COINS: CoinId[] = ['USDC', 'USDT'];

export const isCash = (id: CoinId): boolean => CASH_COINS.includes(id);

export const MARKET_FILTERS: { id: 'all' | Category | 'fav'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'major', label: 'Majors' },
  { id: 'stable', label: 'Stables' },
  { id: 'meme', label: 'Memes' },
  { id: 'privacy', label: 'Privacy' },
];
