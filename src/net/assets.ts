// Everything the wallet shows and can send, for both networks.
// Testnet: worthless test coins. Mainnet: real money — only in builds signed with the private release key.
import type { Network } from '../wallet/chains';
import { NETS, type UtxoCfg } from './send/utxo';

export type AssetKind = 'evm' | 'erc20' | 'hl' | 'utxo' | 'sol' | 'sui' | 'apt' | 'near' | 'xlm' | 'algo' | 'none';

export interface Asset {
  id: string;
  net: Network;
  symbol: string;
  name: string;
  /** Which derived account holds it (chains.ts id). */
  chainId: string;
  network: string;
  decimals: number;
  kind: AssetKind;
  color: string;
  /** JSON-RPC / REST / GraphQL base for balances and sending. */
  rpc?: string;
  evmChainId?: number;
  /** ERC-20 contract (kind 'erc20'); the fee is paid in the network's native coin (feeSymbol). */
  token?: string;
  feeSymbol?: string;
  /** OP-stack chain (Base, Optimism): an extra L1 data fee is charged on top of gas × price. */
  opStack?: boolean;
  utxo?: UtxoCfg;
  aptChainId?: number;
  xlmPassphrase?: string;
  explorerTx?: (hash: string) => string;
  explorerAddr?: (addr: string) => string;
  canSend: boolean;
  faucet?: string;
  note?: string;
  /** Added by the user (custom ERC-20). */
  custom?: boolean;
}

type EvmDef = { id: string; symbol: string; name: string; network: string; chainId: number; rpc: string; color: string; scan: string; opStack?: boolean; faucet?: string };
function evm(net: Network, d: EvmDef): Asset {
  return { id: d.id, net, symbol: d.symbol, name: d.name, chainId: 'evm', network: d.network, decimals: 18, kind: 'evm', color: d.color, rpc: d.rpc,
    evmChainId: d.chainId, opStack: d.opStack, canSend: true, faucet: d.faucet,
    explorerTx: (h) => d.scan + '/tx/' + h, explorerAddr: (a) => d.scan + '/address/' + a };
}
/** An ERC-20 token on the network of `parent` (an 'evm' asset). */
export function erc20(parent: Asset, id: string, symbol: string, name: string, decimals: number, token: string, color = '#2775ca', custom = false): Asset {
  const scan = parent.explorerAddr!('X').replace(/\/address\/X$/, '');
  return { ...parent, id, symbol, name, decimals, kind: 'erc20', color, token, feeSymbol: parent.symbol, custom,
    explorerAddr: (a) => scan + '/token/' + token + '?a=' + a, faucet: undefined, note: undefined };
}

// ---------------- TESTNET ----------------
const sepolia = evm('testnet', { id: 'eth-sepolia', symbol: 'ETH', name: 'Ethereum', network: 'Sepolia', chainId: 11155111, rpc: 'https://ethereum-sepolia-rpc.publicnode.com', color: '#7b8cff', scan: 'https://sepolia.etherscan.io', faucet: 'https://www.alchemy.com/faucets/ethereum-sepolia' });
const arbSepolia = evm('testnet', { id: 'eth-arb-sepolia', symbol: 'ETH', name: 'Ethereum', network: 'Arbitrum Sepolia', chainId: 421614, rpc: 'https://sepolia-rollup.arbitrum.io/rpc', color: '#2d9cdb', scan: 'https://sepolia.arbiscan.io' });
const baseSepolia = evm('testnet', { id: 'eth-base-sepolia', symbol: 'ETH', name: 'Ethereum', network: 'Base Sepolia', chainId: 84532, rpc: 'https://sepolia.base.org', color: '#3b6cff', scan: 'https://sepolia.basescan.org', opStack: true });

