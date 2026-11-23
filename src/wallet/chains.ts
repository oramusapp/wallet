// Networks for groups A, B and C (coins from the SKB Portfolio list, app/src/lib/tokens.ts).
// Derivation paths follow Trust Wallet Core, so the same 24 words restore every address there too.
export type Network = 'testnet' | 'mainnet';
export type Curve = 'secp256k1' | 'ed25519';
export type Group = 'A' | 'B' | 'C';

export type AddressKind =
  | { type: 'evm' }
  | { type: 'p2wpkh'; hrp: Record<Network, string> }
  | { type: 'p2pkh'; version: Record<Network, number[]> }
  | { type: 'solana' }
  | { type: 'sui' }
  | { type: 'aptos' }
  | { type: 'near' }
  | { type: 'stellar' }
  | { type: 'algorand' };

export interface ChainDef {
  id: string;
  name: string;
  group: Group;
  curve: Curve;
  path: Record<Network, string>;
  address: AddressKind;
  /** Coins from the portfolio list held on this network (native coin first). */
  coins: string[];
  /** Sending is not built yet for this network (shown in the app). */
  sendLater?: string;
}

const evmPath = { testnet: "m/44'/60'/0'/0/0", mainnet: "m/44'/60'/0'/0/0" };

export const CHAINS: ChainDef[] = [
  // Group A — one key and one address on every EVM network
  { id: 'evm', name: 'EVM (Ethereum, Arbitrum, Optimism, Base, BNB Chain, Avalanche, HyperEVM, Monad, Plasma)', group: 'A', curve: 'secp256k1', path: evmPath, address: { type: 'evm' },
    coins: ['ETH', 'PEPE', 'SHIB', 'CRV', 'LINK', 'AAVE', 'UNI', 'PENDLE', 'ONDO', 'ENA', 'PAXG', 'WLFI', 'ZRO', 'LIT', 'ARB', 'OP', 'WLD', 'AERO', 'BNB', 'ASTER', 'AVAX', 'HYPE', 'MON', 'XPL', 'USDC', 'USDT'] },
  // Group B — Bitcoin-like (UTXO)
  { id: 'btc', name: 'Bitcoin', group: 'B', curve: 'secp256k1', path: { mainnet: "m/84'/0'/0'/0/0", testnet: "m/84'/1'/0'/0/0" }, address: { type: 'p2wpkh', hrp: { mainnet: 'bc', testnet: 'tb' } }, coins: ['BTC'] },
  { id: 'ltc', name: 'Litecoin', group: 'B', curve: 'secp256k1', path: { mainnet: "m/84'/2'/0'/0/0", testnet: "m/84'/1'/0'/0/0" }, address: { type: 'p2wpkh', hrp: { mainnet: 'ltc', testnet: 'tltc' } }, coins: ['LTC'] },
  { id: 'doge', name: 'Dogecoin', group: 'B', curve: 'secp256k1', path: { mainnet: "m/44'/3'/0'/0/0", testnet: "m/44'/1'/0'/0/0" }, address: { type: 'p2pkh', version: { mainnet: [0x1e], testnet: [0x71] } }, coins: ['DOGE'] },
  { id: 'dash', name: 'Dash', group: 'B', curve: 'secp256k1', path: { mainnet: "m/44'/5'/0'/0/0", testnet: "m/44'/1'/0'/0/0" }, address: { type: 'p2pkh', version: { mainnet: [0x4c], testnet: [0x8c] } }, coins: ['DASH'] },
  { id: 'zec', name: 'Zcash (adres jawny t1)', group: 'B', curve: 'secp256k1', path: { mainnet: "m/44'/133'/0'/0/0", testnet: "m/44'/1'/0'/0/0" }, address: { type: 'p2pkh', version: { mainnet: [0x1c, 0xb8], testnet: [0x1d, 0x25] } }, coins: ['ZEC'],
    sendLater: 'Zcash podpisuje transakcje inaczej niż Bitcoin; wysyłka w osobnym etapie.' },
  // Group C — ed25519 networks
  { id: 'sol', name: 'Solana', group: 'C', curve: 'ed25519', path: { mainnet: "m/44'/501'/0'", testnet: "m/44'/501'/0'" }, address: { type: 'solana' }, coins: ['SOL', 'FARTCOIN', 'PUMP'] },
  { id: 'sui', name: 'Sui', group: 'C', curve: 'ed25519', path: { mainnet: "m/44'/784'/0'/0'/0'", testnet: "m/44'/784'/0'/0'/0'" }, address: { type: 'sui' }, coins: ['SUI'] },
  { id: 'apt', name: 'Aptos', group: 'C', curve: 'ed25519', path: { mainnet: "m/44'/637'/0'/0'/0'", testnet: "m/44'/637'/0'/0'/0'" }, address: { type: 'aptos' }, coins: ['APT'] },
  { id: 'near', name: 'NEAR', group: 'C', curve: 'ed25519', path: { mainnet: "m/44'/397'/0'", testnet: "m/44'/397'/0'" }, address: { type: 'near' }, coins: ['NEAR'] },
  { id: 'xlm', name: 'Stellar', group: 'C', curve: 'ed25519', path: { mainnet: "m/44'/148'/0'", testnet: "m/44'/148'/0'" }, address: { type: 'stellar' }, coins: ['XLM'] },
  { id: 'algo', name: 'Algorand', group: 'C', curve: 'ed25519', path: { mainnet: "m/44'/283'/0'/0'/0'", testnet: "m/44'/283'/0'/0'/0'" }, address: { type: 'algorand' }, coins: ['ALGO'] }
];

export const chainById = (id: string) => CHAINS.find((c) => c.id === id);