export const TESTNET_ASSETS: Asset[] = [
  sepolia, arbSepolia, baseSepolia,
  // USDC test tokens — addresses from Circle's docs, symbol/decimals checked on-chain
  { ...erc20(arbSepolia, 'usdc-arb-sepolia', 'USDC', 'USD Coin', 6, '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'), faucet: 'https://faucet.circle.com' },
  { ...erc20(baseSepolia, 'usdc-base-sepolia', 'USDC', 'USD Coin', 6, '0x036CbD53842c5426634e7929541eC2318f3dCF7e'), faucet: 'https://faucet.circle.com' },
  { id: 'usdc-hl', net: 'testnet', symbol: 'USDC', name: 'Konto Hyperliquid', chainId: 'evm', network: 'Hyperliquid testnet', decimals: 6, kind: 'hl', color: '#50e3c2',
    rpc: 'https://api.hyperliquid-testnet.xyz/info', canSend: false, explorerAddr: (a) => 'https://app.hyperliquid-testnet.xyz/explorer/address/' + a,
    note: 'Saldo konta (perpy + spot). Wpłaty: stary most Hyperliquid jest wycofany (deprecated), zalecany jest Circle CCTP.' },
  { id: 'btc-testnet4', net: 'testnet', symbol: 'BTC', name: 'Bitcoin', chainId: 'btc', network: 'Testnet4', decimals: 8, kind: 'utxo', color: '#f7931a', canSend: true,
    utxo: { api: 'mempool', base: 'https://mempool.space/testnet4/api', net: NETS.btcTest, segwit: true, dust: 546n },
    explorerTx: (h) => 'https://mempool.space/testnet4/tx/' + h, explorerAddr: (a) => 'https://mempool.space/testnet4/address/' + a, faucet: 'https://mempool.space/testnet4/faucet' },
  { id: 'ltc-testnet', net: 'testnet', symbol: 'LTC', name: 'Litecoin', chainId: 'ltc', network: 'Testnet', decimals: 8, kind: 'utxo', color: '#bebebe', canSend: true,
    utxo: { api: 'mempool', base: 'https://litecoinspace.org/testnet/api', net: NETS.ltcTest, segwit: true, dust: 546n },
    explorerTx: (h) => 'https://litecoinspace.org/testnet/tx/' + h, explorerAddr: (a) => 'https://litecoinspace.org/testnet/address/' + a },
  { id: 'sol-devnet', net: 'testnet', symbol: 'SOL', name: 'Solana', chainId: 'sol', network: 'Devnet', decimals: 9, kind: 'sol', color: '#9945ff',
    rpc: 'https://api.devnet.solana.com', canSend: true, explorerTx: (h) => 'https://explorer.solana.com/tx/' + h + '?cluster=devnet', explorerAddr: (a) => 'https://explorer.solana.com/address/' + a + '?cluster=devnet', faucet: 'https://faucet.solana.com' },
  { id: 'sui-testnet', net: 'testnet', symbol: 'SUI', name: 'Sui', chainId: 'sui', network: 'Testnet', decimals: 9, kind: 'sui', color: '#4da2ff',
    rpc: 'https://graphql.testnet.sui.io/graphql', canSend: true, explorerTx: (h) => 'https://suiscan.xyz/testnet/tx/' + h, explorerAddr: (a) => 'https://suiscan.xyz/testnet/account/' + a },
  { id: 'apt-testnet', net: 'testnet', symbol: 'APT', name: 'Aptos', chainId: 'apt', network: 'Testnet', decimals: 8, kind: 'apt', color: '#2ed8a3', aptChainId: 2,
    rpc: 'https://api.testnet.aptoslabs.com/v1', canSend: true, explorerTx: (h) => 'https://explorer.aptoslabs.com/txn/' + h + '?network=testnet', explorerAddr: (a) => 'https://explorer.aptoslabs.com/account/' + a + '?network=testnet' },
  { id: 'near-testnet', net: 'testnet', symbol: 'NEAR', name: 'NEAR', chainId: 'near', network: 'Testnet', decimals: 24, kind: 'near', color: '#c9d1d9',
    rpc: 'https://rpc.testnet.near.org', canSend: true, explorerTx: (h) => 'https://testnet.nearblocks.io/txns/' + h, explorerAddr: (a) => 'https://testnet.nearblocks.io/address/' + a },
  { id: 'xlm-testnet', net: 'testnet', symbol: 'XLM', name: 'Stellar', chainId: 'xlm', network: 'Testnet', decimals: 7, kind: 'xlm', color: '#e6e6e6', xlmPassphrase: 'Test SDF Network ; September 2015',
    rpc: 'https://horizon-testnet.stellar.org', canSend: true, explorerTx: (h) => 'https://stellar.expert/explorer/testnet/tx/' + h, explorerAddr: (a) => 'https://stellar.expert/explorer/testnet/account/' + a,
    note: 'Konto Stellar powstaje dopiero po pierwszej wpłacie (min. 1 XLM). Przy wpłacie na giełdę zwykle trzeba podać memo.' },
  { id: 'algo-testnet', net: 'testnet', symbol: 'ALGO', name: 'Algorand', chainId: 'algo', network: 'Testnet', decimals: 6, kind: 'algo', color: '#bfbfbf',
    rpc: 'https://testnet-api.algonode.cloud', canSend: true, explorerTx: (h) => 'https://lora.algokit.io/testnet/transaction/' + h, explorerAddr: (a) => 'https://lora.algokit.io/testnet/account/' + a },
  { id: 'doge-testnet', net: 'testnet', symbol: 'DOGE', name: 'Dogecoin', chainId: 'doge', network: 'Testnet', decimals: 8, kind: 'none', color: '#c2a633', canSend: false, note: 'Brak publicznego API testnetu. W sieci głównej saldo i wysyłka działają.' },
  { id: 'dash-testnet', net: 'testnet', symbol: 'DASH', name: 'Dash', chainId: 'dash', network: 'Testnet', decimals: 8, kind: 'none', color: '#008de4', canSend: false, note: 'Brak publicznego API testnetu. W sieci głównej saldo i wysyłka działają.' },
  { id: 'zec-testnet', net: 'testnet', symbol: 'ZEC', name: 'Zcash', chainId: 'zec', network: 'Testnet', decimals: 8, kind: 'none', color: '#f4b728', canSend: false, note: 'Tylko adres: Zcash podpisuje transakcje innym formatem (ZIP-244).' }
];

// ---------------- MAINNET (real funds) ----------------
const eth = evm('mainnet', { id: 'eth', symbol: 'ETH', name: 'Ethereum', network: 'Ethereum', chainId: 1, rpc: 'https://ethereum-rpc.publicnode.com', color: '#7b8cff', scan: 'https://etherscan.io' });
const arb = evm('mainnet', { id: 'eth-arb', symbol: 'ETH', name: 'Ethereum', network: 'Arbitrum', chainId: 42161, rpc: 'https://arb1.arbitrum.io/rpc', color: '#2d9cdb', scan: 'https://arbiscan.io' });
const base = evm('mainnet', { id: 'eth-base', symbol: 'ETH', name: 'Ethereum', network: 'Base', chainId: 8453, rpc: 'https://mainnet.base.org', color: '#3b6cff', scan: 'https://basescan.org', opStack: true });
const op = evm('mainnet', { id: 'eth-op', symbol: 'ETH', name: 'Ethereum', network: 'Optimism', chainId: 10, rpc: 'https://mainnet.optimism.io', color: '#ff0420', scan: 'https://optimistic.etherscan.io', opStack: true });
const bsc = evm('mainnet', { id: 'bnb', symbol: 'BNB', name: 'BNB', network: 'BNB Chain', chainId: 56, rpc: 'https://bsc-rpc.publicnode.com', color: '#f3ba2f', scan: 'https://bscscan.com' });
const avax = evm('mainnet', { id: 'avax', symbol: 'AVAX', name: 'Avalanche', network: 'Avalanche C-Chain', chainId: 43114, rpc: 'https://api.avax.network/ext/bc/C/rpc', color: '#e84142', scan: 'https://snowtrace.io' });
const hyperevm = evm('mainnet', { id: 'hype', symbol: 'HYPE', name: 'Hyperliquid', network: 'HyperEVM', chainId: 999, rpc: 'https://rpc.hyperliquid.xyz/evm', color: '#50e3c2', scan: 'https://hyperscan.com' });

export const MAINNET_ASSETS: Asset[] = [
  eth, arb, base, op, bsc, avax, hyperevm,
  // USDC — mainnet addresses from Circle's docs (developers.circle.com/stablecoins/usdc-contract-addresses)
  erc20(eth, 'usdc-eth', 'USDC', 'USD Coin', 6, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  erc20(arb, 'usdc-arb', 'USDC', 'USD Coin', 6, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'),
  erc20(base, 'usdc-base', 'USDC', 'USD Coin', 6, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  erc20(avax, 'usdc-avax', 'USDC', 'USD Coin', 6, '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'),
  erc20(hyperevm, 'usdc-hyperevm', 'USDC', 'USD Coin', 6, '0xb88339CB7199b77E23DB6E890353E22632Ba630f'),
  { id: 'usdc-hl-main', net: 'mainnet', symbol: 'USDC', name: 'Konto Hyperliquid', chainId: 'evm', network: 'Hyperliquid', decimals: 6, kind: 'hl', color: '#50e3c2',
    rpc: 'https://api.hyperliquid.xyz/info', canSend: false, explorerAddr: (a) => 'https://app.hyperliquid.xyz/explorer/address/' + a,
    note: 'Saldo konta (perpy + spot). Wpłaty przez CCTP nie są jeszcze w aplikacji; stary most jest wycofany.' },
  { id: 'btc', net: 'mainnet', symbol: 'BTC', name: 'Bitcoin', chainId: 'btc', network: 'Bitcoin', decimals: 8, kind: 'utxo', color: '#f7931a', canSend: true,
    utxo: { api: 'mempool', base: 'https://mempool.space/api', net: NETS.btcMain, segwit: true, dust: 546n },
    explorerTx: (h) => 'https://mempool.space/tx/' + h, explorerAddr: (a) => 'https://mempool.space/address/' + a },
  { id: 'ltc', net: 'mainnet', symbol: 'LTC', name: 'Litecoin', chainId: 'ltc', network: 'Litecoin', decimals: 8, kind: 'utxo', color: '#bebebe', canSend: true,
    utxo: { api: 'mempool', base: 'https://litecoinspace.org/api', net: NETS.ltcMain, segwit: true, dust: 546n },
    explorerTx: (h) => 'https://litecoinspace.org/tx/' + h, explorerAddr: (a) => 'https://litecoinspace.org/address/' + a },
  { id: 'doge', net: 'mainnet', symbol: 'DOGE', name: 'Dogecoin', chainId: 'doge', network: 'Dogecoin', decimals: 8, kind: 'utxo', color: '#c2a633', canSend: true,
    utxo: { api: 'blockcypher', base: 'https://api.blockcypher.com/v1/doge/main', net: NETS.dogeMain, segwit: false, dust: 1_000_000n },
    explorerTx: (h) => 'https://blockchair.com/dogecoin/transaction/' + h, explorerAddr: (a) => 'https://blockchair.com/dogecoin/address/' + a,
    note: 'Saldo i wysyłka przez publiczne API BlockCypher (limit zapytań na godzinę).' },
  { id: 'dash', net: 'mainnet', symbol: 'DASH', name: 'Dash', chainId: 'dash', network: 'Dash', decimals: 8, kind: 'utxo', color: '#008de4', canSend: true,
    utxo: { api: 'blockcypher', base: 'https://api.blockcypher.com/v1/dash/main', net: NETS.dashMain, segwit: false, dust: 546n },
    explorerTx: (h) => 'https://blockchair.com/dash/transaction/' + h, explorerAddr: (a) => 'https://blockchair.com/dash/address/' + a,
    note: 'Saldo i wysyłka przez publiczne API BlockCypher (limit zapytań na godzinę).' },
  { id: 'sol', net: 'mainnet', symbol: 'SOL', name: 'Solana', chainId: 'sol', network: 'Solana', decimals: 9, kind: 'sol', color: '#9945ff',
    rpc: 'https://api.mainnet-beta.solana.com', canSend: true, explorerTx: (h) => 'https://explorer.solana.com/tx/' + h, explorerAddr: (a) => 'https://explorer.solana.com/address/' + a },
  { id: 'sui', net: 'mainnet', symbol: 'SUI', name: 'Sui', chainId: 'sui', network: 'Sui', decimals: 9, kind: 'sui', color: '#4da2ff',
    rpc: 'https://graphql.mainnet.sui.io/graphql', canSend: true, explorerTx: (h) => 'https://suiscan.xyz/mainnet/tx/' + h, explorerAddr: (a) => 'https://suiscan.xyz/mainnet/account/' + a },
  { id: 'apt', net: 'mainnet', symbol: 'APT', name: 'Aptos', chainId: 'apt', network: 'Aptos', decimals: 8, kind: 'apt', color: '#2ed8a3', aptChainId: 1,
    rpc: 'https://api.mainnet.aptoslabs.com/v1', canSend: true, explorerTx: (h) => 'https://explorer.aptoslabs.com/txn/' + h + '?network=mainnet', explorerAddr: (a) => 'https://explorer.aptoslabs.com/account/' + a + '?network=mainnet' },
  { id: 'near', net: 'mainnet', symbol: 'NEAR', name: 'NEAR', chainId: 'near', network: 'NEAR', decimals: 24, kind: 'near', color: '#c9d1d9',
    rpc: 'https://rpc.mainnet.fastnear.com', canSend: true, explorerTx: (h) => 'https://nearblocks.io/txns/' + h, explorerAddr: (a) => 'https://nearblocks.io/address/' + a },
  { id: 'xlm', net: 'mainnet', symbol: 'XLM', name: 'Stellar', chainId: 'xlm', network: 'Stellar', decimals: 7, kind: 'xlm', color: '#e6e6e6', xlmPassphrase: 'Public Global Stellar Network ; September 2015',
    rpc: 'https://horizon.stellar.org', canSend: true, explorerTx: (h) => 'https://stellar.expert/explorer/public/tx/' + h, explorerAddr: (a) => 'https://stellar.expert/explorer/public/account/' + a,
    note: 'Konto Stellar powstaje dopiero po pierwszej wpłacie (min. 1 XLM). Przy wpłacie na giełdę zwykle trzeba podać memo.' },
  { id: 'algo', net: 'mainnet', symbol: 'ALGO', name: 'Algorand', chainId: 'algo', network: 'Algorand', decimals: 6, kind: 'algo', color: '#bfbfbf',
    rpc: 'https://mainnet-api.algonode.cloud', canSend: true, explorerTx: (h) => 'https://lora.algokit.io/mainnet/transaction/' + h, explorerAddr: (a) => 'https://lora.algokit.io/mainnet/account/' + a },
  { id: 'zec', net: 'mainnet', symbol: 'ZEC', name: 'Zcash', chainId: 'zec', network: 'Zcash', decimals: 8, kind: 'none', color: '#f4b728', canSend: false, note: 'Tylko adres (t1…): Zcash podpisuje transakcje innym formatem (ZIP-244). Środki odzyskasz tymi samymi słowami w Trust Wallet.' }
];

export const ASSETS: Asset[] = [...TESTNET_ASSETS, ...MAINNET_ASSETS];
export const assetsFor = (net: Network, custom: Asset[] = []) => [...ASSETS.filter((a) => a.net === net), ...custom.filter((a) => a.net === net)];
export const assetById = (id: string) => ASSETS.find((a) => a.id === id);
export const evmParents = (net: Network) => ASSETS.filter((a) => a.net === net && a.kind === 'evm');
